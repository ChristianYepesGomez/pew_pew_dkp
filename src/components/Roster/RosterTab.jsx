import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { rosterAPI, calendarAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import BuffChecker from './BuffChecker'
import {
  ShieldStar, Heart, Crosshair, CircleNotch,
  Eye, EyeSlash, Copy, X, Plus, UserPlus,
} from '@phosphor-icons/react'
import SurfaceCard from '../ui/SurfaceCard'
import Button from '../ui/Button'

const ROLE_CONFIG = {
  Tank:   { icon: ShieldStar, color: '#f87171', label: 'Tanks',   min: 2 },
  Healer: { icon: Heart,      color: '#4ade80', label: 'Healers',  min: 3 },
  DPS:    { icon: Crosshair,  color: '#69cff0', label: 'DPS',     min: 13 },
}

const SIGNUP_COLOR = {
  confirmed: '#4ade80',
  late:      '#fb923c',
  tentative: '#facc15',
}

export default function RosterTab() {
  const { user } = useAuth()
  const isPrivileged = user?.role === 'admin' || user?.role === 'officer'

  const [raidDates, setRaidDates]       = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [roster, setRoster]             = useState(null)   // null = no roster yet
  const [available, setAvailable]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [copying, setCopying]           = useState(false)

  // Load raid days from calendar
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    calendarAPI.getMySignups(2).then((res) => {
      const dates = (res.data.dates || [])
        .filter((d) => d.date >= today)
        .map((d) => ({ date: d.date, dayName: d.dayName, raidTime: d.raidTime || '21:00' }))
      setRaidDates(dates)
      if (dates.length > 0) setSelectedDate(dates[0].date)
    }).catch(() => {})
  }, [])

  // Load roster + available players for selected date
  const load = useCallback(async (date) => {
    if (!date) return
    setLoading(true)
    try {
      const [rosterRes, availRes] = await Promise.all([
        rosterAPI.getByDate(date),
        isPrivileged ? rosterAPI.getAvailable(date) : Promise.resolve({ data: [] }),
      ])
      setRoster(rosterRes.data)       // may be null
      setAvailable(availRes.data || [])
    } catch (_) {
      setRoster(null)
      setAvailable([])
    } finally {
      setLoading(false)
    }
  }, [isPrivileged])

  useEffect(() => { load(selectedDate) }, [selectedDate, load])

  // Toggle player in/out of roster (live save)
  const togglePlayer = async (userId, slot) => {
    if (!selectedDate || saving) return
    setSaving(true)
    try {
      const res = await rosterAPI.togglePlayer(selectedDate, userId, slot)
      setRoster(res.data)
    } catch (_) {}
    setSaving(false)
  }

  const handlePublish = async () => {
    if (!selectedDate || saving) return
    setSaving(true)
    try {
      const res = await rosterAPI.publish(selectedDate)
      setRoster(res.data)
    } catch (_) {}
    setSaving(false)
  }

  const handleCopyPrevious = async () => {
    if (!selectedDate || copying) return
    setCopying(true)
    try {
      const res = await rosterAPI.copyPrevious(selectedDate)
      setRoster(res.data)
    } catch (e) {
      alert(e?.response?.data?.error || 'No hay roster anterior')
    }
    setCopying(false)
  }

  const inRoster = roster?.players?.filter(p => p.slot === 'in_roster') || []
  const bench    = roster?.players?.filter(p => p.slot === 'bench')    || []

  // Players not yet in roster (for the add picker)
  const rosterUserIds = new Set(roster?.players?.map(p => p.user_id) || [])
  const notInRoster = available.filter(p => !rosterUserIds.has(p.user_id))

  return (
    <div className="flex flex-col gap-5">

      {/* ── Date selector ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {raidDates.map(({ date, dayName, raidTime }) => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            className={`flex flex-col items-center px-4 py-2 rounded-xl text-xs font-semibold transition-all leading-tight ${
              selectedDate === date
                ? 'bg-[rgba(255,175,157,0.18)] text-[#ffaf9d] outline outline-1 outline-[rgba(255,175,157,0.35)]'
                : 'text-[#b1a7d0] hover:text-[#ffeccd] hover:bg-[rgba(177,167,208,0.10)]'
            }`}
          >
            <span className="font-bold">{dayName}</span>
            <span className="opacity-60">{date.slice(5)} · {raidTime}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <CircleNotch size={28} className="animate-spin text-[#b1a7d0]" />
        </div>
      )}

      {!loading && selectedDate && (
        <SurfaceCard className="overflow-hidden">

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(177,167,208,0.15)]">
            <div className="flex items-center gap-3">
              {roster?.published
                ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(74,222,128,0.12)] text-green-400 border border-green-500/20">✓ Publicado</span>
                : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(250,204,21,0.10)] text-yellow-400 border border-yellow-500/20">Borrador</span>
              }
              <span className="text-sm text-[#b1a7d0]">
                {inRoster.length} jugadores
                {bench.length > 0 && ` · ${bench.length} banquillo`}
              </span>
              {saving && <CircleNotch size={13} className="animate-spin text-[#b1a7d0]" />}
            </div>

            {isPrivileged && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" radius="round"
                  disabled={copying}
                  onClick={handleCopyPrevious}
                  title="Copiar roster anterior"
                >
                  {copying
                    ? <CircleNotch size={13} className="animate-spin" />
                    : <Copy size={13} />
                  }
                  Copiar anterior
                </Button>
                <Button
                  variant={roster?.published ? 'outline' : 'teal'}
                  size="sm" radius="round"
                  disabled={!roster || saving}
                  onClick={handlePublish}
                >
                  {roster?.published ? <EyeSlash size={13} /> : <Eye size={13} />}
                  {roster?.published ? 'Despublicar' : 'Publicar'}
                </Button>
              </div>
            )}
          </div>

          {/* ── Body ────────────────────────────────────────────────── */}
          <div className="p-5 flex flex-col gap-6">

            {/* Roles */}
            {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
              const Icon = cfg.icon
              const players = inRoster.filter(p => p.raid_role === role)
              const toAdd   = notInRoster.filter(p => p.raid_role === role)
              return (
                <RoleSection
                  key={role}
                  role={role}
                  cfg={cfg}
                  players={players}
                  toAdd={toAdd}
                  currentUserId={user?.id}
                  isPrivileged={isPrivileged}
                  saving={saving}
                  onRemove={(uid) => togglePlayer(uid, null)}
                  onAdd={(uid) => togglePlayer(uid, 'in_roster')}
                  onBench={(uid) => togglePlayer(uid, 'bench')}
                />
              )
            })}

            {/* Bench */}
            {(bench.length > 0 || (isPrivileged && notInRoster.length > 0)) && (
              <BenchSection
                players={bench}
                toAdd={notInRoster}
                currentUserId={user?.id}
                isPrivileged={isPrivileged}
                saving={saving}
                onRemove={(uid) => togglePlayer(uid, null)}
                onAdd={(uid) => togglePlayer(uid, 'bench')}
                onMoveToRoster={(uid) => togglePlayer(uid, 'in_roster')}
              />
            )}

            {/* Empty state for members */}
            {!isPrivileged && inRoster.length === 0 && (
              <p className="text-center text-[#b1a7d0] text-sm py-6">
                El roster aún no ha sido publicado.
              </p>
            )}

            {/* Buff checker */}
            {inRoster.length > 0 && <BuffChecker players={inRoster} />}
          </div>
        </SurfaceCard>
      )}
    </div>
  )
}

// ── RoleSection ───────────────────────────────────────────────────────────────
function RoleSection({ role, cfg, players, toAdd, currentUserId, isPrivileged, saving, onRemove, onAdd, onBench }) {
  const Icon = cfg.icon
  const [open, setOpen] = useState(false)
  const popoverRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!popoverRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} style={{ color: cfg.color }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span className="text-[11px] text-[#b1a7d0] opacity-50">({players.length})</span>
        <div className="flex-1 h-px bg-[rgba(177,167,208,0.15)]" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {players.map(p => (
          <PlayerChip
            key={p.user_id}
            player={p}
            isCurrentUser={p.user_id === currentUserId}
            isPrivileged={isPrivileged}
            saving={saving}
            onRemove={() => onRemove(p.user_id)}
            onBench={() => onBench(p.user_id)}
          />
        ))}

        {isPrivileged && toAdd.length > 0 && (
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setOpen(v => !v)}
              disabled={saving}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-dashed border-[rgba(177,167,208,0.25)] text-[#b1a7d0] hover:text-[#ffeccd] hover:border-[rgba(177,167,208,0.45)] transition-all disabled:opacity-40"
            >
              <Plus size={11} weight="bold" />
              Añadir
            </button>

            {open && (
              <PlayerPickerPopover
                players={toAdd}
                onSelect={(uid) => { onAdd(uid); setOpen(false) }}
                onBench={(uid) => { onBench(uid); setOpen(false) }}
              />
            )}
          </div>
        )}

        {isPrivileged && players.length === 0 && toAdd.length === 0 && (
          <span className="text-[11px] text-[#b1a7d0] opacity-30 italic">Sin confirmados para este rol</span>
        )}
      </div>
    </div>
  )
}

// ── BenchSection ──────────────────────────────────────────────────────────────
function BenchSection({ players, toAdd, currentUserId, isPrivileged, saving, onRemove, onAdd, onMoveToRoster }) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!popoverRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!isPrivileged && players.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#b1a7d0] opacity-40">
          🪑 Banquillo
        </span>
        <div className="flex-1 h-px bg-[rgba(177,167,208,0.08)]" />
      </div>

      <div className="flex flex-wrap gap-2 items-center opacity-60">
        {players.map(p => (
          <PlayerChip
            key={p.user_id}
            player={p}
            isCurrentUser={p.user_id === currentUserId}
            isPrivileged={isPrivileged}
            saving={saving}
            onRemove={() => onRemove(p.user_id)}
            onBench={null}
            onMoveToRoster={() => onMoveToRoster(p.user_id)}
          />
        ))}

        {isPrivileged && toAdd.length > 0 && (
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setOpen(v => !v)}
              disabled={saving}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-dashed border-[rgba(177,167,208,0.20)] text-[#b1a7d0] hover:text-[#ffeccd] transition-all disabled:opacity-40"
            >
              <Plus size={11} weight="bold" />
              Al banquillo
            </button>

            {open && (
              <PlayerPickerPopover
                players={toAdd}
                benchOnly
                onBench={(uid) => { onAdd(uid); setOpen(false) }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── PlayerChip ────────────────────────────────────────────────────────────────
function PlayerChip({ player, isCurrentUser, isPrivileged, saving, onRemove, onBench, onMoveToRoster }) {
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div
      ref={ref}
      className={`relative flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl border transition-all ${
        isCurrentUser
          ? 'border-[rgba(255,175,157,0.40)] bg-[rgba(255,175,157,0.08)]'
          : 'border-[rgba(177,167,208,0.15)] bg-[rgba(177,167,208,0.05)]'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: classColor }}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-bold leading-tight" style={{ color: isCurrentUser ? '#ffaf9d' : classColor }}>
          {player.character_name}{isCurrentUser ? ' ★' : ''}
        </span>
        <span className="text-[10px] text-[#b1a7d0] leading-tight">
          {player.spec || player.character_class}
        </span>
      </div>

      {isPrivileged && (
        <div className="flex items-center gap-0.5 ml-1">
          {onBench && (
            <button
              onClick={() => { onBench(); setMenuOpen(false) }}
              disabled={saving}
              title="Mover al banquillo"
              className="w-5 h-5 flex items-center justify-center rounded text-[#b1a7d0] hover:text-yellow-400 hover:bg-[rgba(250,204,21,0.10)] transition-all text-xs disabled:opacity-30"
            >
              🪑
            </button>
          )}
          {onMoveToRoster && (
            <button
              onClick={() => { onMoveToRoster(); setMenuOpen(false) }}
              disabled={saving}
              title="Mover al roster"
              className="w-5 h-5 flex items-center justify-center rounded text-[#b1a7d0] hover:text-green-400 hover:bg-[rgba(74,222,128,0.10)] transition-all text-xs disabled:opacity-30"
            >
              ↑
            </button>
          )}
          <button
            onClick={onRemove}
            disabled={saving}
            title="Quitar"
            className="w-5 h-5 flex items-center justify-center rounded text-[#b1a7d0] hover:text-red-400 hover:bg-[rgba(248,113,113,0.10)] transition-all disabled:opacity-30"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── PlayerPickerPopover ───────────────────────────────────────────────────────
function PlayerPickerPopover({ players, onSelect, onBench, benchOnly }) {
  const [filter, setFilter] = useState('')
  const filtered = players.filter(p =>
    p.character_name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-[#0f0b20] border border-[rgba(177,167,208,0.25)] rounded-xl shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-[rgba(177,167,208,0.15)]">
        <input
          autoFocus
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Buscar…"
          className="w-full bg-[rgba(177,167,208,0.08)] rounded-lg px-2.5 py-1.5 text-xs text-[#ffeccd] outline-none placeholder:text-[#b1a7d0]/50"
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-center text-xs text-[#b1a7d0] py-4 opacity-50">Sin resultados</p>
        )}
        {filtered.map(p => {
          const classColor = CLASS_COLORS[p.character_class] || '#b1a7d0'
          const dotColor = SIGNUP_COLOR[p.signup_status]
          return (
            <div key={p.user_id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[rgba(177,167,208,0.08)] cursor-pointer group"
              onClick={() => benchOnly ? onBench(p.user_id) : onSelect(p.user_id)}
            >
              {dotColor && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />}
              <span className="text-sm font-medium flex-1 truncate" style={{ color: classColor }}>
                {p.character_name}
              </span>
              {!benchOnly && onBench && (
                <button
                  onClick={e => { e.stopPropagation(); onBench(p.user_id) }}
                  className="opacity-0 group-hover:opacity-60 text-[10px] text-[#b1a7d0] hover:text-[#ffeccd] px-1"
                  title="Al banquillo"
                >
                  🪑
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
