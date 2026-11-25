/**
 * Bovinu'S Vision AI — Servidor da API
 * Hackathon FMU Tech 2026.2 · Grupo "O Cubo e Os Mágicos"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config, geminiEnabled, PROJECT_ROOT } from './config.js';
import { getDb, getDriver } from './db/index.js';
import { seedIfNeeded } from './db/seed.js';
import { api } from './routes/api.js';

export function createApp() {
  getDb();
  seedIfNeeded();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  fs.mkdirSync(config.uploadsDir, { recursive: true });
  app.use('/uploads', express.static(config.uploadsDir, { maxAge: '1h' }));
  app.use('/api', api);

  // Em produção (npm run build), serve o frontend compilado pela própria API
  const dist = path.join(PROJECT_ROOT, 'frontend', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

  // Tratamento centralizado de erros (Express 5 captura erros de handlers async)
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error('[API] Erro interno:', err);
    res.status(status).json({ erro: status >= 500 ? 'Erro interno no servidor' : err.message });
  });

  return app;
}

const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
const isMain = Boolean(process.argv[1]) && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url));

if (isMain) {
  const app = createApp();
  app.listen(config.port, () => {
    console.log('\n  🥩  Bovinu\'S Vision AI — API pronta');
    console.log(`  ➜  http://localhost:${config.port}/api/health`);
    console.log(`  ➜  Banco SQLite: ${getDriver()} (${path.relative(PROJECT_ROOT, config.dbPath)})`);
    console.log(`  ➜  Visão Computacional: ${geminiEnabled() ? `Gemini Vision (${config.gemini.model}) + fallback local` : 'CV local (HSV) — defina GEMINI_API_KEY para ativar o Gemini'}\n`);
  });
}
