import CLASS_COLORS from '../../utils/classColors'

// ── StandsPanel — right side bleachers ───────────────────────────────────────
// Visual only: shows bench + declined players as stadium seats.
export default function StandsPanel({ stands }) {
  const declined   = stands.filter(p => p.section === 'declined')
  const noResponse = stands.filter(p => p.section === 'no_response')
  const total      = stands.length

  if (total === 0) return null

  return (
    <div className="absolute left-full top-0 bottom-0 pl-3 w-48 z-10">
      <div
        className="h-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0e0a1c 0%, #120d20 40%, #0e0a1c 100%)',
          border: '1px solid rgba(177,167,208,0.12)',
        }}
      >
        {/* Arch top — stadium feel */}
        <div className="relative flex-shrink-0 h-8"
          style={{ background: 'linear-gradient(180deg, rgba(177,167,208,0.08) 0%, transparent 100%)' }}>
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#b1a7d0] opacity-30">
              Gradas
            </span>
          </div>
          {/* Structural lines suggestion */}
          {[0.2, 0.5, 0.8].map(x => (
            <div key={x} className="absolute top-0 bottom-0 w-px bg-white/5"
              style={{ left: `${x * 100}%` }} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-3">

          {/* Declined */}
          {declined.length > 0 && (
            <Section label="✗ No disponibles" players={declined} accentColor="#f87171" dimmed />
          )}

          {/* No response */}
          {noResponse.length > 0 && (
            <Section label="— Sin respuesta" players={noResponse} accentColor="#b1a7d0" dimmed />
          )}
        </div>

        {/* Bottom rail */}
        <div className="flex-shrink-0 px-3 py-2 border-t border-[rgba(177,167,208,0.08)]">
          <span className="text-[8px] text-[#b1a7d0] opacity-30">{total} fuera del campo</span>
        </div>
      </div>
    </div>
  )
}

function Section({ label, players, accentColor, dimmed }) {
  // Arrange in rows of 3 — bleacher seat style
  const rows = []
  for (let i = 0; i < players.length; i += 3) rows.push(players.slice(i, i + 3))

  return (
    <div>
      {/* Section label — stadium row marker */}
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: `${accentColor}60` }} />
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accentColor, opacity: 0.7 }}>
          {label}
        </span>
      </div>

      {/* Bleacher rows */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row, rowIdx) => (
          <BleacherRow key={rowIdx} players={row} dimmed={dimmed} rowIdx={rowIdx} />
        ))}
      </div>
    </div>
  )
}

function BleacherRow({ players, dimmed, rowIdx }) {
  // Alternate row indent for stadium stagger effect
  const indent = rowIdx % 2 === 1 ? 'pl-4' : 'pl-1'

  return (
    <div className={`flex gap-1.5 ${indent}`}>
      {players.map(p => (
        <Seat key={p.user_id} player={p} dimmed={dimmed} />
      ))}
    </div>
  )
}

function Seat({ player, dimmed }) {
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'
  const initial    = player.character_name?.charAt(0).toUpperCase() || '?'

  return (
    <div
      title={`${player.character_name}${player.spec ? ` · ${player.spec}` : ''}`}
      className={`flex flex-col items-center gap-0.5 ${dimmed ? 'opacity-40' : 'opacity-85'}`}
    >
      {/* Seat circle */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${classColor}20, ${classColor}06)`,
          boxShadow: `0 0 0 1.5px ${classColor}50`,
          color: classColor,
          textShadow: `0 0 6px ${classColor}60`,
        }}
      >
        {initial}
      </div>
      {/* Name under seat */}
      <span
        className="text-[7px] leading-tight text-center truncate max-w-[36px]"
        style={{ color: classColor, opacity: 0.7 }}
      >
        {player.character_name?.split(' ')[0]}
      </span>
    </div>
  )
}
