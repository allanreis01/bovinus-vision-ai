import fs from 'node:fs';
import { analisarLocal } from '../src/services/vision/localAnalyzer.js';
import { calcularPrato } from '../src/domain/pricing.js';

const dir = new URL('../../frontend/public/samples/', import.meta.url);
for (const f of ['prato-churrasco.jpg', 'prato-equilibrado.jpg', 'prato-salada.jpg', 'sobra-prato.jpg']) {
  const r = analisarLocal(fs.readFileSync(new URL(f, dir)));
  const c = calcularPrato({ pesoG: 482, mix: r.mix });
  console.log(f, r.tempoMs + 'ms', 'prato:', r.pratoDetectado, 'ocup:', r.ocupacaoPrato);
  console.log('  area', JSON.stringify(r.areaVisual));
  console.log('  mix ', JSON.stringify(c.mix), '=>', c.margemPct + '%', c.classificacao);
  console.log('  boxes', r.deteccoes.map((d) => `${d.nome}@${d.box.x},${d.box.y},${d.box.w}x${d.box.h}`).join(' | '));
}
