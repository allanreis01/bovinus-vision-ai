import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Trash2,
  Camera,
  Star,
  Thermometer,
  AlertTriangle,
  Flame,
  Send,
  CheckCircle2,
  MessageSquareHeart,
} from 'lucide-react';
import { api } from '../services/api.js';
import { KpiCard } from '../components/KpiCard.jsx';
import { fmtBRL, fmtPct, fmtGramas, fmtNum, CATEGORIA_META } from '../utils/format.js';

const ITENS_SOBRA_RAPIDA = [
  { item: 'Arroz Branco', categoria: 'arroz' },
  { item: 'Peixe ao Molho', categoria: 'quentes' },
  { item: 'Farofa da Casa', categoria: 'quentes' },
  { item: 'Beterraba', categoria: 'salada' },
  { item: 'Cupim (gordura)', categoria: 'churrasco' },
  { item: 'Batata Frita', categoria: 'fritas' },
  { item: 'Salpicão', categoria: 'salada' },
  { item: 'Feijão Tropeiro', categoria: 'feijao' },
];

function SobraTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-amber-300">{d.item}</p>
      <p className="mt-1 text-slate-200">
        Desperdício: <strong className="text-white">{fmtGramas(d.gramas)}</strong> ({fmtPct(d.participacao)})
      </p>
      <p className="text-slate-400">
        {d.ocorrencias} pratos · Custo CMV: {fmtBRL(d.custo)}
      </p>
    </div>
  );
}

export function DesperdicioQualidade({ refreshKey }) {
  const [desperdicio, setDesperdicio] = useState(null);
  const [cubasData, setCubasData] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [erro, setErro] = useState(null);

  // Scanner de retorno
  const [modoSobra, setModoSobra] = useState('rapido'); // rapido | foto
  const [comandaSobra, setComandaSobra] = useState('1579');
  const [pesoSobraG, setPesoSobraG] = useState(75);
  const [itensSel, setItensSel] = useState(['Arroz Branco', 'Beterraba']);
  const [fotoSobra, setFotoSobra] = useState(null);
  const [usarExemploSobra, setUsarExemploSobra] = useState(true);
  const [enviandoSobra, setEnviandoSobra] = useState(false);
  const [sucessoSobra, setSucessoSobra] = useState(null);

  // Filtro de cubas
  const [estacaoCubas, setEstacaoCubas] = useState('Todas');

  // Feedback da comanda
  const [comandaFb, setComandaFb] = useState('1411');
  const [notaFb, setNotaFb] = useState(5);
  const [tagsFb, setTagsFb] = useState(['Picanha no ponto']);
  const [comentarioFb, setComentarioFb] = useState('');
  const [enviandoFb, setEnviandoFb] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([api.getDesperdicio(), api.getCubas(), api.getFeedback()]).then(
      ([d, c, f]) => {
        if (ativo) {
          setDesperdicio(d);
          setCubasData(c);
          setFeedback(f);
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

  const toggleItemSobra = (nome) => {
    setItensSel((prev) => (prev.includes(nome) ? prev.filter((x) => x !== nome) : [...prev, nome].slice(0, 4)));
  };

  const enviarSobra = async (e) => {
    e.preventDefault();
    setEnviandoSobra(true);
    setSucessoSobra(null);
    setErro(null);
    try {
      let res;
      if (modoSobra === 'foto') {
        const form = new FormData();
        form.append('comanda', comandaSobra || 'avulsa');
        form.append('pesoSobraG', String(pesoSobraG));
        if (fotoSobra) {
          form.append('imagem', fotoSobra);
        } else if (usarExemploSobra) {
          const r = await fetch('/samples/sobra-prato.jpg');
          const blob = await r.blob();
          form.append('imagem', blob, 'sobra-prato.jpg');
        } else {
          throw new Error('Escolha uma foto de sobra ou ative a foto de exemplo.');
        }
        res = await api.registrarSobra(form);
      } else {
        if (itensSel.length === 0) throw new Error('Selecione pelo menos 1 item que sobrou no prato.');
        const lista = itensSel.map((nome) => {
          const found = ITENS_SOBRA_RAPIDA.find((i) => i.item === nome);
          return { item: nome, categoria: found?.categoria || 'arroz', percentual: 100 / itensSel.length };
        });
        res = await api.registrarSobra({
          comanda: comandaSobra || 'avulsa',
          pesoSobraG: Number(pesoSobraG),
          itens: lista,
        });
      }

      setSucessoSobra(
        `Sobra registrada (#${res.sobra.comanda}): ${fmtGramas(res.sobra.pesoSobraG)} · Custo perdido ${fmtBRL(
          res.sobra.custoDesperdicio,
        )}`,
      );
      const atualizado = await api.getDesperdicio();
      setDesperdicio(atualizado);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviandoSobra(false);
    }
  };

  const toggleTagFb = (tag) => {
    setTagsFb((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 4)));
  };

  const enviarFeedbackForm = async (e) => {
    e.preventDefault();
    setEnviandoFb(true);
    try {
      await api.enviarFeedback({
        comanda: comandaFb || 'anônima',
        nota: notaFb,
        tags: tagsFb,
        comentario: comentarioFb.trim() || null,
      });
      setComentarioFb('');
      const atualizado = await api.getFeedback();
      setFeedback(atualizado);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviandoFb(false);
    }
  };

  if (!desperdicio && !erro) {
    return <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-[#1E293B]" />;
  }

  const cubasFiltradas =
    cubasData?.cubas.filter((c) => estacaoCubas === 'Todas' || c.estacao === estacaoCubas) || [];

  return (
    <div className="space-y-6">
      {erro && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200">{erro}</div>
      )}

      {/* KPIs */}
      {desperdicio && feedback && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            titulo="Índice de Desperdício"
            valor={fmtPct(desperdicio.indiceGeral, 2)}
            subtitulo={`${desperdicio.totalSobraKg} kg descartados de ${desperdicio.totalServidoKg} kg servidos`}
            icon={Trash2}
            destaque={desperdicio.indiceGeral > 4 ? 'danger' : 'amber'}
          />
          <KpiCard
            titulo="Custo do Desperdício"
            valor={`${fmtBRL(desperdicio.custoDia)}/dia`}
            subtitulo={`Projeção mensal (26d): ${fmtBRL(desperdicio.custoMesProjetado)}`}
            icon={AlertTriangle}
            destaque="wine"
          />
          <KpiCard
            titulo="Cubas em Alerta (Baixa Saída)"
            valor={`${cubasData?.resumo?.paradas || 0} cubas`}
            subtitulo={`${cubasData?.resumo?.alertasTemperatura || 0} alerta(s) de temperatura (RDC 216)`}
            icon={Thermometer}
            destaque={cubasData?.resumo?.paradas > 0 ? 'amber' : 'emerald'}
          />
          <KpiCard
            titulo="Nota Comanda & NPS"
            valor={`${fmtNum(feedback.notaMedia, 2)} / 5`}
            subtitulo={`NPS ${feedback.nps} · ${feedback.total} avaliações hoje`}
            icon={Star}
            destaque="emerald"
          />
        </section>
      )}

      {/* Scanner de Retorno + Ranking de Alimentos Mais Desperdiçados */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Scanner de Retorno */}
        <form
          onSubmit={enviarSobra}
          className="space-y-4 rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Scanner de Retorno (Sobra no Prato)</h2>
              <p className="text-xs text-slate-400">Registre sobras ao devolver o prato para medir rejeição real</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-900/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setModoSobra('rapido')}
              className={`rounded-lg py-2 transition-colors ${
                modoSobra === 'rapido' ? 'bg-[#991B1B] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Registro Rápido
            </button>
            <button
              type="button"
              onClick={() => setModoSobra('foto')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                modoSobra === 'foto' ? 'bg-[#991B1B] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" /> Visão Computacional
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Comanda</label>
              <input
                type="text"
                value={comandaSobra}
                onChange={(e) => setComandaSobra(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300">Peso da Sobra (g)</label>
              <input
                type="number"
                min={5}
                max={1500}
                value={pesoSobraG}
                onChange={(e) => setPesoSobraG(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white tabular-nums"
              />
            </div>
          </div>

          {modoSobra === 'rapido' ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-300">O que voltou no prato? (selecione até 4)</p>
              <div className="flex flex-wrap gap-1.5">
                {ITENS_SOBRA_RAPIDA.map((it) => {
                  const ativo = itensSel.includes(it.item);
                  return (
                    <button
                      key={it.item}
                      type="button"
                      onClick={() => toggleItemSobra(it.item)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        ativo
                          ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                          : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {it.item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex items-center gap-3">
                <img
                  src={fotoSobra ? URL.createObjectURL(fotoSobra) : '/samples/sobra-prato.jpg'}
                  alt="Sobra no prato"
                  className="h-20 w-20 rounded-lg border border-slate-700 object-cover"
                />
                <div className="flex-1 text-xs">
                  <p className="font-semibold text-white">
                    {fotoSobra ? fotoSobra.name : 'Foto de exemplo carregada (sobra-prato.jpg)'}
                  </p>
                  <label className="mt-2 inline-block cursor-pointer rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700">
                    Trocar Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setFotoSobra(f);
                          setUsarExemploSobra(false);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {sucessoSobra && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{sucessoSobra}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={enviandoSobra}
            className="w-full rounded-xl bg-[#991B1B] px-4 py-2.5 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
          >
            {enviandoSobra ? 'Analisando e Salvando...' : 'Registrar Sobra no Termômetro'}
          </button>
        </form>

        {/* Ranking de Desperdício */}
        {desperdicio && (
          <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-7">
            <h2 className="text-base font-bold text-white">Ranking de Alimentos Mais Rejeitados / Desperdiçados</h2>
            <p className="text-xs text-slate-400">Peso acumulado descartado hoje ({desperdicio.pratosComSobra} pratos com sobra)</p>

            <div className="mt-4 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={desperdicio.ranking.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} unit="g" />
                  <YAxis dataKey="item" type="category" stroke="#CBD5E1" fontSize={11} width={130} />
                  <Tooltip content={<SobraTooltip />} />
                  <Bar dataKey="gramas" radius={[0, 4, 4, 0]} barSize={16}>
                    {desperdicio.ranking.slice(0, 10).map((entry, idx) => (
                      <Cell key={idx} fill={entry.cor || CATEGORIA_META[entry.categoria]?.cor || '#D97706'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Giro das Cubas do Buffet */}
      {cubasData && (
        <section className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Giro das Cubas do Buffet &amp; Qualidade</h2>
              <p className="text-xs text-slate-400">
                Identifica cubas paradas (baixa saída) e desvios de temperatura antes do cliente reclamar
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Todas', 'Saladas', 'Quentes', 'Churrasqueira'].map((est) => (
                <button
                  key={est}
                  type="button"
                  onClick={() => setEstacaoCubas(est)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                    estacaoCubas === est
                      ? 'bg-[#991B1B] text-white'
                      : 'border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cubasFiltradas.map((c) => {
              const parada = c.status === 'parada';
              const alto = c.status === 'alto_giro';
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border p-3.5 text-xs ${
                    parada || c.tempAlerta
                      ? 'border-red-500/60 bg-red-950/30'
                      : alto
                        ? 'border-emerald-500/50 bg-emerald-950/20'
                        : 'border-slate-700/80 bg-slate-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{c.nome}</p>
                      <p className="text-[11px] text-slate-400">{c.estacao}</p>
                    </div>
                    {parada ? (
                      <span className="rounded-full border border-red-500/50 bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-200">
                        Baixa Saída
                      </span>
                    ) : alto ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        <Flame className="h-3 w-3" /> Alto Giro
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        Normal
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded bg-slate-900/80 p-1.5">
                      <p className="text-[10px] text-slate-400">Giro</p>
                      <p className="font-bold text-white tabular-nums">{c.giroKgH} kg/h</p>
                    </div>
                    <div className="rounded bg-slate-900/80 p-1.5">
                      <p className="text-[10px] text-slate-400">Sem saída</p>
                      <p className={`font-bold tabular-nums ${c.minSemSaida > 20 ? 'text-red-300' : 'text-slate-200'}`}>
                        {Math.round(c.minSemSaida)} min
                      </p>
                    </div>
                    <div className="rounded bg-slate-900/80 p-1.5">
                      <p className="text-[10px] text-slate-400">Temp.</p>
                      <p className={`font-bold tabular-nums ${c.tempAlerta ? 'text-red-300' : 'text-slate-200'}`}>
                        {c.temperatura}°C
                      </p>
                    </div>
                  </div>

                  {c.alertas.length > 0 && (
                    <p className="mt-2.5 text-[11px] leading-snug text-amber-200">{c.alertas[0]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Feedback Rápido na Comanda */}
      {feedback && (
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-7">
            <div className="flex items-center gap-2">
              <MessageSquareHeart className="h-4 w-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">Voz do Cliente — Feedback Rápido na Comanda</h2>
            </div>
            <p className="text-xs text-slate-400">Tags e comentários capturados no almoço de hoje</p>

            {/* Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              {feedback.tags.map((t) => (
                <span
                  key={t.tag}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    t.tipo === 'positiva'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-red-500/40 bg-red-500/10 text-red-300'
                  }`}
                >
                  {t.tag}
                  <span className="rounded-full bg-slate-900/70 px-1.5 py-0.2 text-[10px] text-white">{t.qtd}</span>
                </span>
              ))}
            </div>

            {/* Comentários recentes */}
            <div className="mt-4 space-y-2">
              {feedback.recentes.slice(0, 4).map((fb) => (
                <div key={fb.id} className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Comanda #{fb.comanda}</span>
                    <span className="font-bold text-amber-400">{'★'.repeat(fb.nota)}{'☆'.repeat(5 - fb.nota)}</span>
                  </div>
                  <p className="mt-1 text-slate-200">&ldquo;{fb.comentario}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>

          {/* Simulador de QR da Comanda */}
          <form
            onSubmit={enviarFeedbackForm}
            className="space-y-4 rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg lg:col-span-5"
          >
            <div>
              <h2 className="text-base font-bold text-white">Simular Avaliação via Comanda</h2>
              <p className="text-xs text-slate-400">Cliente escaneia a comanda ao sair ou na mesa (10 segundos)</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="w-28">
                <label className="block text-xs font-semibold text-slate-300">Comanda</label>
                <input
                  type="text"
                  value={comandaFb}
                  onChange={(e) => setComandaFb(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300">Nota</label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNotaFb(n)}
                      className={`rounded-lg px-2 py-1 text-base transition-colors ${
                        n <= notaFb ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-300">Destaques</p>
              <div className="flex flex-wrap gap-1.5">
                {[...(feedback.tagsDisponiveis?.positivas || []), ...(feedback.tagsDisponiveis?.negativas || [])].map(
                  (tag) => {
                    const ativo = tagsFb.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTagFb(tag)}
                        className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
                          ativo
                            ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                            : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Comentário (opcional)</label>
              <input
                type="text"
                value={comentarioFb}
                onChange={(e) => setComentarioFb(e.target.value)}
                placeholder="Ex.: Picanha espetacular, fila rápida hoje!"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={enviandoFb}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {enviandoFb ? 'Enviando...' : 'Enviar Avaliação da Comanda'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
