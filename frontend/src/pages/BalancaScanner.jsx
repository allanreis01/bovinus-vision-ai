import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Cpu,
  ScanLine,
  Video,
  VideoOff,
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  fmtBRL,
  fmtPct,
  fmtGramas,
  CATEGORIA_META,
  CLASSIFICACAO_META,
} from '../utils/format.js';

const EXEMPLOS = [
  {
    id: 'churrasco',
    titulo: 'Picanha & Linguiça',
    descricao: '~70% proteína nobre · Baixa margem',
    src: '/samples/prato-churrasco.jpg',
    comanda: '1579',
    pesoG: 540,
  },
  {
    id: 'equilibrado',
    titulo: 'Prato Equilibrado',
    descricao: 'Arroz, feijão, carne, fritas e salada',
    src: '/samples/prato-equilibrado.jpg',
    comanda: '1411',
    pesoG: 482,
  },
  {
    id: 'salada',
    titulo: 'Leve (Salada & Frango)',
    descricao: 'Predomínio de folhas · Alta margem',
    src: '/samples/prato-salada.jpg',
    comanda: '1531',
    pesoG: 360,
  },
];

export function BalancaScanner({ refreshKey }) {
  const [modoEntrada, setModoEntrada] = useState('exemplo'); // exemplo | upload | webcam
  const [exemploSel, setExemploSel] = useState(EXEMPLOS[0]);
  const [arquivoUpload, setArquivoUpload] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(EXEMPLOS[0].src);

  const [comanda, setComanda] = useState('1579');
  const [pesoG, setPesoG] = useState(540);
  const [modalidade, setModalidade] = useState('kg');
  const [mostrarBoxes, setMostrarBoxes] = useState(true);

  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);

  // Webcam
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [webcamAtiva, setWebcamAtiva] = useState(false);
  const [erroWebcam, setErroWebcam] = useState(null);

  const carregarHistorico = useCallback(async () => {
    try {
      const lista = await api.listarPratos(12);
      setHistorico(lista);
    } catch {
      // silencioso na tabela secundária
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    api.listarPratos(12).then(
      (lista) => {
        if (ativo) setHistorico(lista);
      },
      () => {},
    );
    return () => {
      ativo = false;
    };
  }, [refreshKey]);

  const pararWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setWebcamAtiva(false);
  }, []);

  useEffect(() => () => pararWebcam(), [pararWebcam]);

  const iniciarWebcam = async () => {
    setErroWebcam(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setWebcamAtiva(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      setErroWebcam('Câmera indisponível ou permissão negada neste navegador. Use Upload ou os Pratos de Exemplo.');
    }
  };

  const capturarWebcam = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setArquivoUpload(file);
        setPreviewUrl(URL.createObjectURL(blob));
        pararWebcam();
      },
      'image/jpeg',
      0.92,
    );
  };

  const selecionarExemplo = (ex) => {
    pararWebcam();
    setModoEntrada('exemplo');
    setExemploSel(ex);
    setArquivoUpload(null);
    setPreviewUrl(ex.src);
    setComanda(ex.comanda);
    setPesoG(ex.pesoG);
    setErro(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pararWebcam();
    setArquivoUpload(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErro(null);
  };

  const executarAnalise = async (e) => {
    e.preventDefault();
    setErro(null);
    setAnalisando(true);
    try {
      const form = new FormData();
      form.append('comanda', String(comanda).trim());
      form.append('pesoG', String(pesoG));
      form.append('modalidade', modalidade);

      if (modoEntrada === 'exemplo') {
        const resp = await fetch(exemploSel.src);
        const blob = await resp.blob();
        form.append('imagem', blob, `${exemploSel.id}.jpg`);
      } else if (arquivoUpload) {
        form.append('imagem', arquivoUpload);
      } else {
        throw new Error('Selecione uma foto do prato ou capture pela webcam antes de analisar.');
      }

      const data = await api.analisarPrato(form);
      setResultado(data);
      await carregarHistorico();
    } catch (err) {
      setErro(err.message);
    } finally {
      setAnalisando(false);
    }
  };

  const classMeta = resultado
    ? CLASSIFICACAO_META[resultado.prato.classificacao] || CLASSIFICACAO_META.equilibrada
    : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Painel Esquerdo: Entrada da Balança */}
        <form
          onSubmit={executarAnalise}
          className="space-y-5 rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg xl:col-span-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Scanner da Balança</h2>
              <p className="text-xs text-slate-400">Foto do prato + leitura da comanda e peso</p>
            </div>
            <span className="rounded-lg bg-red-900/40 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-red-700/50">
              R$ 119,90/kg
            </span>
          </div>

          {/* Tabs de Entrada */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-900/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                pararWebcam();
                setModoEntrada('exemplo');
                setPreviewUrl(exemploSel.src);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                modoEntrada === 'exemplo' ? 'bg-[#991B1B] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Exemplos
            </button>
            <button
              type="button"
              onClick={() => {
                pararWebcam();
                setModoEntrada('upload');
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                modoEntrada === 'upload' ? 'bg-[#991B1B] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="h-3.5 w-3.5" /> Upload Foto
            </button>
            <button
              type="button"
              onClick={() => setModoEntrada('webcam')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${
                modoEntrada === 'webcam' ? 'bg-[#991B1B] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="h-3.5 w-3.5" /> Webcam
            </button>
          </div>

          {/* Área conforme modo */}
          {modoEntrada === 'exemplo' && (
            <div className="grid gap-2.5 sm:grid-cols-3">
              {EXEMPLOS.map((ex) => {
                const ativo = exemploSel.id === ex.id;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => selecionarExemplo(ex)}
                    className={`group overflow-hidden rounded-xl border text-left transition-all ${
                      ativo
                        ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                        : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
                    }`}
                  >
                    <div className="aspect-square w-full overflow-hidden bg-slate-950">
                      <img src={ex.src} alt={ex.titulo} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-bold text-white">{ex.titulo}</p>
                      <p className="truncate text-[10px] text-slate-400">{ex.pesoG}g · #{ex.comanda}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {modoEntrada === 'upload' && (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-600 bg-slate-900/50 px-4 py-8 text-center hover:border-amber-500/60 transition-colors">
              <Upload className="h-8 w-8 text-amber-400" />
              <p className="mt-2 text-sm font-semibold text-white">
                {arquivoUpload ? arquivoUpload.name : 'Clique para enviar foto do prato'}
              </p>
              <p className="mt-1 text-xs text-slate-400">JPEG ou PNG até 10 MB (visão superior recomendada)</p>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
            </label>
          )}

          {modoEntrada === 'webcam' && (
            <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              {webcamAtiva ? (
                <>
                  <div className="overflow-hidden rounded-lg bg-black aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={capturarWebcam}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500"
                    >
                      <Camera className="h-4 w-4" /> Capturar Foto do Prato
                    </button>
                    <button
                      type="button"
                      onClick={pararWebcam}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      <VideoOff className="h-4 w-4" /> Desligar
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-5 text-center">
                  <button
                    type="button"
                    onClick={iniciarWebcam}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white ring-1 ring-slate-600 hover:bg-slate-700"
                  >
                    <Video className="h-4 w-4 text-amber-400" /> Ativar Câmera da Balança
                  </button>
                  {erroWebcam && <p className="mt-2 text-xs text-red-300">{erroWebcam}</p>}
                </div>
              )}
            </div>
          )}

          {/* Dados da Comanda & Peso */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Comanda (Código de Barras)</label>
              <input
                type="text"
                value={comanda}
                onChange={(e) => setComanda(e.target.value)}
                placeholder="Ex: 1579"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white focus:border-amber-500 focus:outline-hidden"
              />
              <div className="mt-1.5 flex gap-1.5">
                {['1579', '1411', '1531'].map((cod) => (
                  <button
                    key={cod}
                    type="button"
                    onClick={() => setComanda(cod)}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    #{cod}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Peso na Balança (gramas)</label>
              <input
                type="number"
                min={30}
                max={3000}
                value={pesoG}
                onChange={(e) => setPesoG(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white focus:border-amber-500 focus:outline-hidden tabular-nums"
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <input
                  type="range"
                  min={150}
                  max={1100}
                  step={10}
                  value={Math.min(1100, Math.max(150, pesoG || 482))}
                  onChange={(e) => setPesoG(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setPesoG(482)}
                  className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-slate-700"
                >
                  482g
                </button>
              </div>
            </div>
          </div>

          {/* Modalidade */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModalidade('kg')}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                modalidade === 'kg'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                  : 'border-slate-700 bg-slate-900/50 text-slate-400'
              }`}
            >
              Por Peso · R$ 119,90/kg
            </button>
            <button
              type="button"
              onClick={() => setModalidade('buffet')}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                modalidade === 'buffet'
                  ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                  : 'border-slate-700 bg-slate-900/50 text-slate-400'
              }`}
            >
              Buffet Livre · R$ 113,00
            </button>
          </div>

          {erro && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200">{erro}</div>
          )}

          <button
            type="submit"
            disabled={analisando}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#991B1B] to-[#B91C1C] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/50 hover:from-red-700 hover:to-red-600 disabled:opacity-60 transition-all"
          >
            <ScanLine className={`h-4 w-4 ${analisando ? 'animate-pulse' : ''}`} />
            {analisando ? 'Analisando Mix via Visão Computacional...' : 'Escanear Prato e Calcular Margem'}
          </button>
        </form>

        {/* Painel Direito: Resultado Visual + Financeiro */}
        <div className="space-y-5 rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">Telemetria Visual &amp; Margem Real</h2>
              <p className="text-xs text-slate-400">
                {resultado
                  ? `Comanda #${comanda} · ${fmtGramas(resultado.prato.pesoG)} · Processado em ${resultado.analise.tempoMs} ms`
                  : 'Selecione um prato e clique em "Escanear Prato" para ver as detecções'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {resultado && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                  <Cpu className="h-3 w-3" />
                  {resultado.analise.engine === 'gemini' ? 'Gemini Vision' : 'CV Local HSV'}
                </span>
              )}
              <button
                type="button"
                onClick={() => setMostrarBoxes((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
              >
                {mostrarBoxes ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {mostrarBoxes ? 'Ocultar caixas' : 'Mostrar caixas'}
              </button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-12">
            {/* Imagem com Bounding Boxes */}
            <div className="md:col-span-6">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                {previewUrl ? (
                  <img src={previewUrl} alt="Prato na balança" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500">Nenhuma foto selecionada</div>
                )}

                {mostrarBoxes &&
                  resultado?.analise?.deteccoes?.map((det, idx) => {
                    const cor = CATEGORIA_META[det.categoria]?.cor || '#F59E0B';
                    return (
                      <div
                        key={idx}
                        style={{
                          left: `${det.box.x * 100}%`,
                          top: `${det.box.y * 100}%`,
                          width: `${det.box.w * 100}%`,
                          height: `${det.box.h * 100}%`,
                          borderColor: cor,
                          backgroundColor: `${cor}20`,
                        }}
                        className="absolute rounded border-2 pointer-events-none"
                      >
                        <span
                          style={{ backgroundColor: cor }}
                          className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-950 shadow"
                        >
                          {det.nome} {Math.round(det.confianca)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Resultado Calculado */}
            <div className="flex flex-col justify-between gap-4 md:col-span-6">
              {resultado ? (
                <>
                  {/* Banner de Classificação */}
                  <div className={`rounded-xl border p-3.5 ${classMeta.bannerClass}`}>
                    <div className="flex items-center gap-2">
                      {resultado.prato.classificacao === 'alerta' ? (
                        <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                      )}
                      <span className="text-sm font-extrabold">{resultado.prato.classificacaoNome}</span>
                    </div>
                    <p className="mt-1.5 text-xs opacity-90">{resultado.prato.insight}</p>
                  </div>

                  {/* 3 Cards Financeiros */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
                      <p className="text-[10px] uppercase text-slate-400">Valor Cobrado</p>
                      <p className="mt-1 text-base font-extrabold text-white tabular-nums">
                        {fmtBRL(resultado.prato.valorCobrado)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
                      <p className="text-[10px] uppercase text-slate-400">CMV Estimado</p>
                      <p className="mt-1 text-base font-extrabold text-slate-200 tabular-nums">
                        {fmtBRL(resultado.prato.cmv)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
                      <p className="text-[10px] uppercase text-slate-400">Margem Real</p>
                      <p className="mt-1 text-base font-extrabold text-amber-300 tabular-nums">
                        {fmtPct(resultado.prato.margemPct)}
                      </p>
                    </div>
                  </div>

                  {/* Composição */}
                  <div className="space-y-2 rounded-xl border border-slate-700/80 bg-slate-900/50 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Composição Detectada (% em Peso)
                    </p>
                    {resultado.prato.composicao.map((item) => {
                      const cor = CATEGORIA_META[item.categoria]?.cor || '#94A3B8';
                      return (
                        <div key={item.categoria} className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="font-medium text-slate-200">{item.nome}</span>
                            <span className="text-slate-300 tabular-nums">
                              <strong>{fmtPct(item.percentual)}</strong> · {fmtGramas(item.gramas)} · CMV {fmtBRL(item.cmv)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, item.percentual)}%`, backgroundColor: cor }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
                  <Scale className="h-10 w-10 text-amber-400/80" />
                  <p className="mt-3 text-sm font-semibold text-white">Pronto para analisar na balança</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Escolha um dos 3 pratos de exemplo ao lado, envie uma foto ou use a webcam. O sistema detecta os itens, calcula o CMV real e salva no SQLite.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Histórico salvo no SQLite */}
      <div className="rounded-xl border border-slate-700/80 bg-[#1E293B] p-5 shadow-lg">
        <h3 className="text-sm font-bold text-white">Histórico Recente da Balança (SQLite)</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-700 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-3">Hora</th>
                <th className="py-2 pr-3">Comanda</th>
                <th className="py-2 pr-3">Peso</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">CMV</th>
                <th className="py-2 pr-3">Margem</th>
                <th className="py-2 pr-3">% Churrasco</th>
                <th className="py-2 pr-3">Motor</th>
                <th className="py-2">Classificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {historico.map((p) => {
                const meta = CLASSIFICACAO_META[p.classificacao] || CLASSIFICACAO_META.equilibrada;
                return (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-2 pr-3 text-slate-400 tabular-nums">{p.hora}</td>
                    <td className="py-2 pr-3 font-bold text-white tabular-nums">#{p.comanda}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtGramas(p.pesoG)}</td>
                    <td className="py-2 pr-3 font-semibold text-white tabular-nums">{fmtBRL(p.valorCobrado)}</td>
                    <td className="py-2 pr-3 text-slate-300 tabular-nums">{fmtBRL(p.cmv)}</td>
                    <td className="py-2 pr-3 font-bold text-amber-300 tabular-nums">{fmtPct(p.margemPct)}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtPct(p.churrascoPct)}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{p.engine}</span>
                    </td>
                    <td className="py-2">
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
    </div>
  );
}
