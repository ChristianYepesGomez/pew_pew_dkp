import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, MegaphoneSimple, ShieldStar, Heart, Crosshair } from '@phosphor-icons/react'
import CLASS_COLORS from '../../utils/classColors'
import StandsPanel from './StandsPanel'
import { checkBuffCoverage, getBuffIconUrl } from '../../utils/raidBuffs'
import { useSpeechBubble } from './SpeechBubble'
import ArmoryModal from './ArmoryModal'

const BENCH_PHRASES = [
  'Ponme a mí',
  'Llevo 45 min calentando',
  'Estoy listo RL',
  'Yo lo hago mejor',
  '¿Para cuándo?',
  'Sigo disponible por si acaso',
  'Me pido el siguiente pull',
  'Necesitáis un DPS de verdad',
]

const SLOTS    = { Tank: 4, Healer: 5, DPS: 15 }
const MIN      = { Tank: 2, Healer: 3, DPS: 13 }
const DPS_ROWS = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14]]

const ROLE_ICON  = { Tank: ShieldStar, Healer: Heart, DPS: Crosshair }
const ROLE_COLOR = { Tank: '#f87171',  Healer: '#4ade80', DPS: '#69cff0' }
const SIGNUP_DOT = { confirmed: '#4ade80', late: '#fb923c', tentative: '#facc15' }

// ── Main component ────────────────────────────────────────────────────────────
export default function RosterField({ roster, available, coaches, stands, isPrivileged, saving, onTogglePlayer, onSetCoach }) {
  const [armoryMemberId, setArmoryMemberId] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const inRoster = roster?.players?.filter(p => p.slot === 'in_roster') || []
  const benchPlayers = roster?.players?.filter(p => p.slot === 'bench') || []

  const byRole = {
    Tank:   inRoster.filter(p => p.raid_role === 'Tank'),
    Healer: inRoster.filter(p => p.raid_role === 'Healer'),
    DPS:    inRoster.filter(p => p.raid_role === 'DPS'),
  }

  // Left panel (Banquillo) = available not in field + bench players
  const inRosterIds = new Set(inRoster.map(p => p.user_id))
  const banquillo = [
    ...benchPlayers,
    ...available.filter(p => !inRosterIds.has(p.user_id)),
  ]
  const banquilloByRole = {
    Tank:   banquillo.filter(p => p.raid_role === 'Tank'),
    Healer: banquillo.filter(p => p.raid_role === 'Healer'),
    DPS:    banquillo.filter(p => p.raid_role === 'DPS'),
  }
  // For slot pickers (inside empty field slots) — exclude bench too
  const allRosterIds = new Set(roster?.players?.map(p => p.user_id) || [])
  const pickerByRole = {
    Tank:   available.filter(p => p.raid_role === 'Tank'   && !allRosterIds.has(p.user_id)),
    Healer: available.filter(p => p.raid_role === 'Healer' && !allRosterIds.has(p.user_id)),
    DPS:    available.filter(p => p.raid_role === 'DPS'    && !allRosterIds.has(p.user_id)),
  }

  const handleDrop = (e, slot) => {
    e.preventDefault()
    const userId = parseInt(e.dataTransfer.getData('text/plain'))
    if (!isNaN(userId)) onTogglePlayer(userId, slot)
  }

  const handleDropToBanquillo = (e) => {
    e.preventDefault()
    const userId = parseInt(e.dataTransfer.getData('text/plain'))
    if (!isNaN(userId)) onTogglePlayer(userId, null)
  }

  return (
    <div className="relative flex flex-col gap-2 select-none">

      {/* ── Banquillo — floats outside to the left (visible to all, editable only for privileged) ── */}
      <div className="absolute right-full top-0 bottom-0 pr-3 w-52 z-10">
        <PlayerListPanel
          banquilloByRole={banquilloByRole}
          saving={saving}
          readOnly={!isPrivileged}
          onDragStart={isPrivileged ? (e, userId) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', String(userId))
          } : undefined}
          onClick={isPrivileged ? (player) => onTogglePlayer(player.user_id, 'in_roster') : undefined}
          onDropToBanquillo={isPrivileged ? handleDropToBanquillo : undefined}
          onPlayerProfile={(userId) => setArmoryMemberId(userId)}
        />
      </div>

      {/* ── Stands — floats outside to the right ───────────────────────── */}
      {stands?.length > 0 && <StandsPanel stands={stands} />}

      {/* ── Coach + Field row ───────────────────────────────────────────── */}
      <div className="flex gap-3 items-stretch">
        <CoachSlot roster={roster} coaches={coaches || []} isPrivileged={isPrivileged} saving={saving} onSetCoach={onSetCoach} />

        <div className="flex-1 relative rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #0a1a10 0%, #0d1f14 35%, #0f2416 55%, #0d1e13 75%, #091610 100%)', minHeight: 480 }}>
          <FieldMarkings />
          <div className="absolute inset-0 flex flex-col justify-between px-6 py-5 pointer-events-none">
            <ZoneLabel color="#69cff0" label="DPS" />
            <ZoneLabel color="#4ade80" label="Healers" />
            <ZoneLabel color="#f87171" label="Tanks" />
          </div>

          {/* DPS — dynamic centered rows */}
          <FieldZone
            players={byRole.DPS} role="DPS" max={15} rowSize={5}
            available={pickerByRole.DPS} isPrivileged={isPrivileged} saving={saving}
            className="pt-8 px-4 pb-4"
            onDragStart={(uid, e) => { e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', String(uid)) }}
            onDrop={e => handleDrop(e, 'in_roster')}
            onAdd={uid => onTogglePlayer(uid, 'in_roster')}
            onRemove={uid => onTogglePlayer(uid, null)}
            onAvatarClick={(player) => setAvatarPreview(player.avatar ? player.avatar : null)}
            onNameClick={(player) => setArmoryMemberId(player.user_id)}
          />

          <div className="mx-8 h-px bg-white/10 my-1" />

          {/* Healers */}
          <FieldZone
            players={byRole.Healer} role="Healer" max={5} rowSize={5}
            available={pickerByRole.Healer} isPrivileged={isPrivileged} saving={saving}
            className="py-5 px-4"
            onDragStart={(uid, e) => { e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', String(uid)) }}
            onDrop={e => handleDrop(e, 'in_roster')}
            onAdd={uid => onTogglePlayer(uid, 'in_roster')}
            onRemove={uid => onTogglePlayer(uid, null)}
            onAvatarClick={(player) => setAvatarPreview(player.avatar ? player.avatar : null)}
            onNameClick={(player) => setArmoryMemberId(player.user_id)}
          />

          <div className="relative mx-16">
            <div className="h-px bg-white/10" />
            <div className="absolute left-1/2 -translate-x-1/2 -top-5 w-24 h-10 rounded-t-full border border-white/10" style={{ borderBottom: 'none' }} />
          </div>

          {/* Tanks */}
          <FieldZone
            players={byRole.Tank} role="Tank" max={4} rowSize={4}
            available={pickerByRole.Tank} isPrivileged={isPrivileged} saving={saving}
            className="py-5 px-4"
            onDragStart={(uid, e) => { e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', String(uid)) }}
            onDrop={e => handleDrop(e, 'in_roster')}
            onAdd={uid => onTogglePlayer(uid, 'in_roster')}
            onRemove={uid => onTogglePlayer(uid, null)}
            onAvatarClick={(player) => setAvatarPreview(player.avatar ? player.avatar : null)}
            onNameClick={(player) => setArmoryMemberId(player.user_id)}
          />
        </div>
      </div>

      {/* ── Buff bar — replaces bench section ───────────────────────────── */}
      <FieldBuffBar players={inRoster} />

      {/* ── Armory modal ─────────────────────────────────────────────────── */}
      {armoryMemberId && (
        <ArmoryModal memberId={armoryMemberId} onClose={() => setArmoryMemberId(null)} />
      )}

      {/* ── Avatar preview overlay ───────────────────────────────────────── */}
      {avatarPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setAvatarPreview(null)}
        >
          <img
            src={avatarPreview}
            alt="Avatar"
            className="max-w-xs max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

// ── PlayerListPanel (Banquillo) ───────────────────────────────────────────────
function PlayerListPanel({ banquilloByRole, saving, readOnly, onDragStart, onClick, onDropToBanquillo, onPlayerProfile }) {
  const [dropOver, setDropOver] = useState(false)
  const total = Object.values(banquilloByRole).flat().length

  return (
    <div
      className={`h-full flex flex-col rounded-2xl border transition-all ${
        dropOver && !readOnly
          ? 'border-yellow-400/40 bg-[rgba(250,204,21,0.04)]'
          : 'border-[rgba(177,167,208,0.15)] bg-[rgba(9,11,26,0.92)]'
      }`}
      style={{ backdropFilter: 'blur(8px)', overflow: 'visible' }}
      onDragOver={readOnly ? undefined : e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(true) }}
      onDragLeave={readOnly ? undefined : e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(false) }}
      onDrop={readOnly ? undefined : e => { setDropOver(false); onDropToBanquillo(e) }}
    >
      <div className="px-3 pt-3 pb-2 border-b border-[rgba(177,167,208,0.10)] flex-shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#b1a7d0] opacity-60">
          {dropOver && !readOnly ? '↩ Banquillo' : `🪑 Banquillo${total > 0 ? ` (${total})` : ''}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
        {Object.entries(banquilloByRole).map(([role, players]) => {
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
                  readOnly={readOnly}
                  onDragStart={readOnly ? undefined : e => onDragStart(e, p.user_id)}
                  onClick={readOnly ? undefined : () => onClick(p)}
                  onProfile={() => onPlayerProfile(p.user_id)}
                />
              ))}
            </div>
          )
        })}

        {total === 0 && (
          <p className="text-[10px] text-center text-[#b1a7d0] opacity-30 py-4">Todos en el campo</p>
        )}
      </div>
    </div>
  )
}

function ListPlayer({ player, saving, readOnly, onDragStart, onClick, onProfile }) {
  const [dragging, setDragging]   = useState(false)
  const [bubblePos, setBubblePos] = useState(null)
  const rowRef = useRef(null)
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'
  const dot = SIGNUP_DOT[player.signup_status]
  const { text, visible } = useSpeechBubble(BENCH_PHRASES, { minDelay: 8000, maxDelay: 30000 })

  // When bubble becomes visible, calculate fixed position from DOM element
  useEffect(() => {
    if (visible && rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect()
      setBubblePos({ top: rect.top + rect.height / 2, left: rect.right + 10 })
    }
  }, [visible])

  return (
    <div
      ref={rowRef}
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : e => { setDragging(true); onDragStart(e) }}
      onDragEnd={readOnly ? undefined : () => setDragging(false)}
      onClick={readOnly ? undefined : onClick}
      title={readOnly ? 'Ver perfil' : 'Click para asignar · Arrastrar al campo'}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg mb-0.5 transition-all ${
        dragging ? 'opacity-30 scale-95' : `hover:bg-[rgba(177,167,208,0.12)] ${readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`
      }`}
      style={{ borderLeft: `2px solid ${classColor}70` }}
    >
      {/* Bubble rendered via portal so overflow never clips it */}
      {(visible || text) && bubblePos && createPortal(
        <div style={{
          position: 'fixed',
          top: bubblePos.top,
          left: bubblePos.left,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s',
        }}>
          <div style={{
            background: 'linear-gradient(135deg,rgba(15,11,32,0.96),rgba(34,30,53,0.96))',
            border: '1px solid rgba(177,167,208,0.35)',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 600,
            color: '#ffeccd',
          }}>
            {text}
          </div>
          {/* Arrow pointing left toward the player */}
          <div style={{
            position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderRight: '4px solid rgba(177,167,208,0.35)',
          }} />
        </div>,
        document.body
      )}

      {dot && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />}
      <button
        onClick={e => { e.stopPropagation(); onProfile() }}
        className="text-xs font-semibold truncate text-left hover:underline"
        style={{ color: classColor }}
        title="Ver perfil"
      >
        {player.character_name}
      </button>
      {player.spec && (
        <span className="text-[9px] text-[#b1a7d0] opacity-50 ml-auto flex-shrink-0 truncate max-w-[50px]">
          {player.spec}
        </span>
      )}
    </div>
  )
}

// ── FieldZone ─────────────────────────────────────────────────────────────────
// Renders a zone (DPS/Healer/Tank) with dynamic slot count and centered layout.
// Below MIN: shows empty + slots (clickable). At/above MIN: players only, drop-only.
function FieldZone({ players, role, max, rowSize, available, isPrivileged, saving, className, onDragStart, onDrop, onAdd, onRemove, onAvatarClick, onNameClick }) {
  const [dropOver, setDropOver] = useState(false)
  const min = MIN[role]
  const hasMin = players.length >= min
  // How many slots to render: actual players, or up to min if below
  const slotCount = hasMin ? players.length : Math.max(players.length, min)

  // Split into rows
  const rows = []
  for (let i = 0; i < slotCount; i += rowSize) {
    rows.push(Array.from({ length: Math.min(rowSize, slotCount - i) }, (_, j) => i + j))
  }

  return (
    <div
      className={`flex flex-col gap-3 items-center ${className}`}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(false) }}
      onDrop={e => { setDropOver(false); onDrop(e) }}
      style={dropOver ? { outline: `1px dashed ${ROLE_COLOR[role]}60`, borderRadius: 8 } : undefined}
    >
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-3 justify-center">
          {row.map(slotIdx => (
            <PlayerSlot key={slotIdx}
              player={players[slotIdx] || null}
              role={role}
              available={hasMin ? [] : available}
              isPrivileged={isPrivileged}
              saving={saving}
              onDragStart={players[slotIdx]
                ? e => onDragStart(players[slotIdx].user_id, e)
                : undefined}
              onDrop={onDrop}
              onAdd={onAdd}
              onRemove={onRemove}
              onAvatarClick={onAvatarClick}
              onNameClick={onNameClick}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── PlayerSlot ────────────────────────────────────────────────────────────────
function PlayerSlot({ player, role, available, isPrivileged, saving, onDragStart, onDrop, onAdd, onRemove, onAvatarClick, onNameClick }) {
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
    return (
      <div ref={ref} className="relative flex flex-col items-center gap-1 group">
        <div
          className={`w-14 h-14 rounded-full overflow-hidden relative ${isPrivileged ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
          draggable={isPrivileged}
          onDragStart={isPrivileged ? onDragStart : undefined}
          onClick={player.avatar ? () => onAvatarClick(player) : undefined}
          title={player.avatar ? 'Ver imagen' : undefined}
          style={{ boxShadow: `0 0 0 2px ${classColor}70, 0 0 12px ${classColor}30` }}
        >
          {/* Avatar or initial */}
          {player.avatar ? (
            <img src={player.avatar} alt={player.character_name}
              className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: `radial-gradient(circle at 35% 35%, ${classColor}25, ${classColor}08)` }}>
              <span className="text-lg font-black"
                style={{ color: classColor, textShadow: `0 0 8px ${classColor}80` }}>
                {player.character_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Hover: remove (privileged) */}
          {isPrivileged && (
            <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button onClick={e => { e.stopPropagation(); onRemove(player.user_id) }} title="Quitar del campo"
                className="w-7 h-7 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-all">
                <X size={12} className="text-red-300" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center max-w-[80px]">
          <button
            onClick={() => onNameClick(player)}
            className="text-[11px] font-bold leading-tight text-center truncate w-full hover:underline"
            style={{ color: classColor, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
            title="Ver perfil"
          >
            {player.character_name}
          </button>
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
        onClick={() => available.length > 0 && setOpen(v => !v)}
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
// ── FieldBuffBar ──────────────────────────────────────────────────────────────
// Two rows: green (covered) on top, red (missing) below.
// Always shown — even with empty roster all show as missing.
function FieldBuffBar({ players }) {
  const coverage = checkBuffCoverage(players || [])
  const covered  = coverage.filter(b => b.covered)
  const missing  = coverage.filter(b => !b.covered)

  return (
    <div className="flex flex-col gap-1.5 px-1 py-2">
      {/* Covered — green row */}
      {covered.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[8px] font-bold uppercase tracking-wider text-green-500 opacity-60 w-12 flex-shrink-0">Tienen</span>
          {covered.map(buff => <BuffIcon key={buff.id} buff={buff} covered />)}
        </div>
      )}

      {/* Missing — red row */}
      {missing.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[8px] font-bold uppercase tracking-wider text-red-400 opacity-60 w-12 flex-shrink-0">Faltan</span>
          {missing.map(buff => <BuffIcon key={buff.id} buff={buff} covered={false} />)}
        </div>
      )}

      {/* All covered state */}
      {missing.length === 0 && covered.length > 0 && (
        <p className="text-[10px] text-green-400 opacity-60 pl-14">✓ Composición completa</p>
      )}
    </div>
  )
}

function BuffIcon({ buff, covered }) {
  const [imgOk, setImgOk] = useState(true)

  return (
    <div
      title={`${buff.name} — ${buff.effect}${covered ? `\nAportado por: ${buff.coveredBy.join(', ')}` : '\nNadie lo aporta'}`}
      className="relative"
      style={{
        opacity: covered ? 1 : 0.35,
        filter: covered ? 'none' : 'grayscale(0.8)',
      }}
    >
      {imgOk ? (
        <img
          src={getBuffIconUrl(buff.icon)}
          alt={buff.name}
          className="w-8 h-8 rounded-md"
          style={covered ? { boxShadow: '0 0 0 1.5px rgba(74,222,128,0.60), 0 0 8px rgba(74,222,128,0.25)' } : { boxShadow: '0 0 0 1.5px rgba(248,113,113,0.40)' }}
          onError={() => setImgOk(false)}
          loading="lazy"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{
            background: covered ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.10)',
            border: covered ? '1.5px solid rgba(74,222,128,0.4)' : '1.5px solid rgba(248,113,113,0.3)',
            color: covered ? '#4ade80' : '#f87171',
          }}
        >
          {buff.name.slice(0, 2)}
        </div>
      )}
    </div>
  )
}
