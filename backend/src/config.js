/**
 * Configuração central do backend.
 * Carrega variáveis de ambiente do .env da raiz (ou de backend/.env).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BACKEND_ROOT = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });
dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

export const config = {
  port: Number(process.env.PORT) || 3001,
  dbPath: path.resolve(BACKEND_ROOT, process.env.DB_PATH || 'data/bovinus.db'),
  uploadsDir: path.join(BACKEND_ROOT, 'uploads'),
  gemini: {
    apiKey: (process.env.GEMINI_API_KEY || '').trim(),
    model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 15000,
  },
};

export const geminiEnabled = () => config.gemini.apiKey.length > 10;
