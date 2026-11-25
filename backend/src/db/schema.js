/** Esquema do banco SQLite do Bovinu'S Vision AI. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Módulo 1: cada pesagem na balança inteligente
CREATE TABLE IF NOT EXISTS pratos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  comanda         TEXT    NOT NULL,
  peso_g          REAL    NOT NULL,
  modalidade      TEXT    NOT NULL DEFAULT 'kg',
  valor_cobrado   REAL    NOT NULL,
  cmv             REAL    NOT NULL,
  margem_pct      REAL    NOT NULL,
  classificacao   TEXT    NOT NULL,
  churrasco_pct   REAL    NOT NULL DEFAULT 0,
  mix_json        TEXT    NOT NULL,
  deteccoes_json  TEXT,
  engine          TEXT    NOT NULL,
  imagem          TEXT,
  origem          TEXT    NOT NULL DEFAULT 'seed',
  hora            TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pratos_created ON pratos(created_at);
CREATE INDEX IF NOT EXISTS idx_pratos_comanda ON pratos(comanda);

-- Módulo 3: mesas dos 3 salões (~90 mesas)
CREATE TABLE IF NOT EXISTS mesas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  salao       TEXT    NOT NULL,
  numero      INTEGER NOT NULL,
  codigo      TEXT    NOT NULL UNIQUE,
  lugares     INTEGER NOT NULL DEFAULT 4,
  status      TEXT    NOT NULL DEFAULT 'livre',
  desde_ts    INTEGER NOT NULL,
  comanda     TEXT
);

CREATE TABLE IF NOT EXISTS mesa_eventos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mesa_id      INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  salao        TEXT    NOT NULL,
  de_status    TEXT    NOT NULL,
  para_status  TEXT    NOT NULL,
  duracao_s    REAL    NOT NULL,
  created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mesa_eventos ON mesa_eventos(de_status, para_status);

-- Módulo 4: sobras registradas no scanner de retorno
CREATE TABLE IF NOT EXISTS sobras (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  comanda       TEXT    NOT NULL,
  peso_sobra_g  REAL    NOT NULL,
  itens_json    TEXT    NOT NULL,
  engine        TEXT    NOT NULL,
  imagem        TEXT,
  origem        TEXT    NOT NULL DEFAULT 'seed',
  created_at    TEXT    NOT NULL
);

-- Módulo 4: giro das cubas do buffet (qualidade/tempo de exposição)
CREATE TABLE IF NOT EXISTS cubas (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nome               TEXT NOT NULL,
  categoria          TEXT NOT NULL,
  estacao            TEXT NOT NULL,
  giro_kg_h          REAL NOT NULL,
  meta_giro_kg_h     REAL NOT NULL,
  min_sem_saida      REAL NOT NULL,
  temperatura_c      REAL NOT NULL
);

-- Módulo 4: feedback rápido via QR da comanda
CREATE TABLE IF NOT EXISTS feedbacks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  comanda     TEXT    NOT NULL,
  nota        INTEGER NOT NULL,
  tags_json   TEXT    NOT NULL,
  comentario  TEXT,
  origem      TEXT    NOT NULL DEFAULT 'seed',
  created_at  TEXT    NOT NULL
);
`;
