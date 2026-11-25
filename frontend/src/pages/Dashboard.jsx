import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Flame,
  Sparkles,
  Trash2,
  ArrowRight,
  Lightbulb,
  Award,
  Camera,
} from 'lucide-react';
import { api } from '../services/api.js';
import { KpiCard } from '../components/KpiCard.jsx';
import {
  fmtBRL,
  fmtPct,
  fmtGramas,
  fmtMin,
  fmtNum,
  CLASSIFICACAO_META,
} from '../utils/format.js';

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-semibold text-amber-300">{label}</p>}
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.cor }} />
            {entry.name}:
          </span>
          <span className="font-bold text-white tabular-nums">
            {typeof entry.value === 'number' ? fmtNum(entry.value, 1) : entry.value}
            {entry.unit || suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard({ refreshKey, onNavegar }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    api.getDashboard().then(
      (res) => {
        if (ativo) {
          setDados(res);
          setErro(null);
          setCarregando(false);
        }
      },
      (err) => {
        if (ativo) {
          setErro(err.message);
          setCarregando(false);
        }
      },
    );
    return () => {
      ativo = false;
    };
  }, [refreshKey]);

  if (carregando && !dados) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-slate-800 bg-[#1E293B]" />
        ))}
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-6 text-sm text-red-200">
        Erro ao carregar o Dashboard: {erro}
      </div>
    );
  }

  const { kpis, mixCategorias, margemPorHorario, rankingSobras, classificacao, insights, roi, ultimosPratos } = dados;

  return (
    <div className="space-y-6">
      {/* Faixa de 5 KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          titulo="Faturamento Estimado Almoço"
          valor={fmtBRL(kpis.faturamentoBase)}
          subtitulo={kpis.formulaFaturamento}
          icon={DollarSign}
          destaque="wine"
          badge={{
            text: `${kpis.pratosRegistrados} pratos · ${fmtGramas(kpis.pesoMedio)} méd.`,
            className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
          }}
        />
        <KpiCard
          titulo="Margem Média Real (Mix)"
          valor={fmtPct(kpis.margemMedia)}
          subtitulo={`CMV médio: ${fmtPct(kpis.cmvMedio)} · Ticket ${fmtBRL(kpis.ticketMedio)}`}
          icon={TrendingUp}
          destaque="emerald"
          onClick={() => onNavegar('balanca')}
          badge={{
            text: 'Ver Balança IA',
            className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
          }}
        />
        <KpiCard
          titulo="Fila na Churrasqueira"
          valor={fmtMin(kpis.filaChurrasqueiraMin)}
          subtitulo={`Balança: ${fmtMin(kpis.filaBalancaMin)} · ${kpis.cenarioFila}`}
          icon={Flame}
          destaque={kpis.filaChurrasqueiraMin > 4 ? 'danger' : 'amber'}
          onClick={() => onNavegar('filas')}
          badge={{
            text: kpis.filaChurrasqueiraMin > 4 ? 'Gargalo > 4 min' : 'Fluxo normal',
            className:
              kpis.filaChurrasqueiraMin > 4
                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
          }}
        />
        <KpiCard
          titulo="Tempo Médio Limpeza Mesa"
          valor={fmtMin(kpis.tempoMedioLimpezaMin)}
          subtitulo={`Ocupação atual: ${fmtPct(kpis.ocupacaoSalao)} (90 mesas)`}
          icon={Sparkles}
          destaque={kpis.mesasCriticas > 0 ? 'amber' : 'default'}
          onClick={() => onNavegar('salao')}
          badge={{
            text: `${kpis.mesasCriticas} mesas > 5 min`,
            className:
              kpis.mesasCriticas > 0
                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
          }}
        />
        <KpiCard
          titulo="Índice de Desperdício"
          valor={fmtPct(kpis.indiceDesperdicio, 2)}
          subtitulo={`Custo estimado: ${fmtBRL(kpis.custoDesperdicioDia)}/dia`}
          icon={Trash2}
          destaque="default"
          onClick={() => onNavegar('desperdicio')}
          badge={{
            text: `Nota comanda ${fmtNum(kpis.notaMedia, 1)}/5`,
            className: 'border-slate-600 bg-slate-800 text-slate-200',
          }}
        />
      </section>

      {/* Gráficos principais */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Mix de Categorias */}
        <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">Mix Real Servido no Prato</h2>
              <p className="text-xs text-slate-400">Participação média por peso detectado na balança</p>
            </div>
            <button
              type="button"
              onClick={() => onNavegar('balanca')}
              className="inline-flex items-center gap-1 rounded-lg bg-[#991B1B] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
              Escanear
            </button>
          </div>

          <div className="grid items-center gap-4 sm:grid-cols-12">
            <div className="h-56 w-full min-w-0 sm:col-span-5">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mixCategorias}
                    dataKey="pct"
                    nameKey="nome"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="#0F172A"
                    strokeWidth={2}
                  >
                    {mixCategorias.map((item) => (
                      <Cell key={item.categoria} fill={item.cor} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 sm:col-span-7">
              {mixCategorias.map((cat) => (
                <div key={cat.categoria} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.cor }} />
                    <span className="truncate text-slate-200 font-medium">{cat.nome}</span>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <span className="font-bold text-white">{fmtPct(cat.pct)}</span>
                    <span className="ml-1.5 text-slate-400">({Math.round(cat.gramasPorPrato)}g)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Margem por Horário */}
        <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">Margem Real × Proteína Nobre por Horário</h2>
              <p className="text-xs text-slate-400">
                Curva do almoço (11h00–15h30): maior % de churrasco reduz a margem líquida
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> % Churrasco
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="h-0.5 w-4 bg-amber-400" /> Margem (%)
              </span>
            </div>
          </div>

          <div className="h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={margemPorHorario} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="hora" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="churrascoPct" name="% Proteína Nobre" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={22} unit="%" />
                <Line
                  type="monotone"
                  dataKey="margem"
                  name="Margem Real"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#F59E0B' }}
                  unit="%"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Segunda linha de análise: Ranking de Sobras + Classificação + ROI/Insights */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Ranking de Sobras */}
        <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Ranking de Sobras (Desperdício no Prato)</h2>
              <p className="text-xs text-slate-400">Top itens mais descartados ao final da refeição</p>
            </div>
            <button
              type="button"
              onClick={() => onNavegar('desperdicio')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              Abrir Módulo 4 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingSobras} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} unit="g" />
                <YAxis dataKey="item" type="category" stroke="#CBD5E1" fontSize={11} width={125} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="gramas" name="Desperdício" radius={[0, 4, 4, 0]} barSize={16} unit=" g">
                  {rankingSobras.map((item, i) => (
                    <Cell key={i} fill={item.cor || '#D97706'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights Acionáveis & Classificação dos Pratos */}
        <div className="space-y-5 lg:col-span-6">
          {/* Classificação de Margem */}
          <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg">
            <h2 className="text-base font-bold text-white">Classificação dos Pratos Servidos</h2>
            <p className="text-xs text-slate-400">Distribuição dos {kpis.pratosRegistrados} pratos analisados hoje</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {classificacao.map((c) => {
                const meta = CLASSIFICACAO_META[c.id] || CLASSIFICACAO_META.equilibrada;
                return (
                  <div key={c.id} className="rounded-lg border border-slate-700/80 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                      <span className="text-xs font-semibold text-slate-200">{c.nome}</span>
                    </div>
                    <p className="mt-2 text-xl font-extrabold text-white tabular-nums">{fmtPct(c.pct)}</p>
                    <p className="text-[11px] text-slate-400">{c.qtd} pratos</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights Operacionais */}
          <div className="rounded-xl border border-amber-600/30 bg-[#1E293B] p-5 shadow-lg">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">Inteligência Operacional para o Gerente</h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {insights.map((ins, i) => (
                <li key={i} className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3 text-xs leading-relaxed text-slate-200">
                  <span className="mr-2 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                    {ins.modulo}
                  </span>
                  {ins.texto}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ROI Estimado + Últimos Pratos da Balança */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-emerald-700/40 bg-gradient-to-br from-[#1E293B] to-emerald-950/20 p-5 shadow-lg lg:col-span-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Impacto Financeiro Estimado (ROI)</h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">Projeção mensal (26 dias úteis) na Unidade Augusta</p>
            </div>
            <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-extrabold text-emerald-300 ring-1 ring-emerald-500/30 tabular-nums">
              +{fmtBRL(roi.totalMensal)}/mês
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {roi.itens.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{item.frente}</p>
                  <p className="text-[11px] text-slate-400">{item.premissa}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-300 tabular-nums">+{fmtBRL(item.mensal)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Últimas Pesagens Registradas</h2>
              <p className="text-xs text-slate-400">Comandas recentes salvas no SQLite</p>
            </div>
            <button
              type="button"
              onClick={() => onNavegar('balanca')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              Ir para Balança IA <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-700 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Hora</th>
                  <th className="py-2 pr-3">Comanda</th>
                  <th className="py-2 pr-3">Peso</th>
                  <th className="py-2 pr-3">Cobrado</th>
                  <th className="py-2 pr-3">CMV</th>
                  <th className="py-2 pr-3">Margem</th>
                  <th className="py-2">Classificação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ultimosPratos.map((p) => {
                  const meta = CLASSIFICACAO_META[p.classificacao] || CLASSIFICACAO_META.equilibrada;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 text-slate-400 tabular-nums">{p.hora}</td>
                      <td className="py-2.5 pr-3 font-bold text-white tabular-nums">#{p.comanda}</td>
                      <td className="py-2.5 pr-3 text-slate-200 tabular-nums">{fmtGramas(p.pesoG)}</td>
                      <td className="py-2.5 pr-3 font-semibold text-white tabular-nums">{fmtBRL(p.valorCobrado)}</td>
                      <td className="py-2.5 pr-3 text-slate-300 tabular-nums">{fmtBRL(p.cmv)}</td>
                      <td className="py-2.5 pr-3 font-bold text-amber-300 tabular-nums">{fmtPct(p.margemPct)}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}>
                          {meta.nome}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
