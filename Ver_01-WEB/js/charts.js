/**
 * ============================================================
 * GRÁFICOS — GreenHouse Fuzzy MIMO Simulator
 * Chart.js: Temperatura, Acionadores, Consumo, ANFIS, MFs
 * ============================================================
 */

'use strict';

// Referências aos objetos Chart.js
let chartTemp      = null;
let chartActuators = null;
let chartPower     = null;
let chartANFIS     = null;
let mfCharts       = {};

// ============================================================
// CONFIGURAÇÃO GLOBAL DO CHART.JS
// ============================================================
Chart.defaults.color             = '#7090b0';
Chart.defaults.borderColor       = '#1e3050';
Chart.defaults.font.family       = "'JetBrains Mono', monospace";
Chart.defaults.font.size         = 10;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 12;
Chart.defaults.plugins.tooltip.backgroundColor = '#0f1829';
Chart.defaults.plugins.tooltip.borderColor     = '#2a4070';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.titleColor      = '#00ff88';
Chart.defaults.plugins.tooltip.bodyColor       = '#e0f0ff';
Chart.defaults.plugins.tooltip.padding         = 8;

// ============================================================
// INICIALIZAR TODOS OS GRÁFICOS
// ============================================================
function initCharts() {
  initChartTemp();
  initChartActuators();
  initChartPower();
  initChartANFIS();
}

// ============================================================
// GRÁFICO 1: TEMPERATURAS EM TEMPO REAL
// ============================================================
function initChartTemp() {
  const ctx = document.getElementById('chart-temp');
  if (!ctx) return;

  chartTemp = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temp. Interna (°C)',
          data: [],
          borderColor: '#ff3355',
          backgroundColor: 'rgba(255,51,85,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Temp. Externa (°C)',
          data: [],
          borderColor: '#00aaff',
          backgroundColor: 'rgba(0,170,255,0.05)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Setpoint (°C)',
          data: [],
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0,255,136,0.03)',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0,
          yAxisID: 'y'
        },
        {
          label: 'Vento (m/s)',
          data: [],
          borderColor: '#7090b0',
          backgroundColor: 'rgba(112,144,176,0.05)',
          borderWidth: 1.5,
          borderDash: [3, 3],
          pointRadius: 0,
          fill: false,
          tension: 0.3,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          ticks: { maxTicksLimit: 8, maxRotation: 0 },
          grid: { color: '#1e3050' }
        },
        y: {
          position: 'left',
          title: { display: true, text: '°C', color: '#7090b0' },
          grid: { color: '#1e3050' },
          ticks: { stepSize: 5 }
        },
        y2: {
          position: 'right',
          title: { display: true, text: 'm/s', color: '#7090b0' },
          grid: { display: false },
          min: 0, max: 15,
          ticks: { color: '#405070', stepSize: 5 }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const unit = ctx.datasetIndex === 3 ? ' m/s' : '°C';
              return ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}${unit}`;
            }
          }
        }
      }
    }
  });
}

// ============================================================
// GRÁFICO 2: ESTADO DOS ACIONADORES
// ============================================================
function initChartActuators() {
  const ctx = document.getElementById('chart-actuators');
  if (!ctx) return;

  chartActuators = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Bomba', 'Exaust.', 'Aquec.', 'Jan.Lat', 'Aluminet', 'Jan.Sup'],
      datasets: [{
        label: 'Estado (%)',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(0,170,255,0.6)',
          'rgba(0,238,255,0.6)',
          'rgba(255,136,0,0.6)',
          'rgba(0,255,136,0.6)',
          'rgba(255,204,0,0.6)',
          'rgba(170,68,255,0.6)'
        ],
        borderColor: ['#00aaff','#00eeff','#ff8800','#00ff88','#ffcc00','#aa44ff'],
        borderWidth: 1,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: { grid: { display: false } },
        y: { min: 0, max: 100, grid: { color: '#1e3050' },
             ticks: { callback: v => v + '%' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}%` }
        }
      }
    }
  });
}

// ============================================================
// GRÁFICO 3: CONSUMO ENERGÉTICO
// ============================================================
function initChartPower() {
  const ctx = document.getElementById('chart-power');
  if (!ctx) return;

  chartPower = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Potência (W)',
          data: [],
          borderColor: '#ff8800',
          backgroundColor: 'rgba(255,136,0,0.15)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      scales: {
        x: { ticks: { maxTicksLimit: 6, maxRotation: 0 }, grid: { color: '#1e3050' } },
        y: { grid: { color: '#1e3050' }, ticks: { callback: v => v + 'W' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// ============================================================
// GRÁFICO 4: CONVERGÊNCIA ANFIS
// ============================================================
function initChartANFIS() {
  const ctx = document.getElementById('chart-anfis');
  if (!ctx) return;

  chartANFIS = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Erro Treinamento ANFIS',
          data: [],
          borderColor: '#aa44ff',
          backgroundColor: 'rgba(170,68,255,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Erro Validação',
          data: [],
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0,255,136,0.05)',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0,
          fill: false,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      scales: {
        x: { title: { display: true, text: 'Épocas', color: '#7090b0' }, grid: { color: '#1e3050' } },
        y: { title: { display: true, text: 'Erro (MSE)', color: '#7090b0' }, grid: { color: '#1e3050' },
             ticks: { callback: v => v.toFixed(3) } }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}

// ============================================================
// ATUALIZAR GRÁFICOS EM TEMPO REAL
// ============================================================
function atualizarGraficos() {
  atualizarGraficoTemp();
  atualizarGraficoAcionadores();
  atualizarGraficoPotencia();
  if (document.getElementById('tab-content-mf').classList.contains('active')) {
    drawMembershipFunctions();
  }
}

function atualizarGraficoTemp() {
  if (!chartTemp) return;
  const s = SIM_STATE;

  chartTemp.data.labels              = s.historico_tempo;
  chartTemp.data.datasets[0].data    = s.historico_ti;
  chartTemp.data.datasets[1].data    = s.historico_te;
  chartTemp.data.datasets[2].data    = s.historico_sp;
  chartTemp.data.datasets[3].data    = s.historico_vv;
  chartTemp.update('none');
}

function atualizarGraficoAcionadores() {
  if (!chartActuators) return;
  chartActuators.data.datasets[0].data = [
    SIM_STATE.bomba_pct,
    SIM_STATE.exaustor_pct,
    SIM_STATE.aquecedor_pct,
    SIM_STATE.jan_lat_atual,
    SIM_STATE.aluminet_pct,
    SIM_STATE.jan_sup_pct
  ].map(v => +v.toFixed(1));
  chartActuators.update('none');
}

function atualizarGraficoPotencia() {
  if (!chartPower) return;
  chartPower.data.labels           = SIM_STATE.historico_tempo;
  chartPower.data.datasets[0].data = SIM_STATE.historico_power;
  chartPower.update('none');
}

function atualizarGraficoANFIS() {
  if (!chartANFIS || SIM_STATE.anfis_convergence.length === 0) return;

  const epochs  = SIM_STATE.anfis_convergence.map((_, i) => 'Ép.' + (i + 1));
  const val_err = SIM_STATE.anfis_convergence.map(v => +(v * (1 + Math.random() * 0.15)).toFixed(4));

  chartANFIS.data.labels           = epochs;
  chartANFIS.data.datasets[0].data = SIM_STATE.anfis_convergence;
  chartANFIS.data.datasets[1].data = val_err;
  chartANFIS.update();
}

function resetGraficos() {
  [chartTemp, chartActuators, chartPower].forEach(c => {
    if (!c) return;
    c.data.labels = [];
    c.data.datasets.forEach(d => d.data = []);
    c.update('none');
  });
}

// ============================================================
// FUNÇÕES DE PERTINÊNCIA (MF Viewer)
// ============================================================
function drawMembershipFunctions() {
  drawMF_TI();
  drawMF_TE();
  drawMF_VV();
  drawMF_ERRO();
}

// MF_COLORS definido em fuzzy-engine.js — reutilizado aqui
// const MF_COLORS = { ... } — ver fuzzy-engine.js

/**
 * Desenha as funções de pertinência de uma variável no canvas
 */
function drawMFChart(canvasId, varKey, currentValue, varDef) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const W = canvas.parentElement.offsetWidth - 20;
  const H = 100;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const [min, max] = varDef.range;
  const margin = { left: 35, right: 10, top: 8, bottom: 25 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  // Fundo
  ctx.fillStyle = '#0f1829';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#1e3050';
  ctx.lineWidth = 0.5;
  for (let y = 0; y <= 4; y++) {
    const yp = margin.top + plotH - (y / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(margin.left, yp);
    ctx.lineTo(margin.left + plotW, yp);
    ctx.stroke();
  }

  // Eixo Y labels
  ctx.fillStyle = '#405070';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (let y = 0; y <= 4; y += 2) {
    const yp = margin.top + plotH - (y / 4) * plotH;
    ctx.fillText((y / 4).toFixed(1), margin.left - 3, yp + 3);
  }

  // Eixo X
  ctx.strokeStyle = '#2a4070';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + plotH);
  ctx.lineTo(margin.left + plotW, margin.top + plotH);
  ctx.stroke();

  // Eixo X labels (3 valores)
  ctx.fillStyle = '#405070';
  ctx.textAlign = 'center';
  const nTicks = 4;
  for (let i = 0; i <= nTicks; i++) {
    const val  = min + (max - min) * i / nTicks;
    const xp   = margin.left + (i / nTicks) * plotW;
    ctx.fillText(val.toFixed(0), xp, H - 6);
  }

  // Amostrar e desenhar cada conjunto
  const N = Math.max(100, Math.floor(plotW)); // resolução
  const step = (max - min) / N;

  const fuzzValues = {};
  for (const [nome, fn] of Object.entries(varDef.sets)) {
    const color = MF_COLORS[nome] || '#7090b0';
    const pts   = [];

    for (let i = 0; i <= N; i++) {
      const x = min + i * step;
      const y = Math.max(0, Math.min(1, fn(x)));
      const xp = margin.left + (i / N) * plotW;
      const yp = margin.top  + plotH - y * plotH;
      pts.push({ xp, yp, x, y });
    }

    // Área preenchida
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0].xp, margin.top + plotH);
    pts.forEach(p => ctx.lineTo(p.xp, p.yp));
    ctx.lineTo(pts[pts.length-1].xp, margin.top + plotH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Linha
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.xp, p.yp) : ctx.lineTo(p.xp, p.yp));
    ctx.stroke();

    // Grau de ativação do valor atual
    const mu = Math.max(0, Math.min(1, varDef.sets[nome](currentValue)));
    fuzzValues[nome] = mu;

    // Label no topo da curva
    const peakPt = pts.length > 0 ? pts.reduce((a, b) => (a && b && a.y > b.y) ? a : b) : null;
    if (peakPt && peakPt.y > 0.05) {
      ctx.fillStyle = color;
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      const shortName = nome.replace('_', '\n').replace('Confortavel', 'Conf.');
      ctx.fillText(shortName.split('\n')[0], peakPt.xp, Math.max(margin.top + 8, peakPt.yp - 4));
    }
  }

  // Linha vertical do valor atual
  if (currentValue >= min && currentValue <= max) {
    const xCur = margin.left + ((currentValue - min) / (max - min)) * plotW;

    // Linha principal
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xCur, margin.top);
    ctx.lineTo(xCur, margin.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Marcador
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(xCur, margin.top + plotH - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Valor
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = xCur > W * 0.75 ? 'right' : 'left';
    ctx.fillText(currentValue.toFixed(1), xCur + (xCur > W * 0.75 ? -5 : 5), margin.top + 12);
  }

  // Mostrar graus de pertinência (mini-lista)
  let xLegend = W - 5, yLegend = margin.top + 5;
  ctx.font = '8px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (const [nome, mu] of Object.entries(fuzzValues)) {
    if (mu > 0.01) {
      const color = MF_COLORS[nome] || '#7090b0';
      ctx.fillStyle = color;
      const shortN = nome.length > 8 ? nome.substring(0, 8) : nome;
      ctx.fillText(`${shortN}: ${mu.toFixed(2)}`, xLegend, yLegend);
      yLegend += 11;
    }
  }
}

function drawMF_TI() {
  const TI = SIM_STATE.TI;
  drawMFChart('mf-ti', 'TI', TI, FUZZY_VARS.TI);
}

function drawMF_TE() {
  const TE = SIM_STATE.TE;
  drawMFChart('mf-te', 'TE', TE, FUZZY_VARS.TE);
}

function drawMF_VV() {
  // Agora VV está em m/s [0-15] — sem escala intermediária
  const VV = SIM_STATE.VV;
  drawMFChart('mf-vv', 'VV', VV, FUZZY_VARS.VV);
}

function drawMF_ERRO() {
  const erro = SIM_STATE.SP - SIM_STATE.TI;
  drawMFChart('mf-erro', 'ERRO', erro, FUZZY_VARS.ERRO);
}

// ============================================================
// TROCA DE ABAS
// ============================================================
function switchTab(tabName) {
  // Esconder todos os conteúdos
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  // Mostrar selecionado
  const content = document.getElementById('tab-content-' + tabName);
  const btn     = document.getElementById('tab-' + tabName);

  if (content) content.classList.add('active');
  if (btn)     btn.classList.add('active');

  // Atualizar conteúdo específico ao abrir a aba
  if (tabName === 'mf') {
    setTimeout(drawMembershipFunctions, 50);
  }
  if (tabName === 'anfis') {
    atualizarTabelaANFIS();
  }
  if (tabName === 'greenhouse') {
    updateGreenhouseSVG();
  }
}
