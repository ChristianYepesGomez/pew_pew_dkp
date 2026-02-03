import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { calendarAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
  DeathKnight: '#C41F3B', DemonHunter: '#A330C9', Monk: '#00FF96', Evoker: '#33937F',
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

  const openSummary = async (date) => {
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

  const closeSummary = () => {
    setExpandedDate(null)
    setSummary(null)
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
        openSummary(date)
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
                  const isLocked = signup.isLocked

                  return (
                    <div
                      key={signup.date}
                      className={`bg-midnight-purple bg-opacity-20 rounded-xl border-2 overflow-hidden transition-all ${
                        isLocked
                          ? 'border-red-500 border-opacity-30 opacity-75'
                          : dateInfo.isToday
                            ? 'border-midnight-glow shadow-lg shadow-midnight-glow/20'
                            : 'border-midnight-bright-purple border-opacity-30'
                      }`}
                    >
                      {/* Date Header */}
                      <div className={`px-4 py-3 ${isLocked ? 'bg-red-900 bg-opacity-20' : dateInfo.isToday ? 'bg-midnight-glow bg-opacity-20' : 'bg-midnight-purple bg-opacity-30'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-white">{dateInfo.dayNum}</div>
                              <div className="text-xs text-midnight-silver uppercase">{dateInfo.month}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">{dateInfo.dayName}</div>
                              <div className="text-sm text-midnight-silver">
                                {signup.raidTime || '21:00'}
                                {dateInfo.isToday && !isLocked && (
                                  <span className="ml-2 px-2 py-0.5 bg-midnight-glow text-midnight-deepblue text-xs rounded-full font-bold">
                                    {t('today')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {signup.dkpAwarded > 0 && (
                              <div className="flex items-center gap-1 text-yellow-400 text-sm">
                                <i className="fas fa-coins"></i>
                                <span>+{signup.dkpAwarded}</span>
                              </div>
                            )}
                            {isLocked && (
                              <div className="flex items-center gap-1 text-red-400 text-sm">
                                <i className="fas fa-lock"></i>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Selection */}
                      <div className="p-4 space-y-4">
                        {/* Locked message */}
                        {isLocked ? (
                          <>
                            {currentStatus ? (
                              <div className={`flex items-center gap-2 text-sm ${STATUS_CONFIG[currentStatus]?.color}`}>
                                <i className={`fas ${STATUS_CONFIG[currentStatus]?.icon}`}></i>
                                <span>{t('your_status')}: <strong>{t(currentStatus)}</strong></span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-red-400">
                                <i className="fas fa-times-circle"></i>
                                <span>{t('no_signup')}</span>
                              </div>
                            )}
                            <div className="bg-red-900 bg-opacity-20 border border-red-500 border-opacity-30 rounded-lg p-3 text-center">
                              <i className="fas fa-lock mr-2 text-red-400"></i>
                              <span className="text-red-300 text-sm">{t('signup_locked')}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Deadline info */}
                            {signup.cutoffTime && (
                              <div className="flex items-center gap-2 text-xs text-midnight-silver">
                                <i className="fas fa-clock"></i>
                                <span>{t('signup_deadline')}: {signup.cutoffTime}</span>
                              </div>
                            )}

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
                          </>
                        )}

                        {/* View Summary Button */}
                        <button
                          onClick={() => openSummary(signup.date)}
                          className="w-full py-2 px-3 bg-midnight-purple bg-opacity-20 text-midnight-silver text-sm rounded-lg hover:bg-opacity-40 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <i className="fas fa-users"></i>
                          {t('view_details')}
                        </button>
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
      {/* Summary Modal */}
      {expandedDate && (
        <SummaryModal
          date={expandedDate}
          summary={summary}
          loadingSummary={loadingSummary}
          onClose={closeSummary}
          t={t}
          language={language}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

// Status icon/color config for member entries
const MEMBER_STATUS = {
  confirmed: { icon: 'fa-check-circle', color: 'text-green-400', opacity: '' },
  tentative: { icon: 'fa-question-circle', color: 'text-yellow-400', opacity: '' },
  declined: { icon: 'fa-times-circle', color: 'text-red-400', opacity: 'opacity-40' },
  noResponse: { icon: 'fa-minus-circle', color: 'text-gray-500', opacity: 'opacity-30' },
}

// Mythic raid composition requirements
const MYTHIC_SIZE = 20
const ROLE_CONFIG = {
  Tank:   { icon: 'fa-shield-alt', color: 'text-blue-400', bgBorder: 'border-blue-500', min: 2, max: 2 },
  Healer: { icon: 'fa-heart',      color: 'text-green-400', bgBorder: 'border-green-500', min: 3, max: 5 },
  DPS:    { icon: 'fa-crosshairs',  color: 'text-red-400',   bgBorder: 'border-red-500',   min: 13, max: 15 },
}

// Single member entry in the roster
const MemberEntry = ({ member, statusKey, isAdmin }) => {
  const status = MEMBER_STATUS[statusKey]
  const hasNote = member.notes && isAdmin
  return (
    <div
      className={`flex items-center gap-1.5 py-0.5 ${status.opacity}`}
      title={`${member.characterName} (${member.characterClass}${member.spec ? ' - ' + member.spec : ''})`}
    >
      <i className={`fas ${status.icon} ${status.color} text-[10px] flex-shrink-0`}></i>
      <span
        className="text-xs truncate"
        style={{ color: CLASS_COLORS[member.characterClass] || '#fff' }}
      >
        {member.characterName}
      </span>
      {hasNote && (
        <i
          className="fas fa-comment-dots text-yellow-400 text-[9px] flex-shrink-0 cursor-help"
          title={member.notes}
        ></i>
      )}
    </div>
  )
}

// Role section (Tank, Healer, or DPS column)
const RoleSection = ({ role, members, t, isAdmin, columns = 1 }) => {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.DPS

  // Sort: confirmed first, then tentative, declined, noResponse
  const statusOrder = ['confirmed', 'tentative', 'declined', 'noResponse']
  const allMembers = []
  statusOrder.forEach(statusKey => {
    ;(members[statusKey] || []).forEach(m => allMembers.push({ ...m, statusKey }))
  })

  const confirmedCount = (members.confirmed || []).length
  const tentativeCount = (members.tentative || []).length

  // Requirement check
  const ready = confirmedCount + tentativeCount
  const isFilled = confirmedCount >= config.min
  const couldFill = ready >= config.min
  const reqLabel = config.min === config.max ? `${config.min}` : `${config.min}-${config.max}`
  const countColor = isFilled ? 'text-green-400' : couldFill ? 'text-yellow-400' : 'text-red-400'

  const gridClass = columns === 2
    ? 'grid grid-cols-2 gap-x-4'
    : ''

  return (
    <div className="flex-1 min-w-0">
      {/* Role Header */}
      <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${config.bgBorder} border-opacity-40`}>
        <i className={`fas ${config.icon} ${config.color}`}></i>
        <span className="text-white font-semibold text-sm">{t(role.toLowerCase())}</span>
        <span className="text-xs ml-auto flex items-center gap-1.5">
          <span className={`font-bold ${countColor}`}>{confirmedCount}</span>
          {tentativeCount > 0 && <span className="text-yellow-400">+{tentativeCount}</span>}
          <span className="text-gray-500">/ {reqLabel}</span>
          {isFilled && <i className="fas fa-check text-green-400 text-[9px]"></i>}
        </span>
      </div>
      {/* Members */}
      <div className={gridClass}>
        {allMembers.map(member => (
          <MemberEntry key={member.id} member={member} statusKey={member.statusKey} isAdmin={isAdmin} />
        ))}
        {allMembers.length === 0 && (
          <div className="text-xs text-gray-600 italic py-1">-</div>
        )}
      </div>
    </div>
  )
}

// Summary View Component - Raid Composition
const SummaryView = ({ summary, t, isAdmin }) => {
  // Group all members by role, maintaining status categories
  const byRole = { Tank: {}, Healer: {}, DPS: {} }
  const statusKeys = ['confirmed', 'tentative', 'declined', 'noResponse']

  statusKeys.forEach(statusKey => {
    ;(summary[statusKey] || []).forEach(member => {
      const role = member.raidRole || 'DPS'
      const roleKey = role === 'Tank' ? 'Tank' : role === 'Healer' ? 'Healer' : 'DPS'
      if (!byRole[roleKey][statusKey]) byRole[roleKey][statusKey] = []
      byRole[roleKey][statusKey].push(member)
    })
  })

  // Progress bar based on mythic raid size (20)
  const confirmed = summary.counts.confirmed
  const tentative = summary.counts.tentative
  const pctConfirmed = Math.min((confirmed / MYTHIC_SIZE) * 100, 100)
  const pctTentative = Math.min((tentative / MYTHIC_SIZE) * 100, 100 - pctConfirmed)

  // Bar color based on confirmed count towards 20
  const barColor = confirmed >= MYTHIC_SIZE ? 'bg-green-500' : confirmed >= 15 ? 'bg-yellow-500' : 'bg-red-500'
  const raidReady = confirmed >= MYTHIC_SIZE

  return (
    <div className="space-y-3">
      {/* Mythic Progress */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-white font-semibold flex items-center gap-1.5">
            <i className="fas fa-skull text-midnight-glow text-[10px]"></i>
            Mythic
          </span>
          <span className="text-midnight-silver">
            <span className={`font-bold ${raidReady ? 'text-green-400' : 'text-white'}`}>{confirmed}</span>
            {tentative > 0 && <span className="text-yellow-400"> +{tentative}</span>}
            <span> / {MYTHIC_SIZE}</span>
            {raidReady && <i className="fas fa-check-circle text-green-400 ml-1.5"></i>}
          </span>
        </div>
        <div className="h-2 bg-midnight-deepblue rounded-full overflow-hidden flex">
          <div className={`${barColor} transition-all duration-500`} style={{ width: `${pctConfirmed}%` }}></div>
          <div className="bg-yellow-500 bg-opacity-50 transition-all duration-500" style={{ width: `${pctTentative}%` }}></div>
        </div>
        {/* Slot markers at key thresholds */}
        <div className="relative h-0">
          <div className="absolute top-[-10px] text-[8px] text-gray-600" style={{ left: `${(15/MYTHIC_SIZE)*100}%`, transform: 'translateX(-50%)' }}>15</div>
          <div className="absolute top-[-10px] text-[8px] text-gray-600" style={{ left: '100%', transform: 'translateX(-100%)' }}>20</div>
        </div>
      </div>

      {/* Role Columns */}
      <div className="flex gap-4 mt-4">
        <RoleSection role="Tank" members={byRole.Tank} t={t} isAdmin={isAdmin} />
        <RoleSection role="Healer" members={byRole.Healer} t={t} isAdmin={isAdmin} />
      </div>
      <div>
        <RoleSection role="DPS" members={byRole.DPS} t={t} isAdmin={isAdmin} columns={2} />
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-3 text-[10px] text-midnight-silver pt-1 border-t border-midnight-bright-purple border-opacity-20">
        <span className="flex items-center gap-1"><i className="fas fa-check-circle text-green-400"></i>{t('confirmed')}</span>
        <span className="flex items-center gap-1"><i className="fas fa-question-circle text-yellow-400"></i>{t('tentative')}</span>
        <span className="flex items-center gap-1 opacity-50"><i className="fas fa-times-circle text-red-400"></i>{t('declined')}</span>
        <span className="flex items-center gap-1 opacity-30"><i className="fas fa-minus-circle text-gray-500"></i>{t('members_no_response')}</span>
      </div>
    </div>
  )
}

// Summary Modal Component (rendered via portal)
const SummaryModal = ({ date, summary, loadingSummary, onClose, t, language, isAdmin }) => {
  const dateInfo = (() => {
    const d = new Date(date + 'T00:00:00')
    const dayName = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })
    const dayNum = d.getDate()
    const month = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long' })
    return {
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
      dayNum,
      month: month.charAt(0).toUpperCase() + month.slice(1)
    }
  })()

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-midnight-deepblue border border-midnight-bright-purple border-opacity-40 rounded-2xl shadow-2xl shadow-midnight-glow/10 animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-midnight-purple bg-opacity-30 border-b border-midnight-bright-purple border-opacity-30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-midnight-purple bg-opacity-40 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-white leading-none">{dateInfo.dayNum}</span>
              <span className="text-[10px] text-midnight-silver uppercase">{dateInfo.month}</span>
            </div>
            <div>
              <h3 className="text-lg font-cinzel font-bold text-white">{t('raid_roster')}</h3>
              <p className="text-sm text-midnight-silver">{dateInfo.dayName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-midnight-purple bg-opacity-30 text-midnight-silver hover:text-white hover:bg-opacity-50 transition-all flex items-center justify-center"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loadingSummary ? (
            <div className="text-center py-12">
              <i className="fas fa-circle-notch fa-spin text-3xl text-midnight-glow"></i>
            </div>
          ) : summary ? (
            <SummaryView summary={summary} t={t} isAdmin={isAdmin} />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
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
