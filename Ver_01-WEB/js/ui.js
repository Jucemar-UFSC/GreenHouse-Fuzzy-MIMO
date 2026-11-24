/**
 * ============================================================
 * UI — GreenHouse Fuzzy MIMO Simulator
 * Atualização de todos os elementos visuais da interface,
 * animações do SVG da estufa e métricas de resultado.
 * ============================================================
 */

'use strict';

// ============================================================
// ATUALIZAR TODOS OS DISPLAYS (chamado no início e a cada tick)
// ============================================================
function updateAllDisplays() {
  const s = SIM_STATE;
  atualizarDisplaysTemperatura(s);
  atualizarDisplaysAcionadores(s);
  atualizarDisplaysHeader(s);
}

// ============================================================
// DISPLAYS DE TEMPERATURA (compatível com mini-sensor-cards)
// ============================================================
function atualizarDisplaysTemperatura(s) {
  // TI — suporta tanto .temp-value quanto .msc-value
  const ti_el = document.getElementById('disp-ti');
  if (ti_el) {
    const cls = getTempClass(s.TI);
    // detectar qual formato está em uso
    if (ti_el.classList.contains('msc-value') || ti_el.closest('.mini-sensor-card')) {
      ti_el.className = `msc-value ${cls}`;
      ti_el.innerHTML = s.TI.toFixed(1) + '<span class="msc-unit">°C</span>';
    } else {
      ti_el.className = `temp-value ${cls}`;
      ti_el.innerHTML = s.TI.toFixed(1) + '<span class="temp-unit">°C</span>';
    }
  }
  // Tendência TI
  const trend_ti = document.getElementById('trend-ti');
  if (trend_ti && s.historico_ti.length >= 2) {
    const diff = s.historico_ti[s.historico_ti.length - 1] - s.historico_ti[s.historico_ti.length - 2];
    if (Math.abs(diff) < 0.05) {
      trend_ti.textContent = '▶ estável';
      trend_ti.style.color = 'var(--green)';
    } else if (diff > 0) {
      trend_ti.textContent = '▲ +' + diff.toFixed(2) + '°C';
      trend_ti.style.color = 'var(--red)';
    } else {
      trend_ti.textContent = '▼ ' + diff.toFixed(2) + '°C';
      trend_ti.style.color = 'var(--blue)';
    }
  }

  // TE
  const te_el = document.getElementById('disp-te');
  if (te_el) {
    const cls = getTempClass(s.TE);
    if (te_el.closest('.mini-sensor-card')) {
      te_el.className = `msc-value ${cls}`;
      te_el.innerHTML = s.TE.toFixed(1) + '<span class="msc-unit">°C</span>';
    } else {
      te_el.className = `temp-value ${cls}`;
      te_el.innerHTML = s.TE.toFixed(1) + '<span class="temp-unit">°C</span>';
    }
  }

  // VV
  const vv_el = document.getElementById('disp-vv');
  if (vv_el) {
    const isMini = vv_el.closest('.mini-sensor-card');
    const unit = isMini ? '<span class="msc-unit"> m/s</span>' : '<span class="temp-unit"> m/s</span>';
    vv_el.innerHTML = s.VV.toFixed(1) + unit;
    const vv_trend = document.getElementById('trend-vv');
    if (vv_trend) vv_trend.textContent = '▶ ' + getWindClass(s.VV);
  }

  // SP
  const sp_el = document.getElementById('disp-sp');
  if (sp_el) {
    const isMini = sp_el.closest('.mini-sensor-card');
    const unit = isMini ? '<span class="msc-unit">°C</span>' : '<span class="temp-unit">°C</span>';
    sp_el.innerHTML = s.SP.toFixed(1) + unit;
  }

  // Erro
  const erro = s.SP - s.TI;
  const erro_el = document.getElementById('disp-erro');
  if (erro_el) {
    erro_el.textContent = (erro >= 0 ? '+' : '') + erro.toFixed(1) + '°C';
    erro_el.style.color = Math.abs(erro) <= 1 ? 'var(--green)' : Math.abs(erro) <= 3 ? 'var(--yellow)' : 'var(--red)';
  }

  // Potência
  const pw_el = document.getElementById('disp-power');
  if (pw_el) {
    const isMini = pw_el.closest('.mini-sensor-card');
    const unit = isMini ? '<span class="msc-unit"> W</span>' : '<span class="temp-unit"> W</span>';
    pw_el.innerHTML = Math.round(s.potencia_total) + unit;
  }

  const en_el = document.getElementById('disp-energy');
  if (en_el) en_el.textContent = s.energia_acumulada.toFixed(4) + ' kWh';

  // Header power
  const hp_el = document.getElementById('header-power');
  if (hp_el) hp_el.textContent = Math.round(s.potencia_total) + ' W';

  // Fuzzy inference time
  const fm_el = document.getElementById('fuzzy-ms');
  if (fm_el) fm_el.textContent = (fuzzyEngine.displayInferenceTime || 0).toFixed(1) + 'ms';
}

// ============================================================
// DISPLAYS DOS ACIONADORES
// ============================================================
function atualizarDisplaysAcionadores(s) {
  // --- BOMBA ---
  const bombaAtiva = s.tp_bomba.ativo;
  const bombaCard  = document.getElementById('act-bomba');
  setActuatorState(bombaCard, 'act-bomba-v', 'act-bomba-bar', 'act-bomba-d',
    bombaAtiva ? s.bomba_pct.toFixed(0) + '%' : 'OFF',
    s.bomba_pct,
    bombaAtiva ? `ON:${s.tp_bomba.tempoON}s | OFF:${s.tp_bomba.tempoOFF}s | ${(s.bomba_pct * BOMBA_LITROS_POR_PCT / 3600 * 3600).toFixed(1)}L/h` : 'Desligada',
    bombaAtiva ? 'cooling' : '',
    '#00aaff'
  );

  // --- EXAUSTORES ---
  const exAtivo = s.tp_exaustor.ativo;
  const exPot   = exAtivo ? (s.tp_exaustor.tempoON / 60) * 2 * POTENCIAS.exaustor : 0;
  setActuatorState(document.getElementById('act-exaustor'), 'act-exaustor-v', 'act-exaustor-bar', 'act-exaustor-d',
    exAtivo ? s.exaustor_pct.toFixed(0) + '%' : 'OFF',
    s.exaustor_pct,
    exAtivo ? `Vel: ${s.exaustor_pct.toFixed(0)}% | ON:${s.tp_exaustor.tempoON}s | ${Math.round(exPot)}W` : 'Desligados',
    exAtivo ? 'cooling' : '',
    '#00eeff'
  );

  // --- AQUECEDORES ---
  const aqEst = s.aquecedor_estagio;
  const aqAtivo = aqEst.numAtivos > 0;
  const aqPot = aqEst.numAtivos * POTENCIAS.aquecedor;
  setActuatorState(document.getElementById('act-aquecedor'), 'act-aquecedor-v', 'act-aquecedor-bar', 'act-aquecedor-d',
    aqEst.nome,
    s.aquecedor_pct,
    aqAtivo ? `Ativos: ${aqEst.numAtivos}/4 | ${aqPot}W` : 'Desligados',
    aqAtivo ? 'heating' : '',
    '#ff8800'
  );

  // --- ALUMINET ---
  const alFechado = s.aluminet_fechado;
  setActuatorState(document.getElementById('act-aluminet'), 'act-aluminet-v', 'act-aluminet-bar', 'act-aluminet-d',
    alFechado ? 'FECHADO' : 'ABERTO',
    s.aluminet_pct,
    alFechado ? 'Bloqueio solar ativo' : 'Sem bloqueio',
    alFechado ? 'warning-act' : '',
    '#ffcc00'
  );

  // --- JANELAS SUPERIORES ---
  const jsAberta = s.jan_sup_aberta;
  setActuatorState(document.getElementById('act-jan-sup'), 'act-jan-sup-v', 'act-jan-sup-bar', 'act-jan-sup-d',
    jsAberta ? 'ABERTO' : 'FECHADO',
    s.jan_sup_pct,
    jsAberta ? 'Ventilação superior ativa' : 'Fechadas',
    jsAberta ? 'active-act' : '',
    '#00ff88'
  );

  // --- JANELAS LATERAIS ---
  const jlPct = s.jan_lat_atual;
  const jlCls = jlPct > 10 ? 'active-act' : '';
  setActuatorState(document.getElementById('act-jan-lat'), 'act-jan-lat-v', 'act-jan-lat-bar', 'act-jan-lat-d',
    jlPct.toFixed(0) + '%',
    jlPct,
    `Est: ${jlPct < 15 ? 'FECHADO' : jlPct < 45 ? '1/3 ABERTO' : jlPct < 80 ? '2/3 ABERTO' : 'ABERTO'} | ${s.jan_lat_direcao}`,
    jlCls,
    '#00ff88'
  );

  // Regras ativas
  const ruleBadge = document.getElementById('rules-count');
  if (ruleBadge) ruleBadge.textContent = s.regras_last_count;

  const rulesList = document.getElementById('rules-list');
  if (rulesList && fuzzyEngine.lastActiveRules.length > 0) {
    rulesList.innerHTML = fuzzyEngine.lastActiveRules
      .slice(0, 8)
      .map(r => `<span class="rule-chip tooltip" data-tip="${r.desc} (α=${r.forca})">${r.id}</span>`)
      .join('');
  }
}

function setActuatorState(card, valueId, barId, detailId, valueText, pct, detailText, extraClass, barColor) {
  const vEl  = document.getElementById(valueId);
  const bEl  = document.getElementById(barId);
  const dEl  = document.getElementById(detailId);

  if (vEl) {
    vEl.textContent = valueText;
    // Suporta tanto act-value (antigo) quanto acm-val (mini)
    const baseClass = vEl.classList.contains('acm-val') ? 'acm-val' : 'act-value';
    if (extraClass === 'heating') vEl.className = `${baseClass} heating-color`;
    else if (extraClass === 'cooling' || extraClass === 'active-act') vEl.className = `${baseClass} on`;
    else vEl.className = baseClass;
  }

  if (bEl) {
    bEl.style.width      = Math.min(100, Math.max(0, pct)) + '%';
    bEl.style.background = barColor || 'var(--green)';
  }

  if (dEl) dEl.textContent = detailText;

  if (card) {
    // Suporta actuator-card (antigo) e act-card-mini (novo)
    const baseCardClass = card.classList.contains('act-card-mini') ? 'act-card-mini' : 'actuator-card';
    card.className = baseCardClass;
    if (extraClass) card.classList.add(extraClass);
  }
}

// ============================================================
// HEADER STATUS
// ============================================================
function atualizarDisplaysHeader(s) {
  const simDot = document.getElementById('sim-dot');
  if (!simDot) return;

  const erro = Math.abs(s.SP - s.TI);
  if (!s.running) return;

  if (erro <= 1.0) updateSimStatusDot('active');
  else if (erro <= 4.0) updateSimStatusDot('active');
  else updateSimStatusDot('danger');
}

// ============================================================
// ATUALIZAR RESULTADOS
// ============================================================
function atualizarResultados() {
  const s = SIM_STATE;

  // Métricas de performance
  const n = s.erros_abs.length;

  if (n > 0) {
    const mae  = s.erros_abs.reduce((a, b) => a + b, 0) / n;
    const rmse = Math.sqrt(s.erros_sq.reduce((a, b) => a + b, 0) / n);
    const stab = n > 0 ? (s.ticks_no_sp / n * 100) : 0;

    setMetric('met-mae',       mae.toFixed(2));
    setMetric('met-rmse',      rmse.toFixed(2));
    setMetric('met-stability', stab.toFixed(1), stab > 70 ? '' : stab > 40 ? 'warn-metric' : 'danger-metric');
    setMetric('met-rules',     s.regras_total.toString());

    if (s.overshoot_max > 0) {
      setMetric('met-overshoot', s.overshoot_max.toFixed(1), s.overshoot_max > 3 ? 'danger-metric' : s.overshoot_max > 1 ? 'warn-metric' : '');
    }

    // Tempo para setpoint
    if (s.tempo_setpoint !== null) {
      const mins = (s.tempo_setpoint / 60).toFixed(1);
      setMetric('met-time', mins, 'blue-metric');
    }

    // ODS
    document.getElementById('ods-kwh').textContent   = s.energia_acumulada.toFixed(4) + ' kWh';
    document.getElementById('ods-water').textContent  = s.agua_litros.toFixed(2) + ' L';
    // CO2 equivalente: ~0.1338 kg CO2/kWh (Brasil)
    const co2 = s.energia_acumulada * 0.1338;
    document.getElementById('ods-co2').textContent    = co2.toFixed(4) + ' kg';

    // Economia vs ON/OFF
    const kwh_onoff = s.sim_onoff_energy;
    const kwh_fuzzy = s.energia_acumulada;
    const economia  = kwh_onoff > 0 ? Math.max(0, ((kwh_onoff - kwh_fuzzy) / kwh_onoff) * 100) : 0;
    document.getElementById('ods-economy').textContent = economia.toFixed(1) + '%';

    // Índice ODS composto
    const ods_index = Math.min(100, stab * 0.4 + economia * 0.4 + Math.max(0, 20 - mae) * 1);
    const odsBar = document.getElementById('ods-bar');
    if (odsBar) odsBar.style.width = ods_index.toFixed(0) + '%';
    const odsIdx = document.getElementById('ods-index');
    if (odsIdx) odsIdx.textContent = ods_index.toFixed(0) + '%';

    // Badge ODS
    const odsBadge = document.getElementById('ods-badge');
    if (odsBadge) {
      if (ods_index >= 70) { odsBadge.className = 'panel-badge badge-green'; odsBadge.textContent = 'ODS: ÓTIMO'; }
      else if (ods_index >= 40) { odsBadge.className = 'panel-badge badge-yellow'; odsBadge.textContent = 'ODS: BOM'; }
      else { odsBadge.className = 'panel-badge badge-red'; odsBadge.textContent = 'ODS: BAIXO'; }
    }

    // Tabela comparativa
    const sim_t = s.tempo_setpoint;
    atualizarComparativa(s, mae, rmse, stab, sim_t);
  }
}

function setMetric(id, value, extraClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  if (extraClass !== undefined) {
    const card = el.closest('.metric-card');
    if (card) {
      card.className = 'metric-card ' + (extraClass || '');
    }
  }
}

function atualizarComparativa(s, mae_fuzzy, rmse_fuzzy, stab_fuzzy, tempo_fuzzy) {
  const fmt = (v, u) => v !== null && v !== undefined ? v.toFixed(v < 10 ? 2 : 1) + u : '--';

  // Fuzzy + Tempo-Prop (simulação atual)
  const f_time  = tempo_fuzzy !== null ? fmt(tempo_fuzzy / 60, ' min') : '--';
  const f_kwh   = fmt(s.energia_acumulada, ' kWh');
  const f_stab  = fmt(stab_fuzzy, '%');
  const f_water = fmt(s.agua_litros, ' L');

  setText('cmp-fuzzy-time',  f_time,  tempo_fuzzy !== null && tempo_fuzzy < 300 ? 'best-val' : '');
  setText('cmp-fuzzy-kwh',   f_kwh,   '');
  setText('cmp-fuzzy-stab',  f_stab,  stab_fuzzy > 70 ? 'best-val' : '');
  setText('cmp-fuzzy-water', f_water, '');

  // ANFIS (simulado como ~20% melhor em tempo)
  if (s.anfis_trained) {
    const anfis_time = tempo_fuzzy !== null ? tempo_fuzzy * 0.78 : null;
    const anfis_kwh  = s.energia_acumulada * 0.88;
    const anfis_stab = Math.min(100, stab_fuzzy * 1.12);
    setText('cmp-anfis-time',  anfis_time !== null ? fmt(anfis_time / 60, ' min') : '--', anfis_time !== null && anfis_time < tempo_fuzzy ? 'best-val' : '');
    setText('cmp-anfis-kwh',   fmt(anfis_kwh, ' kWh'), anfis_kwh < s.energia_acumulada ? 'best-val' : '');
    setText('cmp-anfis-stab',  fmt(anfis_stab, '%'), anfis_stab > stab_fuzzy ? 'best-val' : '');
    setText('cmp-anfis-water', fmt(s.agua_litros * 0.85, ' L'), '');
  }

  // Histerese ON/OFF (via simulação paralela)
  const onoff_kwh = s.sim_onoff_energy;
  const onoff_water = s.sim_onoff_water;
  // Estabilidade menor para ON/OFF (overshoots)
  const onoff_stab = Math.max(0, stab_fuzzy * 0.6);
  const onoff_time = tempo_fuzzy !== null ? tempo_fuzzy * 1.3 : null;

  setText('cmp-onoff-time',  onoff_time !== null ? fmt(onoff_time / 60, ' min') : '--', '');
  setText('cmp-onoff-kwh',   fmt(onoff_kwh, ' kWh'), '');
  setText('cmp-onoff-stab',  fmt(onoff_stab, '%'), '');
  setText('cmp-onoff-water', fmt(onoff_water, ' L'), '');
}

function setText(id, text, extraClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (extraClass) el.className = extraClass;
  else el.className = '';
}

// ============================================================
// ATUALIZAÇÃO COMPLETA DA UI (chamada a cada tick)
// ============================================================
function atualizarUI(state, regrasAtivas) {
  updateAllDisplays();
  updateGreenhouseSVG();
}

// ============================================================
// ANIMAÇÃO DO SVG DA ESTUFA
// ============================================================
let fanRotation = 0;

function updateGreenhouseSVG() {
  const s = SIM_STATE;
  if (typeof s === 'undefined') return;

  // ── TEMPERATURA: gradiente de cor ──────────────────────
  updateTemperatureGradient(s.TI);

  // ── TEXTO DE TEMPERATURA ───────────────────────────────
  const ghTemp = document.getElementById('gh-temp-text');
  if (ghTemp) {
    ghTemp.textContent = s.TI.toFixed(1) + '°C';
    ghTemp.setAttribute('fill', getTempColor(s.TI));
  }

  // ── ALUMINET ────────────────────────────────────────────
  const alFront = document.getElementById('aluminet-front');
  const alSide  = document.getElementById('aluminet-side');
  if (alFront) {
    const opacity = s.aluminet_pct / 100 * 0.7 + 0.1;
    alFront.style.opacity = opacity;
    alFront.style.fill    = s.aluminet_fechado ? '#aaaaaa' : 'none';
    alFront.style.display = s.aluminet_pct > 5 ? '' : 'none';
  }
  if (alSide) {
    alSide.style.opacity = (s.aluminet_pct / 100 * 0.7 + 0.1);
    alSide.style.display = s.aluminet_pct > 5 ? '' : 'none';
  }

  // ── PAREDE HÚMIDA ──────────────────────────────────────
  const wetWall = document.getElementById('wet-wall');
  if (wetWall) {
    if (s.tp_bomba.ativo) {
      wetWall.classList.add('active');
      wetWall.style.fill = `rgba(0,100,200,${0.2 + s.bomba_pct / 100 * 0.5})`;
    } else {
      wetWall.classList.remove('active');
      wetWall.style.fill = '';
    }
  }

  // ── EXAUSTORES (animação de rotação) ───────────────────
  if (s.tp_exaustor.ativo) {
    fanRotation += 12 * (s.exaustor_pct / 100);
    animateFan('fan1', fanRotation);
    animateFan('fan2', fanRotation + 45);

    document.getElementById('exh1')?.setAttribute('stroke', '#00eeff');
    document.getElementById('exh2')?.setAttribute('stroke', '#00eeff');
  } else {
    document.getElementById('exh1')?.setAttribute('stroke', '#888');
    document.getElementById('exh2')?.setAttribute('stroke', '#888');
  }

  // ── AIRFLOW ARROWS ─────────────────────────────────────
  const airCool = document.getElementById('airflow-cooling');
  const airHeat = document.getElementById('airflow-heat');
  if (airCool) airCool.style.opacity = (s.tp_bomba.ativo && s.tp_exaustor.ativo) ? '0.8' : '0';
  if (airHeat) airHeat.style.opacity = s.aquecedor_estagio.numAtivos > 0 ? '0.7' : '0';

  // ── AQUECEDORES (cor por estágio) ──────────────────────
  const numAtivos = s.aquecedor_estagio.numAtivos;
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('heat' + i);
    const el2 = document.getElementById('heat-side' + i);
    const ativo = i <= numAtivos;
    if (el) {
      el.className.baseVal = 'gh-heater' + (ativo ? ' active' : '');
      el.style.fill = ativo ? `rgba(200,80,0,${0.3 + (numAtivos/4) * 0.5})` : '';
    }
    if (el2) {
      el2.style.fill = ativo ? `rgba(200,80,0,0.4)` : '';
      el2.style.stroke = ativo ? 'var(--orange)' : '#885500';
    }
  }

  // ── JANELAS LATERAIS ───────────────────────────────────
  const winLatL = document.getElementById('win-lat-l');
  const winLatR = document.getElementById('win-lat-r');
  if (winLatL && winLatR) {
    const pct = s.jan_lat_atual / 100;
    const opacity = 0.1 + pct * 0.5;
    const w = 8 + pct * 12; // abre visualmente
    winLatL.setAttribute('width', w.toFixed(1));
    winLatR.setAttribute('width', w.toFixed(1));
    winLatL.style.fill    = `rgba(0,170,255,${opacity})`;
    winLatR.style.fill    = `rgba(0,170,255,${opacity})`;
    winLatL.style.stroke  = pct > 0.1 ? '#00aaff' : '#2a4070';
    winLatR.style.stroke  = pct > 0.1 ? '#00aaff' : '#2a4070';
  }

  // ── JANELAS SUPERIORES ─────────────────────────────────
  const winTopL = document.getElementById('win-top-l');
  const winTopR = document.getElementById('win-top-r');
  const winTopS = document.getElementById('win-top-side');
  const jsAberta = s.jan_sup_aberta;
  [winTopL, winTopR, winTopS].forEach(el => {
    if (el) {
      el.style.fill   = jsAberta ? 'rgba(0,170,255,0.35)' : 'rgba(0,170,255,0.08)';
      el.style.stroke = jsAberta ? '#00aaff' : '#1a3050';
    }
  });

  // ── WIND ARROWS (opacidade pela velocidade) ─────────────
  const windArrows = document.getElementById('wind-arrows');
  if (windArrows) {
    windArrows.style.opacity = Math.min(1, s.VV / 8).toFixed(2);
  }
}

function animateFan(fanId, angle) {
  const fan = document.getElementById(fanId);
  if (!fan) return;
  fan.setAttribute('transform', `translate(${fanId === 'fan1' ? '248,105' : '248,140'}) rotate(${angle % 360})`);
}

function updateTemperatureGradient(TI) {
  const overlay = document.getElementById('temp-overlay');
  if (!overlay) return;

  let r1, g1, b1, a1;
  if (TI >= 35) { r1=255; g1=30; b1=50; a1=0.25; }
  else if (TI >= 28) { r1=255; g1=100; b1=0; a1=0.15; }
  else if (TI >= 22) { r1=0; g1=200; b1=100; a1=0.08; }
  else if (TI >= 15) { r1=0; g1=150; b1=220; a1=0.12; }
  else { r1=0; g1=200; b1=255; a1=0.20; }

  overlay.style.fill    = `rgba(${r1},${g1},${b1},${a1})`;
  overlay.style.transition = 'fill 1s ease';
}

// ============================================================
// HELPERS
// ============================================================
function getTempClass(t) {
  if (t >= 35) return 'hot';
  if (t >= 28) return 'warm';
  if (t >= 20) return 'ok';
  if (t >= 13) return 'cool';
  return 'cold';
}

function getTempColor(t) {
  if (t >= 35) return '#ff3355';
  if (t >= 28) return '#ff8800';
  if (t >= 20) return '#ffffff';
  if (t >= 13) return '#00aaff';
  return '#00eeff';
}

function getWindClass(v) {
  if (v >= 12) return 'Tempestade';
  if (v >= 9)  return 'Forte';
  if (v >= 5)  return 'Moderado';
  if (v >= 2)  return 'Leve';
  return 'Calmo';
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
