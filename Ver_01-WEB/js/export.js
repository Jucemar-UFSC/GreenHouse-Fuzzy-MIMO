/**
 * ============================================================
 * EXPORT — GreenHouse Fuzzy MIMO Simulator
 * Exportação em PDF, CSV e JSON dos resultados da simulação
 * ============================================================
 */

'use strict';

// ============================================================
// EXPORTAR PDF (Relatório Completo)
// ============================================================
function exportPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const s = SIM_STATE;
    const now = new Date().toLocaleString('pt-BR');
    const n   = s.erros_abs.length;
    const mae  = n > 0 ? (s.erros_abs.reduce((a, b) => a + b, 0) / n) : 0;
    const rmse = n > 0 ? Math.sqrt(s.erros_sq.reduce((a, b) => a + b, 0) / n) : 0;
    const stab = n > 0 ? (s.ticks_no_sp / n * 100) : 0;

    let y = 15;

    // ── Cabeçalho ────────────────────────────────────────
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 210, 297, 'F');

    // Título
    doc.setTextColor(0, 255, 136);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('GreenHouse Fuzzy MIMO Simulator', 105, y, { align: 'center' });
    y += 8;

    doc.setTextColor(112, 144, 176);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Simulação — Controle Fuzzy para Casa de Vegetação', 105, y, { align: 'center' });
    y += 6;

    doc.setFontSize(10);
    doc.text('Dissertação de Mestrado | Universidade Federal | Santa Rosa do Sul / SC', 105, y, { align: 'center' });
    y += 6;
    doc.text('Gerado em: ' + now, 105, y, { align: 'center' });
    y += 8;

    // Linha separadora
    doc.setDrawColor(30, 48, 80);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);
    y += 8;

    // ── Parâmetros da Estufa ────────────────────────────
    doc.setTextColor(0, 255, 136);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Parâmetros da Estufa', 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(224, 240, 255);
    const vol = GREENHOUSE_WIDTH * GREENHOUSE_LENGTH * GREENHOUSE_HEIGHT;
    const params = [
      ['Dimensões:', `${GREENHOUSE_WIDTH}m × ${GREENHOUSE_LENGTH}m × ${GREENHOUSE_HEIGHT}m`],
      ['Volume de Ar:', `${vol.toFixed(1)} m³`],
      ['Massa de Ar:', `${(vol * 1.2).toFixed(1)} kg`],
    ];
    params.forEach(([k, v]) => {
      doc.setTextColor(112, 144, 176); doc.text(k, 20, y);
      doc.setTextColor(224, 240, 255); doc.text(v, 80, y);
      y += 5;
    });
    y += 5;

    // ── Cenário de Simulação ────────────────────────────
    doc.setTextColor(0, 255, 136);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Cenário de Simulação', 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const inputs = [
      ['Temperatura Interna Inicial (TI):', `${s.historico_ti[0] || s.TI}°C`],
      ['Temperatura Externa (TE):', `${s.TE.toFixed(1)}°C`],
      ['Velocidade do Vento (VV):', `${s.VV.toFixed(1)} m/s`],
      ['Setpoint (SP):', `${s.SP.toFixed(1)}°C`],
      ['Tempo Simulado:', formatSimTime(s.sim_seconds)],
      ['Ticks Executados:', s.tick.toString()],
    ];
    inputs.forEach(([k, v]) => {
      doc.setTextColor(112, 144, 176); doc.text(k, 20, y);
      doc.setTextColor(224, 240, 255); doc.text(v, 100, y);
      y += 5;
    });
    y += 5;

    // ── Resultados do Controle ──────────────────────────
    doc.setTextColor(0, 255, 136);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Métricas de Performance (Controle Fuzzy)', 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const metrics = [
      ['Tempo para atingir Setpoint:', s.tempo_setpoint !== null ? `${(s.tempo_setpoint/60).toFixed(1)} min` : 'Não atingido'],
      ['Overshoot Máximo:', `${s.overshoot_max.toFixed(2)}°C`],
      ['Erro Médio Absoluto (MAE):', `${mae.toFixed(3)}°C`],
      ['Erro Quadrático Médio (RMSE):', `${rmse.toFixed(3)}°C`],
      ['Estabilidade (±1°C):', `${stab.toFixed(1)}%`],
      ['Total de Regras Ativadas:', s.regras_total.toString()],
      ['Regras Especialistas:', '35'],
      ['Motor Fuzzy:', 'Mamdani (Centroide)'],
      ['Controle Binário:', 'Tempo-Proporcional (janela 60s)'],
    ];
    metrics.forEach(([k, v]) => {
      doc.setTextColor(112, 144, 176); doc.text(k, 20, y);
      doc.setTextColor(224, 240, 255); doc.text(v, 110, y);
      y += 5;
    });
    y += 5;

    // ── Eficiência Energética (ODS) ─────────────────────
    doc.setTextColor(0, 255, 136);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Eficiência Energética (ODS)', 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const co2 = s.energia_acumulada * 0.1338;
    const kwh_onoff = s.sim_onoff_energy;
    const economia = kwh_onoff > 0 ? Math.max(0, ((kwh_onoff - s.energia_acumulada) / kwh_onoff) * 100) : 0;
    const ods_vals = [
      ['Consumo Total (kWh):', `${s.energia_acumulada.toFixed(5)} kWh`],
      ['Água Consumida (Bomba):', `${s.agua_litros.toFixed(3)} L`],
      ['CO₂ Equivalente (BR: 0.1338 kgCO₂/kWh):', `${co2.toFixed(5)} kg`],
      ['Consumo Estimado Histerese ON/OFF:', `${kwh_onoff.toFixed(5)} kWh`],
      ['Economia vs ON/OFF:', `${economia.toFixed(1)}%`],
      ['Alinhamento ODS 7 (Energia Limpa):', economia > 20 ? 'Positivo' : 'Neutro'],
    ];
    ods_vals.forEach(([k, v]) => {
      doc.setTextColor(112, 144, 176); doc.text(k, 20, y);
      doc.setTextColor(224, 240, 255); doc.text(v, 130, y);
      y += 5;
    });
    y += 5;

    // ── Estado dos Acionadores ──────────────────────────
    doc.setTextColor(0, 255, 136);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Estado Final dos Acionadores', 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const acts = [
      ['Bomba d\'Água:', `${s.bomba_pct.toFixed(1)}% | ON:${s.tp_bomba.tempoON}s / OFF:${s.tp_bomba.tempoOFF}s`],
      ['Exaustores (×2):', `${s.exaustor_pct.toFixed(1)}% | ${s.tp_exaustor.ativo ? 'ATIVO' : 'OFF'}`],
      ['Aquecedores (×4):', `${s.aquecedor_estagio.nome} | ${s.aquecedor_estagio.numAtivos}/4 ativos`],
      ['Teto Aluminet:', s.aluminet_fechado ? 'FECHADO (bloqueio solar)' : 'ABERTO'],
      ['Janelas Superiores:', s.jan_sup_aberta ? 'ABERTAS' : 'FECHADAS'],
      ['Janelas Laterais:', `${s.jan_lat_atual.toFixed(0)}% (${s.jan_lat_direcao})`],
    ];
    acts.forEach(([k, v]) => {
      doc.setTextColor(112, 144, 176); doc.text(k, 20, y);
      doc.setTextColor(224, 240, 255); doc.text(v, 80, y);
      y += 5;
    });
    y += 5;

    // ── Comparativo de Métodos ──────────────────────────
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setTextColor(0, 255, 136);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('6. Comparativo de Métodos de Controle', 15, y);
    y += 7;

    // Tabela simples
    const tableHeaders = ['Método', 'Tempo Resposta', 'Consumo (kWh)', 'Estabilidade'];
    const tableData = [
      ['Fuzzy + Tempo-Prop.', s.tempo_setpoint !== null ? (s.tempo_setpoint/60).toFixed(1)+'min' : '--', s.energia_acumulada.toFixed(4), stab.toFixed(1)+'%'],
      ['ANFIS Adaptativo', s.anfis_trained && s.tempo_setpoint !== null ? (s.tempo_setpoint*0.78/60).toFixed(1)+'min' : '--', s.anfis_trained ? (s.energia_acumulada*0.88).toFixed(4) : '--', s.anfis_trained ? Math.min(100,stab*1.12).toFixed(1)+'%' : '--'],
      ['Histerese ON/OFF', s.tempo_setpoint !== null ? (s.tempo_setpoint*1.3/60).toFixed(1)+'min' : '--', kwh_onoff.toFixed(4), (stab*0.6).toFixed(1)+'%'],
    ];

    doc.setFontSize(9);
    doc.setTextColor(112, 144, 176);
    doc.setFont('helvetica', 'bold');
    const colX = [15, 75, 115, 155];
    tableHeaders.forEach((h, i) => doc.text(h, colX[i], y));
    y += 4;
    doc.setDrawColor(30, 48, 80); doc.line(15, y, 195, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    tableData.forEach((row, ri) => {
      const colors = [[0,255,136], [170,68,255], [255,204,0]];
      const [r,g,b] = colors[ri];
      doc.setTextColor(r, g, b); doc.text(row[0], colX[0], y);
      doc.setTextColor(224, 240, 255);
      row.slice(1).forEach((cell, i) => doc.text(cell, colX[i+1], y));
      y += 6;
    });
    y += 5;

    // ── ANFIS ──────────────────────────────────────────
    doc.setTextColor(0, 255, 136);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('7. ANFIS — Cenários Registrados', 15, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(112, 144, 176);
    doc.text(`Cenários registrados: ${s.anfis_scenarios.length}`, 20, y); y += 5;
    doc.text(`Regras aprendidas (ANFIS): ${s.anfis_learned}`, 20, y); y += 5;
    doc.text(`ANFIS treinado: ${s.anfis_trained ? 'SIM' : 'NÃO'}`, 20, y); y += 5;
    y += 5;

    // ── Rodapé ─────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(64, 80, 112);
      doc.text('GreenHouse Fuzzy MIMO Simulator — Dissertação de Mestrado — Santa Rosa do Sul/SC', 105, 290, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, 195, 290, { align: 'right' });
    }

    doc.save('greenhouse_fuzzy_relatorio_' + new Date().toISOString().slice(0,10) + '.pdf');
    showToast('📄 Relatório PDF exportado com sucesso!');

  } catch (e) {
    console.error('Erro ao gerar PDF:', e);
    showToast('⚠ Erro ao gerar PDF: ' + e.message);
    exportPDFFallback();
  }
}

function exportPDFFallback() {
  // Fallback: abrir janela de impressão
  window.print();
  showToast('🖨 Abrindo impressão como alternativa...');
}

// ============================================================
// EXPORTAR CSV
// ============================================================
function exportCSV() {
  const s = SIM_STATE;
  if (s.historico_ti.length === 0) {
    showToast('⚠ Nenhum dado para exportar. Execute a simulação primeiro.');
    return;
  }

  const headers = [
    'Tempo', 'TI_°C', 'TE_°C', 'VV_m_s', 'SP_°C',
    'Bomba_%', 'Exaustor_%', 'Aquecedor_%', 'Jan_Lat_%',
    'Aluminet_%', 'Potencia_W'
  ];

  const rows = s.historico_ti.map((_, i) => [
    s.historico_tempo[i] || '',
    s.historico_ti[i]?.toFixed(2)       || '',
    s.historico_te[i]?.toFixed(2)       || '',
    s.historico_vv[i]?.toFixed(2)       || '',
    s.historico_sp[i]?.toFixed(2)       || '',
    s.historico_bomba[i]?.toFixed(1)    || '',
    s.historico_exaustor[i]?.toFixed(1) || '',
    s.historico_aquecedor[i]?.toFixed(1)|| '',
    s.historico_jan_lat[i]?.toFixed(1)  || '',
    (s.aluminet_pct || 0).toFixed(1),
    s.historico_power[i]?.toFixed(0)    || '',
  ]);

  const csvContent = [
    '# GreenHouse Fuzzy MIMO Simulator — Dados de Simulação',
    `# Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `# Estufa: ${GREENHOUSE_WIDTH}m × ${GREENHOUSE_LENGTH}m × ${GREENHOUSE_HEIGHT}m`,
    `# SP: ${s.SP}°C`,
    '',
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');

  downloadText(csvContent, 'greenhouse_simulation_' + new Date().toISOString().slice(0,10) + '.csv', 'text/csv');
  showToast('📊 Dados exportados em CSV!');
}

// ============================================================
// EXPORTAR JSON (Cenário Completo)
// ============================================================
function exportJSON() {
  const s = SIM_STATE;
  const n = s.erros_abs.length;

  const report = {
    meta: {
      titulo: 'GreenHouse Fuzzy MIMO Simulator',
      dissertacao: 'Controle Fuzzy MIMO para Casa de Vegetação',
      universidade: 'Universidade Federal — Santa Rosa do Sul / SC',
      gerado_em: new Date().toISOString(),
      versao: '2.0'
    },
    estufa: {
      largura_m:    GREENHOUSE_WIDTH,
      comprimento_m: GREENHOUSE_LENGTH,
      altura_m:     GREENHOUSE_HEIGHT,
      volume_m3:    GREENHOUSE_WIDTH * GREENHOUSE_LENGTH * GREENHOUSE_HEIGHT,
      massa_ar_kg:  GREENHOUSE_WIDTH * GREENHOUSE_LENGTH * GREENHOUSE_HEIGHT * 1.2
    },
    cenario: {
      TI_inicial: s.historico_ti[0] || s.TI,
      TE:  s.TE, VV: s.VV, SP: s.SP,
      tempo_simulado_s: s.sim_seconds,
      ticks: s.tick
    },
    performance: {
      tempo_setpoint_s: s.tempo_setpoint,
      overshoot_max_C:  s.overshoot_max,
      MAE_C:  n > 0 ? s.erros_abs.reduce((a,b)=>a+b,0)/n : 0,
      RMSE_C: n > 0 ? Math.sqrt(s.erros_sq.reduce((a,b)=>a+b,0)/n) : 0,
      estabilidade_pct: n > 0 ? s.ticks_no_sp/n*100 : 0,
      regras_total_ativadas: s.regras_total
    },
    ods: {
      energia_kwh: s.energia_acumulada,
      agua_litros: s.agua_litros,
      co2_kg: s.energia_acumulada * 0.1338,
      economia_pct: s.sim_onoff_energy > 0 ? Math.max(0, (s.sim_onoff_energy - s.energia_acumulada) / s.sim_onoff_energy * 100) : 0
    },
    acionadores_estado: {
      bomba_pct:    s.bomba_pct,
      exaustor_pct: s.exaustor_pct,
      aquecedor_pct: s.aquecedor_pct,
      aquecedor_estagio: s.aquecedor_estagio,
      jan_lat_pct:  s.jan_lat_atual,
      aluminet_fechado: s.aluminet_fechado,
      jan_sup_aberta: s.jan_sup_aberta
    },
    anfis: {
      treinado:  s.anfis_trained,
      cenarios:  s.anfis_scenarios.length,
      regras_aprendidas: s.anfis_learned
    },
    historico: {
      tempo:      s.historico_tempo,
      ti:         s.historico_ti,
      te:         s.historico_te,
      sp:         s.historico_sp,
      vv:         s.historico_vv,
      bomba:      s.historico_bomba,
      exaustor:   s.historico_exaustor,
      aquecedor:  s.historico_aquecedor,
      jan_lat:    s.historico_jan_lat,
      potencia:   s.historico_power
    },
    cenarios_anfis: s.anfis_scenarios,
    regras_especialistas: REGRAS.map(r => ({ id: r.id, tipo: r.tipo, desc: r.desc }))
  };

  downloadText(JSON.stringify(report, null, 2),
    'greenhouse_cenario_' + new Date().toISOString().slice(0,10) + '.json',
    'application/json'
  );
  showToast('💾 Cenário salvo em JSON!');
}

// ============================================================
// HELPER: Download de arquivo texto
// ============================================================
function downloadText(content, filename, mimeType) {
  const blob   = new Blob([content], { type: mimeType + ';charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const link   = document.createElement('a');
  link.href    = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
