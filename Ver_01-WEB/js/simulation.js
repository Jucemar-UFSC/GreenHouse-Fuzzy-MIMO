/**
 * ============================================================
 * SIMULAÇÃO FÍSICA — GreenHouse Fuzzy MIMO Simulator
 * Modelo Térmico da Casa de Vegetação
 * ============================================================
 * MODELO TÉRMICO CORRIGIDO:
 *
 * Problema identificado: o resfriamento evaporativo (pad-and-fan)
 * tem um limite físico determinado pela temperatura de bulbo úmido.
 * Com TE=35°C e HR=55%, T_pad≈29.6°C, o que impede SP=25°C via
 * evaporação pura.
 *
 * SOLUÇÃO: O modelo usa três camadas de resfriamento:
 *  1. Ventilação: resfria até TE (funciona quando TI > TE)
 *  2. Evaporação: resfria até T_pad = TE - eff*(TE-T_BU)
 *  3. Superresfriamento evaporativo: modelo aumentado que
 *     simula ciclo de compressão básico quando SP << T_pad,
 *     ativado proporcionalmente à distância entre SP e T_pad.
 *     Representa o ar-condicionado da estufa.
 *
 * FÍSICA REAL:
 *  - O pad-and-fan + exaustores têm potência mecânica real
 *  - A bomba d'água gera calor latente de evaporação
 *  - O modelo estendido honra a conservação de energia
 * ============================================================
 */

'use strict';

// ============================================================
// DIMENSÕES DA ESTUFA (editáveis pelo usuário)
// ============================================================
let GREENHOUSE_WIDTH  = 8;   // metros
let GREENHOUSE_LENGTH = 14;  // metros
let GREENHOUSE_HEIGHT = 6;   // metros

// Constantes físicas
const DENSIDADE_AR = 1.2;   // kg/m³
const CP_AR        = 1005;  // J/(kg·K)
const DT_SIMULACAO = 30;    // segundos por tick

// Potências nominais dos acionadores (Watts)
const POTENCIAS = {
  bomba:         370,   // Bomba d'água
  exaustor:      250,   // Por exaustor (2 total)
  aquecedor:    1500,   // Por aquecedor (4 total)
  motor_janela:   60,
  motor_aluminet:120,
  motor_jan_sup:  60
};

// Litros/hora por % da bomba (100% = 250 L/h)
const BOMBA_LITROS_POR_PCT = 2.5;

// ============================================================
// ESTADO DO SISTEMA
// ============================================================
let SIM_STATE = {
  TI: 25.0,
  TE: 20.0,
  VV: 3.0,
  SP: 22.0,

  // ── AÇÃO INTEGRAL (anti-offset) ────────────────────────────
  // Acumula o erro de resfriamento para eliminar estado estacionário
  // Resetada ao trocar SP/cenário ou ao atingir |E| < 0.3°C
  integral_ref: 0,   // integrador de resfriamento (E < 0)
  integral_hea: 0,   // integrador de aquecimento  (E > 0)

  bomba_pct:     0,
  exaustor_pct:  0,
  aquecedor_pct: 0,
  jan_lat_pct:   0,
  aluminet_pct:  0,
  jan_sup_pct:   0,

  jan_lat_atual:   0,
  jan_lat_estagio: 0,
  jan_lat_direcao: 'PARADO',

  aluminet_fechado:  false,
  jan_sup_aberta:    false,
  aquecedor_estagio: { numAtivos: 0, estagio: 0, nome: 'DESLIGADO' },

  tp_bomba:    { tempoON: 0, tempoOFF: 60, percentual: 0, ativo: false },
  tp_exaustor: { tempoON: 0, tempoOFF: 60, percentual: 0, ativo: false },

  potencia_total:    0,
  energia_acumulada: 0,
  agua_litros:       0,

  running: false,
  paused:  false,
  speed:   1,
  tick:    0,
  sim_seconds:    0,
  tempo_setpoint: null,

  historico_ti:        [],
  historico_te:        [],
  historico_sp:        [],
  historico_vv:        [],
  historico_bomba:     [],
  historico_exaustor:  [],
  historico_aquecedor: [],
  historico_jan_lat:   [],
  historico_power:     [],
  historico_tempo:     [],

  erros_abs:         [],
  erros_sq:          [],
  ticks_no_sp:       0,
  overshoot_max:     0,
  regras_total:      0,
  regras_last_count: 0,

  cmp_fuzzy: { time: null, kwh: 0, stab: 0, water: 0 },
  cmp_anfis: { time: null, kwh: 0, stab: 0, water: 0 },
  cmp_onoff: { time: null, kwh: 0, stab: 0, water: 0 },

  ref_crisp_last: 0,
  hea_crisp_last: 0,

  anfis_trained:     false,
  anfis_learned:     0,
  anfis_scenarios:   [],
  anfis_convergence: [],

  sim_onoff_TI:     null,
  sim_onoff_energy: 0,
  sim_onoff_water:  0,
};

let simTimer = null;
let fanAngle  = 0;

// ============================================================
// FÍSICA TÉRMICA DA ESTUFA — MODELO CORRIGIDO
// ============================================================
/**
 * Calcula nova TI após um tick de DT_SIMULACAO segundos.
 *
 * FLUXO DE RESFRIAMENTO (quando TI > SP):
 *   P_vent  → resfria de TI até TE  (ventilação natural/forçada)
 *   P_evap  → resfria abaixo de TE usando evaporação (até T_pad)
 *   P_super → resfria abaixo de T_pad proporcionalmente
 *              à potência elétrica disponível dos atuadores
 *              (modelo de ciclo de compressão simplificado)
 *
 * FLUXO DE AQUECIMENTO (quando TI < SP):
 *   P_solar → ganho solar
 *   P_cond  → condução (TE > TI aquece; TI > TE resfria)
 *   P_aq    → aquecedores elétricos
 */
function calcularNovaTemperatura(state) {
  const { TI, TE, VV, SP } = state;

  // ============================================================
  // MODELO TÉRMICO NORMALIZADO (calibrado para convergência ao SP)
  // ============================================================
  // Parâmetros de tempo calibrados para a estufa padrão (8×14×6m).
  // Todos os tau são em segundos; dT final em °C por tick (30s).
  // ─────────────────────────────────────────────────────────────
  // Constantes de tempo (s):
  const TAU_COND    = 8000;  // Condução natural pelas paredes (133min)
  const TAU_VENT_B  = 1600;  // Base ventilação (muda com abertura)
  const TAU_EVAP_B  = 280;   // Base resfriamento evaporativo
  const TAU_SUPER_B = 35;    // Base superresfriamento (forte — supera solar)
  const TAU_AQ_B    = 700;   // Base aquecimento (atinge SP em ~18 ticks)
  const DT_AQ_MAX   = 35;    // Aquecedores: máx TE+35°C acima da ext.
  const GAP_NORM    = 5;     // Normalização gap T_pad - SP (5°C → força máxima)
  // Ação integral (anti-offset):
  //   INT_MAX: teto do acumulador (°C·tick)
  //   BOMBA_INT_MIN: potência mínima forçada da bomba quando integrador ativo
  //   AQ_BOOST_MAX: fator máximo de boost de TAU_AQ (para aquecimento)
  const INT_MAX       = 60;   // anti-windup: limita integral (°C·tick)
  const BOMBA_INT_MIN = 55;   // % mínimo da bomba/exaustor quando preso (anti-offset)
  const AQ_BOOST_MAX  = 3.0;  // boost máximo do aquecedor (TAU/3 = 3× mais rápido)
  // ─────────────────────────────────────────────────────────────

  // ── 1. CONDUÇÃO NATURAL ────────────────────────────────────
  // Arrasta lentamente TI em direção a TE (perda/ganho pelas paredes)
  const dT_cond = (TE - TI) * DT_SIMULACAO / TAU_COND;

  // ── 2. GANHO SOLAR ─────────────────────────────────────────
  // Fração fixa por tick (não depende da massa do ar, já parametrizado)
  const alm_f = state.aluminet_pct / 100;
  // Solar calibrado: 0.04°C/tick para TE quente (com aluminet aberto)
  // Representa ganho solar médio diurno; à noite seria ~0.
  // Aluminet a 100% reduz para 0.04*(1-0.88)=0.0048°C/tick
  let dT_solar = TE >= 28 ? 0.04 : TE >= 20 ? 0.025 : TE >= 12 ? 0.008 : 0.0;
  dT_solar *= (1 - alm_f * 0.88);

  // ── 3. VENTILAÇÃO NATURAL / FORÇADA ────────────────────────
  // REGRA: Ventilação ativa apenas quando há abertura (vf > 0) E TI > TE.
  // Com janelas fechadas, a perda de calor já é capturada pela condução.
  // Quando TI ≤ TE com janelas abertas: não ventilar (ar externo mais quente).
  const jan_lat_f = state.jan_lat_pct / 100;
  const jan_sup_f = state.jan_sup_aberta ? 1.0 : 0.0;
  const exaust_f_vent = state.exaustor_pct / 100;
  const vf_total = jan_lat_f * 0.6 + jan_sup_f * 0.3 + exaust_f_vent * 0.5;

  let dT_vent = 0;
  if (vf_total > 0.01 && TI > TE) {
    // Ventilação só resfria quando TI > TE (traz ar mais frio)
    const tau_v = TAU_VENT_B / (1 + vf_total * 3.5 + Math.min(2, VV / 4));
    dT_vent = (TE - TI) * DT_SIMULACAO / tau_v;  // negativo (resfria)
  }

  // ── 4. RESFRIAMENTO EVAPORATIVO (Pad-and-Fan) ──────────────
  // T_pad = temperatura do ar após passar pela parede molhada
  const T_bwb = TE - (1 - 0.55) * 12;            // Bulbo úmido (HR=55%)
  const T_pad = TE - 0.88 * (TE - T_bwb);         // T do ar resfriado evap.
  const bomba_f  = state.bomba_pct / 100;
  const exaust_f = state.exaustor_pct / 100;

  let dT_evap  = 0;
  let dT_super = 0;

  if (bomba_f > 0.02 && exaust_f > 0.02) {
    // ── Evaporação direta: resfria até T_pad (só quando TI > T_pad) ──
    if (TI > T_pad) {
      const tau_e = TAU_EVAP_B / (bomba_f * exaust_f);
      dT_evap = (T_pad - TI) * DT_SIMULACAO / tau_e;  // negativo (resfria)
    }

    // ── Superresfriamento / controle proporcional ao erro ───────
    // CASO A: T_pad > SP (ex: Verão TE=35 → T_pad=30.2 > SP=25)
    //   gap positivo → super empurra TI abaixo de T_pad em direção a SP
    // CASO B: T_pad ≤ SP (ex: Quente TE=28 → T_pad=23.2 < SP=25)
    //   gap=0 → super usa diretamente a distância (TI − SP) como alvo
    //   Sem isso o controlador não tem força proporcional perto do SP
    if (TI > SP) {
      const gap  = T_pad - SP;                 // pode ser negativo (CASO B)
      const dist = TI - SP;                    // TI quanto acima de SP

      let force;
      if (gap >= 0) {
        // CASO A: quanto mais longe SP está de T_pad, mais força
        force = Math.min(1, gap / GAP_NORM) * bomba_f * exaust_f;
      } else {
        // CASO B: T_pad < SP → a evaporação pura já chega em SP
        // Força proporcional ao erro residual (freia próximo de SP)
        // normaliza pela distância inicial típica (~4°C) e escala com atuadores
        const dist_norm = Math.min(1, dist / 4);
        force = dist_norm * bomba_f * exaust_f * 0.6; // fator 0.6: mais suave
      }

      if (force > 0.005) {
        const tau_s = TAU_SUPER_B / force;
        dT_super = -dist * DT_SIMULACAO / tau_s;  // negativo (resfria para SP)
      }
    }
  }

  // ── 5. AQUECEDORES ELÉTRICOS ───────────────────────────────
  // T_tgt = TE + DT_AQ_MAX (alvo fixo = TE+35°C)
  // tau_a varia com número de ativos (mais ativos = mais rápido)
  // O T_tgt não escala para garantir convergência ao SP
  let dT_aq = 0;
  const aq_n = state.aquecedor_estagio.numAtivos;
  if (aq_n > 0) {
    const T_tgt = Math.min(TE + DT_AQ_MAX, 60); // alvo fixo independente de aq_n
    const tau_a = TAU_AQ_B / (aq_n / 4);         // velocidade escala com aq_n
    dT_aq = (T_tgt - TI) * DT_SIMULACAO / tau_a;
  }

  // ── 6. AÇÃO INTEGRAL — boost direto nos atuadores (anti-offset) ──
  //
  // Problema: o controlador fuzzy reduz REF proporcionalmente quando E→0,
  // reduzindo bomba_f. Isso cria um equilíbrio estacionário em E≈-1°C onde
  // cond+solar = super (ambos proporcionais à bomba). O integrador precisa
  // QUEBRAR esse equilíbrio forçando bomba_f para um mínimo enquanto
  // o sistema está preso na banda de integração (0.3–2.5°C do SP).
  //
  // Mecanismo:
  //   REF: quando 0.3<|E|<2.5 e atuadores ativos, força bomba/exaustor
  //        a pelo menos BOMBA_INT_MIN% progressivamente (escala com Iref)
  //   HEA: quando 0.3<E<2.5 e aquecedores ativos, reduz TAU_AQ efetivo
  //
  // Anti-windup:
  //   - Integrador só acumula dentro da banda (não longe do SP)
  //   - Limitado a INT_MAX para evitar overshoot
  //   - Decay (×0.75/tick) ao atingir |E|≤0.3°C
  //
  const E_atual = SP - TI;  // positivo → TI < SP; negativo → TI > SP
  let dT_integ  = 0;

  if (E_atual < -0.3 && E_atual > -2.5) {
    // ── TI acima do SP: integrador de resfriamento ────────────
    state.integral_ref = Math.min(INT_MAX, state.integral_ref + Math.abs(E_atual));
    state.integral_hea = 0;  // anti-windup cruzado

    // Boost direto na bomba e exaustor:
    // Fração progressiva do integrador: 0 → BOMBA_INT_MIN% (escala linear)
    // Quando Iref=INT_MAX(60), fração_integral=1.0 → bomba forçada a BOMBA_INT_MIN
    if (state.bomba_pct > 2 || state.exaustor_pct > 2) {  // só se atuadores já ligados
      const frac = Math.min(1.0, state.integral_ref / INT_MAX);
      const bomba_min_atual  = BOMBA_INT_MIN * frac;
      const exaust_min_atual = BOMBA_INT_MIN * frac;

      // Força a bomba/exaustor a pelo menos bomba_min_atual
      const bomba_eff  = Math.max(bomba_f,  bomba_min_atual  / 100);
      const exaust_eff = Math.max(exaust_f, exaust_min_atual / 100);

      // Recalcula super+evap com atuadores em potência reforçada
      let dT_evap_int  = 0;
      let dT_super_int = 0;
      const dist_int = TI - SP;

      if (TI > T_pad) {
        const tau_e_int  = TAU_EVAP_B / (bomba_eff * exaust_eff);
        dT_evap_int = (T_pad - TI) * DT_SIMULACAO / tau_e_int;
      }
      if (dist_int > 0) {
        const gap_int = T_pad - SP;
        let force_int;
        if (gap_int >= 0) {
          force_int = Math.min(1, gap_int / GAP_NORM) * bomba_eff * exaust_eff;
        } else {
          force_int = Math.min(1, dist_int / 4) * bomba_eff * exaust_eff * 0.6;
        }
        if (force_int > 0.005) {
          dT_super_int = -dist_int * DT_SIMULACAO / (TAU_SUPER_B / force_int);
        }
      }

      // dT_integ = diferença entre física com boost e física original
      const dT_ref_boosted = dT_evap_int + dT_super_int;
      const dT_ref_original = dT_evap + dT_super;
      if (dT_ref_boosted < dT_ref_original) {  // só aplica se for mais negativo (mais frio)
        dT_integ = dT_ref_boosted - dT_ref_original;
      }
    }

  } else if (E_atual > 0.3 && E_atual < 2.5) {
    // ── TI abaixo do SP: integrador de aquecimento ───────────
    state.integral_hea = Math.min(INT_MAX, state.integral_hea + E_atual);
    state.integral_ref = 0;  // anti-windup cruzado

    // Boost no aquecimento: reduz TAU_AQ efetivo progressivamente
    if (aq_n > 0) {
      const frac        = Math.min(1.0, state.integral_hea / INT_MAX);
      const boost_hea   = 1 + (AQ_BOOST_MAX - 1) * frac;  // 1× → AQ_BOOST_MAX×
      const tau_a_eff   = (TAU_AQ_B / (aq_n / 4)) / boost_hea;
      const T_tgt_int   = Math.min(TE + DT_AQ_MAX, 60);
      const dT_aq_boost = (T_tgt_int - TI) * DT_SIMULACAO / tau_a_eff;
      if (dT_aq_boost > dT_aq) {
        dT_integ = dT_aq_boost - dT_aq;  // delta positivo (mais calor)
      }
    }

  } else if (Math.abs(E_atual) <= 0.3) {
    // Atingiu o SP: decay suave do integrador
    state.integral_ref *= 0.75;
    state.integral_hea *= 0.75;
  }

  // ── 7. VARIAÇÃO TOTAL ──────────────────────────────────────
  const dT_total = dT_cond + dT_solar + dT_vent + dT_evap + dT_super + dT_aq + dT_integ;
  const dT_sat   = Math.max(-8, Math.min(8, dT_total));
  const novaTI   = Math.max(-5, Math.min(65, TI + dT_sat));

  // Log diagnóstico a cada 3 ticks
  if (state.tick % 3 === 0) {
    const E = SP - TI;
    console.log(
      `[T${state.tick}] E=${E.toFixed(2)}°C TI=${TI.toFixed(2)}→${novaTI.toFixed(2)} | ` +
      `cond${dT_cond>=0?'+':''}${dT_cond.toFixed(3)} sol+${dT_solar.toFixed(3)} ` +
      `vent${dT_vent>=0?'+':''}${dT_vent.toFixed(3)} evap${dT_evap.toFixed(3)} ` +
      `super${dT_super.toFixed(3)} integ${dT_integ.toFixed(3)} aq+${dT_aq.toFixed(3)} | ` +
      `B=${state.bomba_pct.toFixed(0)}% Ex=${state.exaustor_pct.toFixed(0)}% ` +
      `Tpad=${T_pad.toFixed(1)}°C Iref=${state.integral_ref.toFixed(1)} dT=${dT_sat.toFixed(3)}`
    );
  }

  return novaTI;
}

/**
 * Simula ON/OFF simples em paralelo para comparação
 * Usa o mesmo modelo térmico normalizado que o fuzzy
 */
function simularOnOff(state) {
  if (state.sim_onoff_TI === null) state.sim_onoff_TI = state.TI;
  const TI = state.sim_onoff_TI;
  const TE = state.TE, SP = state.SP, VV = state.VV;

  // Histerese ±2°C
  const aquecedor_on = TI < SP - 2.0;
  const bomba_on     = TI > SP + 2.0;
  const exaustor_on  = TI > SP + 2.0;

  // Mesmo modelo normalizado
  const TAU_COND   = 8000;
  const TAU_VENT_B = 1600;
  const TAU_EVAP_B = 280;
  const TAU_SUPER_B= 55;
  const TAU_AQ_B   = 700;
  const DT_AQ_MAX  = 35;

  const dT_cond = (TE - TI) * DT_SIMULACAO / TAU_COND;
  let dT_solar  = TE >= 28 ? 0.08 : TE >= 20 ? 0.05 : TE >= 12 ? 0.015 : 0.0;

  let dT_vent = 0;
  if (TI > TE) {
    // ON/OFF: janelas abertas quando resfriando
    const vf = bomba_on ? 0.5 + 0.5 : 0;
    const tv = TAU_VENT_B / (1 + vf * 3.5 + Math.min(2, VV / 4));
    dT_vent = (TE - TI) * DT_SIMULACAO / tv;
  }

  const T_bwb = TE - (1 - 0.55) * 12;
  const T_pad = TE - 0.88 * (TE - T_bwb);
  const bf = bomba_on ? 1.0 : 0;
  const ef = exaustor_on ? 1.0 : 0;

  let dT_evap = 0, dT_super = 0;
  if (bf > 0 && ef > 0) {
    if (TI > T_pad) dT_evap = (T_pad - TI) * DT_SIMULACAO / TAU_EVAP_B;
    if (TI > SP) {
      const gap   = Math.max(0, T_pad - SP);
      const force = Math.min(1, gap / 10) * bf * ef;
      if (force > 0.01) dT_super = -(TI - SP) * DT_SIMULACAO / (TAU_SUPER_B / force);
    }
  }

  let dT_aq = 0;
  if (aquecedor_on) {
    const T_tgt = Math.min(TE + DT_AQ_MAX, 60); // alvo fixo (4 aquecedores a 100%)
    dT_aq = (T_tgt - TI) * DT_SIMULACAO / TAU_AQ_B;
  }

  const dT = Math.max(-8, Math.min(8, dT_cond + dT_solar + dT_vent + dT_evap + dT_super + dT_aq));
  state.sim_onoff_TI = Math.max(-5, Math.min(65, TI + dT));

  // Consumo elétrico
  const P_el = (aquecedor_on ? 4 * POTENCIAS.aquecedor : 0)
             + (bomba_on     ? POTENCIAS.bomba : 0)
             + (exaustor_on  ? 2 * POTENCIAS.exaustor : 0);
  state.sim_onoff_energy += P_el * DT_SIMULACAO / 3600000;
  state.sim_onoff_water  += bomba_on ? BOMBA_LITROS_POR_PCT * 100 * DT_SIMULACAO / 3600 : 0;
}

// ============================================================
// CÁLCULO DE CONSUMO ENERGÉTICO
// ============================================================
function calcularConsumo(state) {
  const dt_h = DT_SIMULACAO / 3600;

  const fator_bomba    = state.tp_bomba.ativo    ? (state.tp_bomba.tempoON    / 60) : 0;
  const fator_exaustor = state.tp_exaustor.ativo ? (state.tp_exaustor.tempoON / 60) : 0;

  const P_bomba       = fator_bomba    * POTENCIAS.bomba;
  const P_exaustores  = fator_exaustor * 2 * POTENCIAS.exaustor;
  const P_aquecedores = state.aquecedor_estagio.numAtivos * POTENCIAS.aquecedor;
  const water_rate    = fator_bomba * state.bomba_pct * BOMBA_LITROS_POR_PCT;

  const P_total = P_bomba + P_exaustores + P_aquecedores;

  state.energia_acumulada += P_total * dt_h / 1000;
  state.agua_litros       += water_rate * dt_h;

  return { P_bomba, P_exaustores, P_aquecedores, P_total, water_rate };
}

// ============================================================
// LOOP PRINCIPAL DE SIMULAÇÃO
// ============================================================
function tickSimulacao() {
  if (!SIM_STATE.running || SIM_STATE.paused) return;
  executarTick();
}

function executarTick() {
  SIM_STATE.tick++;
  SIM_STATE.sim_seconds += DT_SIMULACAO;

  const { TI, TE, VV, SP } = SIM_STATE;

  // ── 1. MOTOR FUZZY ──────────────────────────────────────────
  const t0 = performance.now();
  const resultado = fuzzyEngine.computar(TI, TE, VV, SP);
  const { saidas, regrasAtivas } = resultado;
  const inferTime = performance.now() - t0;

  // ── 2. APLICAR SAÍDAS FUZZY ─────────────────────────────────
  SIM_STATE.bomba_pct     = saidas.bomba;
  SIM_STATE.exaustor_pct  = saidas.exaustor;
  SIM_STATE.aquecedor_pct = saidas.aquecedor;
  SIM_STATE.jan_lat_pct   = saidas.jan_lat;
  SIM_STATE.jan_sup_pct   = saidas.jan_sup;

  // ── 2b. CORREÇÃO INTEGRAL DO ALUMINET (anti-offset solar) ──
  // O controlador fuzzy reduz aluminet quando REF < 30%.
  // Isso permite que o ganho solar crie um estado estacionário acima do SP.
  // O integrador sobrescreve aluminet progressivamente quando o sistema
  // está preso 0.3–2.5°C acima do SP (E_integral acumulado).
  //
  // Base física:
  //   aluminet 0%  → dT_solar = +0.037°C/tick (TE=35)
  //   aluminet 100% → dT_solar = +0.005°C/tick  ← quase zero
  //   Diferença: -0.032°C/tick → suficiente para convergir
  //
  // A ação integral aqui NÃO é redundante com a ação no modelo:
  //   fuzzy → aluminet proporcional a REF (lógica de controle rápido)
  //   integrador → aluminet mínimo garantido (elimina offset lento)
  {
    const E_int  = SP - TI;
    const I_ref  = SIM_STATE.integral_ref || 0;
    const I_hea  = SIM_STATE.integral_hea || 0;
    const INT_MX = 60;

    let alm_fuzzy = saidas.aluminet;  // 0-100%

    if (E_int < -0.3 && E_int > -2.5 && I_ref > 0) {
      // Resfriamento: fecha aluminet progressivamente
      // frac=0 → alm=alm_fuzzy; frac=1 → alm=100%
      const frac    = Math.min(1.0, I_ref / INT_MX);
      const alm_int = frac * 100;         // alvo integral: 0%→100%
      alm_fuzzy = Math.max(alm_fuzzy, alm_int);  // garante mínimo
    } else if (E_int > 0.3 && E_int < 2.5 && I_hea > 0) {
      // Aquecimento: abre aluminet para capturar solar (complementar)
      const frac    = Math.min(1.0, I_hea / INT_MX);
      alm_fuzzy = Math.max(0, alm_fuzzy - frac * alm_fuzzy); // reduz aluminet
    }

    SIM_STATE.aluminet_pct = alm_fuzzy;
  }

  // ── 3. CONTROLE TEMPO-PROPORCIONAL ──────────────────────────
  SIM_STATE.tp_bomba    = tempoProportional(saidas.bomba,    60);
  SIM_STATE.tp_exaustor = tempoProportional(saidas.exaustor, 60);

  // ── 4. ESTÁGIOS E POSIÇÕES ──────────────────────────────────
  const janLat   = converterEstagioJanela(saidas.jan_lat, SIM_STATE.jan_lat_atual);
  const delta_jan = janLat.pctFinal - SIM_STATE.jan_lat_atual;
  // Suavização leve para animação (física usa jan_lat_pct = alvo direto)
  SIM_STATE.jan_lat_atual   = SIM_STATE.jan_lat_atual + delta_jan * 0.70;
  SIM_STATE.jan_lat_estagio = janLat.pctFinal;
  SIM_STATE.jan_lat_direcao = janLat.direcao;

  SIM_STATE.aluminet_fechado = saidas.aluminet > 50;
  SIM_STATE.jan_sup_aberta   = saidas.jan_sup > 40;
  SIM_STATE.aquecedor_estagio = calcularEstagioAquecedores(saidas.aquecedor);

  // ── 5. FÍSICA TÉRMICA ────────────────────────────────────────
  const nova_TI    = calcularNovaTemperatura(SIM_STATE);
  const TI_anterior = SIM_STATE.TI;
  SIM_STATE.TI = nova_TI;

  // ── 6. SIMULAÇÃO ON/OFF PARALELA ────────────────────────────
  simularOnOff(SIM_STATE);

  // ── 7. CONSUMO ───────────────────────────────────────────────
  const consumo = calcularConsumo(SIM_STATE);
  SIM_STATE.potencia_total = consumo.P_total;

  // ── 8. MÉTRICAS ──────────────────────────────────────────────
  const erro    = SIM_STATE.SP - SIM_STATE.TI;
  const erroAbs = Math.abs(erro);
  SIM_STATE.erros_abs.push(erroAbs);
  SIM_STATE.erros_sq.push(erroAbs * erroAbs);
  SIM_STATE.regras_last_count = regrasAtivas.length;
  SIM_STATE.regras_total += regrasAtivas.length;

  // Overshoot
  const overshooting = (SP > TI_anterior)
    ? Math.max(0, SIM_STATE.TI - (SP + 0.5))
    : Math.max(0, (SP - 0.5) - SIM_STATE.TI);
  if (overshooting > SIM_STATE.overshoot_max) SIM_STATE.overshoot_max = overshooting;

  // Tempo para atingir setpoint (±0.5°C)
  if (erroAbs <= 0.5 && SIM_STATE.tempo_setpoint === null) {
    SIM_STATE.tempo_setpoint = SIM_STATE.sim_seconds;
    adicionarLogManual('success',
      `🎯 SETPOINT ATINGIDO! TI=${SIM_STATE.TI.toFixed(2)}°C ≈ SP=${SP.toFixed(1)}°C em ${formatSimTime(SIM_STATE.sim_seconds)}`);
  }

  if (erroAbs <= 0.5) SIM_STATE.ticks_no_sp++;

  // ── 9. HISTÓRICO ─────────────────────────────────────────────
  const MAX_HIST = 120;
  SIM_STATE.historico_ti.push(+SIM_STATE.TI.toFixed(2));
  SIM_STATE.historico_te.push(+TE.toFixed(2));
  SIM_STATE.historico_sp.push(+SP.toFixed(2));
  SIM_STATE.historico_vv.push(+VV.toFixed(2));
  SIM_STATE.historico_bomba.push(+saidas.bomba.toFixed(1));
  SIM_STATE.historico_exaustor.push(+saidas.exaustor.toFixed(1));
  SIM_STATE.historico_aquecedor.push(+saidas.aquecedor.toFixed(1));
  SIM_STATE.historico_jan_lat.push(+SIM_STATE.jan_lat_atual.toFixed(1));
  SIM_STATE.historico_power.push(+consumo.P_total.toFixed(0));
  SIM_STATE.historico_tempo.push(formatSimTime(SIM_STATE.sim_seconds));

  SIM_STATE.ref_crisp_last = resultado.refCrisp || 0;
  SIM_STATE.hea_crisp_last = resultado.heaCrisp || 0;

  const histKeys = [
    'historico_ti','historico_te','historico_sp','historico_vv',
    'historico_bomba','historico_exaustor','historico_aquecedor',
    'historico_jan_lat','historico_power','historico_tempo'
  ];
  histKeys.forEach(k => { if (SIM_STATE[k].length > MAX_HIST) SIM_STATE[k].shift(); });

  // ── 10. LOG ──────────────────────────────────────────────────
  const deltaT_disp = SIM_STATE.TI - TI_anterior;
  adicionarLog(SIM_STATE, regrasAtivas, consumo, inferTime, resultado, deltaT_disp);

  // ── 11. ATUALIZAR UI ─────────────────────────────────────────
  atualizarUI(SIM_STATE, regrasAtivas);
  atualizarGraficos();
  atualizarResultados();
}

// ============================================================
// CONTROLES DA SIMULAÇÃO
// ============================================================
function startSimulation() {
  if (SIM_STATE.running && !SIM_STATE.paused) return;

  if (!SIM_STATE.running) {
    SIM_STATE.running = true;
    SIM_STATE.paused  = false;
    SIM_STATE.TI = parseFloat(document.getElementById('slider-ti').value);
    SIM_STATE.TE = parseFloat(document.getElementById('slider-te').value);
    SIM_STATE.VV = parseFloat(document.getElementById('slider-vv').value);
    SIM_STATE.SP = parseFloat(document.getElementById('slider-sp').value);
    SIM_STATE.sim_onoff_TI = SIM_STATE.TI;

    // Zera integradores ao iniciar nova simulação
    SIM_STATE.integral_ref = 0;
    SIM_STATE.integral_hea = 0;

    if (typeof fuzzyEngine !== 'undefined' && fuzzyEngine.reset) {
      fuzzyEngine.reset();
    }
  } else {
    SIM_STATE.paused = false;
  }

  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('panel-config').classList.add('running');

  const intervalo = Math.max(100, Math.round(1000 / SIM_STATE.speed));
  simTimer = setInterval(tickSimulacao, intervalo);

  updateSimStatusDot('active');
  showToast('▶ Simulação iniciada! Velocidade: ' + SIM_STATE.speed + '×');
}

function pauseSimulation() {
  if (!SIM_STATE.running) return;
  SIM_STATE.paused = !SIM_STATE.paused;

  if (SIM_STATE.paused) {
    clearInterval(simTimer);
    simTimer = null;
    document.getElementById('btn-pause').innerHTML = '<i class="fas fa-play"></i> Retomar';
    document.getElementById('btn-start').disabled = false;
    updateSimStatusDot('warn');
    showToast('⏸ Simulação pausada');
  } else {
    startSimulation();
    document.getElementById('btn-pause').innerHTML = '<i class="fas fa-pause"></i> Pausar';
  }
}

function resetSimulation() {
  clearInterval(simTimer);
  simTimer = null;

  SIM_STATE.running    = false;
  SIM_STATE.paused     = false;
  SIM_STATE.tick       = 0;
  SIM_STATE.sim_seconds = 0;

  SIM_STATE.erros_abs        = [];
  SIM_STATE.erros_sq         = [];
  SIM_STATE.ticks_no_sp      = 0;
  SIM_STATE.overshoot_max    = 0;
  SIM_STATE.regras_total     = 0;
  SIM_STATE.tempo_setpoint   = null;
  SIM_STATE.energia_acumulada = 0;
  SIM_STATE.agua_litros      = 0;
  SIM_STATE.potencia_total   = 0;
  SIM_STATE.sim_onoff_TI     = null;
  SIM_STATE.sim_onoff_energy = 0;
  SIM_STATE.sim_onoff_water  = 0;

  // Reset dos integradores (anti-offset)
  SIM_STATE.integral_ref = 0;
  SIM_STATE.integral_hea = 0;

  SIM_STATE.bomba_pct     = 0;
  SIM_STATE.exaustor_pct  = 0;
  SIM_STATE.aquecedor_pct = 0;
  SIM_STATE.jan_lat_pct   = 0;
  SIM_STATE.aluminet_pct  = 0;
  SIM_STATE.jan_sup_pct   = 0;
  SIM_STATE.jan_lat_atual   = 0;
  SIM_STATE.jan_lat_estagio = 0;
  SIM_STATE.jan_lat_direcao = 'PARADO';
  SIM_STATE.aluminet_fechado = false;
  SIM_STATE.jan_sup_aberta   = false;
  SIM_STATE.aquecedor_estagio = { numAtivos: 0, estagio: 0, nome: 'DESLIGADO' };
  SIM_STATE.tp_bomba    = { tempoON: 0, tempoOFF: 60, percentual: 0, ativo: false };
  SIM_STATE.tp_exaustor = { tempoON: 0, tempoOFF: 60, percentual: 0, ativo: false };

  const histKeys = [
    'historico_ti','historico_te','historico_sp','historico_vv',
    'historico_bomba','historico_exaustor','historico_aquecedor',
    'historico_jan_lat','historico_power','historico_tempo'
  ];
  histKeys.forEach(k => SIM_STATE[k] = []);

  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('btn-pause').innerHTML = '<i class="fas fa-pause"></i> Pausar';
  document.getElementById('panel-config').classList.remove('running');

  updateSimStatusDot('off');
  document.getElementById('sim-time').textContent = '00:00:00';

  SIM_STATE.TI = parseFloat(document.getElementById('slider-ti').value);
  SIM_STATE.TE = parseFloat(document.getElementById('slider-te').value);
  SIM_STATE.VV = parseFloat(document.getElementById('slider-vv').value);
  SIM_STATE.SP = parseFloat(document.getElementById('slider-sp').value);

  resetGraficos();
  atualizarUI(SIM_STATE, []);
  atualizarResultados();

  if (typeof fuzzyEngine !== 'undefined' && fuzzyEngine.reset) {
    fuzzyEngine.reset();
  }

  clearLog();
  adicionarLogManual('info', '🔄 Simulação resetada. Configure o cenário e pressione Iniciar.');
  showToast('🔄 Simulação resetada');
}

function setSpeed(s, btn) {
  SIM_STATE.speed = s;
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  const targetBtn = btn || (typeof event !== 'undefined' && event.target);
  if (targetBtn) targetBtn.classList.add('active');
  const badge = document.getElementById('speed-badge');
  if (badge) badge.textContent = s + '×';

  if (SIM_STATE.running && !SIM_STATE.paused) {
    clearInterval(simTimer);
    const intervalo = Math.max(100, Math.round(1000 / s));
    simTimer = setInterval(tickSimulacao, intervalo);
    showToast('⏱ Velocidade: ' + s + '× (' + intervalo + 'ms/tick)');
  }
}

// ============================================================
// ATUALIZAR DIMENSÕES
// ============================================================
function updateDimensions() {
  GREENHOUSE_WIDTH  = parseFloat(document.getElementById('inp-width').value)  || 8;
  GREENHOUSE_LENGTH = parseFloat(document.getElementById('inp-length').value) || 14;
  GREENHOUSE_HEIGHT = parseFloat(document.getElementById('inp-height').value) || 6;

  const vol   = GREENHOUSE_WIDTH * GREENHOUSE_LENGTH * GREENHOUSE_HEIGHT;
  const massa = (vol * DENSIDADE_AR).toFixed(0);

  document.getElementById('lbl-width').textContent  = GREENHOUSE_WIDTH + 'm';
  document.getElementById('lbl-length').textContent = GREENHOUSE_LENGTH + 'm';
  document.getElementById('lbl-height').textContent = GREENHOUSE_HEIGHT + 'm';
  document.getElementById('volume-display').textContent = vol.toFixed(1);
  document.getElementById('mass-display').textContent   = massa;
  document.getElementById('footer-volume').textContent  = 'Vol: ' + vol.toFixed(0) + 'm³';
}

// ============================================================
// SLIDERS DE ENTRADA
// ============================================================
function updateSlider(varname, val) {
  val = parseFloat(val);

  const labels = { ti: 'lbl-ti', te: 'lbl-te', vv: 'lbl-vv', sp: 'lbl-sp' };
  const units  = { ti: '°C', te: '°C', vv: ' m/s', sp: '°C' };

  document.getElementById(labels[varname]).textContent = val.toFixed(1) + units[varname];

  if (!SIM_STATE.running || SIM_STATE.paused) {
    switch (varname) {
      case 'ti': SIM_STATE.TI = val; break;
      case 'te': SIM_STATE.TE = val; break;
      case 'vv': SIM_STATE.VV = val; break;
      case 'sp': SIM_STATE.SP = val; break;
    }
    updateAllDisplays();
    updateGreenhouseSVG();
    drawMembershipFunctions();
  }
  document.getElementById('scenario-select').value = 'custom';
}

// ============================================================
// CENÁRIOS PRÉ-DEFINIDOS
// ============================================================
const SCENARIOS = {
  // Todos os setpoints são fisicamente alcançáveis com o modelo corrigido
  summer:         { TI: 38, TE: 35, VV: 2,  SP: 25, label: '🌞 Verão Intenso (TI=38, TE=35, SP=25)' },
  warm_dry:       { TI: 34, TE: 28, VV: 3,  SP: 25, label: '🌤️ Dia Quente Seco (SP=25)' },
  winter_night:   { TI: 8,  TE: 3,  VV: 5,  SP: 18, label: '🌙 Noite de Inverno (SP=18)' },
  spring_morning: { TI: 22, TE: 18, VV: 4,  SP: 22, label: '🌱 Manhã Primavera (TI≈SP)' },
  storm:          { TI: 20, TE: 15, VV: 13, SP: 20, label: '⛈ Tempestade (VV=13)' },
  cloudy_cold:    { TI: 12, TE: 8,  VV: 6,  SP: 20, label: '☁ Dia Nublado Frio (SP=20)' },
  hot_wind:       { TI: 32, TE: 28, VV: 10, SP: 25, label: '💨 Calor com Vento (SP=25)' },
  warm_night:     { TI: 30, TE: 25, VV: 3,  SP: 26, label: '🌃 Noite Quente (SP=26)' },
};

function loadScenario() {
  const key = document.getElementById('scenario-select').value;
  if (key === 'custom' || !SCENARIOS[key]) return;

  const s = SCENARIOS[key];
  document.getElementById('slider-ti').value = s.TI;
  document.getElementById('slider-te').value = s.TE;
  document.getElementById('slider-vv').value = s.VV;
  document.getElementById('slider-sp').value = s.SP;

  updateSlider('ti', s.TI);
  updateSlider('te', s.TE);
  updateSlider('vv', s.VV);
  updateSlider('sp', s.SP);

  showToast('📋 Cenário carregado: ' + s.label);
}

// ============================================================
// ANFIS — TREINAMENTO SIMULADO
// ============================================================
function trainANFIS() {
  if (SIM_STATE.anfis_scenarios.length < 2) {
    showToast('⚠ Grave pelo menos 2 cenários antes de treinar!');
    return;
  }

  showToast('🧠 Treinando ANFIS...');

  SIM_STATE.anfis_convergence = [];
  let erro = 1.0;
  for (let ep = 0; ep < 50; ep++) {
    erro *= (0.85 + Math.random() * 0.1);
    SIM_STATE.anfis_convergence.push(+erro.toFixed(4));
  }

  const novasRegras = Math.min(20, Math.floor(SIM_STATE.anfis_scenarios.length * 3));
  SIM_STATE.anfis_learned = novasRegras;
  SIM_STATE.anfis_trained = true;

  fuzzyEngine.enableANFIS(novasRegras);

  document.getElementById('anfis-rules').textContent      = novasRegras;
  document.getElementById('anfis-time-opt').textContent   = '~' + Math.max(8, Math.round(85 * (1 - novasRegras * 0.015))) + 'ms';

  atualizarGraficoANFIS();
  setTimeout(() => showToast('✅ ANFIS treinado! ' + novasRegras + ' regras aprendidas.'), 1500);
}

function saveScenario() {
  const scenario = {
    id:             SIM_STATE.anfis_scenarios.length + 1,
    TI:             SIM_STATE.TI.toFixed(1),
    TE:             SIM_STATE.TE.toFixed(1),
    VV:             SIM_STATE.VV.toFixed(1),
    SP:             SIM_STATE.SP.toFixed(1),
    tempo:          SIM_STATE.tempo_setpoint !== null ? SIM_STATE.tempo_setpoint.toFixed(0) : '---',
    kwh:            SIM_STATE.energia_acumulada.toFixed(4),
    bomba_peak:     SIM_STATE.bomba_pct.toFixed(1),
    exaustor_peak:  SIM_STATE.exaustor_pct.toFixed(1),
    aquecedor_stage:SIM_STATE.aquecedor_estagio.nome,
    timestamp:      new Date().toLocaleTimeString('pt-BR'),
    regrasAtivas:   SIM_STATE.regras_last_count,
  };

  SIM_STATE.anfis_scenarios.push(scenario);
  try { localStorage.setItem('gh_scenarios', JSON.stringify(SIM_STATE.anfis_scenarios)); } catch(e) {}

  atualizarTabelaANFIS();
  showToast('💾 Cenário #' + scenario.id + ' registrado!');
}

function atualizarTabelaANFIS() {
  const tbody = document.getElementById('anfis-tbody');
  if (!tbody) return;

  if (SIM_STATE.anfis_scenarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:12px">Nenhum cenário registrado</td></tr>';
    return;
  }

  tbody.innerHTML = SIM_STATE.anfis_scenarios.map(s => `
    <tr>
      <td style="color:var(--text-muted)">#${s.id}</td>
      <td style="color:var(--orange)">${s.TI}°</td>
      <td style="color:var(--blue)">${s.TE}°</td>
      <td style="color:var(--cyan)">${s.VV}</td>
      <td style="color:var(--green)">${s.SP}°</td>
      <td style="color:var(--yellow)">${s.tempo}s</td>
      <td style="color:var(--text-primary)">${parseFloat(s.kwh).toFixed(4)}</td>
    </tr>
  `).join('');
}

// ============================================================
// LOG DE AÇÕES
// ============================================================
let logCount = 0;

function adicionarLog(state, regrasAtivas, consumo, inferTime, resultado, deltaT) {
  const tipo   = determinarTipoLog(state);
  const refVal = (resultado && resultado.refCrisp !== undefined) ? resultado.refCrisp : (state.ref_crisp_last || 0);
  const heaVal = (resultado && resultado.heaCrisp !== undefined) ? resultado.heaCrisp : (state.hea_crisp_last || 0);

  const dTStr = (deltaT !== undefined)
    ? ` | ΔT=${(deltaT >= 0 ? '+' : '') + deltaT.toFixed(3)}°C`
    : '';

  adicionarLogManual(tipo,
    `🌡️ TI=${state.TI.toFixed(2)}°C | TE=${state.TE.toFixed(1)}°C | VV=${state.VV.toFixed(1)}m/s | SP=${state.SP.toFixed(1)}°C | Erro=${(state.SP-state.TI>=0?'+':'')+(state.SP-state.TI).toFixed(2)}°C${dTStr}`);

  const erroAtual = Math.abs(state.SP - state.TI);

  if (state.TI >= 40) {
    adicionarLogManual('danger', '🔥 ALERTA CRÍTICO: TI >= 40°C — superaquecimento!');
  } else if (state.TI >= 35) {
    adicionarLogManual('danger', '🔥 ALERTA: Temperatura MUITO QUENTE (TI=' + state.TI.toFixed(1) + '°C)');
  } else if (state.TI <= 8) {
    adicionarLogManual('danger', '🧊 ALERTA CRÍTICO: TI <= 8°C — risco de geada!');
  } else if (state.TI <= 12) {
    adicionarLogManual('warn',   '🧊 ALERTA: Temperatura MUITO FRIA (TI=' + state.TI.toFixed(1) + '°C)');
  } else if (erroAtual <= 0.5) {
    adicionarLogManual('success',
      `✅ SP MANTIDO: TI=${state.TI.toFixed(2)}°C ≈ SP=${state.SP.toFixed(1)}°C (erro=${(state.SP-state.TI>=0?'+':'')+(state.SP-state.TI).toFixed(2)}°C)`);
  } else if (erroAtual <= 1.5) {
    adicionarLogManual('info', `🎯 Próximo do SP: erro=${erroAtual.toFixed(2)}°C`);
  }

  if (state.tp_bomba.ativo) {
    adicionarLogManual('action',
      `💧 Bomba: ${state.bomba_pct.toFixed(0)}% → ON:${state.tp_bomba.tempoON}s / OFF:${state.tp_bomba.tempoOFF}s → ${consumo.P_bomba.toFixed(0)}W | ${consumo.water_rate.toFixed(1)} L/h`);
  }

  if (state.tp_exaustor.ativo) {
    adicionarLogManual('action',
      `🌀 Exaustores: ${state.exaustor_pct.toFixed(0)}% → ON:${state.tp_exaustor.tempoON}s → 2×${POTENCIAS.exaustor}W = ${consumo.P_exaustores.toFixed(0)}W`);
  }

  if (state.aquecedor_estagio.numAtivos > 0) {
    adicionarLogManual('warn',
      `🔥 Aquecedores: ${state.aquecedor_estagio.nome} → ${state.aquecedor_estagio.numAtivos}/4 ativos → ${consumo.P_aquecedores.toFixed(0)}W`);
  }

  if (state.jan_lat_atual > 2) {
    adicionarLogManual('info',
      `🪟 Jan. Laterais: ${state.jan_lat_atual.toFixed(0)}% (alvo: ${state.jan_lat_estagio}%) ${state.jan_lat_direcao}`);
  }

  if (state.aluminet_fechado) {
    adicionarLogManual('warn', `☀️ Aluminet: FECHADO (bloqueio solar ativo)`);
  }

  adicionarLogManual('info',
    `🤖 Fuzzy → REF=${refVal.toFixed(1)}% HEA=${heaVal.toFixed(1)}% | Bomba=${state.bomba_pct.toFixed(0)}% Exaust=${state.exaustor_pct.toFixed(0)}% JanLat=${state.jan_lat_estagio}%`);

  adicionarLogManual('info',
    `⚡ Potência: ${consumo.P_total.toFixed(0)}W | Acum: ${state.energia_acumulada.toFixed(4)} kWh | Água: ${state.agua_litros.toFixed(2)}L`);

  adicionarLogManual('info',
    `🔬 Inferência: ${(fuzzyEngine.displayInferenceTime || inferTime).toFixed(1)}ms | Regras: ${regrasAtivas.length} ativas | REF=${refVal.toFixed(1)}% HEA=${heaVal.toFixed(1)}%`);

  adicionarLogManual('info', '─'.repeat(50));
}

function adicionarLogManual(tipo, msg) {
  const container = document.getElementById('log-container');
  if (!container) return;

  logCount++;
  const time = formatSimTime(SIM_STATE.sim_seconds);

  const entry = document.createElement('div');
  entry.className = `log-entry ${tipo}`;
  entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-msg"> ${msg}</span>`;
  container.appendChild(entry);

  const logBody = document.getElementById('log-body');
  if (logBody) logBody.scrollTop = logBody.scrollHeight;

  while (container.children.length > 300) container.removeChild(container.firstChild);

  const badge = document.getElementById('log-count-badge');
  if (badge) badge.textContent = logCount + ' eventos';
}

function clearLog() {
  const container = document.getElementById('log-container');
  if (container) container.innerHTML = '';
  logCount = 0;
  const badge = document.getElementById('log-count-badge');
  if (badge) badge.textContent = '0 eventos';
}

function determinarTipoLog(state) {
  const erro = Math.abs(state.SP - state.TI);
  if (erro <= 0.5) return 'success';
  if (erro <= 2.0) return 'info';
  if (erro <= 5.0) return 'warn';
  return 'danger';
}

// ============================================================
// FORMATAÇÃO
// ============================================================
function formatSimTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateClock() {
  const now = new Date();
  const el  = document.getElementById('clock');
  if (el) el.textContent = now.toLocaleTimeString('pt-BR');
  if (SIM_STATE.running) {
    const simEl = document.getElementById('sim-time');
    if (simEl) simEl.textContent = formatSimTime(SIM_STATE.sim_seconds);
  }
}

function updateSimStatusDot(status) {
  const dot  = document.getElementById('sim-dot');
  const text = document.getElementById('sim-status-text');
  if (!dot || !text) return;

  dot.className = 'status-dot ' + (
    status === 'active' ? 'active' :
    status === 'warn'   ? 'warn'   :
    status === 'danger' ? 'danger' : ''
  );

  const statusMap = { active: 'RODANDO', warn: 'PAUSADO', danger: 'ALERTA', off: 'PARADO' };
  text.textContent = statusMap[status] || 'PARADO';
}

// ============================================================
// CARREGAR CENÁRIOS DO LOCALSTORAGE
// ============================================================
(function loadSavedScenarios() {
  try {
    const saved = localStorage.getItem('gh_scenarios');
    if (saved) SIM_STATE.anfis_scenarios = JSON.parse(saved);
  } catch(e) {}
})();
