/**
 * Orquestrador de Visão Computacional — HÍBRIDO E INFALÍVEL.
 *
 *   ┌──────────────┐   chave configurada?   ┌───────────────────┐
 *   │ Foto do prato│ ─────────── sim ─────▶ │ Gemini Vision API │──┐
 *   └──────────────┘                        └───────────────────┘  │ erro/timeout
 *          │ não                                                   ▼
 *          └──────────────────────────────▶ ┌───────────────────┐
 *                                           │ CV local (HSV)    │──┐ imagem ilegível
 *                                           └───────────────────┘  ▼
 *                                           ┌───────────────────┐
 *                                           │ Heurística média  │  (nunca falha)
 *                                           └───────────────────┘
 */
import crypto from 'node:crypto';
import { geminiEnabled, config } from '../../config.js';
import { analisarComGemini } from './gemini.js';
import { analisarLocal } from './localAnalyzer.js';
import { CATEGORIAS } from '../../domain/operacao.js';
import { mulberry32 } from '../../utils/random.js';

/** Última camada: mix médio da casa com variação determinística pela imagem. */
function heuristica(buffer, modo, motivo) {
  const hash = crypto.createHash('md5').update(buffer || Buffer.from(String(Date.now()))).digest();
  const rnd = mulberry32(hash.readUInt32LE(0));
  const base =
    modo === 'sobra'
      ? { arroz: 30, salada: 22, quentes: 20, churrasco: 18, feijao: 10 }
      : { churrasco: 31, arroz: 17, salada: 16, feijao: 12, quentes: 11, fritas: 8, massa: 5 };
  const mix = {};
  for (const [k, v] of Object.entries(base)) mix[k] = Math.max(1, v * (0.7 + rnd() * 0.6));
  return {
    engine: 'heuristica',
    modelo: 'Perfil médio Unidade Augusta',
    modo,
    mix,
    deteccoes: [],
    observacao: `Estimativa pelo perfil médio da casa (${motivo}).`,
    tempoMs: 1,
    valido: true,
  };
}

/**
 * Analisa a imagem e SEMPRE devolve um resultado.
 * @param {Buffer|null} buffer
 * @param {string} mimeType
 * @param {{modo?: 'prato'|'sobra', forcarLocal?: boolean}} opts
 */
export async function analisarImagem(buffer, mimeType, { modo = 'prato', forcarLocal = false } = {}) {
  const tentativas = [];

  if (buffer && geminiEnabled() && !forcarLocal) {
    try {
      const r = await analisarComGemini(buffer, mimeType, { modo });
      return { ...r, tentativas };
    } catch (err) {
      tentativas.push({ engine: 'gemini', erro: String(err.message || err).slice(0, 180) });
    }
  } else if (!geminiEnabled()) {
    tentativas.push({ engine: 'gemini', erro: 'GEMINI_API_KEY não configurada — usando CV local' });
  }

  if (buffer) {
    try {
      const r = analisarLocal(buffer, { modo });
      if (r.valido && Object.keys(r.mix).length > 0) return { ...r, tentativas };
      tentativas.push({ engine: 'local-cv', erro: 'Poucos pixels de alimento detectados' });
    } catch (err) {
      tentativas.push({ engine: 'local-cv', erro: String(err.message || err).slice(0, 180) });
    }
  }

  return { ...heuristica(buffer, modo, buffer ? 'imagem não reconhecida' : 'sem imagem'), tentativas };
}

export function statusVisao() {
  return {
    geminiConfigurado: geminiEnabled(),
    modeloGemini: config.gemini.model,
    engineAtiva: geminiEnabled() ? 'gemini' : 'local-cv',
    fallback: ['local-cv', 'heuristica'],
    categorias: Object.fromEntries(Object.entries(CATEGORIAS).map(([k, v]) => [k, v.nome])),
  };
}
