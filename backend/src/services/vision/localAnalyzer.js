/**
 * Analisador LOCAL de Visão Computacional (fallback offline, sem API externa).
 *
 * Pipeline:
 *  1. Decodificação JPEG/PNG em JavaScript puro (jpeg-js / pngjs).
 *  2. Redução para uma grade de células (~96 px de largura) com média RGB
 *     e desvio-padrão de luminância (textura) por célula.
 *  3. Detecção do prato: células brancas, pouco saturadas e lisas => elipse do prato.
 *  4. Classificação de cada célula por regras no espaço HSV + textura
 *     (arroz × louça branca são separados pela textura).
 *  5. Agrupamento em blocos e componentes conexos => bounding boxes por categoria.
 *  6. Conversão de ÁREA visual em PESO via fator de densidade de cada categoria.
 */
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { CATEGORIAS } from '../../domain/operacao.js';
import { round1 } from '../../domain/pricing.js';

const GRID_W = 96;

/* ---------- decodificação ---------- */
export function decodificarImagem(buffer) {
  if (!buffer || buffer.length < 32) throw new Error('Imagem vazia');
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8;
  if (isPng) {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  if (isJpg) {
    const img = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 1024, formatAsRGBA: true });
    return { width: img.width, height: img.height, data: img.data };
  }
  throw new Error('Formato não suportado pelo analisador local (use JPEG ou PNG)');
}

/* ---------- cor ---------- */
export function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/* ---------- grade de células ---------- */
function construirGrade(img) {
  const gw = Math.min(GRID_W, img.width);
  const cell = img.width / gw;
  const gh = Math.max(1, Math.round(img.height / cell));
  const cells = new Array(gw * gh);
  const passo = Math.max(1, Math.floor(cell / 4));
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const x0 = Math.floor(gx * cell);
      const y0 = Math.floor(gy * cell);
      const x1 = Math.min(img.width, Math.floor((gx + 1) * cell));
      const y1 = Math.min(img.height, Math.floor((gy + 1) * cell));
      let r = 0;
      let g = 0;
      let b = 0;
      let l = 0;
      let l2 = 0;
      let n = 0;
      for (let y = y0; y < y1; y += passo) {
        for (let x = x0; x < x1; x += passo) {
          const i = (y * img.width + x) * 4;
          const R = img.data[i];
          const G = img.data[i + 1];
          const B = img.data[i + 2];
          const L = 0.299 * R + 0.587 * G + 0.114 * B;
          r += R;
          g += G;
          b += B;
          l += L;
          l2 += L * L;
          n += 1;
        }
      }
      n = Math.max(1, n);
      const media = l / n;
      const tex = Math.sqrt(Math.max(0, l2 / n - media * media));
      const R = r / n;
      const G = g / n;
      const B = b / n;
      cells[gy * gw + gx] = { r: R, g: G, b: B, tex, ...rgbToHsv(R, G, B) };
    }
  }
  return { gw, gh, cells };
}

/* ---------- prato ---------- */
const ehLoucaBranca = (c) => c.s < 0.16 && c.v > 0.74 && c.tex < 9;

function detectarPrato({ gw, gh, cells }) {
  let minX = gw;
  let minY = gh;
  let maxX = 0;
  let maxY = 0;
  let n = 0;
  for (let y = 0; y < gh; y += 1) {
    for (let x = 0; x < gw; x += 1) {
      if (ehLoucaBranca(cells[y * gw + x])) {
        n += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const largura = maxX - minX;
  const altura = maxY - minY;
  if (n < gw * gh * 0.04 || largura < gw * 0.35 || altura < gh * 0.35) {
    // Sem prato visível: considera elipse central (foto fechada no alimento)
    return { cx: gw / 2, cy: gh / 2, rx: gw * 0.47, ry: gh * 0.47, detectado: false };
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    rx: (largura / 2) * 0.93,
    ry: (altura / 2) * 0.93,
    detectado: true,
  };
}

/* ---------- classificação HSV ---------- */
export function classificarCelula(c) {
  const { h, s, v, tex } = c;
  if (ehLoucaBranca(c)) return 'vazio';
  // Arroz: branco/creme com textura granulada
  if (s < 0.22 && v > 0.66) return tex >= 9 ? 'arroz' : 'vazio';
  // Feijão: muito escuro ou escuro arroxeado (caldo do feijão preto)
  if (v < 0.24) return 'feijao';
  if (v < 0.32 && s < 0.45) return 'feijao';
  if (v < 0.42 && (h >= 250 || h <= 4) && s < 0.6) return 'feijao';
  // Verdes (folhas, pepino, rúcula)
  if (h >= 56 && h <= 170 && s > 0.2 && v > 0.22) return 'salada';
  // Beterraba / repolho roxo
  if (h >= 285 && h <= 335 && s > 0.3 && v >= 0.4) return 'salada';
  // Tomate (vermelho muito saturado e brilhante)
  if ((h <= 12 || h >= 345) && s > 0.6 && v > 0.58) return 'salada';
  // Cenoura (laranja intenso)
  if (h > 12 && h <= 32 && s > 0.7 && v > 0.66) return 'salada';
  // Fritas / polenta (amarelo dourado saturado)
  if (h > 34 && h <= 60 && s > 0.4 && v > 0.6) return 'fritas';
  // Massa (amarelo pálido)
  if (h > 36 && h <= 62 && s >= 0.18 && s <= 0.4 && v > 0.7) return 'massa';
  // Doces (rosa claro)
  if (h > 320 && h < 345 && s > 0.15 && s < 0.45 && v > 0.65) return 'sobremesa';
  // Pratos quentes (frango dourado, molhos claros, farofa)
  if (h > 26 && h <= 48 && s > 0.22 && v >= 0.45) return 'quentes';
  // Churrasco: marrom / vermelho-rosado (crosta + interior da carne)
  if ((h <= 34 || h >= 340) && s > 0.2 && v >= 0.2) return 'churrasco';
  // Arroz na sombra (cinza claro e granulado)
  if (s < 0.22 && v <= 0.66 && v >= 0.45 && tex >= 9) return 'arroz';
  return 'indefinido';
}

/* ---------- caixas delimitadoras ---------- */
function extrairCaixas(rotulos, gw, gh, total) {
  const B = 4; // bloco 4x4 células
  const bw = Math.ceil(gw / B);
  const bh = Math.ceil(gh / B);
  const blocos = new Array(bw * bh).fill(null);
  for (let by = 0; by < bh; by += 1) {
    for (let bx = 0; bx < bw; bx += 1) {
      const cont = {};
      let n = 0;
      for (let y = by * B; y < Math.min(gh, (by + 1) * B); y += 1) {
        for (let x = bx * B; x < Math.min(gw, (bx + 1) * B); x += 1) {
          const r = rotulos[y * gw + x];
          n += 1;
          if (r && r !== 'vazio' && r !== 'indefinido' && r !== 'fora') cont[r] = (cont[r] || 0) + 1;
        }
      }
      const top = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= n * 0.4) blocos[by * bw + bx] = top[0];
    }
  }
  const visitado = new Uint8Array(bw * bh);
  const caixas = [];
  for (let i = 0; i < blocos.length; i += 1) {
    if (!blocos[i] || visitado[i]) continue;
    const cat = blocos[i];
    const fila = [i];
    visitado[i] = 1;
    let minX = bw;
    let minY = bh;
    let maxX = 0;
    let maxY = 0;
    let n = 0;
    while (fila.length) {
      const k = fila.pop();
      const x = k % bw;
      const y = Math.floor(k / bw);
      n += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const j = ny * bw + nx;
        if (!visitado[j] && blocos[j] === cat) {
          visitado[j] = 1;
          fila.push(j);
        }
      }
    }
    if (n >= 3) {
      caixas.push({
        categoria: cat,
        blocos: n,
        x: (minX * B) / gw,
        y: (minY * B) / gh,
        w: Math.min(1, ((maxX + 1) * B) / gw) - (minX * B) / gw,
        h: Math.min(1, ((maxY + 1) * B) / gh) - (minY * B) / gh,
      });
    }
  }
  // Mantém as 2 maiores regiões por categoria (máx. 9 caixas)
  const porCat = {};
  return caixas
    .sort((a, b) => b.blocos - a.blocos)
    .filter((c) => {
      porCat[c.categoria] = (porCat[c.categoria] || 0) + 1;
      return porCat[c.categoria] <= 2;
    })
    .slice(0, 9)
    .map((c) => ({ ...c, confianca: round1(Math.min(97, 62 + (c.blocos / Math.max(1, total / 16)) * 120)) }));
}

/* ---------- análise principal ---------- */
/**
 * @param {Buffer} buffer imagem JPEG/PNG
 * @param {{modo?: 'prato'|'sobra'}} opts
 */
export function analisarLocal(buffer, { modo = 'prato' } = {}) {
  const inicio = Date.now();
  const img = decodificarImagem(buffer);
  const grade = construirGrade(img);
  const { gw, gh, cells } = grade;
  const prato = detectarPrato(grade);

  const rotulos = new Array(gw * gh);
  const area = {};
  const histograma = new Array(12).fill(0);
  let celulasPrato = 0;
  let celulasComida = 0;

  for (let y = 0; y < gh; y += 1) {
    for (let x = 0; x < gw; x += 1) {
      const dx = (x + 0.5 - prato.cx) / prato.rx;
      const dy = (y + 0.5 - prato.cy) / prato.ry;
      const idx = y * gw + x;
      if (dx * dx + dy * dy > 1) {
        rotulos[idx] = 'fora';
        continue;
      }
      celulasPrato += 1;
      const c = cells[idx];
      const r = classificarCelula(c);
      rotulos[idx] = r;
      if (r !== 'vazio' && r !== 'indefinido') {
        area[r] = (area[r] || 0) + 1;
        celulasComida += 1;
        if (c.s > 0.15) histograma[Math.floor(c.h / 30) % 12] += 1;
      }
    }
  }

  // Remove ruído (< 1,5% da área de comida)
  for (const k of Object.keys(area)) if (area[k] < celulasComida * 0.015) delete area[k];

  // Área visual -> peso estimado (densidade aparente)
  const pesoRel = {};
  let somaPeso = 0;
  for (const [cat, n] of Object.entries(area)) {
    pesoRel[cat] = n * CATEGORIAS[cat].densidade;
    somaPeso += pesoRel[cat];
  }
  const mix = {};
  for (const [cat, p] of Object.entries(pesoRel)) mix[cat] = round1((p / somaPeso) * 100);

  const caixas = extrairCaixas(rotulos, gw, gh, celulasComida);
  const ocupacaoPrato = celulasPrato ? round1((celulasComida / celulasPrato) * 100) : 0;
  const totalHist = histograma.reduce((s, v) => s + v, 0) || 1;

  return {
    engine: 'local-cv',
    modelo: 'HSV-Regions v2 (histograma + textura + densidade)',
    modo,
    mix,
    deteccoes: caixas.map((c) => ({
      categoria: c.categoria,
      nome: CATEGORIAS[c.categoria].curto,
      box: { x: round3(c.x), y: round3(c.y), w: round3(c.w), h: round3(c.h) },
      confianca: c.confianca,
    })),
    areaVisual: Object.fromEntries(Object.entries(area).map(([k, n]) => [k, round1((n / Math.max(1, celulasComida)) * 100)])),
    ocupacaoPrato,
    pratoDetectado: prato.detectado,
    histograma: histograma.map((n, i) => ({ faixa: `${i * 30}°`, valor: round1((n / totalHist) * 100) })),
    resolucao: `${img.width}×${img.height}`,
    tempoMs: Date.now() - inicio,
    valido: celulasComida >= 40,
  };
}

const round3 = (n) => Math.round(n * 1000) / 1000;
