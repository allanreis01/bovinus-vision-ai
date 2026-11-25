/**
 * Camada de acesso ao SQLite.
 *
 * Estratégia "infalível" para a banca:
 *  1º tenta `better-sqlite3` (dependência opcional, binário pré-compilado);
 *  2º se não estiver disponível (ex.: Node muito novo sem prebuild), usa o
 *     SQLite NATIVO do Node (`node:sqlite`, Node >= 22.5) — zero compilação.
 * As duas APIs são compatíveis para prepare().run/get/all e exec().
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

const require = createRequire(import.meta.url);

let db = null;
let driver = 'desconhecido';

function abrirBanco(arquivo) {
  try {
    const Better = require('better-sqlite3');
    const conn = new Better(arquivo);
    driver = 'better-sqlite3';
    return conn;
  } catch {
    // Silencia o aviso "ExperimentalWarning" do SQLite nativo em versões antigas do Node
    const originalEmit = process.emitWarning;
    process.emitWarning = (w, ...args) =>
      String(w).includes('SQLite') ? undefined : originalEmit.call(process, w, ...args);
    const { DatabaseSync } = require('node:sqlite');
    process.emitWarning = originalEmit;
    driver = 'node:sqlite (nativo)';
    return new DatabaseSync(arquivo);
  }
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = abrirBanco(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  return db;
}

export const getDriver = () => driver;

/** Transação portátil (funciona nos dois drivers). */
export function transaction(fn) {
  const conn = getDb();
  conn.exec('BEGIN');
  try {
    const r = fn(conn);
    conn.exec('COMMIT');
    return r;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

export function getSetting(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function setSetting(key, value) {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, JSON.stringify(value));
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
