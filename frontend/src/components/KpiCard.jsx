export function KpiCard({
  titulo,
  valor,
  subtitulo,
  icon: Icon,
  badge,
  destaque = 'default',
  onClick,
}) {
  const accentMap = {
    default: 'border-slate-700/80 hover:border-slate-600',
    wine: 'border-red-900/70 bg-gradient-to-br from-[#1E293B] to-red-950/30 hover:border-red-700/80',
    amber: 'border-amber-700/50 bg-gradient-to-br from-[#1E293B] to-amber-950/20 hover:border-amber-500/70',
    emerald: 'border-emerald-700/50 bg-gradient-to-br from-[#1E293B] to-emerald-950/20 hover:border-emerald-500/70',
    danger: 'border-red-600/60 bg-gradient-to-br from-[#1E293B] to-red-950/40 hover:border-red-500/80',
  };

  const iconBgMap = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    wine: 'bg-red-900/50 text-amber-400 border-red-700/50',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/40',
  };

  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left rounded-xl border bg-[#1E293B] p-4 shadow-lg transition-all ${accentMap[destaque] || accentMap.default} ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{titulo}</p>
          <p className="mt-1.5 text-xl xl:text-[22px] font-extrabold tracking-tight text-white tabular-nums">{valor}</p>
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconBgMap[destaque] || iconBgMap.default}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      {(subtitulo || badge) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/60 pt-2.5">
          {subtitulo && <span className="text-xs text-slate-400">{subtitulo}</span>}
          {badge && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
              {badge.text}
            </span>
          )}
        </div>
      )}
    </Comp>
  );
}
