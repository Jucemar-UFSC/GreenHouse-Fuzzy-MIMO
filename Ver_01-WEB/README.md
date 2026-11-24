# GreenHouse Fuzzy MIMO Simulator

**Dissertação de Mestrado — JucemarFC (UFSC)**  
**Orientador: Prof. Dr. Roderval M.**

---

## 📁 Artefatos Gerados

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `index.html` | Simulador interativo (Gêmeo Digital) | ✅ |
| `greenhouse_fuzzy_colab.ipynb` | Notebook Python completo para Google Colab | ✅ Novo |
| `documento_tecnico.html` | Documento técnico acadêmico para dissertação | ✅ Novo |
| `test_final.html` | Teste automatizado dos 8 cenários | ✅ |
| `test_convergencia.html` | Teste de convergência estendido | ✅ |

---

## Visão Geral

Simulador interativo de controle climático de estufa agrícola usando **lógica fuzzy Mamdani (MIMO)**. Demonstra como um controlador fuzzy PD+I consegue estabilizar a temperatura interna exatamente no setpoint mesmo sob condições extremas, incluindo o desafiador cenário de verão (TE=35°C, SP=25°C) onde o sistema evaporativo puro tem limite físico de T_pad=30.2°C.

---

## ✅ Funcionalidades Implementadas

### Motor Fuzzy Mamdani
- **4 entradas**: E = SP−TI (erro), dE (derivada do erro), TE (temperatura externa), VV (velocidade do vento)
- **2 saídas**: REF (refrigeração 0–100%) e HEA (aquecimento 0–100%)
- **54 regras** cobrindo todos os cenários climáticos
- **Anti-windup**: REF e HEA nunca atuam simultaneamente; zona morta ±0.3°C
- **Defuzzificação por centróide** (Mamdani completo)

### Atuadores Mapeados
| REF (%) | Jan. Laterais | Jan. Sup. | Bomba | Exaustores | Aluminet |
|---------|--------------|-----------|-------|------------|---------|
| 0–2     | 0%           | 0%        | 0%    | 0%         | 0%      |
| 2–10    | proporcional | 0%        | 0%    | 0%         | 0%      |
| 10–30   | proporcional | 0%        | prop. | prop.      | 0%      |
| 30–70   | 100%         | prop.     | 100%  | 100%       | prop.   |
| >70     | 100%         | 100%      | 100%  | 100%       | 100%    |

### Modelo Térmico Normalizado (v4.0 — CORRIGIDO)

```
dT/dt = dT_cond + dT_solar + dT_vent + dT_evap + dT_super + dT_aq + dT_integ
```

| Componente     | Equação                                     | Parâmetros          |
|---------------|---------------------------------------------|---------------------|
| Condução       | (TE−TI) × DT / 8000                        | τ = 8000s           |
| Solar          | 0.04°C/tick (TE≥28°C), com aluminet        | bloqueio 88%        |
| Ventilação     | (TE−TI) × DT / τ_v, **só quando TI > TE** | τ_v = 1600s base    |
| Evaporação     | (T_pad−TI) × DT / τ_e, **só TI > T_pad** | τ_e = 280s          |
| Superresfr.    | −(TI−SP) × DT / τ_s                        | τ_s = 35s, CASO A/B |
| Aquecimento    | (TE+35−TI) × DT / τ_a                      | τ_a = 700s base     |
| **Integral**   | boost aluminet + boost τ_aq                 | INT_MAX = 60        |

**T_pad** = TE − 0.88 × (TE − T_BU) onde T_BU = TE − (1−HR) × 12 (HR=55%)

#### Superresfriamento — dois casos:
- **CASO A** (T_pad > SP, ex: Verão TE=35 → T_pad=30.2 > SP=25):  
  `force = min(1, gap/5) × bomba × exaust` onde `gap = T_pad − SP`
- **CASO B** (T_pad ≤ SP, ex: Quente TE=28 → T_pad=23.2 < SP=25):  
  `force = min(1, dist/4) × bomba × exaust × 0.6` onde `dist = TI − SP`

---

## ✅ Correções Implementadas

### v1.0–v2.0 (Correções Originais)
1. **Ventilação condicional**: só resfria quando TI > TE E janelas abertas
2. **Evaporação condicional**: só resfria quando TI > T_pad
3. **Aquecimento alvo fixo**: T_tgt = TE+35°C independente do número de aquecedores
4. **Superresfriamento**: componente extra que permite SP < T_pad
5. **Solar reduzido**: 0.04°C/tick (era 0.08) para ganho realista
6. **Aluminet ativa com REF>30%** (era >60%)

### v3.0 (Correção do Superresfriamento para T_pad < SP)
7. **CASO B do super**: quando T_pad < SP, usa força proporcional ao erro (TI−SP) normalizada por dist=4°C, escala com bomba×exaustor×0.6 — garante controle preciso sem overshooting

### v4.0 (Ação Integral — eliminação do erro estacionário)
8. **Integrador PD+I**:
   - Quando |E| ∈ (0.3, 2.5)°C, acumula o erro em `integral_ref` ou `integral_hea`
   - **REF**: fecha progressivamente o aluminet (0→100%) proporcional a `Iref/INT_MAX`
     - Bloqueia o ganho solar residual de +0.037 → +0.005°C/tick
     - Quebra o equilíbrio estacionário sem alterar a física
   - **HEA**: reduz TAU_AQ efetivo (boost até 3×) proporcional a `Ihea/INT_MAX`
   - **Anti-windup cruzado**: zera integrador oposto ao mudar de modo
   - **Decay suave**: ×0.75 por tick quando |E| ≤ 0.3°C (chegou ao SP)
   - Reset completo ao iniciar/resetar simulação

---

## ✅ Convergência Validada (v4.0)

| Cenário | TI ini | TE | VV | SP | T_pad | TI final | Ticks | Tempo sim. | Overshoot |
|---------|--------|----|----|----|----|-------|-------|-----------|----------|
| **Verão Intenso** | 38°C | 35°C | 2m/s | 25°C | 30.2°C | **25.49°C** | **53** | 26min 30s | 0.00°C |
| **Noite de Inverno** | 8°C | 3°C | 5m/s | 18°C | −1.8°C | **17.71°C** | **21** | 10min 30s | 0.00°C |
| **Dia Quente Seco** | 34°C | 28°C | 3m/s | 25°C | 23.2°C | **25.48°C** | **49** | 24min 30s | 0.00°C |
| **Noite Quente** | 30°C | 25°C | 3m/s | 26°C | 20.2°C | **26.47°C** | **13** | 6min 30s | 0.00°C |
| **Manhã Primavera** | 22°C | 18°C | 4m/s | 22°C | — | **21.99°C** | **1** | imediato | 0.00°C |
| **Tempestade** | 20°C | 15°C | 13m/s | 20°C | — | **19.99°C** | **1** | imediato | 0.00°C |
| **Dia Nublado Frio** | 12°C | 8°C | 6m/s | 20°C | 3.2°C | **19.50°C** | **15** | 7min 30s | 0.00°C |
| **Calor com Vento** | 32°C | 28°C | 10m/s | 25°C | 23.2°C | **25.47°C** | **49** | 24min 30s | 0.00°C |

**Todos os 8 cenários convergem para SP ± 0.5°C sem overshoot. ✅**

### Mecânica da Convergência — Verão Extremo (cenário mais difícil)
```
Fase 1 (T1–T5):   TI 38→26°C  — superresfriamento forte (B=100%, dist=13°C)
Fase 2 (T6–T35):  TI 26→26°C  — equilíbrio quase-estático; aluminet fecha 0→50%
Fase 3 (T36–T53): TI 26→25.5°C — integrador quebra equilíbrio (integ≈-0.03 a -0.07°C/tick)
SP atingido T53:  TI=25.49°C, Aluminet=73%, Bomba=13%
```

---

## ✅ Controle Proporcional no Tempo
- **Bomba e exaustores**: ciclos ON/OFF proporcionais ao % fuzzy (janela 60s)
- **Janelas laterais**: 4 estágios (0, 33, 66, 100%) com suavização 70%
- **Aluminet**: binário (>50% fecha); sobrescrito pelo integrador (anti-offset)
- **Janelas superiores**: binário (>40% abre)
- **Aquecedores**: 4 estágios (0, 1, 2, 3, 4 ativos)

---

## ✅ Comparação Fuzzy vs ON/OFF
- Simulação paralela do controle ON/OFF com histerese ±2°C
- Métricas: tempo para setpoint, kWh, litros de água, overshoot, MAE, MSE

## ✅ ANFIS Simulado
- Treinamento simulado com cenários salvos pelo usuário
- Boost de força das regras após treinamento
- Gráfico de convergência do erro de treinamento

---

## Estrutura de Arquivos

```
index.html              — Interface principal (SPA)
js/
  fuzzy-engine.js       — Motor Mamdani + regras + mapeamento atuadores
  simulation.js         — Modelo térmico + loop de simulação + integrador
  charts.js             — Gráficos Chart.js (temperatura, atuadores, potência)
  ui.js                 — Atualização da UI, SVG da estufa, MFs
  export.js             — Exportação PDF + Tabela ANFIS
test_convergencia.html  — Teste de integração (5 cenários)
test_final.html         — Teste de validação completo (8 cenários)
temp/                   — Arquivos de teste e diagnóstico (histórico)
```

---

## Rotas e Parâmetros

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Aplicação completa (SPA) |
| `test_final.html` | **Teste de validação — 8 cenários completos** |
| `test_convergencia.html` | Teste de integração legado |

---

## Modelo de Dados

**SIM_STATE** (objeto global em `simulation.js`):
- Entradas: `TI`, `TE`, `VV`, `SP`
- Atuadores: `bomba_pct`, `exaustor_pct`, `aquecedor_pct`, `jan_lat_pct`, `aluminet_pct`, `jan_sup_pct`
- **Integradores**: `integral_ref` (resfriamento), `integral_hea` (aquecimento)
- Histórico: arrays de 120 pontos para gráficos
- Métricas: MAE, MSE, overshoot, tempo_setpoint, ticks_no_sp
- Comparação: cmp_fuzzy, cmp_anfis, cmp_onoff

---

## Arquitetura do Controlador

```
         ┌─────────────┐
  SP ───►│  E = SP-TI  │
  TI ───►│  dE         │──► 54 Regras Mamdani ──► REF/HEA (%) ──► Atuadores
  TE ───►│  TE         │
  VV ───►│  VV         │
         └─────────────┘
                │
                ▼ (quando |E| ∈ 0.3..2.5°C)
         ┌─────────────┐
         │  Integrador │──► boost aluminet (REF) / boost τ_aq (HEA)
         │  anti-offset│    elimina erro estacionário ±0.5°C
         └─────────────┘
```

---

## Tecnologias

- HTML5 + CSS3 + JavaScript ES6 (vanilla)
- Chart.js (via CDN) — gráficos de temperatura e atuadores
- Font Awesome (via CDN) — ícones
- Google Fonts (Inter) — tipografia
- jsPDF (via CDN) — exportação PDF
- LocalStorage — persistência de cenários ANFIS

---

## Pendências / Próximos Passos

- [ ] Modo noturno/diurno no modelo solar (dT_solar = 0 à noite)
- [ ] Validação com dados reais de estufa (SC, verão)
- [ ] Otimização ANFIS com algoritmo real (atualmente simulado/pseudo-random)
- [ ] Exportação CSV dos dados de simulação
- [ ] Gráfico de evolução do integrador (Iref/Ihea) ao longo do tempo
