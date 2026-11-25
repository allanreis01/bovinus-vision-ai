/**
 * Rotas da API REST — Bovinu'S Vision AI
 */
import { Router } from 'express';
import multer from 'multer';
import { OPERACAO, CATEGORIAS, FATURAMENTO_BASE, CLASSIFICACAO } from '../domain/operacao.js';
import { analisarImagem, statusVisao } from '../services/vision/index.js';
import { registrarPrato, listarPratos, salvarImagem } from '../services/pratos.js';
import { painelFilas, setConfigFila, getConfigFila } from '../services/filas.js';
import { listarMesas, alterarStatus, simularMovimento } from '../services/mesas.js';
import { analiseDesperdicio, registrarSobra, giroCubas, registrarFeedback, resumoFeedback } from '../services/desperdicio.js';
import { dashboard } from '../services/dashboard.js';
import { seedDatabase, randomizarMesas } from '../db/seed.js';
import { getDriver } from '../db/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Envie um arquivo de imagem (JPEG ou PNG)'), { status: 400 }));
  },
});

const erro = (status, message) => Object.assign(new Error(message), { status });
const body = (req) => req.body || {};

export const api = Router();

/* ---------------- sistema ---------------- */
api.get('/health', (_req, res) => {
  res.json({ ok: true, servico: "Bovinu'S Vision AI", banco: getDriver(), visao: statusVisao(), hora: new Date().toISOString() });
});

api.get('/config', (_req, res) => {
  res.json({ operacao: OPERACAO, faturamentoBase: FATURAMENTO_BASE, categorias: CATEGORIAS, classificacao: CLASSIFICACAO, visao: statusVisao() });
});

api.post('/admin/reset', (_req, res) => {
  seedDatabase();
  res.json({ ok: true, mensagem: 'Banco recriado com os dados da Unidade Augusta' });
});

/* ---------------- Módulo 1: Balança Inteligente ---------------- */
api.post('/balanca/analisar', upload.single('imagem'), async (req, res) => {
  const { comanda, pesoG, modalidade = 'kg', motor } = body(req);
  const peso = Number(String(pesoG ?? '').replace(',', '.'));
  if (!comanda || !/^\d{3,6}$/.test(String(comanda).trim())) throw erro(400, 'Informe o número da comanda (3 a 6 dígitos), ex.: 1579');
  if (!Number.isFinite(peso) || peso < 30 || peso > 3000) throw erro(400, 'Peso da balança deve estar entre 30 g e 3.000 g');

  const buffer = req.file?.buffer || null;
  const analise = await analisarImagem(buffer, req.file?.mimetype, { modo: 'prato', forcarLocal: motor === 'local' });
  const imagem = salvarImagem(buffer, 'prato', comanda);
  const prato = registrarPrato({ comanda: String(comanda).trim(), pesoG: peso, modalidade: modalidade === 'buffet' ? 'buffet' : 'kg', analise, imagem });

  res.status(201).json({ prato, analise: { ...analise, deteccoes: analise.deteccoes || [] }, imagem });
});

api.get('/balanca/pratos', (req, res) => {
  res.json(listarPratos({ limite: req.query.limite, origem: req.query.origem }));
});

/* ---------------- Módulo 2: Filas ---------------- */
api.get('/filas', (_req, res) => res.json(painelFilas()));

api.put('/filas/config', (req, res) => {
  setConfigFila(body(req));
  res.json(painelFilas());
});

api.get('/filas/config', (_req, res) => res.json(getConfigFila()));

/* ---------------- Módulo 3: Radar de Salão ---------------- */
api.get('/mesas', (_req, res) => res.json(listarMesas()));

api.patch('/mesas/:id', (req, res) => {
  const mesa = alterarStatus(req.params.id, body(req).status || 'proximo');
  res.json({ mesa, ...listarMesas() });
});

api.post('/mesas/simular', (req, res) => {
  const r = simularMovimento(Number(body(req).intensidade) || 1);
  res.json({ ...r, ...listarMesas() });
});

api.post('/mesas/reiniciar', (_req, res) => {
  randomizarMesas();
  res.json(listarMesas());
});

/* ---------------- Módulo 4: Desperdício & Qualidade ---------------- */
api.get('/desperdicio', (_req, res) => res.json(analiseDesperdicio()));

api.post('/desperdicio/sobra', upload.single('imagem'), async (req, res) => {
  const b = body(req);
  const peso = Number(String(b.pesoSobraG ?? '').replace(',', '.'));
  if (!Number.isFinite(peso) || peso <= 0 || peso > 1500) throw erro(400, 'Informe o peso da sobra (1 g a 1.500 g)');

  let itens = [];
  let engine = 'registro-rapido';
  let analise = null;
  if (b.itens) {
    try {
      itens = typeof b.itens === 'string' ? JSON.parse(b.itens) : b.itens;
    } catch {
      throw erro(400, 'Lista de itens inválida');
    }
  }
  if (req.file) {
    analise = await analisarImagem(req.file.buffer, req.file.mimetype, { modo: 'sobra' });
    engine = analise.engine;
    if (!itens.length) {
      itens = Object.entries(analise.mix).map(([categoria, percentual]) => ({
        categoria,
        item: analise.deteccoes?.find((d) => d.categoria === categoria)?.nome || CATEGORIAS[categoria].curto,
        percentual,
      }));
    }
  }
  if (!itens.length) throw erro(400, 'Selecione os itens da sobra ou envie uma foto');
  const imagem = req.file ? salvarImagem(req.file.buffer, 'sobra', b.comanda || 'avulsa') : null;
  const sobra = registrarSobra({ comanda: b.comanda, pesoSobraG: peso, itens, engine, imagem });
  res.status(201).json({ sobra, analise });
});

api.get('/qualidade/cubas', (_req, res) => res.json(giroCubas()));

api.get('/qualidade/feedback', (_req, res) => res.json(resumoFeedback()));

api.post('/qualidade/feedback', (req, res) => {
  const b = body(req);
  if (!b.nota) throw erro(400, 'Informe a nota de 1 a 5');
  res.status(201).json(registrarFeedback(b));
});

/* ---------------- Dashboard Executivo ---------------- */
api.get('/dashboard', (_req, res) => res.json(dashboard()));
