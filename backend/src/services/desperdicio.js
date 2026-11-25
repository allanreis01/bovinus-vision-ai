/**
 * Módulo 4 — Termômetro de Desperdício e Qualidade.
 * Sobras no prato · Giro das cubas · Feedback rápido da comanda.
 */
import { getDb } from '../db/index.js';
import { CATEGORIAS, OPERACAO } from '../domain/operacao.js';
import { round1, round2 } from '../domain/pricing.js';
import { jitter } from '../utils/random.js';

const DIAS_OPERACAO_MES = 26;
export const TAGS_FEEDBACK = {
  positivas: ['Picanha no ponto', 'Buffet variado', 'Salão limpo', 'Atendimento rápido', 'Comida quentinha', 'Saladas frescas'],
  negativas: ['Fila na churrasqueira', 'Mesa demorou p/ limpar', 'Demora na bebida', 'Fila na balança', 'Peixe sem sabor', 'Arroz frio'],
};

/* ---------------- sobras ---------------- */
export function registrarSobra({ comanda, pesoSobraG, itens, engine = 'registro-rapido', imagem = null }) {
  const peso = Math.max(1, Number(pesoSobraG) || 0);
  let lista = (itens || []).filter((i) => CATEGORIAS[i.categoria]);
  if (lista.length === 0) lista = [{ item: 'Não identificado', categoria: 'arroz', gramas: peso }];
  // normaliza gramas para somar o peso da sobra
  const soma = lista.reduce((s, i) => s + (Number(i.gramas) || Number(i.percentual) || 1), 0);
  lista = lista.map((i) => ({
    item: i.item || CATEGORIAS[i.categoria].curto,
    categoria: i.categoria,
    gramas: round1(((Number(i.gramas) || Number(i.percentual) || 1) / soma) * peso),
  }));
  const agora = new Date().toISOString();
  const info = getDb()
    .prepare("INSERT INTO sobras (comanda, peso_sobra_g, itens_json, engine, imagem, origem, created_at) VALUES (?, ?, ?, ?, ?, 'scanner-retorno', ?)")
    .run(String(comanda || 'avulsa'), peso, JSON.stringify(lista), engine, imagem, agora);
  const custo = lista.reduce((s, i) => s + (i.gramas / 1000) * CATEGORIAS[i.categoria].cmvKg, 0);
  return { id: Number(info.lastInsertRowid), comanda, pesoSobraG: peso, itens: lista, custoDesperdicio: round2(custo), criadoEm: agora };
}

export function analiseDesperdicio() {
  const db = getDb();
  const sobras = db.prepare('SELECT * FROM sobras').all();
  const pratos = db.prepare('SELECT peso_g, mix_json FROM pratos').all();

  const servidoPorCat = {};
  let totalServido = 0;
  for (const p of pratos) {
    totalServido += p.peso_g;
    const mix = JSON.parse(p.mix_json);
    for (const [cat, pct] of Object.entries(mix)) servidoPorCat[cat] = (servidoPorCat[cat] || 0) + (p.peso_g * pct) / 100;
  }

  const porItem = new Map();
  const sobraPorCat = {};
  let totalSobra = 0;
  let custoTotal = 0;
  for (const s of sobras) {
    totalSobra += s.peso_sobra_g;
    for (const it of JSON.parse(s.itens_json)) {
      const atual = porItem.get(it.item) || { item: it.item, categoria: it.categoria, gramas: 0, ocorrencias: 0 };
      atual.gramas += it.gramas;
      atual.ocorrencias += 1;
      porItem.set(it.item, atual);
      sobraPorCat[it.categoria] = (sobraPorCat[it.categoria] || 0) + it.gramas;
      custoTotal += (it.gramas / 1000) * (CATEGORIAS[it.categoria]?.cmvKg || 0);
    }
  }

  const ranking = [...porItem.values()]
    .sort((a, b) => b.gramas - a.gramas)
    .map((r) => ({
      ...r,
      gramas: round1(r.gramas),
      kg: round2(r.gramas / 1000),
      participacao: round1((r.gramas / Math.max(1, totalSobra)) * 100),
      custo: round2((r.gramas / 1000) * (CATEGORIAS[r.categoria]?.cmvKg || 0)),
      cor: CATEGORIAS[r.categoria]?.cor,
    }));

  const porCategoria = Object.keys(CATEGORIAS)
    .map((cat) => ({
      categoria: cat,
      nome: CATEGORIAS[cat].curto,
      cor: CATEGORIAS[cat].cor,
      servidoKg: round2((servidoPorCat[cat] || 0) / 1000),
      sobraKg: round2((sobraPorCat[cat] || 0) / 1000),
      indice: servidoPorCat[cat] ? round1(((sobraPorCat[cat] || 0) / servidoPorCat[cat]) * 100) : 0,
    }))
    .filter((c) => c.servidoKg > 0);

  return {
    indiceGeral: totalServido ? round2((totalSobra / totalServido) * 100) : 0,
    totalSobraKg: round2(totalSobra / 1000),
    totalServidoKg: round2(totalServido / 1000),
    pratosComSobra: sobras.length,
    pctPratosComSobra: pratos.length ? round1((sobras.length / pratos.length) * 100) : 0,
    custoDia: round2(custoTotal),
    custoMesProjetado: round2(custoTotal * DIAS_OPERACAO_MES),
    receitaPerdidaDia: round2((totalSobra / 1000) * OPERACAO.precoKg),
    ranking,
    porCategoria,
    ultimas: db
      .prepare('SELECT * FROM sobras ORDER BY id DESC LIMIT 8')
      .all()
      .map((s) => ({ id: s.id, comanda: s.comanda, pesoSobraG: s.peso_sobra_g, itens: JSON.parse(s.itens_json), engine: s.engine, imagem: s.imagem, criadoEm: s.created_at })),
  };
}

/* ---------------- cubas ---------------- */
export function giroCubas() {
  const rows = getDb().prepare('SELECT * FROM cubas ORDER BY estacao, nome').all();
  const cubas = rows.map((c) => {
    const giro = round2(jitter(c.giro_kg_h, 0.06));
    const minSemSaida = round1(Math.max(0, jitter(c.min_sem_saida, 0.1)));
    const temp = round1(jitter(c.temperatura_c, 0.015));
    const ratio = giro / c.meta_giro_kg_h;
    const quente = c.estacao !== 'Saladas';
    const tempAlerta = quente ? temp < 60 : temp > 10;
    let status = 'normal';
    if (minSemSaida > 20 || ratio < 0.5) status = 'parada';
    else if (ratio > 1.12) status = 'alto_giro';
    const alertas = [];
    if (status === 'parada') alertas.push(`Baixa saída: ${round1(minSemSaida)} min sem retirada — avaliar aparência/sabor e reduzir cuba.`);
    if (tempAlerta) alertas.push(quente ? `Temperatura ${temp}°C abaixo de 60°C (RDC 216/ANVISA).` : `Temperatura ${temp}°C acima de 10°C para frios (RDC 216/ANVISA).`);
    return {
      id: c.id,
      nome: c.nome,
      categoria: c.categoria,
      estacao: c.estacao,
      giroKgH: giro,
      metaKgH: c.meta_giro_kg_h,
      giroPct: round1(ratio * 100),
      minSemSaida,
      temperatura: temp,
      tempAlerta,
      status,
      alertas,
    };
  });
  return {
    cubas,
    resumo: {
      total: cubas.length,
      paradas: cubas.filter((c) => c.status === 'parada').length,
      altoGiro: cubas.filter((c) => c.status === 'alto_giro').length,
      alertasTemperatura: cubas.filter((c) => c.tempAlerta).length,
    },
  };
}

/* ---------------- feedback ---------------- */
export function registrarFeedback({ comanda, nota, tags, comentario }) {
  const n = Math.max(1, Math.min(5, Math.round(Number(nota) || 0)));
  const validas = [...TAGS_FEEDBACK.positivas, ...TAGS_FEEDBACK.negativas];
  const t = (Array.isArray(tags) ? tags : []).filter((x) => validas.includes(x)).slice(0, 4);
  const texto = comentario ? String(comentario).slice(0, 240) : null;
  const agora = new Date().toISOString();
  const info = getDb()
    .prepare("INSERT INTO feedbacks (comanda, nota, tags_json, comentario, origem, created_at) VALUES (?, ?, ?, ?, 'qr-comanda', ?)")
    .run(String(comanda || 'anônima').slice(0, 12), n, JSON.stringify(t), texto, agora);
  return { id: Number(info.lastInsertRowid), comanda, nota: n, tags: t, comentario: texto, criadoEm: agora };
}

export function resumoFeedback() {
  const rows = getDb().prepare('SELECT * FROM feedbacks ORDER BY id DESC').all();
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const tags = {};
  let soma = 0;
  for (const r of rows) {
    dist[r.nota] += 1;
    soma += r.nota;
    for (const t of JSON.parse(r.tags_json)) tags[t] = (tags[t] || 0) + 1;
  }
  const total = rows.length || 1;
  const promotores = dist[5];
  const detratores = dist[1] + dist[2] + dist[3];
  return {
    total: rows.length,
    notaMedia: round2(soma / total),
    nps: Math.round(((promotores - detratores) / total) * 100),
    distribuicao: Object.entries(dist).map(([nota, qtd]) => ({ nota: Number(nota), qtd })),
    tags: Object.entries(tags)
      .map(([tag, qtd]) => ({ tag, qtd, tipo: TAGS_FEEDBACK.positivas.includes(tag) ? 'positiva' : 'negativa' }))
      .sort((a, b) => b.qtd - a.qtd),
    tagsDisponiveis: TAGS_FEEDBACK,
    recentes: rows
      .filter((r) => r.comentario)
      .slice(0, 8)
      .map((r) => ({ id: r.id, comanda: r.comanda, nota: r.nota, tags: JSON.parse(r.tags_json), comentario: r.comentario, criadoEm: r.created_at })),
  };
}
