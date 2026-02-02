import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { calendarAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
}

const STATUS_CONFIG = {
  confirmed: {
    icon: 'fa-check-circle',
    color: 'text-green-400',
    bg: 'bg-green-500',
    bgHover: 'hover:bg-green-600',
    border: 'border-green-500'
  },
  declined: {
    icon: 'fa-times-circle',
    color: 'text-red-400',
    bg: 'bg-red-500',
    bgHover: 'hover:bg-red-600',
    border: 'border-red-500'
  },
  tentative: {
    icon: 'fa-question-circle',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500',
    bgHover: 'hover:bg-yellow-600',
    border: 'border-yellow-500'
  }
}

const CalendarTab = () => {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [expandedDate, setExpandedDate] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [notes, setNotes] = useState({})
  const [notification, setNotification] = useState(null)
  const [adminView, setAdminView] = useState(false)
  const [overview, setOverview] = useState(null)

  const isAdmin = user?.role === 'admin' || user?.role === 'officer'

  useEffect(() => {
    loadSignups()
  }, [])

  useEffect(() => {
    if (adminView && isAdmin) {
      loadOverview()
    }
  }, [adminView])

  const loadSignups = async () => {
    try {
      setLoading(true)
      const response = await calendarAPI.getMySignups(2)
      setSignups(response.data.dates || [])

      // Initialize notes from existing signups
      const notesMap = {}
      for (const signup of response.data.dates || []) {
        if (signup.notes) {
          notesMap[signup.date] = signup.notes
        }
      }
      setNotes(notesMap)
    } catch (error) {
      console.error('Error loading signups:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOverview = async () => {
    try {
      const response = await calendarAPI.getOverview(2)
      setOverview(response.data)
    } catch (error) {
      console.error('Error loading overview:', error)
    }
  }

  const loadSummary = async (date) => {
    if (expandedDate === date) {
      setExpandedDate(null)
      setSummary(null)
      return
    }

    try {
      setLoadingSummary(true)
      setExpandedDate(date)
      const response = await calendarAPI.getSummary(date)
      setSummary(response.data)
    } catch (error) {
      console.error('Error loading summary:', error)
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleStatusChange = async (date, status) => {
    try {
      setSaving(date)
      const noteText = notes[date] || null
      const response = await calendarAPI.signup(date, status, noteText)

      // Update local state
      setSignups(prev => prev.map(s =>
        s.date === date
          ? { ...s, status, notes: noteText, dkpAwarded: response.data.dkpAwarded }
          : s
      ))

      // Show notification for first signup DKP bonus
      if (response.data.isFirstSignup && response.data.dkpAwarded > 0) {
        setNotification({
          type: 'success',
          message: t('first_signup_bonus').replace('{dkp}', response.data.dkpAwarded)
        })
        setTimeout(() => setNotification(null), 4000)
      }

      // Refresh summary if viewing
      if (expandedDate === date) {
        loadSummary(date)
      }
    } catch (error) {
      console.error('Error saving status:', error)
      setNotification({
        type: 'error',
        message: t('error_generic')
      })
      setTimeout(() => setNotification(null), 4000)
    } finally {
      setSaving(null)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const isToday = date.getTime() === today.getTime()

    const dayName = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })
    const dayNum = date.getDate()
    const month = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' })

    return {
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
      dayNum,
      month,
      isToday
    }
  }

  // Group signups by week
  const groupedSignups = signups.reduce((acc, signup) => {
    const date = new Date(signup.date + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const daysDiff = Math.floor((date - today) / (1000 * 60 * 60 * 24))
    const weekNum = daysDiff < 7 ? 0 : 1

    if (!acc[weekNum]) acc[weekNum] = []
    acc[weekNum].push(signup)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-circle-notch fa-spin text-4xl text-midnight-glow"></i>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-midnight-purple to-midnight-bright-purple flex items-center justify-center">
            <i className="fas fa-calendar-alt text-2xl text-white"></i>
          </div>
          <div>
            <h2 className="text-2xl font-cinzel font-bold text-white">{t('raid_calendar')}</h2>
            <p className="text-midnight-silver">{t('raid_signup')}</p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setAdminView(!adminView)}
            className={`px-4 py-2 rounded-lg transition-all ${
              adminView
                ? 'bg-midnight-glow text-midnight-deepblue'
                : 'bg-midnight-purple bg-opacity-30 text-white hover:bg-opacity-50'
            }`}
          >
            <i className={`fas ${adminView ? 'fa-user' : 'fa-users-cog'} mr-2`}></i>
            {adminView ? t('my_character') : t('admin')}
          </button>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center gap-3 animate-fade-in ${
          notification.type === 'success'
            ? 'bg-green-500 bg-opacity-20 border border-green-500 text-green-400'
            : 'bg-red-500 bg-opacity-20 border border-red-500 text-red-400'
        }`}>
          <i className={`fas ${notification.type === 'success' ? 'fa-coins' : 'fa-exclamation-circle'} text-xl`}></i>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Admin Overview */}
      {adminView && isAdmin && overview ? (
        <AdminOverview overview={overview} t={t} language={language} />
      ) : (
        <>
          {/* User Calendar View */}
          {Object.entries(groupedSignups).map(([weekNum, weekSignups]) => (
            <div key={weekNum} className="space-y-4">
              <h3 className="text-lg font-cinzel text-midnight-glow flex items-center gap-2">
                <i className="fas fa-calendar-week"></i>
                {weekNum === '0' ? t('this_week') : t('next_week')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {weekSignups.map((signup) => {
                  const dateInfo = formatDate(signup.date)
                  const currentStatus = signup.status
                  const isSaving = saving === signup.date

                  return (
                    <div
                      key={signup.date}
                      className={`bg-midnight-purple bg-opacity-20 rounded-xl border-2 overflow-hidden transition-all ${
                        dateInfo.isToday
                          ? 'border-midnight-glow shadow-lg shadow-midnight-glow/20'
                          : 'border-midnight-bright-purple border-opacity-30'
                      }`}
                    >
                      {/* Date Header */}
                      <div className={`px-4 py-3 ${dateInfo.isToday ? 'bg-midnight-glow bg-opacity-20' : 'bg-midnight-purple bg-opacity-30'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-white">{dateInfo.dayNum}</div>
                              <div className="text-xs text-midnight-silver uppercase">{dateInfo.month}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">{dateInfo.dayName}</div>
                              <div className="text-sm text-midnight-silver">
                                {signup.raidTime || '20:00'}
                                {dateInfo.isToday && (
                                  <span className="ml-2 px-2 py-0.5 bg-midnight-glow text-midnight-deepblue text-xs rounded-full font-bold">
                                    {t('today')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {signup.dkpAwarded > 0 && (
                            <div className="flex items-center gap-1 text-yellow-400 text-sm">
                              <i className="fas fa-coins"></i>
                              <span>+{signup.dkpAwarded}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Selection */}
                      <div className="p-4 space-y-4">
                        {/* Current Status Display */}
                        {currentStatus && (
                          <div className={`flex items-center gap-2 text-sm ${STATUS_CONFIG[currentStatus]?.color}`}>
                            <i className={`fas ${STATUS_CONFIG[currentStatus]?.icon}`}></i>
                            <span>{t('your_status')}: <strong>{t(currentStatus)}</strong></span>
                          </div>
                        )}

                        {/* Status Buttons */}
                        <div className="flex gap-2">
                          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(signup.date, status)}
                              disabled={isSaving}
                              className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
                                currentStatus === status
                                  ? `${config.bg} text-white`
                                  : `bg-midnight-purple bg-opacity-30 ${config.color} ${config.bgHover} hover:text-white`
                              } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isSaving && saving === signup.date ? (
                                <i className="fas fa-circle-notch fa-spin"></i>
                              ) : (
                                <i className={`fas ${config.icon}`}></i>
                              )}
                              <span className="hidden sm:inline text-sm">{t(status)}</span>
                            </button>
                          ))}
                        </div>

                        {/* Note Input (for tentative) */}
                        {currentStatus === 'tentative' && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={notes[signup.date] || ''}
                              onChange={(e) => setNotes(prev => ({ ...prev, [signup.date]: e.target.value }))}
                              placeholder={t('note_placeholder')}
                              className="w-full px-3 py-2 bg-midnight-deepblue border border-midnight-bright-purple rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                            />
                            {notes[signup.date] !== signup.notes && (
                              <button
                                onClick={() => handleStatusChange(signup.date, 'tentative')}
                                disabled={isSaving}
                                className="w-full py-1 px-3 bg-midnight-glow bg-opacity-20 text-midnight-glow text-sm rounded-lg hover:bg-opacity-30 transition-all"
                              >
                                <i className="fas fa-save mr-2"></i>
                                {t('save_status')}
                              </button>
                            )}
                          </div>
                        )}

                        {/* View Summary Button */}
                        <button
                          onClick={() => loadSummary(signup.date)}
                          className="w-full py-2 px-3 bg-midnight-purple bg-opacity-20 text-midnight-silver text-sm rounded-lg hover:bg-opacity-40 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <i className={`fas ${expandedDate === signup.date ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          {t('view_details')}
                        </button>

                        {/* Summary Dropdown */}
                        {expandedDate === signup.date && (
                          <div className="border-t border-midnight-bright-purple border-opacity-30 pt-4 animate-fade-in">
                            {loadingSummary ? (
                              <div className="text-center py-4">
                                <i className="fas fa-circle-notch fa-spin text-midnight-glow"></i>
                              </div>
                            ) : summary ? (
                              <SummaryView summary={summary} t={t} isAdmin={isAdmin} />
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {signups.length === 0 && (
            <div className="text-center py-12 text-midnight-silver">
              <i className="fas fa-calendar-times text-4xl mb-4 opacity-50"></i>
              <p>{t('no_raids_scheduled')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Summary View Component
const SummaryView = ({ summary, t, isAdmin }) => {
  const categories = [
    { key: 'confirmed', icon: 'fa-check-circle', color: 'text-green-400', label: t('members_confirmed') },
    { key: 'tentative', icon: 'fa-question-circle', color: 'text-yellow-400', label: t('members_tentative') },
    { key: 'declined', icon: 'fa-times-circle', color: 'text-red-400', label: t('members_declined') },
    { key: 'noResponse', icon: 'fa-minus-circle', color: 'text-gray-400', label: t('members_no_response') },
  ]

  return (
    <div className="space-y-3">
      {/* Counts */}
      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        {categories.map(cat => (
          <div key={cat.key} className={cat.color}>
            <i className={`fas ${cat.icon} text-lg`}></i>
            <div className="font-bold">{summary.counts[cat.key]}</div>
          </div>
        ))}
      </div>

      {/* Member Lists */}
      <div className="space-y-2">
        {categories.map(cat => (
          summary[cat.key]?.length > 0 && (
            <div key={cat.key} className="text-xs">
              <div className={`${cat.color} font-semibold mb-1`}>{cat.label}:</div>
              <div className="flex flex-wrap gap-1">
                {summary[cat.key].map(member => (
                  <span
                    key={member.id}
                    className="px-2 py-0.5 rounded bg-midnight-deepblue"
                    style={{ color: CLASS_COLORS[member.characterClass] || '#fff' }}
                    title={member.notes && isAdmin ? `Nota: ${member.notes}` : member.characterName}
                  >
                    {member.characterName}
                    {member.notes && isAdmin && <i className="fas fa-sticky-note ml-1 text-yellow-400"></i>}
                  </span>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

// Admin Overview Component
const AdminOverview = ({ overview, t, language }) => {
  const [expandedMember, setExpandedMember] = useState(null)

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    const dayName = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' })
    const dayNum = date.getDate()
    return `${dayName} ${dayNum}`
  }

  return (
    <div className="space-y-6">
      {/* Date Headers with Counts */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header Row */}
          <div className="flex bg-midnight-purple bg-opacity-30 rounded-t-lg">
            <div className="w-48 px-4 py-3 font-semibold text-white border-r border-midnight-bright-purple border-opacity-30">
              {t('character')}
            </div>
            {overview.dates.map(date => (
              <div key={date.date} className="flex-1 px-2 py-3 text-center border-r border-midnight-bright-purple border-opacity-30 last:border-r-0">
                <div className="font-semibold text-white text-sm">{formatDateShort(date.date)}</div>
                <div className="flex justify-center gap-2 mt-1 text-xs">
                  <span className="text-green-400" title={t('confirmed')}>{date.counts.confirmed}</span>
                  <span className="text-yellow-400" title={t('tentative')}>{date.counts.tentative}</span>
                  <span className="text-red-400" title={t('declined')}>{date.counts.declined}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Member Rows */}
          <div className="max-h-[500px] overflow-y-auto">
            {overview.members.map((member, idx) => (
              <div
                key={member.id}
                className={`flex ${idx % 2 === 0 ? 'bg-midnight-purple bg-opacity-10' : ''} hover:bg-midnight-purple hover:bg-opacity-20 transition-all`}
              >
                <div
                  className="w-48 px-4 py-2 border-r border-midnight-bright-purple border-opacity-20 flex items-center gap-2 cursor-pointer"
                  onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                  style={{ color: CLASS_COLORS[member.characterClass] || '#fff' }}
                >
                  <span className="truncate">{member.characterName}</span>
                  <span className="text-xs text-midnight-silver">({member.raidRole})</span>
                </div>
                {overview.dates.map(date => {
                  const signup = member.signups[date.date]
                  const status = signup?.status
                  const config = status ? STATUS_CONFIG[status] : null

                  return (
                    <div
                      key={date.date}
                      className="flex-1 px-2 py-2 text-center border-r border-midnight-bright-purple border-opacity-20 last:border-r-0 flex items-center justify-center"
                    >
                      {status ? (
                        <div className="flex items-center gap-1">
                          <i className={`fas ${config.icon} ${config.color}`}></i>
                          {signup.notes && (
                            <i
                              className="fas fa-sticky-note text-yellow-400 text-xs cursor-help"
                              title={signup.notes}
                            ></i>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 text-sm">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className={`flex items-center gap-2 ${config.color}`}>
            <i className={`fas ${config.icon}`}></i>
            <span>{t(status)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-yellow-400">
          <i className="fas fa-sticky-note"></i>
          <span>{t('admin_notes')}</span>
        </div>
      </div>
    </div>
  )
}

export default CalendarTab
