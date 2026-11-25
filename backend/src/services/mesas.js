/**
 * Módulo 3 — Radar de Salão e SLA de Limpeza.
 * Status: livre → ocupada → aguardando_limpeza → livre
 * "crítico" é DERIVADO: aguardando limpeza há mais de 5 min (SLA).
 */
import { getDb, transaction } from '../db/index.js';
import { OPERACAO } from '../domain/operacao.js';
import { round1 } from '../domain/pricing.js';

export const STATUS = ['livre', 'ocupada', 'aguardando_limpeza'];
const PROXIMO = { livre: 'ocupada', ocupada: 'aguardando_limpeza', aguardando_limpeza: 'livre' };
const SLA_MS = OPERACAO.slaLimpezaMin * 60000;

const comandaAleatoria = () => String(1001 + Math.floor(Math.random() * 999));

function decorar(m, agora) {
  const decorrido = agora - m.desde_ts;
  return {
    id: m.id,
    salao: m.salao,
    numero: m.numero,
    codigo: m.codigo,
    lugares: m.lugares,
    status: m.status,
    critico: m.status === 'aguardando_limpeza' && decorrido > SLA_MS,
    desdeTs: m.desde_ts,
    decorridoS: Math.round(decorrido / 1000),
    comanda: m.comanda,
  };
}

export function listarMesas() {
  const agora = Date.now();
  const rows = getDb().prepare('SELECT * FROM mesas ORDER BY salao, numero').all();
  return { serverNow: agora, mesas: rows.map((m) => decorar(m, agora)), metricas: metricasSalao(rows, agora) };
}

export function alterarStatus(id, novoStatus) {
  const db = getDb();
  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(Number(id));
  if (!mesa) {
    const err = new Error('Mesa não encontrada');
    err.status = 404;
    throw err;
  }
  const destino = novoStatus === 'proximo' || !novoStatus ? PROXIMO[mesa.status] : novoStatus;
  if (!STATUS.includes(destino)) {
    const err = new Error(`Status inválido: ${destino}`);
    err.status = 400;
    throw err;
  }
  if (destino === mesa.status) return decorar(mesa, Date.now());
  const agora = Date.now();
  transaction(() => {
    db.prepare('INSERT INTO mesa_eventos (mesa_id, salao, de_status, para_status, duracao_s, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      mesa.id, mesa.salao, mesa.status, destino, round1((agora - mesa.desde_ts) / 1000), new Date(agora).toISOString(),
    );
    db.prepare('UPDATE mesas SET status = ?, desde_ts = ?, comanda = ? WHERE id = ?').run(
      destino, agora, destino === 'ocupada' ? comandaAleatoria() : null, mesa.id,
    );
  });
  return decorar(db.prepare('SELECT * FROM mesas WHERE id = ?').get(mesa.id), agora);
}

/** Simula alguns segundos de operação real do salão (para a demo ao vivo). */
export function simularMovimento(intensidade = 1) {
  const db = getDb();
  const agora = Date.now();
  const mesas = db.prepare('SELECT * FROM mesas').all();
  const mudancas = [];
  for (const m of mesas) {
    const t = agora - m.desde_ts;
    let p;
    if (m.status === 'ocupada') p = t > 20 * 60000 ? 0.07 : 0.015; // clientes terminando
    else if (m.status === 'aguardando_limpeza') p = m.salao === 'superior' ? 0.08 : 0.16; // garçons limpando
    else p = 0.06; // novos clientes chegando
    if (Math.random() < p * intensidade) mudancas.push(m.id);
  }
  for (const id of mudancas.slice(0, 10)) alterarStatus(id, 'proximo');
  return { alteradas: Math.min(10, mudancas.length) };
}

export function metricasSalao(rows, agora = Date.now()) {
  const db = getDb();
  const total = rows.length || 1;
  const cont = { livre: 0, ocupada: 0, aguardando_limpeza: 0, critico: 0 };
  const porSalao = {};
  for (const s of OPERACAO.saloes) {
    porSalao[s.id] = { id: s.id, nome: s.nome, total: 0, livre: 0, ocupada: 0, aguardando_limpeza: 0, critico: 0, maiorEsperaS: 0 };
  }
  for (const m of rows) {
    const ps = porSalao[m.salao];
    ps.total += 1;
    cont[m.status] += 1;
    ps[m.status] += 1;
    if (m.status === 'aguardando_limpeza') {
      const t = agora - m.desde_ts;
      ps.maiorEsperaS = Math.max(ps.maiorEsperaS, Math.round(t / 1000));
      if (t > SLA_MS) {
        cont.critico += 1;
        ps.critico += 1;
      }
    }
  }

  const limpeza = db
    .prepare(`SELECT salao, AVG(duracao_s) AS media, COUNT(*) AS n,
              SUM(CASE WHEN duracao_s > ? THEN 1 ELSE 0 END) AS fora_sla
              FROM mesa_eventos WHERE de_status = 'aguardando_limpeza' AND para_status = 'livre' GROUP BY salao`)
    .all(OPERACAO.slaLimpezaMin * 60);
  let somaMedia = 0;
  let somaN = 0;
  let foraSla = 0;
  for (const l of limpeza) {
    if (porSalao[l.salao]) {
      porSalao[l.salao].tempoMedioLimpezaMin = round1(l.media / 60);
      porSalao[l.salao].slaCumprido = round1(100 - (l.fora_sla / l.n) * 100);
    }
    somaMedia += l.media * l.n;
    somaN += l.n;
    foraSla += l.fora_sla;
  }

  const saloes = Object.values(porSalao).map((s) => ({
    ...s,
    ocupacao: round1(((s.ocupada + s.aguardando_limpeza) / Math.max(1, s.total)) * 100),
    score: s.critico * 3 + s.aguardando_limpeza + (s.tempoMedioLimpezaMin || 0),
  }));
  const maisCritico = [...saloes].sort((a, b) => b.score - a.score)[0];

  return {
    total: rows.length,
    ...cont,
    ocupacao: round1(((cont.ocupada + cont.aguardando_limpeza) / total) * 100),
    tempoMedioLimpezaMin: somaN ? round1(somaMedia / somaN / 60) : 0,
    slaCumprido: somaN ? round1(100 - (foraSla / somaN) * 100) : 100,
    limpezasHoje: somaN,
    saloes,
    maisCritico: maisCritico ? { id: maisCritico.id, nome: maisCritico.nome, critico: maisCritico.critico, aguardando: maisCritico.aguardando_limpeza, tempoMedioLimpezaMin: maisCritico.tempoMedioLimpezaMin } : null,
  };
}
