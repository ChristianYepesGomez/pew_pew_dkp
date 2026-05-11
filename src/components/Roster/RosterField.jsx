import { useState, useRef, useEffect } from 'react'
import { Plus, X, MegaphoneSimple, ShieldStar, Heart, Crosshair } from '@phosphor-icons/react'
import CLASS_COLORS from '../../utils/classColors'
import StandsPanel from './StandsPanel'

const SLOTS    = { Tank: 2, Healer: 5, DPS: 15 }
const DPS_ROWS = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14]]

const ROLE_ICON  = { Tank: ShieldStar, Healer: Heart, DPS: Crosshair }
const ROLE_COLOR = { Tank: '#f87171',  Healer: '#4ade80', DPS: '#69cff0' }
const SIGNUP_DOT = { confirmed: '#4ade80', late: '#fb923c', tentative: '#facc15' }

// ── Main component ────────────────────────────────────────────────────────────
export default function RosterField({ roster, available, coaches, stands, isPrivileged, saving, onTogglePlayer, onSetCoach }) {
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

  // Click player in list → add to first free slot of their role
  const handleListClick = (player) => {
    if (saving) return
    onTogglePlayer(player.user_id, 'in_roster')
  }

  // Drag & drop — use dataTransfer (reliable across all browsers)
  const handleDrop = (e, slot) => {
    e.preventDefault()
    const userId = parseInt(e.dataTransfer.getData('text/plain'))
    if (!isNaN(userId)) onTogglePlayer(userId, slot)
  }

  const handleDropToList = (e) => {
    e.preventDefault()
    const userId = parseInt(e.dataTransfer.getData('text/plain'))
    if (!isNaN(userId)) onTogglePlayer(userId, null)
  }

  return (
    // Relative wrapper: player list floats outside to the left
    <div className="relative flex flex-col gap-2 select-none">

      {/* ── Player list — floats outside to the left ─────────────────── */}
      {isPrivileged && (
        <div className="absolute right-full top-0 bottom-0 pr-3 w-52 z-10">
          <PlayerListPanel
            availByRole={availByRole}
            saving={saving}
            onDragStart={(e, userId) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(userId))
            }}
            onClick={handleListClick}
            onDropToList={handleDropToList}
          />
        </div>
      )}

      {/* ── Stands — floats outside to the right ───────────────────────── */}
      {stands?.length > 0 && <StandsPanel stands={stands} />}

      {/* ── Coach + Field row ───────────────────────────────────────────── */}
      <div className="flex gap-3 items-stretch">

        {/* Coach sideline */}
        <CoachSlot roster={roster} coaches={coaches || []} isPrivileged={isPrivileged} saving={saving} onSetCoach={onSetCoach} />

        {/* Field — full width */}
        <div className="flex-1 relative rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #0a1a10 0%, #0d1f14 35%, #0f2416 55%, #0d1e13 75%, #091610 100%)', minHeight: 480 }}>
          <FieldMarkings />

          <div className="absolute inset-0 flex flex-col justify-between px-6 py-5 pointer-events-none">
            <ZoneLabel color="#69cff0" label="DPS" />
            <ZoneLabel color="#4ade80" label="Healers" />
            <ZoneLabel color="#f87171" label="Tanks" />
          </div>

          {/* DPS */}
          <div className="pt-8 px-4 pb-4 flex flex-col gap-3 items-center">
            {DPS_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-3 justify-center flex-wrap">
                {row.map(slotIdx => (
                  <PlayerSlot key={slotIdx}
                    player={byRole.DPS[slotIdx] || null} role="DPS"
                    available={availByRole.DPS} isPrivileged={isPrivileged} saving={saving}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(byRole.DPS[slotIdx]?.user_id)) }}
                    onDrop={e => handleDrop(e, 'in_roster')}
                    onAdd={uid => onTogglePlayer(uid, 'in_roster')}
                    onRemove={uid => onTogglePlayer(uid, null)}
                    onBench={uid => onTogglePlayer(uid, 'bench')}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="mx-8 h-px bg-white/10 my-1" />

          {/* Healers */}
          <div className="py-5 px-4 flex justify-center gap-4 flex-wrap">
            {Array.from({ length: SLOTS.Healer }, (_, i) => (
              <PlayerSlot key={i}
                player={byRole.Healer[i] || null} role="Healer"
                available={availByRole.Healer} isPrivileged={isPrivileged} saving={saving}
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(byRole.Healer[i]?.user_id)) }}
                onDrop={e => handleDrop(e, 'in_roster')}
                onAdd={uid => onTogglePlayer(uid, 'in_roster')}
                onRemove={uid => onTogglePlayer(uid, null)}
                onBench={uid => onTogglePlayer(uid, 'bench')}
              />
            ))}
          </div>

          {/* Penalty area */}
          <div className="relative mx-16">
            <div className="h-px bg-white/10" />
            <div className="absolute left-1/2 -translate-x-1/2 -top-5 w-24 h-10 rounded-t-full border border-white/10" style={{ borderBottom: 'none' }} />
          </div>

          {/* Tanks */}
          <div className="py-5 px-4 flex justify-center gap-16">
            {Array.from({ length: SLOTS.Tank }, (_, i) => (
              <PlayerSlot key={i}
                player={byRole.Tank[i] || null} role="Tank"
                available={availByRole.Tank} isPrivileged={isPrivileged} saving={saving}
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(byRole.Tank[i]?.user_id)) }}
                onDrop={e => handleDrop(e, 'in_roster')}
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
          onDrop={e => handleDrop(e, 'bench')}
          onDragStart={(e, uid) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(uid)) }}
          onAdd={uid => onTogglePlayer(uid, 'bench')}
          onRemove={uid => onTogglePlayer(uid, null)}
          onMoveToField={uid => onTogglePlayer(uid, 'in_roster')}
        />
      )}
    </div>
  )
}

// ── PlayerListPanel ───────────────────────────────────────────────────────────
function PlayerListPanel({ availByRole, saving, onDragStart, onClick, onDropToList }) {
  const [dropOver, setDropOver] = useState(false)

  return (
    <div
      className={`h-full flex flex-col rounded-2xl border transition-all overflow-hidden ${
        dropOver
          ? 'border-red-400/40 bg-[rgba(248,113,113,0.06)]'
          : 'border-[rgba(177,167,208,0.15)] bg-[rgba(9,11,26,0.92)]'
      }`}
      style={{ backdropFilter: 'blur(8px)' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(false) }}
      onDrop={e => { setDropOver(false); onDropToList(e) }}
    >
      <div className="px-3 pt-3 pb-2 border-b border-[rgba(177,167,208,0.10)] flex-shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#b1a7d0] opacity-60">
          {dropOver ? '↩ Soltar para quitar' : 'Disponibles'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
        {Object.entries(availByRole)
          .filter(([role]) => role !== 'any')
          .map(([role, players]) => {
            if (players.length === 0) return null
            const Icon  = ROLE_ICON[role]
            const color = ROLE_COLOR[role]
            return (
              <div key={role}>
                <div className="flex items-center gap-1 mb-1.5 px-1">
                  <Icon size={9} style={{ color }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
                    {role} ({players.length})
                  </span>
                </div>
                {players.map(p => (
                  <ListPlayer key={p.user_id} player={p} saving={saving}
                    onDragStart={e => onDragStart(e, p.user_id)}
                    onClick={() => onClick(p)}
                  />
                ))}
              </div>
            )
          })}

        {availByRole.any.length === 0 && (
          <p className="text-[10px] text-center text-[#b1a7d0] opacity-30 py-4">Todos asignados</p>
        )}
      </div>
    </div>
  )
}

function ListPlayer({ player, saving, onDragStart, onClick }) {
  const [dragging, setDragging] = useState(false)
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'
  const dot = SIGNUP_DOT[player.signup_status]

  return (
    <div
      draggable
      onDragStart={e => { setDragging(true); onDragStart(e) }}
      onDragEnd={() => setDragging(false)}
      onClick={() => !saving && onClick()}
      title={`Click para asignar · Arrastrar al campo`}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-0.5 transition-all ${
        dragging ? 'opacity-30 scale-95' : 'hover:bg-[rgba(177,167,208,0.12)] cursor-grab active:cursor-grabbing'
      } ${saving ? 'pointer-events-none opacity-50' : ''}`}
      style={{ borderLeft: `2px solid ${classColor}70` }}
    >
      {dot && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />}
      <span className="text-xs font-semibold truncate" style={{ color: classColor }}>
        {player.character_name}
      </span>
      {player.spec && (
        <span className="text-[9px] text-[#b1a7d0] opacity-50 ml-auto flex-shrink-0 truncate max-w-[50px]">
          {player.spec}
        </span>
      )}
    </div>
  )
}

// ── PlayerSlot ────────────────────────────────────────────────────────────────
function PlayerSlot({ player, role, available, isPrivileged, saving, onDragStart, onDrop, onAdd, onRemove, onBench }) {
  const [dropOver, setDropOver] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const roleColor  = ROLE_COLOR[role]
  const classColor = player ? (CLASS_COLORS[player.character_class] || '#b1a7d0') : null

  if (player) {
    // Occupied slot — click removes, drag moves
    return (
      <div ref={ref} className="relative flex flex-col items-center gap-1 group">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center relative ${isPrivileged ? 'cursor-grab active:cursor-grabbing' : ''}`}
          draggable={isPrivileged}
          onDragStart={isPrivileged ? onDragStart : undefined}
          style={{
            background: `radial-gradient(circle at 35% 35%, ${classColor}22, ${classColor}08)`,
            boxShadow: `0 0 0 2px ${classColor}60, 0 0 12px ${classColor}25`,
          }}
        >
          <span className="text-lg font-black" style={{ color: classColor, textShadow: `0 0 8px ${classColor}80` }}>
            {player.character_name.charAt(0).toUpperCase()}
          </span>

          {/* Hover: remove / bench */}
          {isPrivileged && (
            <div className="absolute inset-0 rounded-full bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              <button onClick={() => !saving && onBench(player.user_id)} title="Al banquillo"
                className="w-6 h-6 rounded-full bg-yellow-500/20 hover:bg-yellow-500/40 flex items-center justify-center text-[10px] transition-all">
                🪑
              </button>
              <button onClick={() => !saving && onRemove(player.user_id)} title="Quitar del roster"
                className="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-all">
                <X size={10} className="text-red-300" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center max-w-[80px]">
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

  // Empty slot — drop target + click picker
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
      <div
        className={`w-14 h-14 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
          dropOver ? 'border-solid scale-110 bg-white/10' : 'border-dashed hover:bg-white/5'
        }`}
        style={{ borderColor: dropOver ? roleColor : `${roleColor}60` }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(true) }}
        onDragLeave={() => setDropOver(false)}
        onDrop={e => { setDropOver(false); onDrop(e) }}
        onClick={() => !saving && available.length > 0 && setOpen(v => !v)}
        title="Click para elegir jugador"
      >
        <Plus size={16} style={{ color: roleColor, opacity: dropOver ? 1 : 0.6 }} />
      </div>
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
          const dot = SIGNUP_DOT[p.signup_status]
          return (
            <button key={p.user_id} onClick={() => onSelect(p.user_id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(177,167,208,0.08)] text-left">
              {dot && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />}
              <span className="text-sm font-medium truncate" style={{ color: classColor }}>{p.character_name}</span>
              {p.spec && <span className="text-[10px] text-[#b1a7d0] ml-auto">{p.spec}</span>}
            </button>
          )
        })}
      </div>
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

  const hasCoach   = !!roster?.coach_name
  const classColor = hasCoach ? (CLASS_COLORS[roster.coach_class] || '#b1a7d0') : null

  return (
    <div ref={ref} className="relative flex flex-col items-center justify-center w-20 rounded-xl flex-shrink-0"
      style={{ background: 'linear-gradient(180deg,#0a1a10,#091610)', border: '1px solid rgba(255,255,255,0.07)', minHeight: 480 }}>
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/20">Banda</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isPrivileged ? 'cursor-pointer' : ''}`}
          style={hasCoach
            ? { background: `radial-gradient(circle at 35% 35%, ${classColor}22, ${classColor}08)`, boxShadow: `0 0 0 2px ${classColor}60, 0 0 12px ${classColor}25` }
            : { background: 'rgba(255,255,255,0.04)', boxShadow: '0 0 0 2px rgba(255,255,255,0.10)' }}
          onClick={() => isPrivileged && coaches.length > 0 && setOpen(v => !v)}>
          {hasCoach
            ? <span className="text-xl font-black" style={{ color: classColor, textShadow: `0 0 8px ${classColor}80` }}>{roster.coach_name.charAt(0).toUpperCase()}</span>
            : <MegaphoneSimple size={20} weight="fill" className="text-white/20" />}
        </div>

        <div className="flex flex-col items-center gap-0.5 px-1 text-center">
          {hasCoach ? (
            <>
              <span className="text-[11px] font-bold leading-tight" style={{ color: classColor }}>{roster.coach_name}</span>
              <span className="text-[9px] text-white/30">Raid Leader</span>
            </>
          ) : (
            <span className="text-[9px] text-white/25">{isPrivileged ? 'Asignar RL' : 'Sin RL'}</span>
          )}
        </div>

        {hasCoach && isPrivileged && (
          <button onClick={() => onSetCoach(null)} disabled={saving}
            className="w-5 h-5 rounded-full bg-red-500/10 hover:bg-red-500/25 flex items-center justify-center">
            <X size={9} className="text-red-400" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 w-48 bg-[#0f0b20] border border-[rgba(177,167,208,0.25)] rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[rgba(177,167,208,0.12)]">
            <span className="text-[11px] font-bold text-[#b1a7d0] uppercase tracking-wider">Raid Leader</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {coaches.map(c => {
              const color = CLASS_COLORS[c.character_class] || '#b1a7d0'
              return (
                <button key={c.user_id} onClick={() => { onSetCoach(c.user_id); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(177,167,208,0.08)] text-left">
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

// ── FieldMarkings ─────────────────────────────────────────────────────────────
function FieldMarkings() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
      <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.4" rx="1"/>
      <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4"/>
      <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.12)"/>
      <rect x="25" y="2" width="50" height="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4"/>
      <rect x="25" y="80" width="50" height="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4"/>
      <rect x="37" y="2" width="26" height="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4"/>
      <rect x="37" y="90" width="26" height="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4"/>
    </svg>
  )
}

function ZoneLabel({ color, label }) {
  return <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-20" style={{ color }}>{label}</span>
}

// ── BenchRail ─────────────────────────────────────────────────────────────────
function BenchRail({ bench, available, isPrivileged, saving, onDrop, onDragStart, onAdd, onRemove, onMoveToField }) {
  const [dropOver, setDropOver] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      className={`mt-1 rounded-xl border px-4 py-3 transition-all ${dropOver ? 'border-yellow-400/40 bg-[rgba(250,204,21,0.05)]' : 'border-[rgba(177,167,208,0.12)] bg-[rgba(177,167,208,0.04)]'}`}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(false) }}
      onDrop={e => { setDropOver(false); onDrop(e) }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#b1a7d0] opacity-40">
          🪑 Banquillo {dropOver && <span className="text-yellow-400 font-normal normal-case opacity-100">— soltar aquí</span>}
        </span>
        <div className="flex-1 h-px bg-[rgba(177,167,208,0.10)]" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {bench.map(p => {
          const cc = CLASS_COLORS[p.character_class] || '#b1a7d0'
          return (
            <div key={p.user_id}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-[rgba(177,167,208,0.15)] bg-[rgba(177,167,208,0.05)] group cursor-grab"
              style={{ borderLeftWidth: 2, borderLeftColor: cc }}
              draggable={isPrivileged}
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(e, p.user_id) }}>
              <span className="text-xs font-semibold" style={{ color: cc }}>{p.character_name}</span>
              {isPrivileged && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onMoveToField(p.user_id)} disabled={saving}
                    className="w-4 h-4 flex items-center justify-center text-[10px] hover:text-green-400 text-[#b1a7d0]">↑</button>
                  <button onClick={() => onRemove(p.user_id)} disabled={saving}
                    className="w-4 h-4 flex items-center justify-center hover:text-red-400 text-[#b1a7d0]">
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
