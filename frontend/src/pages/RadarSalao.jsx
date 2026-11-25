import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertOctagon,
  Clock,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { api } from '../services/api.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { fmtPct, fmtMin, fmtCronometro } from '../utils/format.js';

const SALOES_TABS = [
  { id: 'todos', nome: 'Todos os Salões (90)' },
  { id: 'principal', nome: 'Salão Principal (30)' },
  { id: 'superior', nome: 'Salão Superior (40)' },
  { id: 'inferior', nome: 'Salão Inferior / Pista (20)' },
];

const SLA_LIMPEZA_SEG = 5 * 60;
const calcServerOffset = (serverNow) => serverNow - Date.now();

export function RadarSalao({ refreshKey }) {
  const [dados, setDados] = useState(null);
  const [salaoFiltro, setSalaoFiltro] = useState('todos');
  const [autoSimular, setAutoSimular] = useState(false);
  const [erro, setErro] = useState(null);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  useEffect(() => {
    let ativo = true;
    api.getMesas().then(
      (res) => {
        if (ativo) {
          setServerOffsetMs(calcServerOffset(res.serverNow));
          setDados(res);
          setErro(null);
        }
      },
      (err) => {
        if (ativo) setErro(err.message);
      },
    );
    return () => {
      ativo = false;
    };
  }, [refreshKey]);

  // Cronômetro em tempo real (1s)
  useEffect(() => {
    const timer = setInterval(() => {
      setAgoraMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-simulação opcional (a cada 4s)
  useEffect(() => {
    if (!autoSimular) return undefined;
    const timer = setInterval(() => {
      api.simularMesas(1.2).then(
        (res) => {
          setServerOffsetMs(calcServerOffset(res.serverNow));
          setDados(res);
        },
        () => {},
      );
    }, 4000);
    return () => clearInterval(timer);
  }, [autoSimular]);

  const aplicarResposta = (res) => {
    setServerOffsetMs(calcServerOffset(res.serverNow));
    setDados(res);
    setErro(null);
  };

  const clicarMesa = async (id) => {
    try {
      const res = await api.atualizarMesa(id, 'proximo');
      aplicarResposta(res);
    } catch (err) {
      setErro(err.message);
    }
  };

  const simularAgora = async () => {
    try {
      const res = await api.simularMesas(1.6);
      aplicarResposta(res);
    } catch (err) {
      setErro(err.message);
    }
  };

  const reiniciarMesas = async () => {
    try {
      const res = await api.reiniciarMesas();
      aplicarResposta(res);
    } catch (err) {
      setErro(err.message);
    }
  };

  if (!dados && !erro) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-[#1E293B]" />;
  }

  if (erro && !dados) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-6 text-sm text-red-200">
        Erro ao carregar Radar de Salão: {erro}
      </div>
    );
  }

  const agoraServidor = agoraMs + serverOffsetMs;

  const mesasDecoradas = dados.mesas.map((m) => {
    const decorridoS = Math.max(0, Math.floor((agoraServidor - m.desdeTs) / 1000));
    const critico = m.status === 'aguardando_limpeza' && decorridoS > SLA_LIMPEZA_SEG;
    return { ...m, decorridoS, critico };
  });

  const criticasAoVivo = mesasDecoradas.filter((m) => m.critico).length;
  const aguardandoAoVivo = mesasDecoradas.filter((m) => m.status === 'aguardando_limpeza').length;

  const { metricas } = dados;
  const saloesExibidos =
    salaoFiltro === 'todos' ? metricas.saloes : metricas.saloes.filter((s) => s.id === salaoFiltro);

  const mesaStyle = (m) => {
    if (m.critico) {
      return 'border-red-500 bg-red-950/75 text-red-100 animate-pulse-critico hover:bg-red-900/80';
    }
    if (m.status === 'aguardando_limpeza') {
      return 'border-amber-500/80 bg-amber-950/50 text-amber-100 hover:bg-amber-900/50';
    }
    if (m.status === 'ocupada') {
      return 'border-sky-500/60 bg-sky-950/45 text-sky-100 hover:bg-sky-900/50';
    }
    return 'border-emerald-500/50 bg-emerald-950/35 text-emerald-100 hover:bg-emerald-900/45';
  };

  const statusDot = (m) => {
    if (m.critico) return 'bg-red-500';
    if (m.status === 'aguardando_limpeza') return 'bg-amber-400';
    if (m.status === 'ocupada') return 'bg-sky-400';
    return 'bg-emerald-400';
  };

  return (
    <div className="space-y-6">
      {/* KPIs do Salão */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titulo="Taxa de Ocupação Atual"
          valor={fmtPct(metricas.ocupacao)}
          subtitulo={`${metricas.ocupada} ocupadas · ${metricas.livre} livres (de ${metricas.total})`}
          icon={Users}
          destaque="default"
        />
        <KpiCard
          titulo="Tempo Médio de Mesa Suja"
          valor={fmtMin(metricas.tempoMedioLimpezaMin)}
          subtitulo={`Meta SLA da casa: ≤ 5 min (${metricas.limpezasHoje} giros)`}
          icon={Clock}
          destaque={metricas.tempoMedioLimpezaMin > 5 ? 'danger' : 'amber'}
          badge={{
            text: `SLA cumprido: ${fmtPct(metricas.slaCumprido)}`,
            className: 'border-slate-600 bg-slate-800 text-slate-200',
          }}
        />
        <KpiCard
          titulo="Mesas Aguardando Limpeza"
          valor={`${aguardandoAoVivo}`}
          subtitulo={criticasAoVivo > 0 ? `${criticasAoVivo} em estado CRÍTICO (> 5 min)` : 'Nenhuma acima do SLA'}
          icon={Sparkles}
          destaque={criticasAoVivo > 0 ? 'danger' : 'emerald'}
        />
        <KpiCard
          titulo="Salão Mais Crítico"
          valor={metricas.maisCritico?.nome || '—'}
          subtitulo={
            metricas.maisCritico
              ? `Média ${fmtMin(metricas.maisCritico.tempoMedioLimpezaMin)} · ${metricas.maisCritico.critico} críticas`
              : 'Operação equilibrada'
          }
          icon={AlertOctagon}
          destaque="wine"
        />
      </section>

      {/* Barra de Controles e Legenda */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-lg">
        {/* Abas dos salões */}
        <div className="flex flex-wrap gap-1.5">
          {SALOES_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSalaoFiltro(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                salaoFiltro === t.id
                  ? 'bg-[#991B1B] text-white ring-1 ring-amber-500/40'
                  : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t.nome}
            </button>
          ))}
        </div>

        {/* Botões de simulação */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={simularAgora}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
          >
            <Play className="h-3.5 w-3.5" /> Simular Movimento
          </button>

          <button
            type="button"
            onClick={() => setAutoSimular((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              autoSimular
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {autoSimular ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoSimular ? 'Auto-Simulação Ligada' : 'Auto-Simulação (4s)'}
          </button>

          <button
            type="button"
            onClick={reiniciarMesas}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Sortear Ocupação
          </button>
        </div>
      </section>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-400" /> Livre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sky-400" /> Ocupada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-400" /> Aguardando Limpeza (cronômetro)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" /> Crítico / Suja &gt; 5 min (alerta garçons)
          </span>
        </div>
        <span className="text-slate-400">Clique em qualquer mesa para alternar o status ao vivo</span>
      </div>

      {/* Planta dos Salões */}
      <div className="space-y-6">
        {saloesExibidos.map((salao) => {
          const mesasSalao = mesasDecoradas.filter((m) => m.salao === salao.id);
          const criticasSalao = mesasSalao.filter((m) => m.critico).length;
          const limpandoSalao = mesasSalao.filter((m) => m.status === 'aguardando_limpeza').length;

          return (
            <section key={salao.id} className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-white">{salao.nome}</h2>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    {salao.total} mesas · Ocupação {fmtPct(salao.ocupacao, 0)}
                  </span>
                  {salao.tempoMedioLimpezaMin > 0 && (
                    <span className="text-xs text-slate-400">
                      Limpeza média: <strong className="text-slate-200">{fmtMin(salao.tempoMedioLimpezaMin)}</strong>
                    </span>
                  )}
                </div>

                {criticasSalao > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-200">
                    <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
                    {criticasSalao} mesa(s) crítica(s) &gt; 5 min · Acionar garçom!
                  </span>
                ) : limpandoSalao > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                    {limpandoSalao} aguardando limpeza
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Salão em dia
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10">
                {mesasSalao.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => clicarMesa(m.id)}
                    title={`Mesa ${m.codigo} (${m.lugares} lugares) — clique para avançar status`}
                    className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all cursor-pointer ${mesaStyle(m)}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold tracking-tight">{m.codigo}</span>
                      <span className={`h-2 w-2 rounded-full ${statusDot(m)}`} />
                    </div>

                    <div className="mt-2">
                      {m.status === 'aguardando_limpeza' ? (
                        <p className={`text-xs font-extrabold tabular-nums ${m.critico ? 'text-red-300' : 'text-amber-300'}`}>
                          {fmtCronometro(m.decorridoS)}
                        </p>
                      ) : m.status === 'ocupada' ? (
                        <p className="text-[11px] font-semibold text-sky-200 tabular-nums">
                          {m.comanda ? `#${m.comanda}` : 'Ocupada'}
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-emerald-300">Livre</p>
                      )}
                      <p className="text-[10px] opacity-70">{m.lugares} lug.</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
