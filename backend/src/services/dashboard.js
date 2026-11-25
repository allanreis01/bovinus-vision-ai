/**
 * Dashboard Executivo — KPIs consolidados das 4 frentes + insights cruzados.
 */
import { getDb } from '../db/index.js';
import { CATEGORIAS, OPERACAO, FATURAMENTO_BASE } from '../domain/operacao.js';
import { round1, round2 } from '../domain/pricing.js';
import { painelFilas } from './filas.js';
import { listarMesas } from './mesas.js';
import { analiseDesperdicio, resumoFeedback } from './desperdicio.js';
import { listarPratos } from './pratos.js';

const DIAS_MES = 26;

export function dashboard() {
  const db = getDb();
  const pratos = db.prepare('SELECT peso_g, valor_cobrado, cmv, margem_pct, classificacao, churrasco_pct, mix_json, hora FROM pratos').all();
  const n = pratos.length || 1;

  let receita = 0;
  let cmv = 0;
  let peso = 0;
  const gramasCat = {};
  const classes = { alta: 0, equilibrada: 0, alerta: 0 };
  const slots = new Map();

  for (const p of pratos) {
    receita += p.valor_cobrado;
    cmv += p.cmv;
    peso += p.peso_g;
    classes[p.classificacao] = (classes[p.classificacao] || 0) + 1;
    const mix = JSON.parse(p.mix_json);
    for (const [cat, pct] of Object.entries(mix)) gramasCat[cat] = (gramasCat[cat] || 0) + (p.peso_g * pct) / 100;

    const [h, m] = p.hora.split(':').map(Number);
    const chave = `${String(h).padStart(2, '0')}:${m < 30 ? '00' : '30'}`;
    const s = slots.get(chave) || { hora: chave, receita: 0, cmv: 0, pratos: 0, churrasco: 0, peso: 0 };
    s.receita += p.valor_cobrado;
    s.cmv += p.cmv;
    s.pratos += 1;
    s.peso += p.peso_g;
    s.churrasco += p.churrasco_pct;
    slots.set(chave, s);
  }

  const margemMedia = receita ? round1(((receita - cmv) / receita) * 100) : 0;
  const mixCategorias = Object.entries(gramasCat)
    .map(([cat, g]) => ({ categoria: cat, nome: CATEGORIAS[cat].curto, cor: CATEGORIAS[cat].cor, pct: round1((g / peso) * 100), kg: round2(g / 1000), gramasPorPrato: round1(g / n) }))
    .sort((a, b) => b.pct - a.pct);

  const margemPorHorario = [...slots.values()]
    .sort((a, b) => a.hora.localeCompare(b.hora))
    .map((s) => ({
      hora: s.hora,
      margem: round1(((s.receita - s.cmv) / s.receita) * 100),
      pratos: s.pratos,
      churrascoPct: round1(s.churrasco / s.pratos),
      receita: round2(s.receita),
      pesoMedio: Math.round(s.peso / s.pratos),
    }));

  const filas = painelFilas();
  const salao = listarMesas().metricas;
  const desperdicio = analiseDesperdicio();
  const feedback = resumoFeedback();
  const churrasqueira = filas.estacoes.find((e) => e.id === 'churrasqueira');
  const balanca = filas.estacoes.find((e) => e.id === 'balanca');

  /* ---------- insights cruzados ---------- */
  const insights = [];
  const cedo = margemPorHorario.filter((s) => s.hora < '13:30');
  const tarde = margemPorHorario.filter((s) => s.hora >= '13:30' && s.hora <= '15:30');
  if (cedo.length && tarde.length) {
    const mc = avg(cedo.map((s) => s.churrascoPct));
    const mt = avg(tarde.map((s) => s.churrascoPct));
    const gc = avg(cedo.map((s) => s.margem));
    const gt = avg(tarde.map((s) => s.margem));
    if (mt > mc) {
      insights.push({
        modulo: 'Balança IA',
        tipo: 'margem',
        texto: `Após 13h30, com a fila da churrasqueira menor, a proteína nobre sobe de ${round1(mc)}% para ${round1(mt)}% do prato e a margem cai ${round1(gc - gt)} p.p. — ajustar o ritmo de passagem dos cortes nobres no fim do almoço.`,
      });
    }
  }
  if (salao.maisCritico) {
    insights.push({
      modulo: 'Radar de Salão',
      tipo: 'limpeza',
      texto: `${salao.maisCritico.nome} é o mais crítico: tempo médio de limpeza de ${String(salao.maisCritico.tempoMedioLimpezaMin).replace('.', ',')} min (SLA: ${OPERACAO.slaLimpezaMin} min). Sugestão: garçom volante fixo no salão no pico.`,
    });
  }
  if (churrasqueira.status === 'gargalo') {
    insights.push({
      modulo: 'Filas',
      tipo: 'fila',
      texto: `Churrasqueira é o gargalo agora (${String(round1(churrasqueira.esperaMin)).replace('.', ',')} min de espera). +1 cortador reduz para ${String(round1(churrasqueira.comMaisUm)).replace('.', ',')} min.`,
    });
  }
  if (desperdicio.ranking[0]) {
    insights.push({
      modulo: 'Desperdício',
      tipo: 'desperdicio',
      texto: `${desperdicio.ranking[0].item} lidera as sobras (${String(desperdicio.ranking[0].participacao).replace('.', ',')}% do total descartado). Testar cuba menor / reposição mais frequente.`,
    });
  }

  /* ---------- ROI estimado ---------- */
  const ticketMedio = receita / n;
  const roi = [
    { frente: 'Mix do Prato (+1,5 p.p. de margem)', mensal: round2(FATURAMENTO_BASE * 0.015 * DIAS_MES), premissa: 'Ajuste do ritmo de cortes nobres nos horários de alerta' },
    { frente: 'Filas e Mesas (+2% de clientes no pico)', mensal: round2(OPERACAO.fluxoDiario * 0.02 * ticketMedio * DIAS_MES), premissa: 'Menos desistências e giro de mesa mais rápido' },
    { frente: 'Desperdício (−30% de sobras)', mensal: round2(desperdicio.custoDia * 0.3 * DIAS_MES), premissa: 'Ranking de rejeição + cubas paradas' },
  ];

  return {
    unidade: OPERACAO.unidade,
    kpis: {
      faturamentoBase: FATURAMENTO_BASE,
      formulaFaturamento: `${OPERACAO.fluxoDiario} clientes × ${OPERACAO.consumoMedioG} g × R$ ${OPERACAO.precoKg.toFixed(2).replace('.', ',')}/kg`,
      faturamentoRegistrado: round2(receita),
      pratosRegistrados: pratos.length,
      ticketMedio: round2(ticketMedio),
      pesoMedio: round1(peso / n),
      margemMedia,
      cmvMedio: round1(100 - margemMedia),
      filaChurrasqueiraMin: churrasqueira.esperaMin,
      filaBalancaMin: balanca.esperaMin,
      cenarioFila: filas.cenario.nome,
      tempoMedioLimpezaMin: salao.tempoMedioLimpezaMin,
      ocupacaoSalao: salao.ocupacao,
      mesasCriticas: salao.critico,
      indiceDesperdicio: desperdicio.indiceGeral,
      custoDesperdicioDia: desperdicio.custoDia,
      notaMedia: feedback.notaMedia,
      nps: feedback.nps,
    },
    classificacao: [
      { id: 'alta', nome: 'Alta Margem', qtd: classes.alta, pct: round1((classes.alta / n) * 100) },
      { id: 'equilibrada', nome: 'Equilibrada', qtd: classes.equilibrada, pct: round1((classes.equilibrada / n) * 100) },
      { id: 'alerta', nome: 'Alerta Proteína', qtd: classes.alerta, pct: round1((classes.alerta / n) * 100) },
    ],
    mixCategorias,
    margemPorHorario,
    rankingSobras: desperdicio.ranking.slice(0, 8),
    insights,
    roi: { itens: roi, totalMensal: round2(roi.reduce((s, r) => s + r.mensal, 0)) },
    ultimosPratos: listarPratos({ limite: 6 }),
    atualizadoEm: new Date().toISOString(),
  };
}

const avg = (arr) => arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
