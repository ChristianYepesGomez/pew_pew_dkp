import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { rosterAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import BuffChecker from './BuffChecker'
import RosterAdmin from './RosterAdmin'
import {
  Skull, Users, ShieldStar, Heart, Crosshair, CircleNotch,
  Copy, PencilSimple, Plus, Trash, Eye, EyeSlash,
  ClockCountdown, CheckCircle,
} from '@phosphor-icons/react'
import SurfaceCard from '../ui/SurfaceCard'
import Button from '../ui/Button'

const ROLE_CONFIG = {
  Tank:   { icon: ShieldStar,  color: '#f87171', label: 'Tanks' },
  Healer: { icon: Heart,       color: '#4ade80', label: 'Healers' },
  DPS:    { icon: Crosshair,   color: '#69cff0', label: 'DPS' },
}

// Upcoming raid dates (next 4 weeks) — we query each unique date
function getUpcomingDates() {
  const now = new Date()
  return [0, 7, 14, 21].map((offset) => {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10)
  })
}

export default function RosterTab() {
  const { user } = useAuth()
  const isPrivileged = user?.role === 'admin' || user?.role === 'officer'

  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [rosters, setRosters] = useState([])
  const [selectedRosterId, setSelectedRosterId] = useState(null)
  const [availableBosses, setAvailableBosses] = useState([])
  const [loading, setLoading] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [editingRoster, setEditingRoster] = useState(null)

  // Load current raid dates from the calendar dates we know about
  useEffect(() => {
    // Use today + next few weeks, filter to configured raid days server-side
    const upcoming = getUpcomingDates()
    setDates(upcoming)
    setSelectedDate(upcoming[0])
  }, [])

  // Load bosses for picker
  useEffect(() => {
    rosterAPI.getBosses()
      .then((res) => setAvailableBosses(res.data))
      .catch(() => {})
  }, [])

  const loadRosters = useCallback(async (date) => {
    if (!date) return
    setLoading(true)
    try {
      const res = await rosterAPI.getByDate(date)
      setRosters(res.data)
      if (res.data.length > 0) setSelectedRosterId(res.data[0].id)
      else setSelectedRosterId(null)
    } catch (_) {
      setRosters([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRosters(selectedDate)
  }, [selectedDate, loadRosters])

  const handlePublishToggle = async (roster) => {
    try {
      await rosterAPI.update(roster.id, { published: !roster.published })
      loadRosters(selectedDate)
    } catch (_) {}
  }

  const handleDelete = async (roster) => {
    if (!confirm(`¿Borrar el roster "${roster.name}"?`)) return
    try {
      await rosterAPI.remove(roster.id)
      loadRosters(selectedDate)
    } catch (_) {}
  }

  const handleCopy = async (roster) => {
    try {
      await rosterAPI.copy(roster.id, { target_date: selectedDate })
      loadRosters(selectedDate)
    } catch (_) {}
  }

  const selectedRoster = rosters.find((r) => r.id === selectedRosterId) || null

  // Group boss list by zone for the member view (left panel)
  const bossesInRosters = rosters.flatMap((r) =>
    r.bosses.map((b) => ({ ...b, rosterId: r.id, rosterName: r.name }))
  )

  return (
    <div className="flex flex-col gap-6">
      {/* ── Date selector ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-widest text-[#b1a7d0]">Fecha</span>
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                selectedDate === d
                  ? 'bg-[rgba(255,175,157,0.20)] text-[#ffaf9d] outline outline-1 outline-[rgba(255,175,157,0.40)]'
                  : 'text-[#b1a7d0] hover:text-[#ffeccd] hover:bg-[rgba(177,167,208,0.10)]'
              }`}
            >
              {formatDateLabel(d)}
            </button>
          ))}
        </div>
        {isPrivileged && (
          <Button
            variant="coral"
            size="sm"
            radius="round"
            onClick={() => { setEditingRoster(null); setAdminOpen(true) }}
          >
            <Plus size={14} weight="bold" />
            Nuevo roster
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <CircleNotch size={28} className="animate-spin text-[#b1a7d0]" />
        </div>
      )}

      {!loading && rosters.length === 0 && (
        <SurfaceCard className="p-8 text-center">
          <Skull size={32} className="mx-auto mb-3 opacity-30 text-[#b1a7d0]" />
          <p className="text-[#b1a7d0]">No hay rosters publicados para esta fecha.</p>
          {isPrivileged && (
            <Button
              variant="outline"
              size="sm"
              radius="round"
              className="mt-4"
              onClick={() => { setEditingRoster(null); setAdminOpen(true) }}
            >
              Crear el primero
            </Button>
          )}
        </SurfaceCard>
      )}

      {!loading && rosters.length > 0 && (
        <>
          {/* ── Roster tabs (if multiple) ──────────────────────────── */}
          {rosters.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {rosters.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRosterId(r.id)}
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                    selectedRosterId === r.id
                      ? 'bg-[rgba(177,167,208,0.20)] text-[#ffeccd] outline outline-1 outline-[rgba(177,167,208,0.30)]'
                      : 'text-[#b1a7d0] hover:bg-[rgba(177,167,208,0.10)]'
                  }`}
                >
                  {r.name}
                  {!r.published && isPrivileged && (
                    <span className="text-[10px] text-orange-400 font-bold">BORRADOR</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedRoster && (
            <RosterView
              roster={selectedRoster}
              currentUserId={user?.id}
              isPrivileged={isPrivileged}
              onEdit={() => { setEditingRoster(selectedRoster); setAdminOpen(true) }}
              onPublishToggle={() => handlePublishToggle(selectedRoster)}
              onCopy={() => handleCopy(selectedRoster)}
              onDelete={() => handleDelete(selectedRoster)}
            />
          )}
        </>
      )}

      {/* ── Admin modal ───────────────────────────────────────────── */}
      {adminOpen && (
        <RosterAdmin
          roster={editingRoster}
          date={selectedDate}
          availableBosses={availableBosses}
          onClose={() => setAdminOpen(false)}
          onSaved={() => { setAdminOpen(false); loadRosters(selectedDate) }}
        />
      )}
    </div>
  )
}

// ── RosterView ────────────────────────────────────────────────────────────────
function RosterView({ roster, currentUserId, isPrivileged, onEdit, onPublishToggle, onCopy, onDelete }) {
  const inRoster = roster.players.filter((p) => p.slot === 'in_roster')
  const bench    = roster.players.filter((p) => p.slot === 'bench')

  const byRole = {
    Tank:   inRoster.filter((p) => p.raid_role === 'Tank'),
    Healer: inRoster.filter((p) => p.raid_role === 'Healer'),
    DPS:    inRoster.filter((p) => p.raid_role === 'DPS'),
  }

  const isInRoster = inRoster.some((p) => p.user_id === currentUserId)
  const isOnBench  = bench.some((p)    => p.user_id === currentUserId)

  return (
    <SurfaceCard className="overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-[rgba(177,167,208,0.15)]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-[#ffeccd]">{roster.name}</h3>
            {roster.published ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(74,222,128,0.12)] text-green-400 border border-green-500/20">
                ✓ Publicado
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(250,204,21,0.10)] text-yellow-400 border border-yellow-500/20">
                Borrador
              </span>
            )}
            {/* Personal badge */}
            {isInRoster && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(255,175,157,0.15)] text-[#ffaf9d] border border-[rgba(255,175,157,0.30)]">
                🐾 Estás dentro
              </span>
            )}
            {isOnBench && !isInRoster && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(177,167,208,0.12)] text-[#b1a7d0] border border-[rgba(177,167,208,0.20)]">
                🪑 Banquillo
              </span>
            )}
          </div>

          {/* Bosses */}
          {roster.bosses.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Skull size={13} className="text-[#b1a7d0] opacity-60" />
              {roster.bosses.map((b) => (
                <span key={b.boss_id} className="text-xs text-[#b1a7d0]">
                  {b.boss_name}
                </span>
              )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-[#b1a7d0] opacity-30">·</span>, el], [])}
            </div>
          )}
        </div>

        {isPrivileged && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="sm" radius="round" onClick={onPublishToggle} title={roster.published ? 'Despublicar' : 'Publicar'}>
              {roster.published ? <EyeSlash size={15} /> : <Eye size={15} />}
            </Button>
            <Button variant="ghost" size="sm" radius="round" onClick={onEdit} title="Editar">
              <PencilSimple size={15} />
            </Button>
            <Button variant="ghost" size="sm" radius="round" onClick={onCopy} title="Copiar roster">
              <Copy size={15} />
            </Button>
            <Button variant="ghost" size="sm" radius="round" className="text-red-400 hover:text-red-300" onClick={onDelete} title="Borrar">
              <Trash size={15} />
            </Button>
          </div>
        )}
      </div>

      {/* Composition stats */}
      <div className="grid grid-cols-3 border-b border-[rgba(177,167,208,0.15)]">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const Icon = cfg.icon
          const count = byRole[role].length
          return (
            <div key={role} className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</span>
              <span className="text-[11px] text-[#b1a7d0]">
                <Icon size={11} style={{ color: cfg.color, display: 'inline', marginRight: 3 }} />
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Players by role */}
      <div className="p-5 flex flex-col gap-5">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const Icon = cfg.icon
          const players = byRole[role]
          if (players.length === 0) return null
          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} style={{ color: cfg.color }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
                <div className="flex-1 h-px bg-[rgba(177,167,208,0.15)]" />
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <PlayerCard
                    key={p.user_id}
                    player={p}
                    isCurrentUser={p.user_id === currentUserId}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* Bench */}
        {bench.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#b1a7d0] opacity-50">🪑 Banquillo</span>
              <div className="flex-1 h-px bg-[rgba(177,167,208,0.10)]" />
            </div>
            <div className="flex flex-wrap gap-2 opacity-50">
              {bench.map((p) => (
                <PlayerCard
                  key={p.user_id}
                  player={p}
                  isCurrentUser={p.user_id === currentUserId}
                  bench
                />
              ))}
            </div>
          </div>
        )}

        {/* Buff checker */}
        <BuffChecker players={inRoster} />
      </div>
    </SurfaceCard>
  )
}

// ── PlayerCard ────────────────────────────────────────────────────────────────
function PlayerCard({ player, isCurrentUser, bench }) {
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'

  return (
    <div
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
        isCurrentUser
          ? 'border-[rgba(255,175,157,0.40)] bg-[rgba(255,175,157,0.08)] outline outline-1 outline-[rgba(255,175,157,0.20)]'
          : 'border-[rgba(177,167,208,0.15)] bg-[rgba(177,167,208,0.05)]'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: classColor }}
    >
      <div className="flex flex-col min-w-0">
        <span
          className="text-sm font-bold leading-tight truncate"
          style={{ color: isCurrentUser ? '#ffaf9d' : classColor }}
        >
          {player.character_name}
          {isCurrentUser && ' ★'}
        </span>
        <span className="text-[11px] text-[#b1a7d0] leading-tight">
          {player.character_class}{player.spec ? ` · ${player.spec}` : ''}
        </span>
      </div>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}
