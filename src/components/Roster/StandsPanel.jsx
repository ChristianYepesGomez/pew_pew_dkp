import CLASS_COLORS from '../../utils/classColors'
import { useSpeechBubble, SpeechBubbleAbove } from './SpeechBubble'

const STANDS_PHRASES = [
  'Falta healing',
  'Falta DPS',
  '¿Cuántos wipes lleváis?',
  'Mechanic diff',
  'Mañana seguro que cae',
  'Yo lo hacía mejor',
  'No iban así en el PTR',
  'Están jugando sin flask',
  'Le falta ilvl al tank',
  'Borra el juego',
  '¿A qué hora termináis?',
  'GG EZ',
  'Un día de estos entro yo',
]

export default function StandsPanel({ stands }) {
  if (!stands || stands.length === 0) return null

  // 2 per row, staggered
  const rows = []
  for (let i = 0; i < stands.length; i += 2) rows.push(stands.slice(i, i + 2))

  return (
    <div className="absolute left-full top-0 bottom-0 pl-3 w-36 z-20" style={{ overflow: 'visible' }}>
      <div className="h-full flex flex-col rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, #0e0a1c 0%, #120d20 40%, #0e0a1c 100%)',
          border: '1px solid rgba(177,167,208,0.12)',
          overflow: 'visible',
        }}
      >
        {/* Top label */}
        <div className="flex-shrink-0 h-6 flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg,rgba(177,167,208,0.07) 0%,transparent 100%)' }}>
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#b1a7d0] opacity-25">Gradas</span>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-5" style={{ overflow: 'visible' }}>
          {rows.map((row, rowIdx) => (
            <div key={rowIdx}
              className="flex gap-4 justify-center"
              style={{ paddingLeft: rowIdx % 2 === 1 ? 14 : 0 }}>
              {row.map(p => <Seat key={p.user_id} player={p} />)}
            </div>
          ))}
        </div>

        <div className="flex-shrink-0 px-3 py-1 border-t border-[rgba(177,167,208,0.08)]">
          <span className="text-[8px] text-[#b1a7d0] opacity-25">{stands.length}</span>
        </div>
      </div>
    </div>
  )
}

function Seat({ player }) {
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'
  const initial    = player.character_name?.charAt(0).toUpperCase() || '?'
  const { text, visible } = useSpeechBubble(STANDS_PHRASES, { minDelay: 8000, maxDelay: 28000 })

  return (
    <div
      title={player.character_name}
      className="relative flex flex-col items-center gap-0.5 opacity-75"
      style={{ overflow: 'visible' }}
    >
      {/* Speech bubble — floats to the left, outside the panel */}
      {(visible || text) && (
        <div
          className="absolute pointer-events-none"
          style={{
            right: '110%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            transition: 'opacity 0.3s, transform 0.3s',
            opacity: visible ? 1 : 0,
            whiteSpace: 'nowrap',
          }}
        >
          <div
            className="px-2 py-1 rounded-lg text-[9px] font-semibold text-[#ffeccd] shadow-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(15,11,32,0.95), rgba(34,30,53,0.95))',
              border: '1px solid rgba(177,167,208,0.35)',
            }}
          >
            {text}
          </div>
          {/* Arrow pointing right toward the seat */}
          <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-full"
            style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '4px solid rgba(177,167,208,0.35)' }}
          />
        </div>
      )}

      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${classColor}18, ${classColor}06)`,
          boxShadow: `0 0 0 1.5px ${classColor}45`,
          color: classColor,
        }}
      >
        {initial}
      </div>
      <span className="text-[7px] leading-tight text-center max-w-[40px] truncate"
        style={{ color: classColor, opacity: 0.65 }}>
        {player.character_name?.split(' ')[0]}
      </span>
    </div>
  )
}
