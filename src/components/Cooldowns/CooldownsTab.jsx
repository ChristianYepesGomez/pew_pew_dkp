import { useState, useEffect, useCallback } from 'react'
import { bossesAPI, cooldownsAPI } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'
import {
  Plus, Trash, Copy, Check, CircleNotch, X,
  ShieldStar, Sword, Heart
} from '@phosphor-icons/react'
import SectionHeader from '../ui/SectionHeader'
import Button from '../ui/Button'

const DIFFICULTY = 'Mythic'

const CATEGORY_ICON = {
  healing:   { Icon: Heart,      color: 'text-green-400' },
  defensive: { Icon: ShieldStar, color: 'text-yellow-400' },
  interrupt: { Icon: Sword,      color: 'text-red-400' },
}

const CATEGORY_LABEL = {
  healing:   'Healing',
  defensive: 'Defensivo',
  interrupt: 'Interrupt',
}

function SpellIcon({ iconSlug, size = 20 }) {
  if (!iconSlug) return null
  return (
    <img
      src={`https://wow.zamimg.com/images/wow/icons/small/${iconSlug}.jpg`}
      alt=""
      width={size}
      height={size}
      className="rounded"
      onError={e => { e.target.style.display = 'none' }}
    />
  )
}

function formatTs(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function AddEventRow({ bossId, difficulty, onCreated }) {
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState('')
  const [secs, setSecs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ts = (parseInt(minutes || 0, 10) * 60) + parseInt(secs || 0, 10)
    if (!label.trim()) { setError('Nombre del evento requerido'); return }
    if (isNaN(ts) || ts < 0) { setError('Timestamp inválido'); return }
    setError('')
    setLoading(true)
    try {
      await cooldownsAPI.createEvent({ bossId, difficulty, eventLabel: label.trim(), timestampSeconds: ts })
      setLabel('')
      setMinutes('')
      setSecs('')
      onCreated()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <tr className="border-t border-lavender-12">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            placeholder="m"
            className="w-12 bg-indigo border border-lavender-20 rounded px-2 py-1 text-sm text-cream text-center"
          />
          <span className="text-muted">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={secs}
            onChange={e => setSecs(e.target.value)}
            placeholder="ss"
            className="w-14 bg-indigo border border-lavender-20 rounded px-2 py-1 text-sm text-cream text-center"
          />
        </div>
      </td>
      <td className="px-3 py-2" colSpan={2}>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Nombre del evento (ej: Destello Vacío)"
          className="w-full bg-indigo border border-lavender-20 rounded px-2 py-1 text-sm text-cream"
        />
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </td>
      <td className="px-3 py-2">
        <Button size="sm" radius="round" onClick={handleSubmit} loading={loading}>
          Añadir
        </Button>
      </td>
    </tr>
  )
}

function AssignmentRow({ assignment, onDelete }) {
  const { Icon, color } = CATEGORY_ICON[assignment.category] || CATEGORY_ICON.defensive
  return (
    <div className="flex items-center gap-2 py-0.5">
      <SpellIcon iconSlug={assignment.icon_slug} size={18} />
      <Icon size={14} className={color} />
      <span className="text-sm text-cream">{assignment.cooldown_name}</span>
      <span className="text-sm text-muted">—</span>
      <span className="text-sm text-lavender">{assignment.character_name}</span>
      {assignment.notes && <span className="text-xs text-muted italic">{assignment.notes}</span>}
      <button onClick={() => onDelete(assignment.id)} className="ml-auto text-muted hover:text-red-400 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}

function AddAssignmentForm({ eventId, rosterCDs, onAdded, onCancel }) {
  const [selectedRosterEntry, setSelectedRosterEntry] = useState('')
  const [selectedCd, setSelectedCd] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentRoster = selectedRosterEntry ? rosterCDs.find(r => r.user.id === parseInt(selectedRosterEntry, 10)) : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedRosterEntry || !selectedCd) { setError('Selecciona jugador y cooldown'); return }
    setError('')
    setLoading(true)
    try {
      await cooldownsAPI.createAssignment({
        bossEventId: eventId,
        cooldownId: parseInt(selectedCd, 10),
        assignedUserId: parseInt(selectedRosterEntry, 10),
        notes: notes.trim() || null,
      })
      onAdded()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al asignar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 p-2 bg-lavender-8 rounded-lg border border-lavender-12 space-y-2">
      <div className="flex gap-2 flex-wrap">
        <select
          value={selectedRosterEntry}
          onChange={e => { setSelectedRosterEntry(e.target.value); setSelectedCd('') }}
          className="bg-indigo border border-lavender-20 rounded px-2 py-1 text-sm text-cream min-w-0 flex-1"
        >
          <option value="">— Jugador —</option>
          {rosterCDs.map(r => (
            <option key={r.user.id} value={r.user.id}>
              {r.user.characterName} ({r.user.characterClass})
            </option>
          ))}
        </select>

        <select
          value={selectedCd}
          onChange={e => setSelectedCd(e.target.value)}
          disabled={!currentRoster}
          className="bg-indigo border border-lavender-20 rounded px-2 py-1 text-sm text-cream min-w-0 flex-1 disabled:opacity-50"
        >
          <option value="">— Cooldown —</option>
          {currentRoster?.cooldowns.map(cd => (
            <option key={cd.id} value={cd.id}>
              [{CATEGORY_LABEL[cd.category]}] {cd.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
          className="bg-indigo border border-lavender-20 rounded px-2 py-1 text-sm text-cream min-w-0 flex-1"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" radius="round" onClick={handleSubmit} loading={loading}>Asignar</Button>
        <Button size="sm" radius="round" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}

function EventRow({ event, rosterCDs, onDeleteEvent, onDeleteAssignment, onAssignmentAdded }) {
  const [showAdd, setShowAdd] = useState(false)

  return (
    <tr className="border-t border-lavender-12 align-top">
      <td className="px-3 py-3 text-sm font-mono text-lavender whitespace-nowrap">
        {formatTs(event.timestamp_seconds)}
      </td>
      <td className="px-3 py-3 text-sm text-cream">
        {event.event_label}
      </td>
      <td className="px-3 py-3">
        <div className="space-y-0.5">
          {event.assignments.map(a => (
            <AssignmentRow key={a.id} assignment={a} onDelete={onDeleteAssignment} />
          ))}
          {event.assignments.length === 0 && !showAdd && (
            <span className="text-xs text-muted italic">Sin asignaciones</span>
          )}
          {showAdd ? (
            <AddAssignmentForm
              eventId={event.id}
              rosterCDs={rosterCDs}
              onAdded={() => { setShowAdd(false); onAssignmentAdded() }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-1 flex items-center gap-1 text-xs text-muted hover:text-lavender transition-colors"
            >
              <Plus size={12} /> Añadir CD
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <button onClick={() => onDeleteEvent(event.id)} className="text-muted hover:text-red-400 transition-colors">
          <Trash size={16} />
        </button>
      </td>
    </tr>
  )
}

function MrtNotePanel({ bossId, difficulty, bossName }) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateNote = useCallback(async () => {
    if (!bossId) return
    setLoading(true)
    try {
      const res = await cooldownsAPI.getMrtNote(bossId, difficulty)
      setNote(res.data.note || '')
    } catch (err) {
      setNote('Error al generar la nota')
    } finally {
      setLoading(false)
    }
  }, [bossId, difficulty])

  const copyNote = () => {
    if (!note) return
    navigator.clipboard.writeText(note).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-6 bg-lavender-8 rounded-xl border border-lavender-12 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cream">Nota MRT</h3>
        <div className="flex gap-2">
          <Button size="sm" radius="round" variant="secondary" onClick={generateNote} loading={loading} icon={CircleNotch}>
            Generar
          </Button>
          {note && (
            <Button size="sm" radius="round" variant={copied ? 'success' : 'outline'} onClick={copyNote} icon={copied ? Check : Copy}>
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          )}
        </div>
      </div>
      {note ? (
        <textarea
          readOnly
          value={note}
          rows={10}
          className="w-full bg-indigo border border-lavender-20 rounded-lg px-3 py-2 text-xs font-mono text-cream resize-none"
        />
      ) : (
        <p className="text-xs text-muted">
          Haz clic en "Generar" para crear la nota MRT lista para pegar en el juego.
        </p>
      )}
    </div>
  )
}

export default function CooldownsTab() {
  const [zones, setZones] = useState([])
  const [selectedBossId, setSelectedBossId] = useState('')
  const [events, setEvents] = useState([])
  const [rosterCDs, setRosterCDs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedBoss = zones.flatMap(z => z.bosses || []).find(b => b.id === parseInt(selectedBossId, 10))

  useEffect(() => {
    loadZones()
    loadRosterCDs()
  }, [])

  useEffect(() => {
    if (selectedBossId) loadEvents()
  }, [selectedBossId])

  useSocket({ cooldowns_updated: () => { if (selectedBossId) loadEvents() } })

  const loadZones = async () => {
    try {
      const res = await bossesAPI.getAll()
      setZones(res.data)
    } catch {
      // non-fatal
    }
  }

  const loadRosterCDs = async () => {
    try {
      const res = await cooldownsAPI.getRosterCDs()
      setRosterCDs(res.data)
    } catch {
      // non-fatal
    }
  }

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

  // Current zones with their bosses
  const currentZones = zones.filter(z => z.is_current && (z.bosses || []).length > 0)

  return (
    <div className="space-y-6">
      <SectionHeader icon={ShieldStar} title="CD Manager" />

      {/* Boss selector — grouped by zone, always Mythic */}
      <div className="flex items-center gap-3">
        <select
          value={selectedBossId}
          onChange={e => setSelectedBossId(e.target.value)}
          className="bg-indigo border border-lavender-20 rounded-lg px-3 py-2 text-sm text-cream"
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
        <span className="text-xs font-medium text-orange-400 bg-orange-400/10 border border-orange-400/30 rounded-full px-3 py-1">
          Mítico
        </span>
      </div>

      {/* Events table */}
      {selectedBossId && (
        <div className="bg-lavender-8 rounded-xl border border-lavender-12 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <CircleNotch size={24} className="animate-spin text-lavender" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-lavender-12">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted uppercase tracking-wide w-24">Tiempo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted uppercase tracking-wide w-40">Evento</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted uppercase tracking-wide">CDs Asignados</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <EventRow
                    key={event.id}
                    event={event}
                    rosterCDs={rosterCDs}
                    onDeleteEvent={handleDeleteEvent}
                    onDeleteAssignment={handleDeleteAssignment}
                    onAssignmentAdded={loadEvents}
                  />
                ))}
                <AddEventRow
                  bossId={parseInt(selectedBossId, 10)}
                  difficulty={DIFFICULTY}
                  onCreated={loadEvents}
                />
              </tbody>
            </table>
          )}

          {error && (
            <p className="px-4 py-2 text-sm text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* MRT Note section */}
      {selectedBossId && events.length > 0 && (
        <MrtNotePanel
          bossId={parseInt(selectedBossId, 10)}
          difficulty={DIFFICULTY}
          bossName={selectedBoss?.name || ''}
        />
      )}

      {!selectedBossId && (
        <div className="text-center py-12 text-muted">
          <ShieldStar size={48} className="mx-auto mb-3 opacity-30" />
          <p>Selecciona un boss para gestionar los CDs de raid</p>
        </div>
      )}
    </div>
  )
}
