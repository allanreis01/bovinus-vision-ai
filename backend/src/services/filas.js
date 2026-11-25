/**
 * Módulo 2 — Monitor de Filas e Gargalos.
 *
 * Modelo de Teoria das Filas M/M/c (Erlang C) por estação do buffet:
 *   λ  = taxa de chegada (clientes/min), derivada da MESMA curva de chegada
 *        usada no seed (618 clientes/dia, pico às 12h30);
 *   μ  = taxa de atendimento por servidor (cortador, balança, posição);
 *   c  = nº de servidores (equipe configurável ao vivo no painel).
 * Wq = C(c, a) / (cμ − λ)  — tempo médio de espera na fila.
 */
import { OPERACAO } from '../domain/operacao.js';
import { round1, round2 } from '../domain/pricing.js';
import { pesoChegada } from '../db/seed.js';
import { getSetting, setSetting, getDb } from '../db/index.js';
import { jitter } from '../utils/random.js';

export const ESTACOES = [
  { id: 'saladas', nome: 'Saladas', fracao: 0.9, mu: 1.1, servidoresPadrao: 5, recurso: 'posições de serviço', limiteMin: 2.5, acao: 'abrir o 2º lado do buffet de saladas' },
  { id: 'quentes', nome: 'Quentes', fracao: 0.88, mu: 1.25, servidoresPadrao: 4, recurso: 'posições de serviço', limiteMin: 2.5, acao: 'duplicar as cubas de maior giro (arroz/feijão)' },
  { id: 'churrasqueira', nome: 'Churrasqueira', fracao: 0.86, mu: 1.305, servidoresPadrao: 3, recurso: 'cortadores', limiteMin: 4, acao: 'reforço de cortador na churrasqueira' },
  { id: 'balanca', nome: 'Balança', fracao: 1.0, mu: 2.33, servidoresPadrao: 2, recurso: 'balanças/operadores', limiteMin: 2, acao: 'abrir a balança reserva com operador' },
];

export const CENARIOS = {
  pico: { id: 'pico', nome: 'Horário de Pico', hora: '12:30', minDesde11h: 90, ocupacaoSalao: 0.88 },
  normal: { id: 'normal', nome: 'Horário Normal', hora: '14:00', minDesde11h: 180, ocupacaoSalao: 0.55 },
};

const GARCONS_PADRAO = 9;
const LIMITE_BEBIDA_MIN = 4;

/* ---------------- curva de demanda ---------------- */
let somaCurva = 0;
for (let m = 0; m < 270; m += 1) somaCurva += pesoChegada(m);

/** Clientes por minuto em um instante do almoço. */
export const taxaChegada = (minDesde11h) => (OPERACAO.fluxoDiario * pesoChegada(minDesde11h)) / somaCurva;

/* ---------------- Erlang C ---------------- */
export function erlangC(lambda, mu, c) {
  const a = lambda / mu;
  const rho = a / c;
  if (rho >= 1) return { pEspera: 1, wqMin: Infinity, rho };
  let soma = 0;
  let termo = 1;
  for (let k = 0; k < c; k += 1) {
    if (k > 0) termo *= a / k;
    soma += termo;
  }
  const termoC = (termo * a) / c / (1 - rho);
  const pEspera = termoC / (soma + termoC);
  return { pEspera, wqMin: pEspera / (c * mu - lambda), rho };
}

const LIMITE_WQ = 15;

function medirEstacao(est, lambdaTotal, c) {
  const lambda = lambdaTotal * est.fracao;
  const { wqMin, rho, pEspera } = erlangC(lambda, est.mu, c);
  const wq = Math.min(LIMITE_WQ, wqMin);
  const pessoasFila = Number.isFinite(wqMin) ? lambda * wq : lambda * LIMITE_WQ;
  let status = 'ok';
  if (wq > est.limiteMin) status = 'gargalo';
  else if (wq > est.limiteMin * 0.6) status = 'atencao';
  return {
    id: est.id,
    nome: est.nome,
    recurso: est.recurso,
    servidores: c,
    lambda: round2(lambda),
    capacidade: round2(c * est.mu),
    utilizacao: round1(Math.min(100, rho * 100)),
    probEspera: round1(pEspera * 100),
    esperaMin: round2(wq),
    atendimentoMin: round2(1 / est.mu),
    pessoasFila: Math.round(pessoasFila),
    limiteMin: est.limiteMin,
    status,
    colapso: !Number.isFinite(wqMin),
  };
}

/* ---------------- estado (cenário + equipe) ---------------- */
export function getConfigFila() {
  const cfg = getSetting('fila_config', { cenario: 'pico', equipe: {} }) || {};
  const equipe = { garcons: GARCONS_PADRAO };
  for (const e of ESTACOES) equipe[e.id] = e.servidoresPadrao;
  return { cenario: CENARIOS[cfg.cenario] ? cfg.cenario : 'pico', equipe: { ...equipe, ...(cfg.equipe || {}) } };
}

export function setConfigFila({ cenario, equipe }) {
  const atual = getConfigFila();
  const nova = {
    cenario: CENARIOS[cenario] ? cenario : atual.cenario,
    equipe: { ...atual.equipe },
  };
  for (const [k, v] of Object.entries(equipe || {})) {
    if (k in nova.equipe) nova.equipe[k] = Math.max(1, Math.min(k === 'garcons' ? 20 : 8, Math.round(Number(v) || 1)));
  }
  setSetting('fila_config', nova);
  return nova;
}

/* ---------------- painel ---------------- */
export function painelFilas({ comRuido = true } = {}) {
  const { cenario, equipe } = getConfigFila();
  const cen = CENARIOS[cenario];
  const lambdaBase = taxaChegada(cen.minDesde11h);
  const lambda = comRuido ? jitter(lambdaBase, 0.02) : lambdaBase;

  const estacoes = ESTACOES.map((e) => medirEstacao(e, lambda, equipe[e.id]));

  // Simulação "e se?" — impacto de +1 servidor em cada estação
  for (const st of estacoes) {
    const est = ESTACOES.find((e) => e.id === st.id);
    st.comMaisUm = round2(Math.min(LIMITE_WQ, erlangC(lambda * est.fracao, est.mu, st.servidores + 1).wqMin));
  }

  // 1º atendimento de bebida na mesa: depende de mesas ocupadas por garçom
  const totalMesas = OPERACAO.saloes.reduce((s, x) => s + x.mesas, 0);
  const ocupadasReais = getDb().prepare("SELECT COUNT(*) AS n FROM mesas WHERE status = 'ocupada'").get().n;
  const ocupadas = Math.max(ocupadasReais, Math.round(totalMesas * cen.ocupacaoSalao));
  const bebidaMin = round2((comRuido ? jitter(1, 0.06) : 1) * (1.2 + (ocupadas / equipe.garcons) * 0.42));
  const bebidaMaisUm = round2(1.2 + (ocupadas / (equipe.garcons + 1)) * 0.42);

  const alertas = [];
  for (const st of estacoes) {
    const est = ESTACOES.find((e) => e.id === st.id);
    if (st.status === 'gargalo') {
      alertas.push({
        severidade: 'critico',
        estacao: st.nome,
        titulo: `Fila na ${st.nome} > ${String(est.limiteMin).replace('.', ',')} min`,
        mensagem: `Espera atual de ${fmtMin(st.esperaMin)} com ${st.pessoasFila} clientes na fila (utilização ${st.utilizacao}%).`,
        acao: `Recomendar ${est.acao}.`,
        impacto: `Com +1 ${singular(st.recurso)}: espera cai para ${fmtMin(st.comMaisUm)}.`,
      });
    } else if (st.status === 'atencao') {
      alertas.push({
        severidade: 'atencao',
        estacao: st.nome,
        titulo: `${st.nome} se aproximando do limite`,
        mensagem: `Espera de ${fmtMin(st.esperaMin)} (limite ${fmtMin(est.limiteMin)}).`,
        acao: `Deixar equipe de prontidão para ${est.acao}.`,
        impacto: `Com +1 ${singular(st.recurso)}: ${fmtMin(st.comMaisUm)}.`,
      });
    }
  }
  if (bebidaMin > LIMITE_BEBIDA_MIN) {
    alertas.push({
      severidade: 'critico',
      estacao: 'Salão',
      titulo: `1º atendimento de bebida > ${LIMITE_BEBIDA_MIN} min`,
      mensagem: `${ocupadas} mesas ocupadas para ${equipe.garcons} garçons (${round1(ocupadas / equipe.garcons)} mesas/garçom).`,
      acao: 'Remanejar 1 garçom para o Salão Superior (maior nº de mesas).',
      impacto: `Com +1 garçom: ${fmtMin(bebidaMaisUm)}.`,
    });
  }

  const jornadaMin = round1(estacoes.reduce((s, e) => s + e.esperaMin + e.atendimentoMin, 0) + 0.5);

  return {
    cenario: cen,
    equipe,
    chegadasPorMin: round2(lambda),
    clientesNaHora: Math.round(lambda * 60),
    estacoes,
    bebida: {
      esperaMin: bebidaMin,
      comMaisUm: bebidaMaisUm,
      mesasOcupadas: ocupadas,
      garcons: equipe.garcons,
      limiteMin: LIMITE_BEBIDA_MIN,
      status: bebidaMin > LIMITE_BEBIDA_MIN ? 'gargalo' : bebidaMin > LIMITE_BEBIDA_MIN * 0.75 ? 'atencao' : 'ok',
    },
    jornadaMin,
    alertas,
    curvaDia: curvaDoDia(equipe),
    atualizadoEm: new Date().toISOString(),
  };
}

/** Espera prevista ao longo do almoço (11h00–15h30) com a equipe atual. */
export function curvaDoDia(equipe) {
  const pontos = [];
  for (let m = 0; m <= 270; m += 15) {
    const lambda = taxaChegada(Math.min(269, m));
    const hora = 11 * 60 + m;
    const p = { hora: `${String(Math.floor(hora / 60)).padStart(2, '0')}:${String(hora % 60).padStart(2, '0')}`, chegadas: round1(lambda * 60) };
    for (const e of ESTACOES) p[e.id] = round2(Math.min(LIMITE_WQ, erlangC(lambda * e.fracao, e.mu, equipe[e.id]).wqMin));
    pontos.push(p);
  }
  return pontos;
}

function fmtMin(min) {
  if (!Number.isFinite(min)) return '> 15 min';
  if (min < 1) return `${Math.round(min * 60)} s`;
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return s ? `${m} min ${String(s).padStart(2, '0')} s` : `${m} min`;
}

const singular = (recurso) =>
  ({ cortadores: 'cortador', 'balanças/operadores': 'balança', 'posições de serviço': 'posição' })[recurso] || recurso;
