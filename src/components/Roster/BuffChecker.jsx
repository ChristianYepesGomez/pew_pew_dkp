import { checkBuffCoverage, getBuffIconUrl } from '../../utils/raidBuffs'

const CATEGORY_LABELS = {
  stat: 'Stats',
  amp: 'Daño',
  defensive: 'Defensivo',
  utility: 'Utilidad',
  lust: 'Lust',
}

export default function BuffChecker({ players }) {
  const coverage = checkBuffCoverage(players)
  const missing = coverage.filter((b) => !b.covered)

  return (
    <div className="rounded-xl border border-[rgba(177,167,208,0.20)] bg-[rgba(177,167,208,0.06)] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[#b1a7d0]">
          Buffs de raid
        </span>
        {missing.length === 0 ? (
          <span className="text-xs font-semibold text-green-400">✓ Composición completa</span>
        ) : (
          <span className="text-xs font-semibold text-orange-400">
            {missing.length} buff{missing.length > 1 ? 's' : ''} ausente{missing.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {coverage.map((buff) => (
          <BuffIcon key={buff.id} buff={buff} />
        ))}
      </div>
    </div>
  )
}

function BuffIcon({ buff }) {
  const { covered, coveredBy, name, effect, icon } = buff

  return (
    <div
      className="relative group flex flex-col items-center gap-1"
      title={`${name} — ${effect}${covered ? `\nAportado por: ${coveredBy.join(', ')}` : '\n⚠ Nadie en el roster aporta este buff'}`}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${
          covered
            ? 'border-green-500/60 opacity-100'
            : 'border-red-500/60 opacity-40 grayscale'
        }`}
      >
        <img
          src={getBuffIconUrl(icon)}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Check / X */}
      <span
        className={`text-[10px] font-bold leading-none ${
          covered ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {covered ? '✓' : '✗'}
      </span>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 hidden group-hover:flex flex-col items-center pointer-events-none">
        <div className="bg-[#0f0b20] border border-[rgba(177,167,208,0.30)] rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
          <div className="font-bold text-[#ffeccd] mb-1">{name}</div>
          <div className="text-[#b1a7d0] mb-1">{effect}</div>
          {covered ? (
            <div className="text-green-400">{coveredBy.join(', ')}</div>
          ) : (
            <div className="text-red-400">Sin cobertura</div>
          )}
        </div>
        <div className="w-2 h-2 bg-[#0f0b20] border-r border-b border-[rgba(177,167,208,0.30)] rotate-45 -mt-1" />
      </div>
    </div>
  )
}
