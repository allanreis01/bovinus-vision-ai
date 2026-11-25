/**
 * Dados reais da operação de almoço — Bovinu'S Grill & Beer, Unidade Augusta.
 * Fonte: briefing oficial do Hackathon FMU Tech 2026.2.
 * TODOS os cálculos do sistema partem destas constantes.
 */
export const OPERACAO = Object.freeze({
  unidade: "Bovinu'S Grill & Beer — Unidade Augusta",
  endereco: 'Rua Augusta, São Paulo/SP',
  servico: 'Almoço Self-Service por Peso',
  precoKg: 119.9, // R$ / kg
  buffetLivre: 113.0, // R$ por pessoa
  consumoMedioG: 482, // gramas / cliente (média semanal)
  fluxoDiario: 618, // clientes / dia
  slaLimpezaMin: 5, // mesa suja > 5 min = crítico
  horarioAlmoco: { inicio: '11:00', fim: '15:30' },
  fluxoCliente: ['Pratos', 'Saladas', 'Quentes', 'Churrasqueira', 'Balança', 'Mesa'],
  saloes: [
    { id: 'principal', nome: 'Salão Principal', mesas: 30, prefixo: 'P' },
    { id: 'superior', nome: 'Salão Superior', mesas: 40, prefixo: 'S' },
    { id: 'inferior', nome: 'Salão Inferior (Pista)', mesas: 20, prefixo: 'I' },
  ],
});

/** Faturamento-base projetado do almoço: 618 clientes × 482 g × R$ 119,90/kg */
export const FATURAMENTO_BASE =
  Math.round(OPERACAO.fluxoDiario * (OPERACAO.consumoMedioG / 1000) * OPERACAO.precoKg * 100) / 100;

/**
 * Categorias de alimentos reconhecidas pela Visão Computacional.
 * - cmvKg: Custo da Mercadoria Vendida estimado por kg servido (R$), já com perda de cocção/aparas.
 * - densidade: fator que converte ÁREA visual no prato em PESO (carne é densa, folhas são leves).
 * - cor: cor usada nos gráficos e bounding boxes.
 */
export const CATEGORIAS = Object.freeze({
  churrasco: {
    nome: 'Churrasco / Proteína Nobre',
    curto: 'Churrasco',
    cmvKg: 74.0,
    densidade: 1.35,
    cor: '#DC2626',
    estacao: 'Churrasqueira',
    itens: ['Picanha', 'Fraldinha', 'Cupim', 'Linguiça Toscana', 'Coração de Frango', 'Maminha'],
  },
  quentes: {
    nome: 'Pratos Quentes',
    curto: 'Quentes',
    cmvKg: 32.0,
    densidade: 1.1,
    cor: '#EA580C',
    estacao: 'Quentes',
    itens: ['Strogonoff de Frango', 'Peixe ao Molho', 'Frango Grelhado', 'Farofa da Casa', 'Escondidinho'],
  },
  arroz: {
    nome: 'Arroz',
    curto: 'Arroz',
    cmvKg: 6.5,
    densidade: 1.0,
    cor: '#E2E8F0',
    estacao: 'Quentes',
    itens: ['Arroz Branco', 'Arroz Biro-Biro'],
  },
  feijao: {
    nome: 'Feijão',
    curto: 'Feijão',
    cmvKg: 8.0,
    densidade: 1.15,
    cor: '#78350F',
    estacao: 'Quentes',
    itens: ['Feijão Preto', 'Feijão Tropeiro'],
  },
  salada: {
    nome: 'Saladas & Legumes',
    curto: 'Salada',
    cmvKg: 14.0,
    densidade: 0.55,
    cor: '#16A34A',
    estacao: 'Saladas',
    itens: ['Alface', 'Rúcula', 'Tomate', 'Beterraba', 'Cenoura Ralada', 'Salpicão', 'Pepino'],
  },
  fritas: {
    nome: 'Fritas',
    curto: 'Fritas',
    cmvKg: 18.0,
    densidade: 0.6,
    cor: '#EAB308',
    estacao: 'Quentes',
    itens: ['Batata Frita', 'Polenta Frita', 'Mandioca Frita'],
  },
  massa: {
    nome: 'Massas',
    curto: 'Massa',
    cmvKg: 11.0,
    densidade: 1.0,
    cor: '#F59E0B',
    estacao: 'Quentes',
    itens: ['Lasanha à Bolonhesa', 'Espaguete ao Sugo', 'Nhoque'],
  },
  sobremesa: {
    nome: 'Sobremesas',
    curto: 'Sobremesa',
    cmvKg: 26.0,
    densidade: 0.9,
    cor: '#DB2777',
    estacao: 'Sobremesas',
    itens: ['Pudim', 'Mousse de Maracujá', 'Doce de Leite'],
  },
});

export const CATEGORIA_IDS = Object.keys(CATEGORIAS);

/** Faixas de classificação de margem do prato (margem bruta sobre CMV). */
export const CLASSIFICACAO = Object.freeze({
  alta: { id: 'alta', nome: 'Alta Margem', cor: 'verde', minMargem: 75 },
  equilibrada: { id: 'equilibrada', nome: 'Margem Equilibrada', cor: 'amarelo', minMargem: 62 },
  alerta: { id: 'alerta', nome: 'Alerta de Proteína Nobre', cor: 'vermelho', minMargem: 0 },
  limiteChurrascoPct: 55, // acima disso o prato é sempre "Alerta de Proteína Nobre"
});
