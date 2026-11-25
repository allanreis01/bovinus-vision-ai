import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const tempDbPath = path.join(os.tmpdir(), `bovinus-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DB_PATH = tempDbPath;

const { createApp } = await import('../src/server.js');
const { closeDb } = await import('../src/db/index.js');
const { config } = await import('../src/config.js');

let server;
let baseUrl;
const uploadedFiles = [];

async function apiJson(endpoint, options = {}) {
  const res = await fetch(`${baseUrl}${endpoint}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

describe("Bovinu'S Vision AI — Testes da API e Regras de Negócio", () => {
  before(async () => {
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        fs.unlinkSync(`${tempDbPath}${suffix}`);
      } catch {
        // arquivo pode não existir
      }
    }
    for (const imgRel of uploadedFiles) {
      const fileName = path.basename(imgRel);
      try {
        fs.unlinkSync(path.join(config.uploadsDir, fileName));
      } catch {
        // arquivo já removido
      }
    }
  });

  it('GET /api/health e /api/config retornam os parâmetros reais da Unidade Augusta', async () => {
    const health = await apiJson('/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);

    const cfg = await apiJson('/config');
    assert.equal(cfg.status, 200);
    assert.equal(cfg.data.operacao.precoKg, 119.9);
    assert.equal(cfg.data.operacao.buffetLivre, 113);
    assert.equal(cfg.data.operacao.consumoMedioG, 482);
    assert.equal(cfg.data.operacao.fluxoDiario, 618);
  });

  it('GET /api/dashboard retorna KPIs, mix de categorias, margem por horário e ranking de sobras', async () => {
    const { status, data } = await apiJson('/dashboard');
    assert.equal(status, 200);
    assert.equal(data.kpis.pratosRegistrados, 618);
    assert.equal(data.kpis.pesoMedio, 482);
    assert.equal(data.kpis.faturamentoBase, 35715.33);
    assert.ok(Array.isArray(data.mixCategorias) && data.mixCategorias.length >= 5);
    assert.ok(Array.isArray(data.margemPorHorario) && data.margemPorHorario.length >= 5);
    assert.ok(Array.isArray(data.rankingSobras) && data.rankingSobras.length >= 3);
  });

  it('POST /api/balanca/analisar analisa foto de churrasco, calcula valor/margem e persiste no SQLite', async () => {
    const samplePath = path.join(PROJECT_ROOT, 'frontend', 'public', 'samples', 'prato-churrasco.jpg');
    const buffer = fs.readFileSync(samplePath);
    const form = new FormData();
    form.append('imagem', new Blob([buffer], { type: 'image/jpeg' }), 'prato-churrasco.jpg');
    form.append('comanda', '1579');
    form.append('pesoG', '482');
    form.append('modalidade', 'kg');

    const { status, data } = await apiJson('/balanca/analisar', { method: 'POST', body: form });
    assert.equal(status, 201);
    if (data.imagem) uploadedFiles.push(data.imagem);
    assert.equal(data.prato.valorCobrado, 57.79);
    assert.equal(data.prato.classificacao, 'alerta');
    assert.ok(Array.isArray(data.analise.deteccoes) && data.analise.deteccoes.length > 0);

    const lista = await apiJson('/balanca/pratos?origem=balanca-ia');
    assert.equal(lista.status, 200);
    assert.ok(lista.data.some((p) => p.comanda === '1579' && p.id === data.prato.id));
  });

  it('GET /api/filas e PUT /api/filas/config alternam cenário Pico x Normal e reduzem espera', async () => {
    const pico = await apiJson('/filas');
    assert.equal(pico.status, 200);
    assert.equal(pico.data.cenario.id, 'pico');
    const churrasPico = pico.data.estacoes.find((e) => e.id === 'churrasqueira');
    assert.ok(churrasPico.esperaMin > 3, `Espera esperada no pico > 3 min, obtido ${churrasPico.esperaMin}`);

    const normal = await apiJson('/filas/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cenario: 'normal' }),
    });
    assert.equal(normal.status, 200);
    assert.equal(normal.data.cenario.id, 'normal');
    const churrasNormal = normal.data.estacoes.find((e) => e.id === 'churrasqueira');
    assert.ok(churrasNormal.esperaMin < churrasPico.esperaMin);

    // Restaura cenário pico
    await apiJson('/filas/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cenario: 'pico' }),
    });
  });

  it('GET /api/mesas retorna 90 mesas (30/40/20) e PATCH /api/mesas/:id altera status', async () => {
    const { status, data } = await apiJson('/mesas');
    assert.equal(status, 200);
    assert.equal(data.mesas.length, 90);
    const contagem = { principal: 0, superior: 0, inferior: 0 };
    for (const m of data.mesas) contagem[m.salao] += 1;
    assert.deepEqual(contagem, { principal: 30, superior: 40, inferior: 20 });

    const mesaAlvo = data.mesas[0];
    const novoStatus = mesaAlvo.status === 'ocupada' ? 'aguardando_limpeza' : 'ocupada';
    const patch = await apiJson(`/mesas/${mesaAlvo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    });
    assert.equal(patch.status, 200);
    assert.equal(patch.data.mesa.status, novoStatus);
  });

  it('Módulo 4: desperdício, sobra, giro das cubas e feedback funcionam ponta a ponta', async () => {
    const despBefore = await apiJson('/desperdicio');
    assert.equal(despBefore.status, 200);
    assert.ok(despBefore.data.ranking.length > 0);

    const sobraRes = await apiJson('/desperdicio/sobra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comanda: '1411',
        pesoSobraG: 85,
        itens: [
          { categoria: 'arroz', item: 'Arroz Branco', gramas: 55 },
          { categoria: 'salada', item: 'Beterraba', gramas: 30 },
        ],
      }),
    });
    assert.equal(sobraRes.status, 201);
    assert.equal(sobraRes.data.sobra.pesoSobraG, 85);

    const cubas = await apiJson('/qualidade/cubas');
    assert.equal(cubas.status, 200);
    assert.equal(cubas.data.cubas.length, 20);

    const fbAntes = await apiJson('/qualidade/feedback');
    assert.equal(fbAntes.status, 200);

    const fbPost = await apiJson('/qualidade/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comanda: '1531',
        nota: 5,
        tags: ['Picanha no ponto', 'Salão limpo'],
        comentario: 'Excelente atendimento na Augusta!',
      }),
    });
    assert.equal(fbPost.status, 201);
    assert.equal(fbPost.data.nota, 5);
  });
});
