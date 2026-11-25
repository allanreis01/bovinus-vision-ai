import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Flame,
  Scale,
  Salad,
  Utensils,
  Wine,
  AlertTriangle,
  CheckCircle2,
  Users,
  Plus,
  Minus,
  ArrowRight,
  Clock,
  Sun,
  Zap,
} from 'lucide-react';
import { api } from '../services/api.js';
import { fmtMin, fmtPct, fmtNum } from '../utils/format.js';

const ICONES_ESTACAO = {
  saladas: Salad,
  quentes: Utensils,
  churrasqueira: Flame,
  balanca: Scale,
};

function FilasTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-bold text-amber-300">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}:
          </span>
          <span className="font-bold text-white tabular-nums">{fmtMin(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function MonitorFilas({ refreshKey }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api.getFilas().then(
      (res) => {
        if (ativo) {
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

  const alterarCenario = async (cenario) => {
    setSalvando(true);
    try {
      const res = await api.atualizarFilas({ cenario });
      setDados(res);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const ajustarServidor = async (chave, delta) => {
    if (!dados) return;
    const atual = dados.equipe[chave] || 1;
    const novo = Math.max(1, atual + delta);
    setSalvando(true);
    try {
      const res = await api.atualizarFilas({ equipe: { [chave]: novo } });
      setDados(res);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!dados && !erro) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-[#1E293B]" />;
  }

  if (erro && !dados) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-6 text-sm text-red-200">
        Erro ao carregar Monitor de Filas: {erro}
      </div>
    );
  }

  const { cenario, equipe, chegadasPorMin, clientesNaHora, estacoes, bebida, jornadaMin, alertas, curvaDia } = dados;

  const corStatus = (st) => {
    if (st === 'gargalo') return 'border-red-500/70 bg-gradient-to-b from-[#1E293B] to-red-950/30';
    if (st === 'atencao') return 'border-amber-500/60 bg-gradient-to-b from-[#1E293B] to-amber-950/20';
    return 'border-slate-700/80 bg-[#1E293B]';
  };

  return (
    <div className="space-y-6">
      {/* Barra de Simulação Pico vs Normal */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700/80 bg-[#1E293B] p-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={salvando}
            onClick={() => alterarCenario('pico')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              cenario.id === 'pico'
                ? 'bg-[#991B1B] text-white shadow-md shadow-red-950/50 ring-1 ring-amber-500/50'
                : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Zap className="h-4 w-4 text-amber-400" />
            Simular Horário de Pico (12h30)
          </button>

          <button
            type="button"
            disabled={salvando}
            onClick={() => alterarCenario('normal')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              cenario.id === 'normal'
                ? 'bg-emerald-700 text-white shadow-md ring-1 ring-emerald-400/50'
                : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sun className="h-4 w-4 text-amber-300" />
            Simular Horário Normal (14h00)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5">
            <span className="text-slate-400">Chegada agora: </span>
            <strong className="text-white tabular-nums">{fmtNum(chegadasPorMin, 2)}/min</strong>
            <span className="text-slate-400"> ({clientesNaHora} clientes/h)</span>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5">
            <span className="text-slate-400">Jornada até a mesa: </span>
            <strong className="text-amber-300 tabular-nums">{fmtMin(jornadaMin)}</strong>
          </div>
        </div>
      </section>

      {/* Pipeline Real do Buffet + Bebida na Mesa */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Fluxo Real da Operação: Pratos → Saladas → Quentes → Churrasqueira → Balança → Mesa
          </h2>
          <span className="text-xs text-slate-400">Ajuste a equipe (- / +) para simular reforço em tempo real</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {estacoes.map((est) => {
            const Icon = ICONES_ESTACAO[est.id] || Clock;
            return (
              <div key={est.id} className={`flex flex-col justify-between rounded-xl border p-4 shadow-lg transition-all ${corStatus(est.status)}`}>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Icon className={`h-4 w-4 shrink-0 ${est.status === 'gargalo' ? 'text-red-400' : 'text-amber-400'}`} />
                      <h3 className="truncate text-sm font-bold text-white">{est.nome}</h3>
                    </div>
                    {est.status === 'gargalo' ? (
                      <span className="rounded-full border border-red-500/50 bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-300">
                        Gargalo
                      </span>
                    ) : est.status === 'atencao' ? (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                        Atenção
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                        Fluindo
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-white tabular-nums">{fmtMin(est.esperaMin)}</p>
                    <p className="text-[11px] text-slate-400">
                      {est.pessoasFila} na fila · Limite {fmtMin(est.limiteMin)}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Utilização</span>
                      <span className="font-bold text-slate-200 tabular-nums">{fmtPct(est.utilizacao, 0)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          est.status === 'gargalo'
                            ? 'bg-red-500'
                            : est.status === 'atencao'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, est.utilizacao)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Controle de servidores */}
                <div className="mt-4 border-t border-slate-700/70 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      <strong className="text-white">{est.servidores}</strong> {est.recurso}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={salvando || est.servidores <= 1}
                        onClick={() => ajustarServidor(est.id, -1)}
                        className="rounded border border-slate-600 bg-slate-800 p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                        aria-label={`Remover ${est.recurso}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => ajustarServidor(est.id, 1)}
                        className="rounded border border-amber-500/40 bg-amber-500/15 p-1 text-amber-300 hover:bg-amber-500/25"
                        aria-label={`Adicionar ${est.recurso}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Com +1: <strong className="text-emerald-300">{fmtMin(est.comMaisUm)}</strong>
                  </p>
                </div>
              </div>
            );
          })}

          {/* Card 5: 1º Atendimento de Bebida na Mesa */}
          <div className={`flex flex-col justify-between rounded-xl border p-4 shadow-lg ${corStatus(bebida.status)}`}>
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wine className={`h-4 w-4 ${bebida.status === 'gargalo' ? 'text-red-400' : 'text-amber-400'}`} />
                  <h3 className="text-sm font-bold text-white">1ª Bebida (Mesa)</h3>
                </div>
                {bebida.status === 'gargalo' ? (
                  <span className="rounded-full border border-red-500/50 bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-300">
                    Atraso
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                    No SLA
                  </span>
                )}
              </div>

              <div className="mt-3">
                <p className="text-2xl font-extrabold text-white tabular-nums">{fmtMin(bebida.esperaMin)}</p>
                <p className="text-[11px] text-slate-400">
                  {bebida.mesasOcupadas} mesas ocupadas · SLA {fmtMin(bebida.limiteMin)}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-700/70 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  <strong className="text-white">{equipe.garcons}</strong> garçons ativos
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={salvando || equipe.garcons <= 1}
                    onClick={() => ajustarServidor('garcons', -1)}
                    className="rounded border border-slate-600 bg-slate-800 p-1 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                    aria-label="Remover garçom"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => ajustarServidor('garcons', 1)}
                    className="rounded border border-amber-500/40 bg-amber-500/15 p-1 text-amber-300 hover:bg-amber-500/25"
                    aria-label="Adicionar garçom"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                Com +1 garçom: <strong className="text-emerald-300">{fmtMin(bebida.comMaisUm)}</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Alertas Acionáveis + Curva de Espera */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Alertas */}
        <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">Alertas Acionáveis de Gargalo</h2>
          </div>
          <p className="text-xs text-slate-400">Recomendações automáticas com base na fila atual (Erlang-C)</p>

          <div className="mt-4 space-y-3">
            {alertas.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs text-emerald-200">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="font-bold">Operação sem gargalos críticos!</p>
                  <p className="mt-0.5 text-emerald-300/80">
                    Todas as estações estão dentro do tempo ideal de espera para este fluxo.
                  </p>
                </div>
              </div>
            ) : (
              alertas.map((al, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3.5 text-xs ${
                    al.severidade === 'critico'
                      ? 'border-red-500/50 bg-red-950/40 text-red-100'
                      : 'border-amber-500/40 bg-amber-950/30 text-amber-100'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className={`h-4 w-4 shrink-0 ${al.severidade === 'critico' ? 'text-red-400' : 'text-amber-400'}`} />
                    <span>{al.titulo}</span>
                  </div>
                  <p className="mt-1 opacity-90">{al.mensagem}</p>
                  <div className="mt-2 flex items-center gap-1.5 font-semibold text-amber-300">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <span>{al.acao}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-300">{al.impacto}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Gráfico Curva do Dia */}
        <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">Previsão de Fila ao Longo do Almoço (11h00–15h30)</h2>
              <p className="text-xs text-slate-400">Simulação em tempo real considerando a equipe configurada acima</p>
            </div>
          </div>

          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curvaDia} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hora" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} unit="m" />
                <Tooltip content={<FilasTooltip />} />
                <ReferenceLine y={4} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Limite Churrasqueira (4 min)', fill: '#FCA5A5', fontSize: 10 }} />
                <Line type="monotone" dataKey="churrasqueira" name="Churrasqueira" stroke="#DC2626" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="balanca" name="Balança" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="quentes" name="Quentes" stroke="#EA580C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="saladas" name="Saladas" stroke="#16A34A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
