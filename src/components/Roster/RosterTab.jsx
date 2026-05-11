import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { rosterAPI, calendarAPI } from '../../services/api'
import RosterField from './RosterField'
import { CircleNotch, Copy, Plus, Skull, X, Trash, CalendarDots } from '@phosphor-icons/react'
import SurfaceCard from '../ui/SurfaceCard'
import Button from '../ui/Button'
import CLASS_COLORS from '../../utils/classColors'

export default function RosterTab({ initialDate, onGoToCalendar }) {
  const { user } = useAuth()
  const isPrivileged = user?.role === 'admin' || user?.role === 'officer'

  const [raidDates, setRaidDates]           = useState([])
  const [selectedDate, setSelectedDate]     = useState(null)
  const [rosters, setRosters]               = useState([])   // array — one per boss
  const [selectedRosterId, setSelectedRosterId] = useState(null)
  const [available, setAvailable]           = useState([])
  const [coaches, setCoaches]               = useState([])
  const [declined, setDeclined]             = useState([])
  const [availableBosses, setAvailableBosses] = useState([])
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [copying, setCopying]               = useState(false)
  const [bossPickerOpen, setBossPickerOpen] = useState(false)
  const bossPickerRef = useRef(null)

  // Load raid days
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    calendarAPI.getMySignups(2).then(res => {
      const dates = (res.data.dates || [])
        .filter(d => d.date >= today)
        .map(d => ({ date: d.date, dayName: d.dayName, raidTime: d.raidTime || '21:00' }))
      setRaidDates(dates)
      // Use initialDate if valid, otherwise first date
      const target = initialDate && dates.find(d => d.date === initialDate)
      setSelectedDate(target ? initialDate : (dates[0]?.date || null))
    }).catch(() => {})
  }, [])

  // Load coaches + bosses once
  useEffect(() => {
    if (!isPrivileged) return
    rosterAPI.getCoaches().then(r => setCoaches(r.data || [])).catch(() => {})
    rosterAPI.getBosses().then(r => setAvailableBosses(r.data || [])).catch(() => {})
  }, [isPrivileged])

  // Close boss picker on outside click
  useEffect(() => {
    if (!bossPickerOpen) return
    const h = e => { if (!bossPickerRef.current?.contains(e.target)) setBossPickerOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [bossPickerOpen])

  const load = useCallback(async (date) => {
    if (!date) return
    setLoading(true)
    try {
      const [rosterRes, availRes, summaryRes] = await Promise.all([
        rosterAPI.getByDate(date),
        isPrivileged ? rosterAPI.getAvailable(date) : Promise.resolve({ data: [] }),
        calendarAPI.getSummary(date),
      ])
      const list = Array.isArray(rosterRes.data) ? rosterRes.data : []
      setRosters(list)
      // If boss-specific rosters exist, skip general (boss_id=null) and select first boss
      const bossSpecific = list.filter(r => r.boss_id !== null)
      const firstToShow = bossSpecific.length > 0 ? bossSpecific[0] : list[0]
      setSelectedRosterId(firstToShow?.id || null)

      setAvailable(availRes.data || [])
      const summary = summaryRes.data || {}
      setDeclined([
        ...(summary.declined || []).map(d => ({ ...d, status: 'declined' })),
        ...(summary.noResponse || []).map(d => ({ ...d, status: 'no_response' })),
      ])
    } catch (_) {
      setRosters([])
      setSelectedRosterId(null)
    } finally {
      setLoading(false)
    }
  }, [isPrivileged])

  useEffect(() => { load(selectedDate) }, [selectedDate, load])

  // When rosters change, keep selectedRosterId valid
  useEffect(() => {
    if (rosters.length > 0 && !rosters.find(r => r.id === selectedRosterId)) {
      setSelectedRosterId(rosters[0].id)
    }
  }, [rosters])

  // Update one roster in the array after a mutation
  const updateRoster = (updated) => {
    if (!updated) return
    setRosters(prev => {
      const idx = prev.findIndex(r => r.id === updated.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
      return [...prev, updated]
    })
    setSelectedRosterId(updated.id)
  }

  const togglePlayer  = async (userId, slot) => {
    if (!selectedRosterId) return
    setSaving(true)
    try { updateRoster((await rosterAPI.togglePlayer(selectedRosterId, userId, slot)).data) }
    catch (_) {} finally { setSaving(false) }
  }
  const handleSetCoach = async (userId) => {
    if (!selectedRosterId) return
    setSaving(true)
    try { updateRoster((await rosterAPI.setCoach(selectedRosterId, userId)).data) }
    catch (_) {} finally { setSaving(false) }
  }
  const handleCopyPrevious = async () => {
    if (!selectedRosterId || copying) return
    setCopying(true)
    try { updateRoster((await rosterAPI.copyPrevious(selectedRosterId)).data) }
    catch (e) { alert(e?.response?.data?.error || 'No hay roster anterior') }
    finally { setCopying(false) }
  }
  const handleDeleteRoster = async (rosterId) => {
    if (!confirm('¿Eliminar este roster de boss?')) return
    try {
      await rosterAPI.deleteRoster(rosterId)
      await load(selectedDate)
    } catch (_) {}
  }

  const handleAddBoss = async (bossId) => {
    setBossPickerOpen(false)
    if (!selectedDate || !bossId) return
    setSaving(true)
    try {
      const res = await rosterAPI.createBossRoster(selectedDate, bossId)
      if (res.data) {
        updateRoster(res.data)
        await load(selectedDate) // reload full list to sync
      }
    } catch (e) {
      console.error('Error creating boss roster:', e?.response?.data || e.message)
      alert(e?.response?.data?.error || 'Error al crear roster para ese boss')
    } finally {
      setSaving(false)
    }
  }

  const selectedRoster = rosters.find(r => r.id === selectedRosterId) || null
  const inRoster = selectedRoster?.players?.filter(p => p.slot === 'in_roster') || []

  // Stands: declined + no-response not in field
  const inRosterIds = new Set(inRoster.map(p => p.user_id))
  const stands = declined.filter(d => !inRosterIds.has(d.id)).map(d => ({
    user_id: d.id,
    character_name: d.characterName || d.character_name,
    character_class: d.characterClass || d.character_class,
    spec: d.spec,
    section: d.status === 'declined' ? 'declined' : 'no_response',
  }))

  // Only show boss-specific rosters in tabs; general (null) only if no boss rosters exist
  const bossRosters = rosters.filter(r => r.boss_id !== null)
  const visibleRosters = bossRosters.length > 0 ? bossRosters : rosters

  // Bosses already added (to exclude from picker)
  const usedBossIds = new Set(rosters.filter(r => r.boss_id).map(r => r.boss_id))

  return (
    <div className="flex flex-col gap-4">

      {/* ── Date selector — CENTERED ───────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 flex-wrap relative">
        {onGoToCalendar && (
          <button
            onClick={() => onGoToCalendar(selectedDate)}
            className="absolute left-0 flex items-center gap-1 text-xs text-[#b1a7d0] hover:text-[#ffeccd] transition-colors px-2 py-1 rounded hover:bg-[rgba(177,167,208,0.10)]"
          >
            <CalendarDots size={13} />
            Calendario
          </button>
        )}
        {raidDates.map(({ date, dayName }) => (
          <button key={date} onClick={() => setSelectedDate(date)}
            className={`flex flex-col items-center px-4 py-2 rounded-xl text-xs font-semibold transition-all leading-tight ${
              selectedDate === date
                ? 'bg-[rgba(255,175,157,0.18)] text-[#ffaf9d] outline outline-1 outline-[rgba(255,175,157,0.35)]'
                : 'text-[#b1a7d0] hover:text-[#ffeccd] hover:bg-[rgba(177,167,208,0.10)]'
            }`}>
            <span className="font-bold">{dayName}</span>
            <span className="opacity-60">{date.slice(5)}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <CircleNotch size={28} className="animate-spin text-[#b1a7d0]" />
        </div>
      )}

      {!loading && selectedDate && (
        <div className="flex flex-col gap-3">

          {/* ── Boss tabs + toolbar ──────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Boss tabs — only boss-specific, or general if none exist */}
            {visibleRosters.map(r => (
              <div key={r.id} className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedRosterId(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedRosterId === r.id
                      ? 'bg-[rgba(255,175,157,0.18)] text-[#ffaf9d] outline outline-1 outline-[rgba(255,175,157,0.35)]'
                      : 'text-[#b1a7d0] hover:text-[#ffeccd] hover:bg-[rgba(177,167,208,0.10)]'
                  }`}
                >
                  <Skull size={11} />
                  {r.boss_name || 'General'}
                </button>
                {isPrivileged && r.boss_id && (
                  <button onClick={() => handleDeleteRoster(r.id)}
                    className="text-[#b1a7d0] hover:text-red-400 transition-colors p-0.5">
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}

            {/* Add boss button */}
            {isPrivileged && (
              <div ref={bossPickerRef} className="relative">
                <button
                  onClick={() => setBossPickerOpen(v => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed border-[rgba(177,167,208,0.25)] text-[#b1a7d0] hover:text-[#ffeccd] hover:border-[rgba(177,167,208,0.45)] transition-all"
                >
                  <Plus size={11} weight="bold" />
                  Boss
                </button>

                {bossPickerOpen && (
                  <BossPicker
                    bosses={availableBosses}
                    usedBossIds={usedBossIds}
                    onSelect={handleAddBoss}
                  />
                )}
              </div>
            )}

            {/* Spacer + actions */}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#b1a7d0]">{inRoster.length} en campo</span>
              {saving && <CircleNotch size={12} className="animate-spin text-[#b1a7d0]" />}
              {isPrivileged && selectedRosterId && (
                <Button variant="ghost" size="sm" radius="round" disabled={copying} onClick={handleCopyPrevious}>
                  {copying ? <CircleNotch size={12} className="animate-spin" /> : <Copy size={12} />}
                  Copiar anterior
                </Button>
              )}
            </div>
          </div>

          {/* ── Field ─────────────────────────────────────────────────── */}
          {selectedRosterId || isPrivileged ? (
            selectedRosterId ? (
              <RosterField
                roster={selectedRoster}
                available={available}
                coaches={coaches}
                stands={stands}
                isPrivileged={isPrivileged}
                saving={saving}
                onTogglePlayer={togglePlayer}
                onSetCoach={handleSetCoach}
              />
            ) : (
              <SurfaceCard className="p-10 text-center">
                <Skull size={32} className="mx-auto mb-3 opacity-20 text-[#b1a7d0]" />
                <p className="text-[#b1a7d0] mb-4">
                  {rosters.length === 0
                    ? 'Añade un boss para crear el roster de hoy.'
                    : 'Selecciona un boss arriba.'}
                </p>
              </SurfaceCard>
            )
          ) : (
            <SurfaceCard className="p-10 text-center">
              <p className="text-[#b1a7d0]">El roster aún no está disponible.</p>
            </SurfaceCard>
          )}
        </div>
      )}
    </div>
  )
}

// ── BossPicker ─────────────────────────────────────────────────────────────────
function BossPicker({ bosses, usedBossIds, onSelect }) {
  const [filter, setFilter] = useState('')

  // Group by zone, exclude already-added bosses
  const groups = bosses
    .filter(b => !usedBossIds.has(b.id) && b.name.toLowerCase().includes(filter.toLowerCase()))
    .reduce((acc, b) => {
      if (!acc[b.zone_name]) acc[b.zone_name] = []
      acc[b.zone_name].push(b)
      return acc
    }, {})

  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-[#0f0b20] border border-[rgba(177,167,208,0.25)] rounded-xl shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-[rgba(177,167,208,0.12)]">
        <input autoFocus value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Buscar boss…"
          className="w-full bg-[rgba(177,167,208,0.08)] rounded-lg px-2.5 py-1.5 text-xs text-[#ffeccd] outline-none placeholder:text-[#b1a7d0]/50" />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {Object.entries(groups).map(([zoneName, bsses]) => (
          <div key={zoneName}>
            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#b1a7d0] opacity-40 bg-[rgba(177,167,208,0.04)]">
              {zoneName}
            </div>
            {bsses.map(b => (
              <button key={b.id} onClick={() => onSelect(b.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(177,167,208,0.08)] text-left">
                <Skull size={11} className="text-[#b1a7d0] opacity-50" />
                <span className="text-sm text-[#ffeccd]">{b.name}</span>
              </button>
            ))}
          </div>
        ))}
        {Object.keys(groups).length === 0 && (
          <p className="text-xs text-center text-[#b1a7d0] py-4 opacity-40">
            {filter ? 'Sin resultados' : 'Todos los bosses ya añadidos'}
          </p>
        )}
      </div>
    </div>
  )
}
