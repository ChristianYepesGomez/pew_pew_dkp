import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { rosterAPI, calendarAPI } from '../../services/api'
import RosterField from './RosterField'
import { CircleNotch, Copy } from '@phosphor-icons/react'
import SurfaceCard from '../ui/SurfaceCard'
import Button from '../ui/Button'

export default function RosterTab() {
  const { user } = useAuth()
  const isPrivileged = user?.role === 'admin' || user?.role === 'officer'

  const [raidDates, setRaidDates]       = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [roster, setRoster]             = useState(null)
  const [available, setAvailable]       = useState([])
  const [coaches, setCoaches]           = useState([])
  const [declined, setDeclined]         = useState([])  // for stands
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [copying, setCopying]           = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    calendarAPI.getMySignups(2).then(res => {
      const dates = (res.data.dates || [])
        .filter(d => d.date >= today)
        .map(d => ({ date: d.date, dayName: d.dayName, raidTime: d.raidTime || '21:00' }))
      setRaidDates(dates)
      if (dates.length > 0) setSelectedDate(dates[0].date)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isPrivileged) return
    rosterAPI.getCoaches().then(res => setCoaches(res.data || [])).catch(() => {})
  }, [isPrivileged])

  const load = useCallback(async (date) => {
    if (!date) return
    setLoading(true)
    try {
      const [rosterRes, availRes, summaryRes] = await Promise.all([
        rosterAPI.getByDate(date),
        isPrivileged ? rosterAPI.getAvailable(date) : Promise.resolve({ data: [] }),
        calendarAPI.getSummary(date),
      ])
      setRoster(rosterRes.data)
      setAvailable(availRes.data || [])
      // Stands: declined + no-response, tagged with status
      const summary = summaryRes.data || {}
      setDeclined([
        ...(summary.declined || []).map(d => ({ ...d, status: 'declined' })),
        ...(summary.noResponse || []).map(d => ({ ...d, status: 'no_response' })),
      ])
    } catch (_) {
      setRoster(null)
      setAvailable([])
      setDeclined([])
    } finally {
      setLoading(false)
    }
  }, [isPrivileged])

  useEffect(() => { load(selectedDate) }, [selectedDate, load])

  const togglePlayer = async (userId, slot) => {
    if (!selectedDate) return
    setSaving(true)
    try {
      const res = await rosterAPI.togglePlayer(selectedDate, userId, slot)
      setRoster(res.data)
    } catch (_) {
    } finally {
      setSaving(false)
    }
  }

  const handleSetCoach = async (userId) => {
    if (!selectedDate) return
    setSaving(true)
    try {
      const res = await rosterAPI.setCoach(selectedDate, userId)
      setRoster(res.data)
    } catch (_) {
    } finally {
      setSaving(false)
    }
  }

  const handleCopyPrevious = async () => {
    if (!selectedDate || copying) return
    setCopying(true)
    try {
      const res = await rosterAPI.copyPrevious(selectedDate)
      setRoster(res.data)
    } catch (e) {
      alert(e?.response?.data?.error || 'No hay roster anterior')
    } finally {
      setCopying(false)
    }
  }

  const inRoster = roster?.players?.filter(p => p.slot === 'in_roster') || []

  // Stands: declined + no-response (not in field)
  const inRosterIds = new Set(inRoster.map(p => p.user_id))
  const stands = declined
    .filter(d => !inRosterIds.has(d.id))
    .map(d => ({
      user_id: d.id,
      character_name: d.characterName || d.character_name,
      character_class: d.characterClass || d.character_class,
      spec: d.spec,
      section: d.status === 'declined' ? 'declined' : 'no_response',
    }))

  return (
    <div className="flex flex-col gap-5">

      {/* Date selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {raidDates.map(({ date, dayName, raidTime }) => (
          <button key={date} onClick={() => setSelectedDate(date)}
            className={`flex flex-col items-center px-4 py-2 rounded-xl text-xs font-semibold transition-all leading-tight ${
              selectedDate === date
                ? 'bg-[rgba(255,175,157,0.18)] text-[#ffaf9d] outline outline-1 outline-[rgba(255,175,157,0.35)]'
                : 'text-[#b1a7d0] hover:text-[#ffeccd] hover:bg-[rgba(177,167,208,0.10)]'
            }`}>
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
        <div className="flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#b1a7d0]">{inRoster.length} en campo</span>
              {saving && <CircleNotch size={12} className="animate-spin text-[#b1a7d0]" />}
            </div>
            {isPrivileged && (
              <Button variant="ghost" size="sm" radius="round" disabled={copying} onClick={handleCopyPrevious}>
                {copying ? <CircleNotch size={12} className="animate-spin" /> : <Copy size={12} />}
                Copiar anterior
              </Button>
            )}
          </div>

          {/* Field */}
          {(isPrivileged || roster) ? (
            <RosterField
              roster={roster}
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
              <p className="text-[#b1a7d0]">El roster aún no ha sido publicado.</p>
            </SurfaceCard>
          )}

        </div>
      )}
    </div>
  )
}
