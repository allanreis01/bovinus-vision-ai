/**
 * Seed automático com dados REALISTAS do almoço da Unidade Augusta.
 * - 618 pratos (fluxo médio diário) com média exata de 482 g
 * - curva de chegada com pico às 12h30
 * - 90 mesas (Principal 30 · Superior 40 · Inferior/Pista 20)
 * - sobras, giro das cubas e feedbacks da comanda
 * Gerador pseudoaleatório com semente fixa => demo reprodutível.
 */
import { getDb, transaction, setSetting, getSetting } from './index.js';
import { OPERACAO } from '../domain/operacao.js';
import { calcularPrato, round1 } from '../domain/pricing.js';
import { mulberry32 } from '../utils/random.js';

export const SEED_VERSION = 3;

/* ---------------- utilitários ---------------- */
function makeRng(seed) {
  const rnd = mulberry32(seed);
  const api = {
    rnd,
    between: (a, b) => a + (b - a) * rnd(),
    int: (a, b) => Math.floor(a + (b - a + 1) * rnd()),
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    normal: (mu, sigma) => {
      const u = 1 - rnd();
      const v = rnd();
      return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = rnd() * total;
      for (const [v, w] of entries) {
        r -= w;
        if (r <= 0) return v;
      }
      return entries[entries.length - 1][0];
    },
  };
  return api;
}

const pad = (n) => String(n).padStart(2, '0');

/** Data local de hoje no horário hh:mm:ss */
export function hojeAs(minutosDesdeMeiaNoite, segundos = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutosDesdeMeiaNoite);
  d.setSeconds(segundos);
  return d;
}

export const horaStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Curva de chegada de clientes no almoço (11h00–15h30), pico às 12h30. */
export function pesoChegada(minDesde11h) {
  const pico = Math.exp(-((minDesde11h - 90) ** 2) / (2 * 42 ** 2));
  const segundoPico = 0.35 * Math.exp(-((minDesde11h - 165) ** 2) / (2 * 30 ** 2));
  return 0.12 + pico + segundoPico;
}

/* ---------------- perfis de prato ---------------- */
function gerarMix(rng, minDesde11h) {
  const tarde = minDesde11h > 165; // após 13h45
  const perfil = rng.weighted([
    ['carnivoro', tarde ? 0.34 : 0.17],
    ['tradicional', 0.45],
    ['leve', tarde ? 0.12 : 0.22],
    ['massas', 0.12],
  ]);
  const b = rng.between;
  let mix;
  switch (perfil) {
    case 'carnivoro':
      mix = { churrasco: b(50, 72), arroz: b(8, 18), salada: b(3, 10), quentes: b(0, 10), fritas: b(0, 8), feijao: b(0, 6) };
      break;
    case 'leve':
      mix = { salada: b(34, 55), arroz: b(14, 24), feijao: b(6, 14), quentes: b(4, 14), churrasco: b(5, 15) };
      break;
    case 'massas':
      mix = { massa: b(20, 34), quentes: b(18, 28), churrasco: b(10, 22), salada: b(8, 18), arroz: b(4, 12) };
      break;
    default:
      mix = { churrasco: b(24, 40), arroz: b(14, 22), feijao: b(9, 15), salada: b(9, 18), fritas: b(0, 10), quentes: b(0, 12) };
  }
  if (rng.rnd() < 0.18) mix.sobremesa = b(3, 8);
  return mix;
}

/* ---------------- catálogo de sobras ---------------- */
const PROPENSAO_SOBRA = [
  ['Arroz Branco', 'arroz', 1.6],
  ['Peixe ao Molho', 'quentes', 1.35],
  ['Farofa da Casa', 'quentes', 1.2],
  ['Beterraba', 'salada', 1.1],
  ['Cupim (gordura)', 'churrasco', 1.05],
  ['Fraldinha (aparas)', 'churrasco', 0.85],
  ['Salpicão', 'salada', 0.8],
  ['Alface', 'salada', 0.7],
  ['Feijão Tropeiro', 'feijao', 0.6],
  ['Polenta Frita', 'fritas', 0.55],
  ['Batata Frita', 'fritas', 0.5],
  ['Lasanha à Bolonhesa', 'massa', 0.5],
  ['Picanha', 'churrasco', 0.45],
  ['Strogonoff de Frango', 'quentes', 0.4],
  ['Feijão Preto', 'feijao', 0.35],
  ['Pudim', 'sobremesa', 0.2],
];

const CUBAS = [
  // nome, categoria, estacao, giro, meta, minSemSaida, temperatura
  ['Alface Americana', 'salada', 'Saladas', 3.2, 3.0, 2, 6.5],
  ['Rúcula', 'salada', 'Saladas', 1.4, 1.5, 6, 7.0],
  ['Tomate Fatiado', 'salada', 'Saladas', 2.1, 2.0, 3, 6.8],
  ['Beterraba Cozida', 'salada', 'Saladas', 0.4, 1.2, 34, 8.9],
  ['Salpicão', 'salada', 'Saladas', 0.9, 1.2, 12, 7.4],
  ['Cenoura Ralada', 'salada', 'Saladas', 0.7, 1.0, 9, 7.1],
  ['Arroz Branco', 'arroz', 'Quentes', 6.5, 6.0, 1, 74],
  ['Feijão Preto', 'feijao', 'Quentes', 4.1, 4.0, 2, 78],
  ['Feijão Tropeiro', 'feijao', 'Quentes', 1.6, 2.0, 8, 69],
  ['Strogonoff de Frango', 'quentes', 'Quentes', 2.4, 2.2, 3, 71],
  ['Peixe ao Molho', 'quentes', 'Quentes', 0.5, 1.6, 41, 58],
  ['Farofa da Casa', 'quentes', 'Quentes', 1.1, 1.0, 5, 62],
  ['Batata Frita', 'fritas', 'Quentes', 3.6, 3.0, 1, 72],
  ['Polenta Frita', 'fritas', 'Quentes', 0.6, 1.4, 27, 63],
  ['Lasanha à Bolonhesa', 'massa', 'Quentes', 1.8, 1.8, 6, 70],
  ['Escondidinho', 'quentes', 'Quentes', 0.8, 1.2, 18, 66],
  ['Picanha', 'churrasco', 'Churrasqueira', 5.8, 5.0, 0.5, 68],
  ['Fraldinha', 'churrasco', 'Churrasqueira', 3.1, 3.0, 1, 67],
  ['Linguiça Toscana', 'churrasco', 'Churrasqueira', 2.2, 2.0, 2, 70],
  ['Cupim', 'churrasco', 'Churrasqueira', 0.9, 1.6, 15, 65],
];

const FEEDBACK_TAGS_POS = ['Picanha no ponto', 'Buffet variado', 'Salão limpo', 'Atendimento rápido', 'Comida quentinha', 'Saladas frescas'];
const FEEDBACK_TAGS_NEG = ['Fila na churrasqueira', 'Mesa demorou p/ limpar', 'Demora na bebida', 'Fila na balança', 'Peixe sem sabor', 'Arroz frio'];
const COMENTARIOS = {
  5: ['Picanha estava perfeita, voltarei!', 'Melhor buffet da Augusta.', 'Tudo impecável hoje.', 'Atendimento nota 10, garçom muito atencioso.'],
  4: ['Muito bom, só a fila da churrasqueira que pegou.', 'Comida ótima, salão cheio mas organizado.', 'Gostei das saladas, bem frescas.', 'Bom, mas a bebida demorou um pouco.'],
  3: ['Esperei uns 5 min por uma mesa limpa no salão de cima.', 'Fila na balança grande ao meio-dia e meia.', 'Peixe estava meio frio.', 'Ok, nada demais hoje.'],
  2: ['Mesa suja por muito tempo no superior.', 'Fila enorme pra carne, desisti da segunda passada.', 'Arroz estava frio.'],
  1: ['Demorei 20 min entre fila e achar mesa limpa.'],
};

/* ---------------- seed ---------------- */
export function seedDatabase() {
  const rng = makeRng(20262);
  const db = getDb();

  transaction(() => {
    db.exec('DELETE FROM pratos; DELETE FROM mesa_eventos; DELETE FROM mesas; DELETE FROM sobras; DELETE FROM cubas; DELETE FROM feedbacks;');

    /* ---- 618 pratos com média exata de 482 g ---- */
    const N = OPERACAO.fluxoDiario;
    const slots = [];
    for (let m = 0; m < 270; m += 1) slots.push([m, pesoChegada(m)]);
    const pesos = Array.from({ length: N }, () => Math.min(1150, Math.max(140, rng.normal(482, 150))));
    const media = pesos.reduce((s, p) => s + p, 0) / N;
    const ajuste = OPERACAO.consumoMedioG - media;
    const comandasFixas = ['1579', '1411', '1531'];

    const insPrato = db.prepare(`INSERT INTO pratos
      (comanda, peso_g, modalidade, valor_cobrado, cmv, margem_pct, classificacao, churrasco_pct, mix_json, deteccoes_json, engine, imagem, origem, hora, created_at)
      VALUES (?, ?, 'kg', ?, ?, ?, ?, ?, ?, NULL, 'historico-balanca', NULL, 'seed', ?, ?)`);
    const insSobra = db.prepare(`INSERT INTO sobras (comanda, peso_sobra_g, itens_json, engine, imagem, origem, created_at)
      VALUES (?, ?, ?, 'registro-rapido', NULL, 'seed', ?)`);

    const registros = [];
    for (let i = 0; i < N; i += 1) {
      const minDesde11h = rng.weighted(slots);
      const quando = hojeAs(11 * 60 + minDesde11h, rng.int(0, 59));
      const peso = Math.round(pesos[i] + ajuste);
      const comanda = i < 3 ? comandasFixas[i] : String(rng.int(1001, 1999));
      registros.push({ minDesde11h, quando, peso, comanda });
    }
    registros.sort((a, b) => a.quando - b.quando);

    for (const r of registros) {
      const calc = calcularPrato({ pesoG: r.peso, mix: gerarMix(rng, r.minDesde11h) });
      insPrato.run(
        r.comanda, r.peso, calc.valorCobrado, calc.cmv, calc.margemPct, calc.classificacao,
        calc.mix.churrasco || 0, JSON.stringify(calc.mix), horaStr(r.quando), r.quando.toISOString(),
      );

      // ~28% dos pratos voltam com sobra
      if (rng.rnd() < 0.28) {
        const total = Math.round(Math.min(190, Math.max(12, rng.normal(55, 30))));
        const nItens = rng.weighted([[1, 0.5], [2, 0.35], [3, 0.15]]);
        const escolhidos = new Map();
        for (let k = 0; k < nItens; k += 1) {
          const [nome, cat] = rng.weighted(PROPENSAO_SOBRA.map((p) => [p, p[2]]));
          escolhidos.set(nome, cat);
        }
        const partes = [...escolhidos.entries()];
        const pesosParte = partes.map(() => rng.between(0.5, 1.5));
        const soma = pesosParte.reduce((s, v) => s + v, 0);
        const itens = partes.map(([nome, cat], idx) => ({ item: nome, categoria: cat, gramas: round1((total * pesosParte[idx]) / soma) }));
        const fim = new Date(r.quando.getTime() + rng.int(22, 48) * 60000);
        insSobra.run(r.comanda, total, JSON.stringify(itens), fim.toISOString());
      }
    }

    /* ---- 90 mesas ---- */
    const agora = Date.now();
    const insMesa = db.prepare('INSERT INTO mesas (salao, numero, codigo, lugares, status, desde_ts, comanda) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of OPERACAO.saloes) {
      for (let n = 1; n <= s.mesas; n += 1) {
        const lugares = s.id === 'superior' ? rng.pick([2, 4, 4, 6]) : s.id === 'inferior' ? rng.pick([4, 4, 6]) : 4;
        insMesa.run(s.id, n, `${s.prefixo}${pad(n)}`, lugares, 'livre', agora, null);
      }
    }
    randomizarMesas(rng);

    /* ---- histórico de eventos de limpeza (tempo médio por salão) ---- */
    const mesas = db.prepare('SELECT id, salao FROM mesas').all();
    const mediaLimpeza = { principal: 3.4, inferior: 3.9, superior: 6.2 };
    const insEvento = db.prepare('INSERT INTO mesa_eventos (mesa_id, salao, de_status, para_status, duracao_s, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (let e = 0; e < 460; e += 1) {
      const m = rng.pick(mesas);
      const quando = hojeAs(11 * 60 + rng.weighted(slots) + 30);
      const ocupacao = Math.max(14, rng.normal(34, 9)) * 60;
      const limpeza = Math.max(0.8, rng.normal(mediaLimpeza[m.salao], mediaLimpeza[m.salao] * 0.38)) * 60;
      insEvento.run(m.id, m.salao, 'ocupada', 'aguardando_limpeza', round1(ocupacao), quando.toISOString());
      insEvento.run(m.id, m.salao, 'aguardando_limpeza', 'livre', round1(limpeza), new Date(quando.getTime() + limpeza * 1000).toISOString());
    }

    /* ---- cubas ---- */
    const insCuba = db.prepare('INSERT INTO cubas (nome, categoria, estacao, giro_kg_h, meta_giro_kg_h, min_sem_saida, temperatura_c) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of CUBAS) insCuba.run(...c);

    /* ---- feedbacks ---- */
    const insFb = db.prepare('INSERT INTO feedbacks (comanda, nota, tags_json, comentario, origem, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (let f = 0; f < 74; f += 1) {
      const nota = rng.weighted([[5, 0.42], [4, 0.33], [3, 0.15], [2, 0.07], [1, 0.03]]);
      const tags = new Set();
      const nTags = rng.int(1, 2);
      for (let t = 0; t < nTags; t += 1) {
        tags.add(nota >= 4 && rng.rnd() < 0.8 ? rng.pick(FEEDBACK_TAGS_POS) : rng.pick(FEEDBACK_TAGS_NEG));
      }
      const quando = hojeAs(11 * 60 + 25 + rng.weighted(slots));
      const comentario = rng.rnd() < 0.7 ? rng.pick(COMENTARIOS[nota]) : null;
      insFb.run(String(rng.int(1001, 1999)), nota, JSON.stringify([...tags]), comentario, 'seed', quando.toISOString());
    }
  });

  setSetting('seed_version', SEED_VERSION);
  setSetting('seed_em', new Date().toISOString());
  setSetting('fila_config', { cenario: 'pico', equipe: {} });
}

/** Distribui status realistas pelas mesas (simula ~12h45 de um dia de semana). */
export function randomizarMesas(rng = makeRng(Date.now() % 100000)) {
  const db = getDb();
  const agora = Date.now();
  const upd = db.prepare('UPDATE mesas SET status = ?, desde_ts = ?, comanda = ? WHERE id = ?');
  const mesas = db.prepare('SELECT id, salao FROM mesas').all();
  for (const m of mesas) {
    // Salão Superior tem mais mesas sujas (mais longe do apoio dos garçons)
    const pSuja = m.salao === 'superior' ? 0.17 : 0.08;
    const status = rng.weighted([
      ['ocupada', 0.6],
      ['aguardando_limpeza', pSuja],
      ['livre', 0.4 - pSuja],
    ]);
    let desde;
    let comanda = null;
    if (status === 'ocupada') {
      desde = agora - rng.int(3, 45) * 60000;
      comanda = String(rng.int(1001, 1999));
    } else if (status === 'aguardando_limpeza') {
      desde = agora - rng.int(10, 470) * 1000;
    } else {
      desde = agora - rng.int(1, 15) * 60000;
    }
    upd.run(status, desde, comanda, m.id);
  }
}

/** Executa o seed somente na primeira execução (ou quando a versão do seed muda). */
export function seedIfNeeded() {
  const db = getDb();
  const versao = getSetting('seed_version', 0);
  const total = db.prepare('SELECT COUNT(*) AS n FROM pratos').get().n;
  if (versao !== SEED_VERSION || total === 0) {
    seedDatabase();
    return true;
  }
  // Se o servidor ficou desligado, reativa o "relógio" das mesas para a demo
  const maisAntiga = db.prepare("SELECT MIN(desde_ts) AS t FROM mesas WHERE status = 'aguardando_limpeza'").get().t;
  if (maisAntiga && Date.now() - maisAntiga > 30 * 60000) randomizarMesas();
  return false;
}
