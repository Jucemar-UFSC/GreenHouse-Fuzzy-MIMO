# 🌿 GreenHouse Fuzzy MIMO Simulator
OTIMIZAÇÃO COMPUTACIONAL COM LÓGICA FUZZY APLICADA AO CONTROLE DE TEMPERATURA EM CASA DE VEGETAÇÃO

> Controlador Fuzzy Mamdani MIMO (4 entradas × 2 saídas) para regulação térmica de estufas com resfriamento evaporativo *pad-and-fan* — simulado sobre um modelo físico de 7 componentes, com benchmark experimental de 6 estratégias de controle em 24 horas simuladas.

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/JucemarFC/greenhouse-fuzzy-mimo/blob/main/0-GreenHouse_Fuzzy_MIMO_Simulator.ipynb)
![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)
![Jupyter](https://img.shields.io/badge/Jupyter-Notebook%20%2F%20Colab-orange.svg)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-green.svg)

**Dissertação de Mestrado — PPGTIC / UFSC** · autor: JucemarFC

---

## Sobre o projeto

Este notebook implementa e valida um **controlador fuzzy Mamdani MIMO** (Multiple Input, Multiple Output) para manter a temperatura interna de uma estufa (`TI`) próxima do setpoint (`SP`), acionando progressivamente os atuadores de um sistema de resfriamento evaporativo *pad-and-fan*, janelas, *aluminet* (sombreamento) e aquecedores elétricos.

O projeto responde a três perguntas de pesquisa:

1. Um controlador fuzzy MIMO converge ao setpoint com precisão e sem *overshoot* em condições climáticas adversas?
2. Ele supera o controle ON/OFF industrial (bang-bang) em precisão térmica e desgaste de atuadores?
3. Que estratégias de pós-processamento da saída fuzzy (TPC, histerese adaptativa) melhoram o trade-off **precisão × desgaste × consumo**?

> 🔬 O projeto é a contraparte em Python do motor fuzzy originalmente escrito em JavaScript (`js/fuzzy-engine.js`) — os parâmetros das funções de pertinência seguem exatamente o motor JS.

---

##  Destaques

-  **54 regras Mamdani** organizadas em 5 grupos semânticos, com defuzzificação por **centróide de singletons** (abordagem híbrida Mamdani–Sugeno)
-  **Modelo térmico físico de 7 componentes** (condução, radiação solar, ventilação, evaporação, superresfriamento, aquecimento e ação integral) em ticks de 30 s
-  **Mecanismos de proteção**: zona morta ±0,3 °C (impede resfriar/aquecer simultaneamente), anti-windup no integrador, saturação de segurança ±8 °C/tick
-  **6 tratamentos experimentais** comparados no mesmo modelo físico: ON/OFF, Fuzzy Baseline, Fuzzy+TPC, Fuzzy+Histerese Adaptativa, Fuzzy Híbrido e PID clássico com anti-windup
-  **11 cenários de simulação**: 3 climáticos de 24 h (2880 ticks) + 8 cenários de validação extrema
-  **Métricas completas**: MAE, RMSE, tempo até o setpoint, overshoot, comutações/hora (desgaste), energia (Wh) e água (L)
-  **Análise de custo operacional** em R$ (tarifas de energia e água), teste de robustez com **ruído de sensor** (σ = 0,3 °C) e **teste-t de Student** (α = 0,05)
-  **Relatório final em PDF** (9 páginas A4) gerado automaticamente com gráficos e comentários acadêmicos prontos para a banca

---

##  Arquitetura do Controlador

### Variáveis de entrada (4)

| Variável | Símbolo | Universo | Rótulos linguísticos | Descrição |
|-----------|---------|-------------|---------------------|------------|
| Erro de temperatura | `E = SP − TI` | [−25, +25] °C | MN, N, Z, P, MP | Diferença entre setpoint e temperatura interna |
| Derivada do erro | `dE` | [−8, +8] °C/tick | N, Z, P | Taxa de variação do erro |
| Temperatura externa | `TE` | [−10, +55] °C | Fria, Amena, Quente | Perturbação climática |
| Velocidade do vento | `VV` | [0, +20] m/s | Fraco, Medio, Forte | Ventilação natural / risco |

### Variáveis de saída (2)

| Variável | Símbolo | Universo | Atua sobre |
|-----------|---------|-------------|------------|
| Potência de resfriamento | `REF` | [0, 100] % | Bomba + exaustores + janelas + aluminet |
| Potência de aquecimento | `HEA` | [0, 100] % | Aquecedores elétricos (0–4 estágios) |

### Pipeline de inferência

```
Entradas (TI, TE, VV, SP)
    │
    ▼
Fuzzificação (trapmf / trimf implementadas à mão)
    │
    ▼
Avaliação das 54 regras — t-norm MÍNIMO (Mamdani clássico)
    │
    ▼
Agregação: somatório ponderado de singletons
    │
    ▼
Defuzzificação: centróide  →  REF*, HEA*  (0–100 %)
    │
    ▼
Anti-windup: zona morta ±0,3 °C
    │
    ▼
Mapeamento progressivo REF/HEA → atuadores físicos
```

### Mapeamento progressivo dos atuadores (REF → hardware)

| Saída fuzzy | Atuação |
|-------------|---------|
| `REF > 2 %` | Janelas laterais (proporcionais) |
| `REF > 10 %` | Bomba + exaustores (*pad-and-fan* completo) |
| `REF > 20 %` | Janelas superiores |
| `REF > 30 %` | *Aluminet* (bloqueia até 88 % da radiação solar) |

A **ação integral (PD+I)** elimina o erro em regime permanente: quando a temperatura fica presa entre 0,3 °C e 2,5 °C acima do SP, o *aluminet* fecha progressivamente e a bomba/exaustor recebem um ganho mínimo forçado (`BOMBA_INT_MIN = 55 %`).

---

##  Modelo térmico (Gêmeo Digital)

Estufa de **8 × 14 × 6 m**, passo de simulação `Δt = 30 s`, umidade relativa `HR = 55 %`, eficiência evaporativa do pad `88 %`.

$$\Delta T_{total}(k) = \Delta T_{cond} + \Delta T_{solar} + \Delta T_{vent} + \Delta T_{evap} + \Delta T_{super} + \Delta T_{aq} + \Delta T_{integ}$$

O limite termodinâmico do resfriamento evaporativo é dado pela temperatura do ar após o pad:

$$T_{BU} = T_E - (1 - HR) \cdot 12 \qquad T_{pad} = T_E - 0{,}88 \cdot (T_E - T_{BU})$$

> Exemplo: `TE = 35 °C, HR = 55 %` → `T_pad ≈ 30,2 °C`. Um SP de 25 °C no verão fica **no limite físico** do sistema — comportamento explorado nas análises de trade-off.

---

##  Delineamento experimental (Cap. 3 da dissertação)

### Tratamentos T1–T6

| Tratamento | Estratégia | Descrição |
|------------|-----------|------------|
| **T1** | ON/OFF tradicional | Histerese fixa ±2 °C, acionamento imediato (bang-bang) |
| **T2** | Fuzzy Baseline | Limiar fixo de 50 % sobre a saída fuzzy |
| **T3** | Fuzzy + TPC | Controle Proporcional por Tempo (janela de 5 min) |
| **T4** | Fuzzy + Histerese Adaptativa | Banda dinâmica ajustada pelo erro acumulado |
| **T5** | Fuzzy Híbrido | TPC + Histerese Adaptativa combinados |
| **T6** | PID clássico (benchmark) | PID discreto com anti-windup (clamping), ganhos Kp=3,0 / Ki=0,001 / Kd=30 |

Todos os tratamentos rodam sobre o **mesmo modelo térmico de 7 componentes**, garantindo comparação justa.

### Cenários climáticos (24 h — 2880 ticks, `seed = 42`)

| Cenário | Condição | TE | Vento | SP |
|---------|-----------|-----|-------|-----|
| `C1_Frio` | Inverno | 8–12 °C | ~5 m/s | 18 °C |
| `C2_Quente` | Verão | 28–32 °C | ~1 m/s | 25 °C |
| `C3_Transicao` | Primavera/outono | 15–30 °C | moderado | 22 °C |

### Cenários de validação extrema (8)

`VERÃO_INTENSO` (38→25 °C) · `INVERNO_NOITE` (8→18 °C) · `QUENTE_SECO` · `NOITE_QUENTE` · `MANHÃ_PRIMAVERA` · `TEMPESTADE` (13 m/s) · `NUBLADO_FRIO` · `CALOR_VENTO` (10 m/s)

### Métricas coletadas

`MAE` · `RMSE` · tempo até o setpoint (±0,5 °C) · `overshoot` · comutações/hora (desgaste de relés/motores) · energia (Wh, bomba 370 W + 2 exaustores 250 W + aquecedores 1500 W cada) · água (L) · convergência

---

##  Resultados principais

>  Números da execução de referência do notebook (`seed = 42`); cada nova execução regenera a tabela mestra.

- **Precisão térmica**: o T5 (Híbrido) atingiu MAE de **1,378 °C** contra **1,893 °C** do T1 (ON/OFF) — e a diferença foi validada com teste-t de Student (α = 0,05).
- **Desgaste de atuadores**: o T5 reduziu as comutações para **48/h** contra **78,8/h** do T1 — o ganho real do controle fuzzy em cenários-limite, protegendo relés, contatores e motores.
- **Trade-off honesto**: no cenário extremo C2 (SP = 25 °C ≈ T_pad ≈ 25,2 °C), o custo operacional do T5 foi maior (R$ 31,29 vs R$ 9,48 em 24 h) — o controlador prefere estabilidade a economia bruta quando o setpoint encosta no limite termodinâmico.
- **Robustez ao ruído** (σ = 0,3 °C no sensor): o T1 é naturalmente tolerante (banda larga ±2 °C age como filtro passa-baixa); o T5, com histerese adaptativa estreita, exige filtragem da leitura (média móvel) para evitar *chattering*.

---

##  Como executar

### Opção 1 — Google Colab (recomendado, zero instalação)

1. Clique no badge **Open In Colab** no topo deste README.
2. Menu `Ambiente de execução → Executar tudo` (`Ctrl+F9`).
3. Aguarde: a célula 1 instala as dependências; a bateria completa (6 tratamentos × 3 cenários × 24 h) roda em ~15–30 s.
4. No fim, baixe o relatório `Relatorio_Final_GreenHouse_Fuzzy_MIMO_Completo.pdf` no painel de arquivos (ícone de pastinha à esquerda).

> ⏱️ Execução completa: **~2 minutos** no Colab gratuito. Não requer GPU.

### Opção 2 — Máquina local

```bash
git clone https://github.com/JucemarFC/greenhouse-fuzzy-mimo.git
cd greenhouse-fuzzy-mimo
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
jupyter notebook GreenHouse_Fuzzy_MIMO_Simulator.ipynb
```

### Parâmetros para experimentar

| Parâmetro | Onde | Padrão |
|-----------|------|--------|
| Cenários 24 h | `gerar_cenario_24h()` | `C1_Frio`, `C2_Quente`, `C3_Transicao` |
| Seed | `gerar_cenario_24h(seed=...)` | `42` |
| Duração da simulação | `N_TICKS_24H` | `2880` (24 h) |
| Tarifas de custo | `TARIFA_ENERGIA`, `TARIFA_AGUA` | `0.85` R$/kWh, `6.50` R$/m³ |
| Novos cenários de validação | lista `CENARIOS` | `(nome, TI, TE, VV, SP, ticks)` |

---

##  Arquivos gerados pela execução

| Tipo | Arquivo | Conteúdo |
|------|---------|----------|
|  PDF | `Relatorio_Final_GreenHouse_Fuzzy_MIMO_Completo.pdf` | Relatório de 9 páginas (capa, 7 figuras com comentários acadêmicos, conclusões) |
|  CSV | `tabela_mestra_tratamentos_24h.csv` | Métricas dos 6 tratamentos × 3 cenários |
|  CSV | `metricas_tratamentos_24h.csv` | Consolidação T1–T5 (Cap. 3) |
|  CSV | `convergencia_fuzzy.csv` | Convergência nos 8 cenários de validação |
|  CSV | `comparacao_fuzzy_onoff.csv` | Fuzzy vs ON/OFF por cenário |
|  PNG | `mf_entradas.png` | Funções de pertinência das 4 entradas |
|  PNG | `resposta_temperatura.png` | TI × tempo nos 8 cenários |
|  PNG | `atuadores_verao.png` | Atuação progressiva dos 6 atuadores |
|  PNG | `componentes_termicos.png` | Decomposição dos 7 componentes térmicos |
|  PNG | `ativacao_mf.png` | Dinâmica de ativação das regras |
|  PNG | `figura_superficie_controle.png` | Superfícies de controle E × dE → REF / HEA (3D) |
|  PNG | `comparativo_final_6_tratamentos.png` | Painel comparativo final (Cap. 4) |

##  Estrutura do projeto

```
.
├── 0-GreenHouse_Fuzzy_MIMO_Simulator.ipynb   # aplicação principal (Colab/Jupyter)
├── requirements.txt                          # dependências do projeto
├── js/fuzzy-engine.js                        # motor fuzzy original (referência de parâmetros)
└── README.md
```

---

##  Roadmap

- [ ] Validação experimental em protótipo físico (Raspberry Pi / Arduino)
- [ ] Filtro de Kalman ou média móvel no sensor (robustez ao ruído do T5)
- [ ] Otimização automática de singletons e histerese com Algoritmos Genéticos / PSO
- [ ] Controle MIMO acoplado incluindo Umidade Relativa (UR)

---

##  Autor

**JucemarFC** — Professor Técnico em Informática (CEDUP/SC), docente em Sistemas de Informação (Esucri), mestrando em Tecnologias da Informação (PPGTIC/UFSC).

##  Licença

MIT — consulte o arquivo `LICENSE`.
