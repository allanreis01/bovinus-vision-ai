/**
 * Motor de precificação e margem do prato.
 * Valor cobrado (peso × R$ 119,90/kg ou Buffet Livre R$ 113,00)
 * vs. CMV estimado pelo mix detectado pela Visão Computacional.
 */
import { OPERACAO, CATEGORIAS, CATEGORIA_IDS, CLASSIFICACAO } from './operacao.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const round1 = (n) => Math.round((Number(n) + Number.EPSILON) * 10) / 10;

/** Normaliza um mix {categoria: pct} para somar exatamente 100. */
export function normalizarMix(mix) {
  const limpo = {};
  let total = 0;
  for (const id of CATEGORIA_IDS) {
    const v = Math.max(0, Number(mix?.[id]) || 0);
    if (v > 0) {
      limpo[id] = v;
      total += v;
    }
  }
  if (total <= 0) return { arroz: 25, feijao: 15, salada: 25, churrasco: 25, quentes: 10 };
  const out = {};
  let acumulado = 0;
  const ids = Object.keys(limpo).sort((a, b) => limpo[b] - limpo[a]);
  ids.forEach((id, i) => {
    if (i === ids.length - 1) out[id] = round1(100 - acumulado);
    else {
      out[id] = round1((limpo[id] / total) * 100);
      acumulado += out[id];
    }
  });
  return out;
}

export function classificarPrato(margemPct, churrascoPct) {
  if (churrascoPct >= CLASSIFICACAO.limiteChurrascoPct || margemPct < CLASSIFICACAO.equilibrada.minMargem) {
    return CLASSIFICACAO.alerta;
  }
  if (margemPct >= CLASSIFICACAO.alta.minMargem) return CLASSIFICACAO.alta;
  return CLASSIFICACAO.equilibrada;
}

/**
 * @param {{pesoG:number, mix:Record<string,number>, modalidade?:'kg'|'buffet'}} p
 */
export function calcularPrato({ pesoG, mix, modalidade = 'kg' }) {
  const peso = Math.max(0, Number(pesoG) || 0);
  const mixN = normalizarMix(mix);
  const valorCobrado =
    modalidade === 'buffet' ? OPERACAO.buffetLivre : round2((peso / 1000) * OPERACAO.precoKg);

  const composicao = Object.entries(mixN).map(([id, pct]) => {
    const gramas = (peso * pct) / 100;
    const cmv = (gramas / 1000) * CATEGORIAS[id].cmvKg;
    return {
      categoria: id,
      nome: CATEGORIAS[id].nome,
      percentual: pct,
      gramas: round1(gramas),
      cmv: round2(cmv),
      receita: round2(valorCobrado * (pct / 100)),
    };
  });

  const cmv = round2(composicao.reduce((s, c) => s + c.cmv, 0));
  const margemValor = round2(valorCobrado - cmv);
  const margemPct = valorCobrado > 0 ? round1((margemValor / valorCobrado) * 100) : 0;
  const churrascoPct = mixN.churrasco || 0;
  const classe = classificarPrato(margemPct, churrascoPct);

  return {
    pesoG: peso,
    modalidade,
    precoKg: OPERACAO.precoKg,
    valorCobrado,
    cmv,
    cmvPct: valorCobrado > 0 ? round1((cmv / valorCobrado) * 100) : 0,
    margemValor,
    margemPct,
    classificacao: classe.id,
    classificacaoNome: classe.nome,
    classificacaoCor: classe.cor,
    mix: mixN,
    composicao,
    insight: gerarInsight(classe.id, mixN, margemPct),
  };
}

function gerarInsight(classe, mix, margem) {
  const top = Object.entries(mix).sort((a, b) => b[1] - a[1])[0];
  const topNome = top ? CATEGORIAS[top[0]].curto : '—';
  if (classe === 'alerta') {
    return `Prato com ${round1(mix.churrasco || 0)}% de proteína nobre: margem de ${margem}% está abaixo da meta. Avaliar ritmo de passagem dos cortes nobres na churrasqueira neste horário.`;
  }
  if (classe === 'equilibrada') {
    return `Mix equilibrado (predomínio: ${topNome}). Margem de ${margem}% dentro da faixa saudável da casa.`;
  }
  return `Prato de alta margem (${margem}%) — predomínio de ${topNome}. Ótima contribuição para o resultado do almoço.`;
}
