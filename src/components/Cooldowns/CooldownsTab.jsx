import { useState, useEffect } from 'react'
import { bossesAPI, cooldownsAPI } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'
import { CLASS_COLORS } from '../../utils/constants'
import {
  Plus, Trash, Copy, Check, CircleNotch, X,
  ShieldStar, Sword, Heart, Clipboard,
} from '@phosphor-icons/react'
import SectionHeader from '../ui/SectionHeader'
import Button from '../ui/Button'

const DIFFICULTY = 'Mythic'

const CATEGORY = {
  healing:   { Icon: Heart,      color: 'text-green-400',  ring: 'ring-green-400/40',  chip: 'bg-green-400/10 border-green-400/30' },
  defensive: { Icon: ShieldStar, color: 'text-yellow-400', ring: 'ring-yellow-400/40', chip: 'bg-yellow-400/10 border-yellow-400/30' },
  interrupt: { Icon: Sword,      color: 'text-red-400',    ring: 'ring-red-400/40',    chip: 'bg-red-400/10 border-red-400/30' },
}

const CATEGORY_LABEL = { healing: 'Healing', defensive: 'Defensivo', interrupt: 'Interrupt' }

function formatTs(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function SpellIcon({ iconSlug, size = 18 }) {
  if (!iconSlug) return null
  return (
    <img
      src={`https://wow.zamimg.com/images/wow/icons/small/${iconSlug}.jpg`}
      alt="" width={size} height={size}
      className="rounded flex-shrink-0"
      onError={e => { e.target.style.display = 'none' }}
    />
  )
}

// ─── Assignment chip ───────────────────────────────────────────────────────
function AssignmentChip({ assignment, onDelete }) {
  const cat = CATEGORY[assignment.category] || CATEGORY.defensive
  const classColor = CLASS_COLORS[assignment.character_class] || '#ffffff'
  return (
    <div className={`flex items-center gap-1.5 pl-1.5 pr-1 py-0.5 rounded-lg border ${cat.chip} group`}>
      <SpellIcon iconSlug={assignment.icon_slug} size={16} />
      <cat.Icon size={11} className={cat.color} />
      <span className="text-xs text-cream">{assignment.cooldown_name}</span>
      <span className="text-xs font-medium" style={{ color: classColor }}>
        {assignment.character_name}
      </span>
      <button
        onClick={() => onDelete(assignment.id)}
        className="ml-0.5 opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-all"
      >
        <X size={10} />
      </button>
    </div>
  )
}

// ─── Inline assignment form (inside event card) ───────────────────────────
function AddAssignmentForm({ eventId, rosterCDs, assignedCdIds, onAdded, onCancel }) {
  const [userId, setUserId] = useState('')
  const [cdId, setCdId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const player = userId ? rosterCDs.find(r => r.user.id === parseInt(userId, 10)) : null

  const submit = async () => {
    if (!userId || !cdId) { setError('Selecciona jugador y cooldown'); return }
    setError('')
    setLoading(true)
    try {
      await cooldownsAPI.createAssignment({
        bossEventId: eventId,
        cooldownId: parseInt(cdId, 10),
        assignedUserId: parseInt(userId, 10),
      })
      onAdded()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al asignar')
    } finally {
      setLoading(false)
    }
  }

  const sel = 'bg-indigo border border-lavender-20 rounded px-2 py-1.5 text-sm text-cream focus:outline-none focus:border-lavender-40 min-w-0'

  return (
    <div className="mt-2 p-2 bg-lavender-8 rounded-lg border border-lavender-12 space-y-2">
      <div className="flex flex-wrap gap-2">
        <select value={userId} onChange={e => { setUserId(e.target.value); setCdId('') }} className={sel}>
          <option value="">— Jugador —</option>
          {rosterCDs.map(r => {
            const col = CLASS_COLORS[r.user.characterClass] || '#ffffff'
            return (
              <option key={r.user.id} value={r.user.id} style={{ color: col }}>
                {r.user.characterName} ({r.user.characterClass})
              </option>
            )
          })}
        </select>
        <select value={cdId} onChange={e => setCdId(e.target.value)} disabled={!player} className={`${sel} disabled:opacity-40`}>
          <option value="">— Cooldown —</option>
          {player?.cooldowns.map(cd => (
            <option key={cd.id} value={cd.id} disabled={assignedCdIds.has(cd.id)}>
              [{CATEGORY_LABEL[cd.category]}] {cd.name}{assignedCdIds.has(cd.id) ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" radius="round" onClick={submit} loading={loading}>Asignar</Button>
        <Button size="sm" radius="round" variant="ghost" onClick={onCancel} icon={X} iconOnly />
      </div>
    </div>
  )
}

// ─── Event card ────────────────────────────────────────────────────────────
function EventCard({ event, rosterCDs, isSelected, onSelect, onDelete, onDeleteAssignment, onAssigned }) {
  const [showForm, setShowForm] = useState(false)
  const assignedCdIds = new Set(event.assignments.map(a => a.cooldown_id))

  return (
    <div
      onClick={() => onSelect(event.id)}
      className={`rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-lavender-40 bg-lavender-12 ring-2 ring-lavender/30'
          : 'border-lavender-12 bg-lavender-8 hover:border-lavender-20'
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Timestamp */}
        <div className="flex-shrink-0 w-14 text-center pt-0.5">
          <span className="text-sm font-mono font-bold text-lavender leading-none">
            {formatTs(event.timestamp_seconds)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-cream mb-2">{event.event_label}</p>

          <div className="flex flex-wrap gap-1.5">
            {event.assignments.map(a => (
              <AssignmentChip key={a.id} assignment={a} onDelete={id => { onDeleteAssignment(id) }} />
            ))}
            {event.assignments.length === 0 && !showForm && (
              <span className="text-xs text-muted italic">Sin CDs asignados</span>
            )}
          </div>

          {showForm ? (
            <AddAssignmentForm
              eventId={event.id}
              rosterCDs={rosterCDs}
              assignedCdIds={assignedCdIds}
              onAdded={() => { setShowForm(false); onAssigned() }}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setShowForm(true) }}
              className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-lavender transition-colors"
            >
              <Plus size={11} /> Añadir CD
            </button>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={e => { e.stopPropagation(); onDelete(event.id) }}
          className="flex-shrink-0 p-1 text-muted hover:text-red-400 transition-colors"
        >
          <Trash size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Add event form (bottom of timeline) ──────────────────────────────────
function AddEventForm({ bossId, onCreated }) {
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState('')
  const [secs, setSecs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const ts = (parseInt(minutes || 0, 10) * 60) + parseInt(secs || 0, 10)
    if (!label.trim()) { setError('Nombre requerido'); return }
    if (isNaN(ts) || ts < 0) { setError('Tiempo inválido'); return }
    setError('')
    setLoading(true)
    try {
      await cooldownsAPI.createEvent({ bossId, difficulty: DIFFICULTY, eventLabel: label.trim(), timestampSeconds: ts })
      setLabel(''); setMinutes(''); setSecs('')
      onCreated()
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'bg-indigo border border-lavender-20 rounded px-2 py-1.5 text-sm text-cream focus:outline-none focus:border-lavender-40'

  return (
    <div className="border-t border-lavender-12 p-3">
      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number" min="0" value={minutes}
            onChange={e => setMinutes(e.target.value)}
            placeholder="m"
            className={`${inputCls} w-12 text-center`}
          />
          <span className="text-muted font-bold">:</span>
          <input
            type="number" min="0" max="59" value={secs}
            onChange={e => setSecs(e.target.value)}
            placeholder="ss"
            className={`${inputCls} w-14 text-center`}
          />
        </div>
        <input
          type="text" value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Nombre del evento (ej: Destello Vacío, Grito de Guerra...)"
          className={`${inputCls} flex-1`}
        />
        <Button size="sm" radius="round" type="submit" loading={loading} icon={Plus}>
          Añadir
        </Button>
      </form>
      {error && <p className="text-red-400 text-xs mt-1 pl-1">{error}</p>}
    </div>
  )
}

// ─── Roster panel ──────────────────────────────────────────────────────────
function RosterPanel({ rosterCDs, events, selectedEventId, onQuickAssign }) {
  // CDs already assigned in the selected event
  const selectedEvent = events.find(e => e.id === selectedEventId)
  const selectedAssigned = new Set(selectedEvent?.assignments.map(a => a.cooldown_id) ?? [])
  // CDs assigned in ANY event (soft indicator)
  const anyAssigned = new Set(events.flatMap(e => e.assignments.map(a => a.cooldown_id)))

  const byCategory = { healing: [], defensive: [], interrupt: [] }
  for (const r of rosterCDs) {
    for (const cd of r.cooldowns) {
      if (byCategory[cd.category]) {
        byCategory[cd.category].push({ ...cd, user: r.user })
      }
    }
  }

  return (
    <div className="bg-lavender-8 rounded-xl border border-lavender-12 overflow-hidden sticky top-4">
      <div className="px-4 py-3 border-b border-lavender-12">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">CDs del Roster</p>
        <p className="text-xs text-muted mt-0.5">
          {selectedEventId
            ? <span className="text-lavender">Selecciona un CD para asignar →</span>
            : 'Selecciona un evento para asignar rápido'}
        </p>
      </div>

      <div className="overflow-y-auto max-h-[55vh]">
        {Object.entries(byCategory).map(([cat, cds]) => {
          if (cds.length === 0) return null
          const { Icon, color } = CATEGORY[cat]
          return (
            <div key={cat} className="border-b border-lavender-12 last:border-0">
              <div className="flex items-center gap-2 px-4 py-2 bg-lavender-12 sticky top-0 z-10">
                <Icon size={12} className={color} />
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                  {CATEGORY_LABEL[cat]}
                </span>
              </div>
              <div className="px-3 py-2 space-y-0.5">
                {cds.map(cd => {
                  const classColor = CLASS_COLORS[cd.user.characterClass] || '#ffffff'
                  const assignedHere = selectedAssigned.has(cd.id)
                  const assignedElse = !assignedHere && anyAssigned.has(cd.id)
                  const canClick = !!selectedEventId && !assignedHere

                  return (
                    <button
                      key={`${cd.id}-${cd.user.id}`}
                      disabled={!canClick}
                      onClick={() => onQuickAssign(cd, cd.user)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                        canClick ? 'hover:bg-lavender-20 cursor-pointer' : 'cursor-default'
                      } ${assignedHere ? 'opacity-35' : assignedElse ? 'opacity-55' : ''}`}
                    >
                      <SpellIcon iconSlug={cd.icon_slug} size={18} />
                      <span className="text-xs leading-snug">
                        <span className="font-medium" style={{ color: classColor }}>{cd.user.characterName}</span>
                        {' '}
                        <span className="text-muted">{cd.name}</span>
                      </span>
                      {assignedHere && <Check size={12} className="text-green-400 flex-shrink-0 ml-auto" />}
                      {assignedElse && <span className="text-xs text-muted flex-shrink-0 ml-auto">en uso</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {rosterCDs.length === 0 && (
          <p className="text-xs text-muted text-center py-8">
            No hay miembros activos con CDs registrados
          </p>
        )}
      </div>
    </div>
  )
}

// ─── MRT note panel ─────────────────────────────────────────────────────────
function MrtNotePanel({ bossId, bossName, onClose }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true)
    cooldownsAPI.getMrtNote(bossId, DIFFICULTY)
      .then(res => setNote(res.data.note || '(Sin asignaciones que exportar)'))
      .catch(() => setNote('Error al generar la nota'))
      .finally(() => setLoading(false))
  }, [bossId])

  const copy = () => {
    navigator.clipboard.writeText(note).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-lavender-8 rounded-xl border border-lavender-12 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-lavender-12">
        <div className="flex items-center gap-2">
          <Clipboard size={16} className="text-lavender" />
          <span className="text-sm font-semibold text-cream">Nota MRT — {bossName}</span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && note && (
            <Button
              size="sm" radius="round"
              variant={copied ? 'success' : 'outline'}
              icon={copied ? Check : Copy}
              onClick={copy}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          )}
          <button onClick={onClose} className="text-muted hover:text-cream transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-2">
            <CircleNotch size={16} className="animate-spin" /> Generando...
          </div>
        ) : (
          <textarea
            readOnly value={note} rows={12}
            className="w-full bg-indigo border border-lavender-20 rounded-lg px-3 py-2 text-xs font-mono text-cream resize-none"
          />
        )}
      </div>
    </div>
  )
}

// ─── Main tab ──────────────────────────────────────────────────────────────
export default function CooldownsTab() {
  const [zones, setZones] = useState([])
  const [selectedBossId, setSelectedBossId] = useState('')
  const [events, setEvents] = useState([])
  const [rosterCDs, setRosterCDs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [showMrt, setShowMrt] = useState(false)

  const currentZones = zones.filter(z => (z.bosses || []).length > 0)
  const selectedBoss = currentZones.flatMap(z => z.bosses || []).find(b => b.id === parseInt(selectedBossId, 10))

  useEffect(() => {
    bossesAPI.getAll().then(r => setZones(r.data)).catch(() => {})
    cooldownsAPI.getRosterCDs().then(r => setRosterCDs(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedBossId) return
    setSelectedEventId(null)
    setShowMrt(false)
    loadEvents()
  }, [selectedBossId])

  useSocket({ cooldowns_updated: () => { if (selectedBossId) loadEvents() } })

  const loadEvents = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await cooldownsAPI.getEvents(selectedBossId, DIFFICULTY)
      setEvents(res.data.events)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar eventos')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    try {
      await cooldownsAPI.deleteEvent(eventId)
      if (selectedEventId === eventId) setSelectedEventId(null)
      loadEvents()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar evento')
    }
  }

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await cooldownsAPI.deleteAssignment(assignmentId)
      loadEvents()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar asignación')
    }
  }

  const handleQuickAssign = async (cd, user) => {
    if (!selectedEventId) return
    try {
      await cooldownsAPI.createAssignment({
        bossEventId: selectedEventId,
        cooldownId: cd.id,
        assignedUserId: user.id,
      })
      loadEvents()
    } catch (err) {
      setError(err.response?.data?.error || 'Ya asignado o error')
    }
  }

  const toggleEventSelect = (eventId) => {
    setSelectedEventId(prev => prev === eventId ? null : eventId)
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={ShieldStar} title="CD Manager" />

      {/* Boss selector + MRT button */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedBossId}
          onChange={e => setSelectedBossId(e.target.value)}
          className="bg-indigo border border-lavender-20 rounded-lg px-3 py-2 text-sm text-cream focus:outline-none focus:border-lavender-40"
        >
          <option value="">— Selecciona un boss —</option>
          {currentZones.map(zone => (
            <optgroup key={zone.id} label={zone.name}>
              {(zone.bosses || []).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {selectedBossId && (
          <Button
            size="sm" radius="round"
            variant={showMrt ? 'secondary' : 'outline'}
            icon={Clipboard}
            onClick={() => setShowMrt(v => !v)}
          >
            {showMrt ? 'Ocultar nota MRT' : 'Nota MRT'}
          </Button>
        )}
      </div>

      {/* MRT note panel */}
      {showMrt && selectedBossId && (
        <MrtNotePanel
          bossId={parseInt(selectedBossId, 10)}
          bossName={selectedBoss?.name || ''}
          onClose={() => setShowMrt(false)}
        />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Main content */}
      {!selectedBossId ? (
        <div className="text-center py-20 text-muted">
          <ShieldStar size={52} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Selecciona un boss para gestionar los CDs de progresión</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <CircleNotch size={28} className="animate-spin text-lavender" />
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_260px] gap-4 items-start">

          {/* ── Timeline ─────────────────────────────────────────── */}
          <div className="bg-lavender-8 rounded-xl border border-lavender-12 overflow-hidden">
            <div className="px-4 py-3 border-b border-lavender-12 flex items-center justify-between">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                Timeline — {events.length} evento{events.length !== 1 ? 's' : ''}
              </p>
              {selectedEventId && (
                <span className="text-xs text-lavender">
                  Selecciona un CD a la derecha para asignarlo →
                </span>
              )}
            </div>

            <div className="p-3 space-y-2">
              {events.length === 0 && (
                <p className="text-sm text-muted text-center py-8 italic">
                  Sin eventos. Añade el primer timer del boss abajo.
                </p>
              )}
              {events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  rosterCDs={rosterCDs}
                  isSelected={selectedEventId === event.id}
                  onSelect={toggleEventSelect}
                  onDelete={handleDeleteEvent}
                  onDeleteAssignment={handleDeleteAssignment}
                  onAssigned={loadEvents}
                />
              ))}
            </div>

            <AddEventForm
              bossId={parseInt(selectedBossId, 10)}
              onCreated={loadEvents}
            />
          </div>

          {/* ── Roster CDs ───────────────────────────────────────── */}
          <RosterPanel
            rosterCDs={rosterCDs}
            events={events}
            selectedEventId={selectedEventId}
            onQuickAssign={handleQuickAssign}
          />
        </div>
      )}
    </div>
  )
}
