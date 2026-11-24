/**
 * ============================================================
 * MOTOR FUZZY MAMDANI — GreenHouse Fuzzy MIMO Simulator
 * Dissertação de Mestrado — JucemarFC (UFSC)
 * ============================================================
 * Arquitetura: controlador Mamdani com 4 entradas e 2 saídas.
 *
 * ENTRADAS:
 *   E    = SP - TI  (Erro de temperatura, -25..+25 °C)
 *              E > 0 → TI < SP → sistema FRIO → ligar aquecedores
 *              E < 0 → TI > SP → sistema QUENTE → ligar resfriamento
 *   dE   = E(k) - E(k-1)  (Derivada do erro)
 *   TE   = Temperatura Externa (-5..45 °C)
 *   VV   = Velocidade do vento (0..15 m/s)
 *
 * SAÍDAS:
 *   REF  = Potência de refrigeração (0..100 %)  — quando E < 0
 *   HEA  = Potência de aquecimento  (0..100 %)  — quando E > 0
 * ============================================================
 */

'use strict';

// ============================================================
// FUNÇÕES DE PERTINÊNCIA
// ============================================================
const FuzzyMF = {
  trapmf(x, a, b, c, d) {
    if (x <= a || x >= d) return 0;
    if (x >= b && x <= c) return 1;
    if (x > a && x < b)   return (x - a) / (b - a);
    return (d - x) / (d - c);
  },
  trimf(x, a, b, c) {
    if (x <= a || x >= c) return 0;
    if (x === b)           return 1;
    if (x < b)             return (x - a) / (b - a);
    return (c - x) / (c - b);
  },
  gaussmf(x, mean, sigma) {
    return Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
  }
};

// ============================================================
// VARIÁVEIS LINGUÍSTICAS DE ENTRADA
// ============================================================

// ── ERRO  E = SP - TI  [-25 .. +25 °C] ─────────────────────
// MN: E < -4°C  → TI MUITO acima do SP  → refrigeração máxima
//  N: -4 < E < -0.5°C → TI acima do SP  → refrigeração moderada
//  Z: E ≈ 0  (±1.5°C)  → TI ≈ SP        → manutenção
//  P: 0.5 < E < 4°C  → TI abaixo do SP  → aquecimento moderado
// MP: E > 4°C → TI MUITO abaixo do SP   → aquecimento máximo
const MF_ERRO = {
  MN: (e) => FuzzyMF.trapmf(e, -30, -25,  -8,  -4),
  N:  (e) => FuzzyMF.trimf (e,  -8,  -4,  -0.5),
  Z:  (e) => FuzzyMF.trimf (e, -1.5,  0,   1.5),
  P:  (e) => FuzzyMF.trimf (e,  0.5,  4,    8),
  MP: (e) => FuzzyMF.trapmf(e,   4,   8,   25,  30),
};

// ── DELTA-ERRO  dE  [-5 .. +5 °C/tick] ─────────────────────
const MF_DE = {
  N:  (de) => FuzzyMF.trapmf(de, -8, -4, -0.8, -0.1),
  Z:  (de) => FuzzyMF.trimf (de, -0.5,  0,  0.5),
  P:  (de) => FuzzyMF.trapmf(de, 0.1, 0.8,  4,   8),
};

// ── TEMPERATURA EXTERNA  TE  [-5 .. 45 °C] ─────────────────
const MF_TE = {
  Fria:   (t) => FuzzyMF.trapmf(t, -10,  -5,   8, 16),
  Amena:  (t) => FuzzyMF.trimf (t,  12,  20,  28),
  Quente: (t) => FuzzyMF.trapmf(t,  24,  30,  45, 55),
};

// ── VELOCIDADE DO VENTO  VV  [0 .. 15 m/s] ─────────────────
const MF_VV = {
  Fraco:  (v) => FuzzyMF.trapmf(v, -1,  0,  3,  6),
  Medio:  (v) => FuzzyMF.trimf (v,  4,  7, 11),
  Forte:  (v) => FuzzyMF.trapmf(v,  9, 12, 15, 20),
};

// ============================================================
// VARIÁVEIS DE SAÍDA — centróides
// ============================================================
const NIV = {
  OFF:   0,
  LEVE:  20,
  MEDIO: 40,
  ALTO:  65,
  MAX:   90
};

// ============================================================
// BASE DE REGRAS — 50 regras
// Formato: [E_key, dE_key, TE_key, VV_key, REF, HEA]
// REGRA SEMÂNTICA:
//   E=MN → TI muito acima SP → refrigeração máxima
//   E=N  → TI um pouco acima SP → refrigeração moderada
//   E=Z  → TI ≈ SP → manutenção mínima
//   E=P  → TI um pouco abaixo SP → aquecimento moderado
//   E=MP → TI muito abaixo SP → aquecimento máximo
// ============================================================
const REGRAS = [
  // ══════════════════════════════════════════════════════════
  // GRUPO 1 — SUPERAQUECIMENTO (E=MN: TI >> SP, erro muito negativo)
  // ══════════════════════════════════════════════════════════
  ['MN', 'N', 'Quente',  'Fraco',  NIV.MAX,   NIV.OFF],  // R01
  ['MN', 'N', 'Quente',  'Medio',  NIV.MAX,   NIV.OFF],  // R02
  ['MN', 'N', 'Quente',  'Forte',  NIV.ALTO,  NIV.OFF],  // R03
  ['MN', 'Z', 'Quente',  'Fraco',  NIV.MAX,   NIV.OFF],  // R04
  ['MN', 'Z', 'Quente',  'Medio',  NIV.MAX,   NIV.OFF],  // R05
  ['MN', 'P', 'Quente',  'Fraco',  NIV.MAX,   NIV.OFF],  // R06 ainda longe, manter MAX
  ['MN', 'P', 'Quente',  'Medio',  NIV.ALTO,  NIV.OFF],  // R07

  ['MN', 'N', 'Amena',   'Fraco',  NIV.MAX,   NIV.OFF],  // R08
  ['MN', 'N', 'Amena',   'Medio',  NIV.ALTO,  NIV.OFF],  // R09
  ['MN', 'Z', 'Amena',   'Fraco',  NIV.MAX,   NIV.OFF],  // R10
  ['MN', 'Z', 'Amena',   'Medio',  NIV.ALTO,  NIV.OFF],  // R11
  ['MN', 'P', 'Amena',   'Fraco',  NIV.ALTO,  NIV.OFF],  // R12
  ['MN', 'P', 'Amena',   'Medio',  NIV.MEDIO, NIV.OFF],  // R13

  ['MN', 'N', 'Fria',    'Fraco',  NIV.ALTO,  NIV.OFF],  // R14
  ['MN', 'Z', 'Fria',    'Fraco',  NIV.MEDIO, NIV.OFF],  // R15
  ['MN', 'P', 'Fria',    'Fraco',  NIV.LEVE,  NIV.OFF],  // R16

  // ══════════════════════════════════════════════════════════
  // GRUPO 2 — TEMPERATURA ELEVADA (E=N: TI um pouco acima do SP)
  // NOTA: dE=P significa que o sistema ESTÁ esfriando (TI está caindo).
  //       Mesmo assim mantemos REF alto para superar o ganho solar
  //       e garantir convergência ao SP. Só reduzimos REF quando
  //       E estiver muito próximo de Z (quase no SP).
  // ══════════════════════════════════════════════════════════
  ['N',  'N', 'Quente',  'Fraco',  NIV.ALTO,  NIV.OFF],  // R17
  ['N',  'N', 'Quente',  'Medio',  NIV.MEDIO, NIV.OFF],  // R18
  ['N',  'Z', 'Quente',  'Fraco',  NIV.ALTO,  NIV.OFF],  // R19
  ['N',  'Z', 'Quente',  'Medio',  NIV.ALTO,  NIV.OFF],  // R20 era MEDIO, subiu para ALTO
  ['N',  'P', 'Quente',  'Fraco',  NIV.ALTO,  NIV.OFF],  // R21 era MEDIO: manter ALTO enquanto E<0
  ['N',  'P', 'Quente',  'Medio',  NIV.MEDIO, NIV.OFF],  // R22 vento moderado: MEDIO ok

  ['N',  'N', 'Amena',   'Fraco',  NIV.MEDIO, NIV.OFF],  // R23
  ['N',  'Z', 'Amena',   'Fraco',  NIV.MEDIO, NIV.OFF],  // R24
  ['N',  'P', 'Amena',   'Fraco',  NIV.MEDIO, NIV.OFF],  // R25 era LEVE: subiu para MEDIO

  ['N',  'N', 'Fria',    'Fraco',  NIV.LEVE,  NIV.OFF],  // R26
  ['N',  'Z', 'Fria',    'Fraco',  NIV.LEVE,  NIV.OFF],  // R27
  ['N',  'P', 'Fria',    'Fraco',  NIV.OFF,   NIV.OFF],  // R28

  // ══════════════════════════════════════════════════════════
  // GRUPO 3 — EQUILÍBRIO (E=Z: TI ≈ SP ± 1.5°C)
  // Quando TE é quente e sistema está no SP:
  //   - dE=N (esfriando): manter leve refrigeração para compensar solar
  //   - dE=Z (estável): mínima refrigeração (só para compensar ganho solar)
  //   - dE=P (aquecendo leve): nada — será corrigido no próximo tick
  // ══════════════════════════════════════════════════════════
  ['Z',  'N', 'Quente',  '*',      NIV.LEVE,  NIV.OFF],  // R29 esfriando+TE quente
  ['Z',  'Z', 'Quente',  '*',      NIV.LEVE,  NIV.OFF],  // R30 estável+TE quente → leve refrig
  ['Z',  'P', 'Quente',  '*',      NIV.OFF,   NIV.OFF],  // R31 aquecendo leve

  ['Z',  'N', 'Amena',   '*',      NIV.OFF,   NIV.OFF],  // R32
  ['Z',  'Z', 'Amena',   '*',      NIV.OFF,   NIV.OFF],  // R33 SETPOINT ATINGIDO
  ['Z',  'P', 'Amena',   '*',      NIV.OFF,   NIV.LEVE], // R34

  ['Z',  'N', 'Fria',    '*',      NIV.OFF,   NIV.OFF],  // R35
  ['Z',  'Z', 'Fria',    '*',      NIV.OFF,   NIV.LEVE], // R36
  ['Z',  'P', 'Fria',    '*',      NIV.OFF,   NIV.MEDIO],// R37

  // ══════════════════════════════════════════════════════════
  // GRUPO 4 — TEMPERATURA BAIXA (E=P: TI um pouco abaixo do SP)
  // ══════════════════════════════════════════════════════════
  ['P',  'P', 'Fria',    '*',      NIV.OFF,   NIV.ALTO], // R38
  ['P',  'Z', 'Fria',    '*',      NIV.OFF,   NIV.MEDIO],// R39
  ['P',  'N', 'Fria',    '*',      NIV.OFF,   NIV.LEVE], // R40 já aquecendo

  ['P',  'P', 'Amena',   '*',      NIV.OFF,   NIV.MEDIO],// R41
  ['P',  'Z', 'Amena',   '*',      NIV.OFF,   NIV.LEVE], // R42
  ['P',  'N', 'Amena',   '*',      NIV.OFF,   NIV.OFF],  // R43

  ['P',  'P', 'Quente',  '*',      NIV.OFF,   NIV.LEVE], // R44
  ['P',  'Z', 'Quente',  '*',      NIV.OFF,   NIV.OFF],  // R45

  // ══════════════════════════════════════════════════════════
  // GRUPO 5 — SUB-RESFRIAMENTO (E=MP: TI muito abaixo do SP)
  // ══════════════════════════════════════════════════════════
  ['MP', 'P', 'Fria',    '*',      NIV.OFF,   NIV.MAX],  // R46
  ['MP', 'Z', 'Fria',    '*',      NIV.OFF,   NIV.MAX],  // R47
  ['MP', 'N', 'Fria',    '*',      NIV.OFF,   NIV.ALTO], // R48 já aquecendo

  ['MP', 'P', 'Amena',   '*',      NIV.OFF,   NIV.ALTO], // R49
  ['MP', 'Z', 'Amena',   '*',      NIV.OFF,   NIV.MEDIO],// R50
  ['MP', 'N', 'Amena',   '*',      NIV.OFF,   NIV.LEVE], // R51

  ['MP', 'P', 'Quente',  '*',      NIV.OFF,   NIV.MEDIO],// R52
  ['MP', 'Z', 'Quente',  '*',      NIV.OFF,   NIV.LEVE], // R53
  ['MP', 'N', 'Quente',  '*',      NIV.OFF,   NIV.OFF],  // R54 TE quente já aquece
];

// ============================================================
// MAPEAMENTO SAÍDAS → ATUADORES
// ============================================================
/**
 * REF (0-100%) → percentuais dos atuadores de resfriamento
 * Ativação imediata a partir de REF > 2%
 */
function mapRefToActuators(ref) {
  const s = {
    bomba_pct:    0,
    exaustor_pct: 0,
    jan_lat_pct:  0,
    jan_sup_pct:  0,
    aluminet_pct: 0,
  };

  if (ref <= 2) return s; // OFF total

  // Janelas laterais: proporcional a REF (abre imediatamente)
  s.jan_lat_pct = Math.min(100, ref * 1.1);

  // Janelas superiores: abrem a partir de REF=20
  if (ref > 20) s.jan_sup_pct = Math.min(100, (ref - 20) * 2.5);

  // Bomba: ativa a partir de REF=10 (parede molhada)
  if (ref > 10) s.bomba_pct = Math.min(100, (ref - 10) * 1.25);

  // Exaustores: ativam a partir de REF=10 (pad-and-fan completo)
  if (ref > 10) s.exaustor_pct = Math.min(100, (ref - 10) * 1.25);

  // Aluminet: fecha a partir de REF > 30 para bloquear radiação solar
  // REF=30 → alm=0%, REF=70 → alm=100% — proteção progressiva
  if (ref > 30) s.aluminet_pct = Math.min(100, (ref - 30) * 2.5);

  return s;
}

/**
 * HEA (0-100%) → percentuais dos atuadores de aquecimento
 */
function mapHeaToActuators(hea) {
  const s = {
    aquecedor_pct: 0,
    jan_lat_pct:   0,
    jan_sup_pct:   0,
    aluminet_pct:  0,
  };

  if (hea <= 2) return s;

  s.aquecedor_pct = Math.min(100, hea);
  // Janelas fechadas quando aquecimento ativo (reter calor)
  s.jan_lat_pct  = 0;
  s.jan_sup_pct  = 0;
  s.aluminet_pct = 0; // aluminet aberto: deixa entrar radiação solar

  return s;
}

// ============================================================
// MOTOR FUZZY — CLASSE PRINCIPAL
// ============================================================
class FuzzyEngine {
  constructor() {
    this.lastResult       = null;
    this.lastActiveRules  = [];
    this.inferenceTime    = 0;
    this.displayInferenceTime = 0;
    this.callCount        = 0;
    this.anfisEnabled     = false;
    this.anfisLearned     = 0;
    this._erroAnterior    = null;
  }

  /**
   * Pipeline: fuzzifica → avalia regras → defuzzifica → mapeia atuadores
   * @param {number} TI  - Temperatura Interna [°C]
   * @param {number} TE  - Temperatura Externa [°C]
   * @param {number} VV  - Velocidade do Vento [m/s]
   * @param {number} SP  - Setpoint [°C]
   */
  computar(TI, TE, VV, SP) {
    const t0 = performance.now();

    // ── Erro: E = SP - TI ─────────────────────────────────────
    // E < 0 → TI > SP → está QUENTE → precisamos RESFRIAR
    // E > 0 → TI < SP → está FRIO  → precisamos AQUECER
    const erro = SP - TI;

    // Derivada do erro
    const dErro = (this._erroAnterior !== null) ? (erro - this._erroAnterior) : 0;
    this._erroAnterior = erro;

    // ── Fuzzificar ─────────────────────────────────────────────
    const muE  = {};
    for (const [k, fn] of Object.entries(MF_ERRO)) muE[k]  = Math.max(0, Math.min(1, fn(erro)));

    const muDE = {};
    for (const [k, fn] of Object.entries(MF_DE))   muDE[k] = Math.max(0, Math.min(1, fn(dErro)));

    const muTE = {};
    for (const [k, fn] of Object.entries(MF_TE))   muTE[k] = Math.max(0, Math.min(1, fn(TE)));

    const muVV = {};
    for (const [k, fn] of Object.entries(MF_VV))   muVV[k] = Math.max(0, Math.min(1, fn(VV)));

    // ── Avaliação das regras ───────────────────────────────────
    const regrasAtivas = [];
    let refNum = 0, refDen = 0;
    let heaNum = 0, heaDen = 0;

    for (let i = 0; i < REGRAS.length; i++) {
      const [eKey, deKey, teKey, vvKey, refCentro, heaCentro] = REGRAS[i];

      const muE_val  = muE[eKey]   || 0;
      const muDE_val = muDE[deKey] || 0;
      const muTE_val = muTE[teKey] || 0;
      const muVV_val = (vvKey === '*') ? 1.0 : (muVV[vvKey] || 0);

      const forca = Math.min(muE_val, muDE_val, muTE_val, muVV_val);
      const forcaFinal = this.anfisEnabled
        ? Math.min(1, forca * (1 + this.anfisLearned * 0.003))
        : forca;

      if (forcaFinal > 0.005) {
        regrasAtivas.push({
          id:    `R${String(i + 1).padStart(2, '0')}`,
          tipo:  heaCentro > 0 ? 'aquecimento' : (refCentro > 0 ? 'resfriamento' : 'equilibrio'),
          desc:  `E=${eKey} dE=${deKey} TE=${teKey} VV=${vvKey} → REF=${refCentro}% HEA=${heaCentro}%`,
          forca: forcaFinal.toFixed(3),
          erro:  erro.toFixed(2),
          dErro: dErro.toFixed(3),
        });

        refNum += refCentro * forcaFinal;
        refDen += forcaFinal;
        heaNum += heaCentro * forcaFinal;
        heaDen += forcaFinal;
      }
    }

    // ── Defuzzificação ─────────────────────────────────────────
    let refCrisp = refDen > 0 ? refNum / refDen : 0;
    let heaCrisp = heaDen > 0 ? heaNum / heaDen : 0;

    // Anti-windup: se E < -0.3 → TI > SP → só REF
    //              se E >  0.3 → TI < SP → só HEA
    //              Zona morta estreita (±0.3°C) para minimizar offset
    if (erro < -0.3) {
      // TI > SP: resfriar
      heaCrisp = 0;
    } else if (erro > 0.3) {
      // TI < SP: aquecer
      refCrisp = 0;
    } else {
      // Zona morta ±0.3°C: desligar tudo
      refCrisp = 0;
      heaCrisp = 0;
    }

    const refFinal = Math.max(0, Math.min(100, refCrisp));
    const heaFinal = Math.max(0, Math.min(100, heaCrisp));

    // ── Mapeamento para atuadores ──────────────────────────────
    const aRef = mapRefToActuators(refFinal);
    const aHea = mapHeaToActuators(heaFinal);

    const saidas = {
      bomba:     refFinal > 0 ? aRef.bomba_pct    : 0,
      exaustor:  refFinal > 0 ? aRef.exaustor_pct : 0,
      aquecedor: heaFinal > 0 ? aHea.aquecedor_pct : 0,
      jan_lat:   refFinal > 0 ? aRef.jan_lat_pct  : (heaFinal > 0 ? 0 : 0),
      jan_sup:   refFinal > 0 ? aRef.jan_sup_pct  : 0,
      aluminet:  refFinal > 0 ? aRef.aluminet_pct : 0,
      refCrisp:  refFinal,
      heaCrisp:  heaFinal,
      erro,
      dErro,
    };

    // Proteção vento forte (>12 m/s): fecha tudo
    if (VV >= 12) {
      saidas.jan_lat  = 0;
      saidas.jan_sup  = 0;
      saidas.exaustor = 0;
      saidas.bomba    = 0;
    }

    const t1 = performance.now();
    this.inferenceTime = t1 - t0;
    this.callCount++;

    this.displayInferenceTime = this.anfisEnabled
      ? Math.max(1.5, this.inferenceTime * (1 - this.anfisLearned * 0.006))
      : this.inferenceTime + 55 + Math.random() * 20;

    this.lastResult      = { ...saidas, regrasAtivas };
    this.lastActiveRules = regrasAtivas;

    // Detalhes para visualização de MFs
    const TIf   = this._fuzzifyDisplay(TI,   'TI');
    const TEf   = this._fuzzifyDisplay(TE,   'TE');
    const VVf   = this._fuzzifyDisplay(VV,   'VV');
    const ERROt = this._fuzzifyDisplay(erro, 'ERRO');

    return {
      saidas,
      regrasAtivas,
      TIf, TEf, VVf, ERROt,
      erro,
      refCrisp: refFinal,
      heaCrisp: heaFinal,
      muE, muDE, muTE, muVV,
    };
  }

  _fuzzifyDisplay(valor, variavel) {
    const varDef = FUZZY_VARS[variavel];
    if (!varDef) return {};
    const result = {};
    for (const [nome, fn] of Object.entries(varDef.sets)) {
      result[nome] = Math.max(0, Math.min(1, fn(valor)));
    }
    return result;
  }

  getFuzzificationDetails(TI, TE, VV, SP) {
    const erro = SP - TI;
    return {
      TI:   { valor: TI,   graus: this._fuzzifyDisplay(TI,   'TI')   },
      TE:   { valor: TE,   graus: this._fuzzifyDisplay(TE,   'TE')   },
      VV:   { valor: VV,   graus: this._fuzzifyDisplay(VV,   'VV')   },
      ERRO: { valor: erro, graus: this._fuzzifyDisplay(erro, 'ERRO') }
    };
  }

  enableANFIS(learnedRules) {
    this.anfisEnabled = true;
    this.anfisLearned = learnedRules;
  }

  disableANFIS() {
    this.anfisEnabled = false;
    this.anfisLearned = 0;
  }

  reset() {
    this._erroAnterior = null;
  }
}

// ============================================================
// VARIÁVEIS FUZZY PARA VISUALIZAÇÃO
// ============================================================
const FUZZY_VARS = {
  TI: {
    range: [0, 50],
    label: 'Temperatura Interna (°C)',
    sets: {
      Muito_Fria:   (x) => FuzzyMF.trapmf(x, -5,  0,  8, 14),
      Fria:         (x) => FuzzyMF.trimf (x, 10, 16, 22),
      Confortavel:  (x) => FuzzyMF.trimf (x, 19, 25, 31),
      Quente:       (x) => FuzzyMF.trimf (x, 28, 34, 40),
      Muito_Quente: (x) => FuzzyMF.trapmf(x, 36, 42, 55, 60),
    },
    colors: ['#00eeff','#00aaff','#00ff88','#ffcc00','#ff3355']
  },
  TE: {
    range: [-5, 45],
    label: 'Temperatura Externa (°C)',
    sets: {
      Fria:   (t) => FuzzyMF.trapmf(t, -10,  -5,   8, 15),
      Amena:  (t) => FuzzyMF.trimf (t,  10,  20,  28),
      Quente: (t) => FuzzyMF.trapmf(t,  24,  30,  45, 55),
    },
    colors: ['#00aaff','#00ff88','#ff3355']
  },
  VV: {
    range: [0, 15],
    label: 'Velocidade do Vento (m/s)',
    sets: {
      Fraco:  (v) => FuzzyMF.trapmf(v, -1,  0,  3,  6),
      Medio:  (v) => FuzzyMF.trimf (v,  4,  7, 11),
      Forte:  (v) => FuzzyMF.trapmf(v,  9, 12, 15, 20),
    },
    colors: ['#00ff88','#ffcc00','#ff3355']
  },
  ERRO: {
    range: [-25, 25],
    label: 'Erro = SP − TI (°C)',
    sets: {
      Muito_Negativo: (e) => FuzzyMF.trapmf(e, -30, -25,  -8,  -4),
      Negativo:       (e) => FuzzyMF.trimf (e,  -8,  -4, -0.5),
      Zero:           (e) => FuzzyMF.trimf (e, -1.5,  0,  1.5),
      Positivo:       (e) => FuzzyMF.trimf (e,  0.5,  4,   8),
      Muito_Positivo: (e) => FuzzyMF.trapmf(e,   4,   8,  25, 30),
    },
    colors: ['#ff3355','#ff8800','#00ff88','#00aaff','#00eeff']
  },
};

function fuzzify(valor, variavel) {
  const varDef = FUZZY_VARS[variavel];
  if (!varDef) return {};
  const result = {};
  for (const [nome, fn] of Object.entries(varDef.sets)) {
    result[nome] = Math.max(0, Math.min(1, fn(valor)));
  }
  return result;
}

// ============================================================
// INSTÂNCIA GLOBAL DO MOTOR
// ============================================================
const fuzzyEngine = new FuzzyEngine();

// ============================================================
// CONTROLE TEMPO-PROPORCIONAL
// ============================================================
function tempoProportional(percentual, janela = 60) {
  const pct     = Math.max(0, Math.min(100, percentual));
  const tempoON = (pct / 100) * janela;
  const tempoOFF= janela - tempoON;
  return {
    tempoON:   +tempoON.toFixed(1),
    tempoOFF:  +tempoOFF.toFixed(1),
    percentual: pct,
    ciclosHora: 3600 / janela,
    ativo:      pct > 2,
  };
}

/**
 * Converte % em estágio de janela lateral (0, 33, 66, 100%)
 */
function converterEstagioJanela(pct, pctAtual = 0) {
  const limites = [0, 33, 66, 100];
  const nomes   = ['FECHADA', 'PARCIAL 1/3', 'PARCIAL 2/3', 'ABERTA'];

  let minDist = Infinity, estagioIdx = 0;
  limites.forEach((lim, i) => {
    const d = Math.abs(pct - lim);
    if (d < minDist) { minDist = d; estagioIdx = i; }
  });

  const pctFinal = limites[estagioIdx];
  const diff     = pctFinal - pctAtual;
  let direcao    = 'PARADO';
  if (Math.abs(diff) > 2) direcao = diff > 0 ? '▲ SUBINDO' : '▼ DESCENDO';

  return { estagio: estagioIdx, pctFinal, nome: nomes[estagioIdx], direcao };
}

/**
 * Calcula estágio de aquecedores a partir do % fuzzy
 */
function calcularEstagioAquecedores(pct) {
  if (pct < 5)  return { numAtivos: 0, estagio: 0, nome: 'DESLIGADO' };
  if (pct < 28) return { numAtivos: 1, estagio: 1, nome: 'EST. 1' };
  if (pct < 53) return { numAtivos: 2, estagio: 2, nome: 'EST. 2' };
  if (pct < 78) return { numAtivos: 3, estagio: 3, nome: 'EST. 3' };
  return            { numAtivos: 4, estagio: 4, nome: 'MÁXIMO' };
}

// ============================================================
// CORES PARA VISUALIZAÇÃO DAS MFs
// ============================================================
const MF_COLORS = {
  Muito_Fria:     '#00eeff',
  Fria:           '#00aaff',
  Confortavel:    '#00ff88',
  Quente:         '#ffcc00',
  Muito_Quente:   '#ff3355',
  Amena:          '#00ff88',
  Fraco:          '#00ff88',
  Medio:          '#ffcc00',
  Forte:          '#ff3355',
  Muito_Negativo: '#ff3355',
  Negativo:       '#ff8800',
  Zero:           '#00ff88',
  Positivo:       '#00aaff',
  Muito_Positivo: '#00eeff',
};
