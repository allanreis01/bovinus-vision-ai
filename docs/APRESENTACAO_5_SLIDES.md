# 🎤 Apresentação (5 Slides) & Roteiros — Bovinu'S Vision AI

**Equipe:** **O Cubo e Os Mágicos**  
- Allan Reis da Conceição — RA: `1539160`
- Gabriel Noriler Souza — RA: `1642714`
- Mayara Franciele Santos da Silva — RA: `1873454`

**Evento:** Hackathon FMU Tech 2026.2 — Parceria **Bovinu'S Grill & Beer (Unidade Augusta)**

---

## 📑 Estrutura Obrigatória dos 5 Slides

### Slide 1 — O Problema & Escopo Real (Unidade Augusta)
- **Título:** *A Balança Pesa Gramas. Ela Não Enxerga Margem.*
- **Dados reais da operação:**
  - `R$ 119,90/kg` (Buffet Livre `R$ 113,00`) · `482 g` consumo médio · `~618 clientes/dia` (`R$ 35.715/dia`).
  - `90 mesas` em 3 salões (`Principal 30`, `Superior 40`, `Inferior/Pista 20`).
  - Comandas com código de barras (`#1579`, `#1411`, `#1531`).
- **As 4 Dores do Almoço:**
  1. **Mix do Prato:** 482 g de picanha vs. 482 g de arroz/salada têm margens opostas.
  2. **Filas:** Gargalo na Churrasqueira/Balança às 12h30 e atraso na 1ª bebida.
  3. **Limpeza do Salão:** Mesas sujas no Salão Superior demoram > 5 min para girar.
  4. **Qualidade & Desperdício:** Sobras no retorno e cubas paradas sem visibilidade.
- **Escopo disciplinado:** Foco 100% na jornada do cliente no almoço e inteligência para o gerente (sem ERP de estoque, sem checkout online, sem mudar o modelo self-service).

### Slide 2 — A Solução: Bovinu'S Vision AI (Visão Computacional Híbrida)
- **Título:** *Inteligência Visual na Balança e no Salão — Sem Mudar o Hábito do Cliente*
- **Como funciona na balança:**
  - Câmera superior captura o prato + leitura automática do peso (`482 g`) e da comanda (`#1579`).
  - **IA Híbrida Infalível:** Google **Gemini Vision** para reconhecimento semântico + **Motor Local HSV (cor, textura e densidade)** em JS puro caso a API esteja indisponível.
- **Resultado instantâneo:** Bounding boxes por categoria, cálculo de **Valor Cobrado vs. CMV Real vs. Margem (%)** e semáforo de risco (*Alta Margem*, *Equilibrada*, *Alerta de Proteína Nobre*).

### Slide 3 — Arquitetura & Integração das 4 Frentes
- **Título:** *4 Módulos Conectados em Uma Única Torre de Controle*
- **Diagrama visual:**
  - `Balança & Câmera` → `API Express + Visão Híbrida` → `SQLite` → `Dashboard React`
- **As 4 frentes operando juntas:**
  1. **Balança IA:** Margem real por prato e por horário (ex.: queda de margem após 13h30).
  2. **Monitor de Filas (Erlang-C):** Simula Pico (12h30) vs Normal (14h00) e calcula impacto de `+1 cortador`.
  3. **Radar de Salão (90 Mesas):** Mapa clicável dos 3 salões com cronômetro SLA de limpeza (> 5 min pisca alerta).
  4. **Termômetro de Desperdício:** Scanner de retorno (sobras), giro/temperatura das cubas e avaliação rápida na comanda.

### Slide 4 — Demonstração Prática & Impacto Financeiro (ROI)
- **Título:** *Da Operação no Chão de Salão ao Resultado no Caixa*
- **Destaques da Demo ao Vivo:**
  - Escaneamento ao vivo de prato de Picanha (`540 g`) vs Prato Equilibrado (`482 g`).
  - Simulação de pico `12h30` mostrando +1 cortador reduzindo a fila da churrasqueira.
  - Salão Superior com alerta vermelho `> 05:00` sendo limpo em 1 clique.
- **ROI Mensal Estimado (26 dias úteis, Unidade Augusta):**
  - `+1,5 p.p.` na margem via controle do mix: **+ R$ 13,9 mil/mês**
  - `+2%` de giro/fluxo no pico sem desistência: **+ R$ 18,5 mil/mês**
  - `-30%` no custo de desperdício (ranking de sobras): **+ R$ 2,3 mil/mês**
  - **Potencial Total:** **~ R$ 34,8 mil/mês** em ganho operacional.

### Slide 5 — Equipe & Próximos Passos
- **Grupo: O Cubo e Os Mágicos**
  - Allan Reis da Conceição (RA `1539160`) · Gabriel Noriler Souza (RA `1642714`) · Mayara Franciele Santos da Silva (RA `1873454`)
- **Próximos passos de implantação na Unidade Augusta (30 dias):**
  1. **Semana 1:** Instalar webcam fixa acima da balança atual e integrar leitura serial do peso + leitor da comanda.
  2. **Semana 2:** Calibrar o CMV exato dos cortes e cubas com o gerente da Augusta.
  3. **Semana 3:** Disponibilizar o **Radar de Salão** em tablet para o líder de salão/garçons.
  4. **Semana 4:** Piloto completo no almoço (11h30–15h00) medindo redução do SLA de limpeza e ganho de margem.

---

## ⏱️ Roteiro Cronometrado — Pitch ao Vivo (4 Minutos)

| Tempo | Slide | Responsável | Fala Sugerida (Objetiva) |
| :--- | :---: | :--- | :--- |
| **0:00 – 0:45** | Slide 1 | **Allan** | Apresentação do grupo *O Cubo e Os Mágicos*. Contexto real da Augusta: 618 clientes/dia, 482g médios a R$ 119,90/kg, 90 mesas em 3 salões. A dor central: a balança sabe o peso, mas não sabe se tem 70% de picanha ou 70% de salada, e o gerente sofre no escuro com filas na churrasqueira, limpeza no Salão Superior e desperdício. |
| **0:45 – 1:35** | Slide 2 | **Mayara** | Apresentação do *Bovinu'S Vision AI* sem mudar nada na rotina do cliente nem inventar cardápio à la carte. Explicar a visão computacional híbrida: Gemini Vision + fallback local HSV offline. Mostra como identificamos as categorias e calculamos CMV e margem real por comanda na hora da pesagem. |
| **1:35 – 2:55** | Slides 3 & 4 (Demo) | **Gabriel** | Demonstração ao vivo no sistema rodando: (1) Dashboard com os R$ 35,7 mil/dia e insight das 13h30; (2) Balança IA escaneando prato de Picanha (`#1579`, alerta vermelho) vs Salada (alta margem); (3) Monitor de Filas simulando Pico 12h30 e adicionando `+1 cortador`; (4) Radar de Salão mostrando as 90 mesas e alerta > 5 min no Superior. |
| **2:55 – 3:35** | Slide 4 (ROI) | **Mayara** | Mostrar o Termômetro de Desperdício (ranking de sobras + cubas paradas) e o ROI projetado de ~R$ 34,8 mil/mês combinando margem do mix, redução de desistência na fila/mesa e menos desperdício. |
| **3:35 – 4:00** | Slide 5 | **Allan** | Plano de implantação em 4 semanas na Rua Augusta aproveitando a estrutura existente (balança, comanda e câmera USB simples). Encerramento e abertura para perguntas da banca. |

---

## 🎥 Roteiro Cronometrado — Vídeo Demo (2 Minutos)

| Tempo | Cena / Tela | Narração |
| :--- | :--- | :--- |
| **0:00 – 0:20** | **Abertura + Dashboard Executivo** | *"Olá banca! Somos o grupo O Cubo e Os Mágicos. Apresentamos o Bovinu'S Vision AI, criado sob medida para o almoço da Unidade Augusta: 618 clientes/dia, 482 gramas médios e 90 mesas em 3 salões."* |
| **0:20 – 0:55** | **Módulo 1 — Balança Inteligente IA** | Clicar no prato *Picanha & Linguiça*, inserir comanda `1579` e clicar em **Escanear**. Mostrar as bounding boxes, o valor cobrado (`R$ 119,90/kg`) vs CMV e o alerta de proteína nobre. Depois clicar no *Prato Equilibrado* (`482g`, comanda `1411`) e mostrar a margem saudável salva no SQLite. |
| **0:55 – 1:18** | **Módulo 2 — Monitor de Filas** | Abrir o Monitor de Filas no modo **Pico 12h30**, mostrar o gargalo na Churrasqueira (`> 4 min`) e clicar em **`+` cortador**, mostrando a fila cair imediatamente para menos de 1 minuto no gráfico do dia. |
| **1:18 – 1:40** | **Módulo 3 — Radar de Salão (90 Mesas)** | Mostrar as abas Principal (30), Superior (40) e Inferior (20). Destacar as mesas com alerta vermelho pulsante (`> 5 min`) no Salão Superior e clicar em uma mesa para registrar a limpeza ao vivo. |
| **1:40 – 2:00** | **Módulo 4 + Encerramento no Dashboard** | Mostrar rapidamente o **Ranking de Sobras**, as **Cubas de baixa saída** e voltar ao **Dashboard Executivo** destacando o ROI mensal estimado de ~R$ 34,8 mil/mês. *"Bovinu'S Vision AI: inteligência operacional sem atrito para a Unidade Augusta!"* |
