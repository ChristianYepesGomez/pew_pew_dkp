import CLASS_COLORS from '../../utils/classColors'

export default function StandsPanel({ stands }) {
  if (!stands || stands.length === 0) return null

  // Arrange all players in rows of 3
  const rows = []
  for (let i = 0; i < stands.length; i += 3) rows.push(stands.slice(i, i + 3))

  return (
    <div className="absolute left-full top-0 bottom-0 pl-3 w-44 z-10">
      <div
        className="h-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0e0a1c 0%, #120d20 40%, #0e0a1c 100%)',
          border: '1px solid rgba(177,167,208,0.12)',
        }}
      >
        {/* Stadium arch top */}
        <div className="relative flex-shrink-0 h-7"
          style={{ background: 'linear-gradient(180deg,rgba(177,167,208,0.07) 0%,transparent 100%)' }}>
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#b1a7d0] opacity-25">
              Gradas
            </span>
          </div>
          {[0.25, 0.5, 0.75].map(x => (
            <div key={x} className="absolute top-0 bottom-0 w-px bg-white/5" style={{ left: `${x*100}%` }} />
          ))}
        </div>

        {/* Bleacher rows — staggered */}
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-2">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className={`flex gap-2 ${rowIdx % 2 === 1 ? 'pl-5' : 'pl-1'}`}>
              {row.map(p => <Seat key={p.user_id} player={p} />)}
            </div>
          ))}
        </div>

        {/* Bottom count */}
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-[rgba(177,167,208,0.08)]">
          <span className="text-[8px] text-[#b1a7d0] opacity-25">{stands.length} espectadores</span>
        </div>
      </div>
    </div>
  )
}

function Seat({ player }) {
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'
  const initial    = player.character_name?.charAt(0).toUpperCase() || '?'

  return (
    <div
      title={`${player.character_name}${player.spec ? ` · ${player.spec}` : ''}`}
      className="flex flex-col items-center gap-0.5 opacity-70"
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${classColor}18, ${classColor}06)`,
          boxShadow: `0 0 0 1.5px ${classColor}45`,
          color: classColor,
          textShadow: `0 0 6px ${classColor}50`,
        }}
      >
        {initial}
      </div>
      <span className="text-[7px] leading-tight text-center truncate max-w-[38px]"
        style={{ color: classColor, opacity: 0.6 }}>
        {player.character_name?.split(' ')[0]}
      </span>
    </div>
  )
}
