/**
 * Módulo 1 — Registro de pratos da Balança Inteligente.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { calcularPrato } from '../domain/pricing.js';
import { horaStr } from '../db/seed.js';

export function salvarImagem(buffer, prefixo, comanda) {
  if (!buffer) return null;
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const nome = `${prefixo}-${Date.now()}-${String(comanda).replace(/\W/g, '')}.jpg`;
  fs.writeFileSync(path.join(config.uploadsDir, nome), buffer);
  return `/uploads/${nome}`;
}

export function registrarPrato({ comanda, pesoG, modalidade, analise, imagem }) {
  const calc = calcularPrato({ pesoG, mix: analise.mix, modalidade });
  const agora = new Date();
  const info = getDb()
    .prepare(`INSERT INTO pratos
      (comanda, peso_g, modalidade, valor_cobrado, cmv, margem_pct, classificacao, churrasco_pct, mix_json, deteccoes_json, engine, imagem, origem, hora, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'balanca-ia', ?, ?)`)
    .run(
      String(comanda), calc.pesoG, calc.modalidade, calc.valorCobrado, calc.cmv, calc.margemPct, calc.classificacao,
      calc.mix.churrasco || 0, JSON.stringify(calc.mix), JSON.stringify(analise.deteccoes || []), analise.engine, imagem,
      horaStr(agora), agora.toISOString(),
    );
  return { id: Number(info.lastInsertRowid), criadoEm: agora.toISOString(), ...calc };
}

export function listarPratos({ limite = 20, origem } = {}) {
  const lim = Math.min(200, Math.max(1, Number(limite) || 20));
  const sql = origem
    ? 'SELECT * FROM pratos WHERE origem = ? ORDER BY id DESC LIMIT ?'
    : 'SELECT * FROM pratos ORDER BY id DESC LIMIT ?';
  const rows = origem ? getDb().prepare(sql).all(origem, lim) : getDb().prepare(sql).all(lim);
  return rows.map(mapPrato);
}

export function mapPrato(r) {
  return {
    id: r.id,
    comanda: r.comanda,
    pesoG: r.peso_g,
    modalidade: r.modalidade,
    valorCobrado: r.valor_cobrado,
    cmv: r.cmv,
    margemPct: r.margem_pct,
    classificacao: r.classificacao,
    churrascoPct: r.churrasco_pct,
    mix: JSON.parse(r.mix_json),
    engine: r.engine,
    imagem: r.imagem,
    origem: r.origem,
    hora: r.hora,
    criadoEm: r.created_at,
  };
}
