/**
 * Integração com Google Gemini Vision (@google/genai).
 * Retorna itens detectados, percentual visual em PESO estimado e bounding boxes.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { config } from '../../config.js';
import { CATEGORIAS, CATEGORIA_IDS } from '../../domain/operacao.js';

let client = null;
const getClient = () => {
  if (!client) client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return client;
};

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    eh_comida: { type: Type.BOOLEAN, description: 'true se a imagem mostra um prato de comida' },
    itens: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          categoria: { type: Type.STRING, enum: CATEGORIA_IDS },
          item: { type: Type.STRING, description: 'Nome do alimento em português, ex: Picanha, Arroz Branco' },
          percentual_peso: { type: Type.NUMBER, description: 'Percentual estimado do PESO total do prato (0-100)' },
          confianca: { type: Type.NUMBER, description: 'Confiança 0-100' },
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: '[ymin, xmin, ymax, xmax] normalizado 0-1000',
          },
        },
        required: ['categoria', 'item', 'percentual_peso', 'box_2d'],
      },
    },
    observacao: { type: Type.STRING, description: 'Observação curta (máx. 20 palavras) sobre o prato' },
  },
  required: ['eh_comida', 'itens'],
};

function prompt(modo) {
  const cats = CATEGORIA_IDS.map((id) => `- ${id}: ${CATEGORIAS[id].nome} (ex.: ${CATEGORIAS[id].itens.slice(0, 4).join(', ')})`).join('\n');
  const contexto =
    modo === 'sobra'
      ? 'A foto mostra a SOBRA (resto) deixada no prato ao final da refeição. Identifique apenas os restos de comida.'
      : 'A foto mostra um prato montado por um cliente, fotografado sobre a balança antes da pesagem.';
  return `Você é o sistema de visão computacional de uma churrascaria self-service por quilo em São Paulo (Bovinu'S Grill & Beer).
${contexto}
Classifique cada alimento visível em UMA das categorias:
${cats}
Regras:
1. "percentual_peso" deve estimar a participação no PESO (carnes são densas; folhas são leves). A soma deve ser 100.
2. Agrupe pedaços iguais em um único item, com um box_2d englobando a região.
3. Ignore a louça, talheres, mesa e fundo.
4. Responda somente no JSON do schema.`;
}

function comTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout do Gemini após ${ms} ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {{modo?: 'prato'|'sobra'}} opts
 */
export async function analisarComGemini(buffer, mimeType, { modo = 'prato' } = {}) {
  const inicio = Date.now();
  const resposta = await comTimeout(
    getClient().models.generateContent({
      model: config.gemini.model,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: mimeType || 'image/jpeg', data: buffer.toString('base64') } }, { text: prompt(modo) }],
        },
      ],
      config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
    }),
    config.gemini.timeoutMs,
  );

  const json = JSON.parse(resposta.text || '{}');
  const itens = (json.itens || []).filter((i) => CATEGORIAS[i.categoria] && Number(i.percentual_peso) > 0);
  if (!json.eh_comida || itens.length === 0) {
    throw new Error('Gemini não identificou alimentos na imagem');
  }

  const mix = {};
  for (const i of itens) mix[i.categoria] = (mix[i.categoria] || 0) + Number(i.percentual_peso);

  return {
    engine: 'gemini',
    modelo: config.gemini.model,
    modo,
    mix,
    deteccoes: itens.map((i) => {
      const [ymin, xmin, ymax, xmax] = (i.box_2d || [0, 0, 1000, 1000]).map((n) => Math.min(1000, Math.max(0, n)) / 1000);
      return {
        categoria: i.categoria,
        nome: i.item || CATEGORIAS[i.categoria].curto,
        box: { x: xmin, y: ymin, w: Math.max(0.02, xmax - xmin), h: Math.max(0.02, ymax - ymin) },
        confianca: Math.round(Number(i.confianca) || 90),
      };
    }),
    observacao: json.observacao || null,
    tempoMs: Date.now() - inicio,
    valido: true,
  };
}
