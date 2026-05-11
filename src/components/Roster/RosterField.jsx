import { useState, useRef, useEffect } from 'react'
import { Plus, X, MegaphoneSimple } from '@phosphor-icons/react'
import CLASS_COLORS from '../../utils/classColors'

const SLOTS = { Tank: 2, Healer: 5, DPS: 15 }
const DPS_ROWS = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14]]

export default function RosterField({ roster, available, coaches, isPrivileged, saving, onTogglePlayer, onSetCoach }) {
  const inRoster = roster?.players?.filter(p => p.slot === 'in_roster') || []
  const bench    = roster?.players?.filter(p => p.slot === 'bench')    || []

  const byRole = {
    Tank:   inRoster.filter(p => p.raid_role === 'Tank'),
    Healer: inRoster.filter(p => p.raid_role === 'Healer'),
    DPS:    inRoster.filter(p => p.raid_role === 'DPS'),
  }

  const rosterIds = new Set(roster?.players?.map(p => p.user_id) || [])
  const availByRole = {
    Tank:   available.filter(p => p.raid_role === 'Tank'   && !rosterIds.has(p.user_id)),
    Healer: available.filter(p => p.raid_role === 'Healer' && !rosterIds.has(p.user_id)),
    DPS:    available.filter(p => p.raid_role === 'DPS'    && !rosterIds.has(p.user_id)),
    any:    available.filter(p => !rosterIds.has(p.user_id)),
  }

  return (
    <div className="flex flex-col gap-2 select-none">

      {/* ── Coach + Field row ─────────────────────────────────────────── */}
      <div className="flex gap-3 items-stretch">

        {/* Coach — left sideline */}
        <CoachSlot
          roster={roster}
          coaches={coaches || []}
          isPrivileged={isPrivileged}
          saving={saving}
          onSetCoach={onSetCoach}
        />

        {/* Field */}
        <div className="flex-1 relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0a1a10 0%, #0d1f14 35%, #0f2416 55%, #0d1e13 75%, #091610 100%)',
            minHeight: 480,
          }}
        >
          <FieldMarkings />

          {/* Zone labels */}
          <div className="absolute inset-0 flex flex-col justify-between px-6 py-5 pointer-events-none">
            <ZoneLabel color="#69cff0" label="DPS" />
            <ZoneLabel color="#4ade80" label="Healers" />
            <ZoneLabel color="#f87171" label="Tanks" />
          </div>

          {/* DPS zone (top) */}
          <div className="pt-8 px-4 pb-4 flex flex-col gap-3 items-center">
            {DPS_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-3 justify-center flex-wrap">
                {row.map(slotIdx => (
                  <PlayerSlot key={slotIdx}
                    player={byRole.DPS[slotIdx] || null} role="DPS"
                    available={availByRole.DPS} isPrivileged={isPrivileged} saving={saving}
                    onAdd={uid => onTogglePlayer(uid, 'in_roster')}
                    onRemove={uid => onTogglePlayer(uid, null)}
                    onBench={uid => onTogglePlayer(uid, 'bench')}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Midfield line */}
          <div className="mx-8 h-px bg-white/10 my-1" />

          {/* Healers zone */}
          <div className="py-5 px-4 flex justify-center gap-4 flex-wrap">
            {Array.from({ length: SLOTS.Healer }, (_, i) => (
              <PlayerSlot key={i}
                player={byRole.Healer[i] || null} role="Healer"
                available={availByRole.Healer} isPrivileged={isPrivileged} saving={saving}
                onAdd={uid => onTogglePlayer(uid, 'in_roster')}
                onRemove={uid => onTogglePlayer(uid, null)}
                onBench={uid => onTogglePlayer(uid, 'bench')}
              />
            ))}
          </div>

          {/* Penalty area */}
          <div className="relative mx-16">
            <div className="h-px bg-white/10" />
            <div className="absolute left-1/2 -translate-x-1/2 -top-5 w-24 h-10 rounded-t-full border border-white/10"
              style={{ borderBottom: 'none' }} />
          </div>

          {/* Tanks zone (goal area) */}
          <div className="py-5 px-4 flex justify-center gap-16">
            {Array.from({ length: SLOTS.Tank }, (_, i) => (
              <PlayerSlot key={i}
                player={byRole.Tank[i] || null} role="Tank"
                available={availByRole.Tank} isPrivileged={isPrivileged} saving={saving}
                onAdd={uid => onTogglePlayer(uid, 'in_roster')}
                onRemove={uid => onTogglePlayer(uid, null)}
                onBench={uid => onTogglePlayer(uid, 'bench')}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bench */}
      {(bench.length > 0 || (isPrivileged && availByRole.any.length > 0)) && (
        <BenchRail
          bench={bench} available={availByRole.any}
          isPrivileged={isPrivileged} saving={saving}
          onAdd={uid => onTogglePlayer(uid, 'bench')}
          onRemove={uid => onTogglePlayer(uid, null)}
          onMoveToField={uid => onTogglePlayer(uid, 'in_roster')}
        />
      )}
    </div>
  )
}

// ── CoachSlot ─────────────────────────────────────────────────────────────────
function CoachSlot({ roster, coaches, isPrivileged, saving, onSetCoach }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const hasCoach = !!roster?.coach_name
  const classColor = hasCoach ? (CLASS_COLORS[roster.coach_class] || '#b1a7d0') : null

  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center justify-center w-20 rounded-xl"
      style={{
        background: 'linear-gradient(180deg, #0a1a10 0%, #091610 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        minHeight: 480,
      }}
    >
      {/* Sideline label */}
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/20">Banda</span>
      </div>

      {/* Coach content */}
      <div className="flex flex-col items-center gap-2">
        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all ${
            isPrivileged ? 'hover:brightness-125' : ''
          }`}
          style={hasCoach ? {
            background: `radial-gradient(circle at 35% 35%, ${classColor}22, ${classColor}08)`,
            boxShadow: `0 0 0 2px ${classColor}60, 0 0 12px ${classColor}25`,
          } : {
            background: 'rgba(255,255,255,0.04)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.10)',
          }}
          onClick={() => isPrivileged && coaches.length > 0 && setOpen(v => !v)}
          title={isPrivileged ? 'Seleccionar raid leader' : ''}
        >
          {hasCoach ? (
            <span className="text-xl font-black" style={{ color: classColor, textShadow: `0 0 8px ${classColor}80` }}>
              {roster.coach_name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <MegaphoneSimple size={20} weight="fill" className="text-white/20" />
          )}
        </div>

        {/* Name */}
        <div className="flex flex-col items-center gap-0.5 px-1 text-center">
          {hasCoach ? (
            <>
              <span className="text-[11px] font-bold leading-tight" style={{ color: classColor, textShadow: '0 1px 4px rgba(0,0,0,0.8)', writingMode: 'horizontal-tb' }}>
                {roster.coach_name}
              </span>
              <span className="text-[9px] text-white/30 leading-tight">Raid Leader</span>
            </>
          ) : (
            <span className="text-[9px] text-white/25 leading-tight text-center">
              {isPrivileged ? 'Asignar RL' : 'Sin RL'}
            </span>
          )}
        </div>

        {/* Remove coach button */}
        {hasCoach && isPrivileged && (
          <button
            onClick={() => onSetCoach(null)}
            disabled={saving}
            className="w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/25 flex items-center justify-center transition-all"
          >
            <X size={9} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Picker popover */}
      {open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 w-48 bg-[#0f0b20] border border-[rgba(177,167,208,0.25)] rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[rgba(177,167,208,0.12)]">
            <span className="text-[11px] font-bold text-[#b1a7d0] uppercase tracking-wider">Raid Leader</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {coaches.map(c => {
              const color = CLASS_COLORS[c.character_class] || '#b1a7d0'
              return (
                <button key={c.user_id}
                  onClick={() => { onSetCoach(c.user_id); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(177,167,208,0.08)] text-left"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-sm font-medium" style={{ color }}>{c.character_name}</span>
                  <span className="text-[10px] text-[#b1a7d0] ml-auto">{c.spec}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Field SVG markings ────────────────────────────────────────────────────────
function FieldMarkings() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
      <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.4" rx="1" />
      <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
      <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.12)" />
      <rect x="25" y="2" width="50" height="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
      <rect x="25" y="80" width="50" height="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
      <rect x="37" y="2" width="26" height="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
      <rect x="37" y="90" width="26" height="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
    </svg>
  )
}

function ZoneLabel({ color, label }) {
  return <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-20" style={{ color }}>{label}</span>
}

// ── PlayerSlot ────────────────────────────────────────────────────────────────
function PlayerSlot({ player, role, available, isPrivileged, saving, onAdd, onRemove, onBench }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const roleColor = { Tank: '#f87171', Healer: '#4ade80', DPS: '#69cff0' }[role]
  const classColor = player ? (CLASS_COLORS[player.character_class] || '#b1a7d0') : null

  if (player) {
    return (
      <div ref={ref} className="relative flex flex-col items-center gap-1 group">
        <div className="w-14 h-14 rounded-full flex items-center justify-center relative cursor-default"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${classColor}22, ${classColor}08)`,
            boxShadow: `0 0 0 2px ${classColor}60, 0 0 12px ${classColor}25`,
          }}
        >
          <span className="text-lg font-black" style={{ color: classColor, textShadow: `0 0 8px ${classColor}80` }}>
            {player.character_name.charAt(0).toUpperCase()}
          </span>

          {isPrivileged && (
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              <button onClick={() => onBench(player.user_id)} disabled={saving}
                className="w-6 h-6 rounded-full bg-yellow-500/20 hover:bg-yellow-500/40 flex items-center justify-center text-[10px] transition-all">
                🪑
              </button>
              <button onClick={() => onRemove(player.user_id)} disabled={saving}
                className="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-all">
                <X size={10} className="text-red-300" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-0 max-w-[80px]">
          <span className="text-[11px] font-bold leading-tight text-center truncate w-full"
            style={{ color: classColor, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {player.character_name}
          </span>
          {player.spec && (
            <span className="text-[9px] text-white/40 leading-tight text-center truncate w-full">{player.spec}</span>
          )}
        </div>
      </div>
    )
  }

  if (!isPrivileged) {
    return (
      <div className="flex flex-col items-center gap-1 opacity-20">
        <div className="w-14 h-14 rounded-full border-2 border-dashed" style={{ borderColor: roleColor }} />
        <div className="h-3" />
      </div>
    )
  }

  return (
    <div ref={ref} className="relative flex flex-col items-center gap-1">
      <button
        onClick={() => available.length > 0 && setOpen(v => !v)}
        disabled={saving || available.length === 0}
        className="w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center transition-all hover:border-opacity-80 hover:bg-white/5 disabled:opacity-25 disabled:cursor-default"
        style={{ borderColor: `${roleColor}60` }}
      >
        <Plus size={16} style={{ color: roleColor, opacity: 0.6 }} />
      </button>
      <div className="h-3" />

      {open && (
        <SlotPickerPopover players={available} roleColor={roleColor}
          onSelect={uid => { onAdd(uid); setOpen(false) }} />
      )}
    </div>
  )
}

// ── SlotPickerPopover ─────────────────────────────────────────────────────────
function SlotPickerPopover({ players, roleColor, onSelect }) {
  const [filter, setFilter] = useState('')
  const filtered = players.filter(p => p.character_name.toLowerCase().includes(filter.toLowerCase()))
  const SIGNUP_COLOR = { confirmed: '#4ade80', late: '#fb923c', tentative: '#facc15' }

  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 w-48 bg-[#0f0b20] border border-[rgba(177,167,208,0.25)] rounded-xl shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-[rgba(177,167,208,0.12)]">
        <input autoFocus value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Buscar…"
          className="w-full bg-[rgba(177,167,208,0.08)] rounded-lg px-2.5 py-1.5 text-xs text-[#ffeccd] outline-none placeholder:text-[#b1a7d0]/50" />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 && <p className="text-xs text-center text-[#b1a7d0] py-3 opacity-40">Sin resultados</p>}
        {filtered.map(p => {
          const classColor = CLASS_COLORS[p.character_class] || '#b1a7d0'
          const dot = SIGNUP_COLOR[p.signup_status]
          return (
            <button key={p.user_id} onClick={() => onSelect(p.user_id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(177,167,208,0.08)] text-left">
              {dot && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />}
              <span className="text-sm font-medium truncate" style={{ color: classColor }}>{p.character_name}</span>
              {p.spec && <span className="text-[10px] text-[#b1a7d0] ml-auto flex-shrink-0">{p.spec}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── BenchRail ─────────────────────────────────────────────────────────────────
function BenchRail({ bench, available, isPrivileged, saving, onAdd, onRemove, onMoveToField }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="mt-1 rounded-xl bg-[rgba(177,167,208,0.04)] border border-[rgba(177,167,208,0.12)] px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#b1a7d0] opacity-40">🪑 Banquillo</span>
        <div className="flex-1 h-px bg-[rgba(177,167,208,0.10)]" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {bench.map(p => {
          const classColor = CLASS_COLORS[p.character_class] || '#b1a7d0'
          return (
            <div key={p.user_id}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-[rgba(177,167,208,0.15)] bg-[rgba(177,167,208,0.05)] group"
              style={{ borderLeftWidth: 2, borderLeftColor: classColor }}>
              <span className="text-xs font-semibold" style={{ color: classColor }}>{p.character_name}</span>
              {isPrivileged && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onMoveToField(p.user_id)} disabled={saving}
                    title="Al campo" className="w-4 h-4 flex items-center justify-center text-[10px] hover:text-green-400 text-[#b1a7d0] transition-colors">↑</button>
                  <button onClick={() => onRemove(p.user_id)} disabled={saving}
                    title="Quitar" className="w-4 h-4 flex items-center justify-center hover:text-red-400 text-[#b1a7d0] transition-colors">
                    <X size={9} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {isPrivileged && available.length > 0 && (
          <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)} disabled={saving}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-dashed border-[rgba(177,167,208,0.20)] text-[#b1a7d0] hover:text-[#ffeccd] transition-all">
              <Plus size={10} weight="bold" />
              Banquillo
            </button>
            {open && (
              <SlotPickerPopover players={available} roleColor="#b1a7d0"
                onSelect={uid => { onAdd(uid); setOpen(false) }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
