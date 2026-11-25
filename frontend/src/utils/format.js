export const fmtBRL = (valor) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor) || 0);

export const fmtNum = (valor, casas = 0) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number(valor) || 0);

export const fmtPct = (valor, casas = 1) => `${fmtNum(valor, casas)}%`;

export const fmtGramas = (g) => {
  const n = Number(g) || 0;
  return n >= 1000 ? `${fmtNum(n / 1000, 2)} kg` : `${Math.round(n)} g`;
};

export const fmtMin = (min) => {
  const n = Number(min);
  if (!Number.isFinite(n)) return '> 15 min';
  if (n < 1) return `${Math.round(n * 60)} s`;
  const m = Math.floor(n);
  const s = Math.round((n - m) * 60);
  if (s === 60) return `${m + 1} min`;
  return s > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${m} min`;
};

export const fmtCronometro = (segTotal) => {
  const s = Math.max(0, Math.floor(Number(segTotal) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

export const fmtHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const CATEGORIA_META = {
  churrasco: { nome: 'Churrasco / Proteína Nobre', curto: 'Churrasco', cor: '#DC2626' },
  quentes: { nome: 'Pratos Quentes', curto: 'Quentes', cor: '#EA580C' },
  arroz: { nome: 'Arroz', curto: 'Arroz', cor: '#E2E8F0' },
  feijao: { nome: 'Feijão', curto: 'Feijão', cor: '#A16207' },
  salada: { nome: 'Saladas & Legumes', curto: 'Salada', cor: '#16A34A' },
  fritas: { nome: 'Fritas', curto: 'Fritas', cor: '#EAB308' },
  massa: { nome: 'Massas', curto: 'Massa', cor: '#F59E0B' },
  sobremesa: { nome: 'Sobremesas', curto: 'Sobremesa', cor: '#DB2777' },
};

export const CLASSIFICACAO_META = {
  alta: {
    nome: 'Alta Margem',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    bannerClass: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-100',
    dotClass: 'bg-emerald-400',
  },
  equilibrada: {
    nome: 'Margem Equilibrada',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    bannerClass: 'bg-amber-950/60 border-amber-500/50 text-amber-100',
    dotClass: 'bg-amber-400',
  },
  alerta: {
    nome: 'Alerta de Proteína Nobre',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/40',
    bannerClass: 'bg-red-950/60 border-red-500/50 text-red-100',
    dotClass: 'bg-red-400',
  },
};
