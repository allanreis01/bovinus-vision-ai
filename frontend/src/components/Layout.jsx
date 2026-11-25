import { useState } from 'react';
import {
  LayoutDashboard,
  Camera,
  Clock,
  Grid2x2,
  ThermometerSnowflake,
  RotateCcw,
  RefreshCw,
  Menu,
  X,
  Flame,
  Cpu,
  Sparkles,
} from 'lucide-react';

const PAGINAS = [
  {
    id: 'dashboard',
    titulo: 'Dashboard Executivo',
    curto: 'Dashboard',
    subtitulo: 'Visão consolidada do almoço — Unidade Augusta',
    icon: LayoutDashboard,
  },
  {
    id: 'balanca',
    titulo: 'Balança Inteligente IA',
    curto: 'Balança IA',
    subtitulo: 'Módulo 1 · Visão computacional do mix do prato & margem real',
    icon: Camera,
  },
  {
    id: 'filas',
    titulo: 'Monitor de Filas e Gargalos',
    curto: 'Filas & Gargalos',
    subtitulo: 'Módulo 2 · Fluxo Saladas → Quentes → Churrasqueira → Balança → Mesa',
    icon: Clock,
  },
  {
    id: 'salao',
    titulo: 'Radar de Salão & SLA',
    curto: 'Radar de Salão',
    subtitulo: 'Módulo 3 · Planta ao vivo das 90 mesas e cronômetro de limpeza',
    icon: Grid2x2,
  },
  {
    id: 'desperdicio',
    titulo: 'Desperdício & Qualidade',
    curto: 'Desperdício',
    subtitulo: 'Módulo 4 · Scanner de retorno, giro das cubas e feedback da comanda',
    icon: ThermometerSnowflake,
  },
];

export function Layout({
  paginaAtiva,
  onNavegar,
  visaoStatus,
  onResetDemo,
  onRefresh,
  resetando,
  children,
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const paginaAtual = PAGINAS.find((p) => p.id === paginaAtiva) || PAGINAS[0];
  const geminiAtivo = Boolean(visaoStatus?.geminiConfigurado);

  const selecionar = (id) => {
    onNavegar(id);
    setMenuAberto(false);
  };

  return (
    <div className="min-h-screen flex bg-[#0F172A] text-slate-100">
      {/* Overlay mobile */}
      {menuAberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 flex flex-col border-r border-slate-800 bg-[#0B1120] transition-transform duration-200 lg:static lg:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Marca */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#991B1B] to-[#7F1D1D] ring-1 ring-amber-500/50 shadow-lg shadow-red-950/50">
              <Flame className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-white">Bovinu&apos;S</span>
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 ring-1 ring-amber-500/30">
                  Vision AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Unidade Augusta · Almoço</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuAberto(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 space-y-1.5 px-3 py-4">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Módulos Operacionais
          </p>
          {PAGINAS.map((p) => {
            const Icon = p.icon;
            const ativa = p.id === paginaAtiva;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selecionar(p.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                  ativa
                    ? 'bg-gradient-to-r from-[#991B1B] to-[#7F1D1D] text-white shadow-md shadow-red-950/50 ring-1 ring-amber-500/40'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${ativa ? 'text-amber-300' : 'text-slate-400'}`} />
                <span className="truncate">{p.curto}</span>
              </button>
            );
          })}
        </nav>

        {/* Cartão de Regras Reais da Casa */}
        <div className="mx-3 mb-4 rounded-xl border border-slate-800 bg-[#1E293B]/60 p-3.5 text-xs">
          <p className="font-semibold text-amber-400">Parâmetros Unidade Augusta</p>
          <div className="mt-2 space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Self-Service</span>
              <span className="font-semibold tabular-nums">R$ 119,90/kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Buffet Livre</span>
              <span className="font-semibold tabular-nums">R$ 113,00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Consumo Médio</span>
              <span className="font-semibold tabular-nums">482 g · ~618/dia</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Capacidade</span>
              <span className="font-semibold tabular-nums">90 mesas (3 salões)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMenuAberto(true)}
                className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 lg:hidden"
                aria-label="Abrir navegação"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-white sm:text-xl">{paginaAtual.titulo}</h1>
                <p className="truncate text-xs text-slate-400">{paginaAtual.subtitulo}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                title={
                  geminiAtivo
                    ? `Google Gemini Vision (${visaoStatus?.modeloGemini}) com fallback local HSV`
                    : 'Análise local HSV por histograma/textura (defina GEMINI_API_KEY para usar Gemini Vision)'
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  geminiAtivo
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }`}
              >
                {geminiAtivo ? <Sparkles className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                {geminiAtivo ? 'Gemini Vision Ativo' : 'CV Local HSV Ativo'}
              </span>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar
                </button>
              )}

              <button
                type="button"
                disabled={resetando}
                onClick={onResetDemo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-800/60 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-200 hover:border-red-600 hover:bg-red-900/60 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${resetando ? 'animate-spin' : ''}`} />
                {resetando ? 'Reiniciando...' : 'Reiniciar Demo'}
              </button>
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>

        {/* Rodapé Obrigatório */}
        <footer className="border-t border-slate-800 bg-[#0B1120] px-4 py-4 text-xs text-slate-400 lg:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-bold text-amber-400">Grupo: O Cubo e Os Mágicos</span>
              <span className="mx-2 text-slate-600">•</span>
              <span className="text-slate-300">
                Allan Reis da Conceição (RA: 1539160) · Gabriel Noriler Souza (RA: 1642714) · Mayara Franciele Santos da Silva (RA: 1873454)
              </span>
            </div>
            <div className="text-slate-400">
              Hackathon FMU Tech 2026.2 — Parceria <strong className="text-slate-200">Bovinu&apos;S Grill &amp; Beer (Unidade Augusta)</strong>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
