import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { calendarAPI, warcraftLogsAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import { CheckCircle, XCircle, Question, MinusCircle, ShieldStar, Heart, Crosshair, CircleNotch, CalendarDots, CalendarX, Users, ClockCounterClockwise, Coins, WarningCircle, Warning, X, Clock, Lock, FloppyDisk, Skull, Check, ChatDots, Note, MagnifyingGlass, ArrowLeft, Link, ArrowSquareOut, Info } from '@phosphor-icons/react'

const WCL_ICON = 'https://assets.rpglogs.com/img/warcraft/favicon.png'

const WclIcon = ({ size = 16, className = '', opacity = '' }) => (
  <img src={WCL_ICON} alt="WCL" width={size} height={size} className={`inline-block ${opacity} ${className}`} style={{ imageRendering: 'auto' }} />
)

const STATUS_CONFIG = {
  confirmed: {
    Icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500',
    bgHover: 'hover:bg-green-600',
    border: 'border-green-500'
  },
  declined: {
    Icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500',
    bgHover: 'hover:bg-red-600',
    border: 'border-red-500'
  },
  tentative: {
    Icon: Question,
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
  const [wclModal, setWclModal] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [raidHistory, setRaidHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [inlineAttendance, setInlineAttendance] = useState({}) // For full-size card inline display
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [cutoffBannerDismissed, setCutoffBannerDismissed] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'officer'

  // Get current raid week key (Thursday-based reset, matching backend convention)
  const getCurrentRaidWeek = () => {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 4=Thu
    const daysToLastThursday = (dayOfWeek + 3) % 7 // Days since last Thursday
    const lastThursday = new Date(now)
    lastThursday.setDate(now.getDate() - daysToLastThursday)
    lastThursday.setHours(0, 0, 0, 0)
    return lastThursday.toISOString().split('T')[0]
  }

  // Check if banner was dismissed this week
  useEffect(() => {
    const raidWeek = getCurrentRaidWeek()
    const dismissedWeek = localStorage.getItem('unconfirmed_banner_dismissed')
    if (dismissedWeek === raidWeek) {
      setBannerDismissed(true)
    }
    // Check if cutoff banner was dismissed permanently
    if (localStorage.getItem('cutoff_banner_dismissed') === 'true') {
      setCutoffBannerDismissed(true)
    }
  }, [])

  const dismissBanner = (e) => {
    e.stopPropagation()
    const raidWeek = getCurrentRaidWeek()
    localStorage.setItem('unconfirmed_banner_dismissed', raidWeek)
    setBannerDismissed(true)
  }

  const dismissCutoffBanner = (e) => {
    e.stopPropagation()
    localStorage.setItem('cutoff_banner_dismissed', 'true')
    setCutoffBannerDismissed(true)
  }

  useEffect(() => {
    loadSignups()
  }, [])

  useEffect(() => {
    if (adminView) {
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

  const loadRaidHistory = async () => {
    try {
      setLoadingHistory(true)
      const response = await calendarAPI.getHistory(8)
      setRaidHistory(response.data || [])
    } catch (error) {
      console.error('Error loading raid history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (showHistory && raidHistory.length === 0) {
      loadRaidHistory()
    }
  }, [showHistory])

  // Auto-load attendance for full-size cards (single day in week)
  useEffect(() => {
    const loadInlineAttendance = async () => {
      // Find weeks with only 1 day (full-size cards)
      for (const [weekKey, weekSignups] of groupedSignups) {
        if (weekSignups.length === 1) {
          const date = weekSignups[0].date
          if (!inlineAttendance[date]) {
            try {
              const response = await calendarAPI.getSummary(date)
              setInlineAttendance(prev => ({ ...prev, [date]: response.data }))
            } catch (error) {
              console.error('Error loading inline attendance:', error)
            }
          }
        }
      }
    }
    if (!loading && signups.length > 0) {
      loadInlineAttendance()
    }
  }, [signups, loading])

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

  // Group signups by raid week: Mon → Wed → Thu (week ENDS on Thursday)
  // Only show 2 raid weeks maximum
  const groupedSignups = (() => {
    // Sort all signups by date first
    const sortedSignups = [...signups].sort((a, b) => a.date.localeCompare(b.date))

    // Helper: get the Thursday that ends this raid week
    const getRaidWeekEndThursday = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00')
      const dayOfWeek = d.getDay() // 0=Sun, 1=Mon, 3=Wed, 4=Thu
      const thursdayDate = new Date(d)

      if (dayOfWeek === 1) {
        // Monday -> Thursday is +3 days
        thursdayDate.setDate(thursdayDate.getDate() + 3)
      } else if (dayOfWeek === 3) {
        // Wednesday -> Thursday is +1 day
        thursdayDate.setDate(thursdayDate.getDate() + 1)
      }
      // Thursday (4) stays as-is

      return thursdayDate.toISOString().split('T')[0]
    }

    // Group by raid week (keyed by the Thursday that ends the week)
    const weekMap = new Map()
    for (const signup of sortedSignups) {
      const weekKey = getRaidWeekEndThursday(signup.date)
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, [])
      }
      weekMap.get(weekKey).push(signup)
    }

    // Convert to array, sorted by week key, limit to 2 weeks
    const weeks = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 2)

    return weeks
  })()

  // Count unconfirmed days from DISPLAYED signups only (not all signups)
  // Also exclude past days even if not marked as locked
  const unconfirmedCount = (() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return groupedSignups.reduce((count, [, weekSignups]) => {
      return count + weekSignups.filter(s => {
        const signupDate = new Date(s.date + 'T00:00:00')
        const isPast = signupDate < today
        return !s.status && !s.isLocked && !isPast
      }).length
    }, 0)
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <CircleNotch size={40} className="animate-spin text-coral" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('raid_calendar')}</h2>
          <p className="text-lavender">{t('raid_signup')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowHistory(!showHistory); setAdminView(false) }}
            className={`px-4 py-2 rounded-lg transition-all ${
              showHistory
                ? 'bg-orange-500/80 text-white'
                : 'bg-lavender-12/30 text-white hover:bg-lavender-12/50'
            }`}
          >
            <ClockCounterClockwise size={16} className="inline mr-2" />
            {t('raid_history')}
          </button>
          <button
            onClick={() => { setAdminView(!adminView); setShowHistory(false) }}
            className={`px-4 py-2 rounded-lg transition-all ${
              adminView
                ? 'bg-coral text-indigo'
                : 'bg-lavender-12/30 text-white hover:bg-lavender-12/50'
            }`}
          >
            {adminView ? <CalendarDots size={16} className="inline mr-2" /> : <Users size={16} className="inline mr-2" />}
            {adminView ? t('raid_calendar') : t('team_overview')}
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center gap-3 animate-fade-in ${
          notification.type === 'success'
            ? 'bg-green-500/20 border border-green-500 text-green-400'
            : 'bg-red-500/20 border border-red-500 text-red-400'
        }`}>
          {notification.type === 'success' ? <Coins size={20} /> : <WarningCircle size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Team Overview */}
      {adminView && overview ? (
        <AdminOverview overview={overview} t={t} language={language} isAdmin={isAdmin} />
      ) : showHistory ? (
        <RaidHistory history={raidHistory} loading={loadingHistory} t={t} language={language} isAdmin={isAdmin} onLinkWcl={setWclModal} />
      ) : (
        <>
          {/* Unconfirmed days alert */}
          {unconfirmedCount > 0 && !bannerDismissed && (
            <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/15 border border-orange-500/40 rounded-xl text-sm animate-pulse-subtle">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Warning size={16} className="text-orange-400" />
              </div>
              <span className="flex-1 text-orange-200 font-medium">
                {t('unconfirmed_days_alert').replace('{count}', unconfirmedCount)}
              </span>
              <button
                onClick={dismissBanner}
                className="text-orange-400 hover:text-orange-200 transition-colors p-1"
                title={t('dismiss')}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Signup cutoff info banner */}
          {!cutoffBannerDismissed && (
            <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm">
              <Clock size={16} className="text-yellow-400 flex-shrink-0" />
              <span className="flex-1 text-yellow-200">{t('signup_cutoff_info')}</span>
              <button
                onClick={dismissCutoffBanner}
                className="text-yellow-400 hover:text-yellow-200 transition-colors p-1"
                title={t('dismiss')}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* User Calendar View */}
          {groupedSignups.map(([weekKey, weekSignups], weekIdx) => {
            const firstDate = new Date(weekSignups[0].date + 'T00:00:00')
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Check if this group contains today
            const hasToday = weekSignups.some(s => {
              const d = new Date(s.date + 'T00:00:00')
              return d.getTime() === today.getTime()
            })

            // Simple label: first group with today = "Esta Semana", next = "Próxima Semana", etc.
            const fmtShort = (d) => d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })
            let weekLabel
            if (hasToday) {
              weekLabel = t('this_week')
            } else if (weekIdx === 0 || weekIdx === 1) {
              // If first group doesn't have today, still call it "this week" or "next week"
              weekLabel = weekIdx === 0 ? t('this_week') : t('next_week')
            } else {
              const lastDate = new Date(weekSignups[weekSignups.length - 1].date + 'T00:00:00')
              weekLabel = `${fmtShort(firstDate)} - ${fmtShort(lastDate)}`
            }

            // Adaptive grid: 1 day = full, 2 = half, 3 = thirds
            const count = weekSignups.length
            const gridClass = count === 1
              ? 'grid grid-cols-1 gap-4'
              : count === 2
                ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'

            return (
            <div key={weekKey} className="space-y-4">
              <h3 className="text-lg text-coral flex items-center gap-2">
                <CalendarDots size={18} />
                {weekLabel}
              </h3>

              <div className={gridClass}>
                {weekSignups.map((signup) => {
                  const dateInfo = formatDate(signup.date)
                  const currentStatus = signup.status
                  const isSaving = saving === signup.date
                  const isLocked = signup.isLocked
                  // Adaptive card size: full (1 day), medium (2 days), compact (3 days)
                  const cardSize = count === 1 ? 'full' : count === 2 ? 'medium' : 'compact'

                  // Get inline attendance for full cards
                  const attendance = cardSize === 'full' ? inlineAttendance[signup.date] : null

                  return (
                    <div
                      key={signup.date}
                      onClick={cardSize === 'compact' ? () => openSummary(signup.date) : undefined}
                      className={`bg-lavender-12/20 rounded-xl border-2 overflow-hidden transition-all ${
                        cardSize === 'compact' ? 'cursor-pointer hover:bg-lavender-12/30' : ''
                      } ${
                        isLocked
                          ? 'border-red-500/30 opacity-75'
                          : dateInfo.isToday
                            ? 'border-coral shadow-lg shadow-coral/20'
                            : 'border-lavender-20/30'
                      }`}
                    >
                      {/* Date Header */}
                      <div className={`${cardSize === 'full' ? 'px-6 py-5' : cardSize === 'medium' ? 'px-5 py-4' : 'px-4 py-3'} ${isLocked ? 'bg-red-900/20' : dateInfo.isToday ? 'bg-coral/20' : 'bg-lavender-12/30'}`}>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center ${cardSize === 'full' ? 'gap-5' : cardSize === 'medium' ? 'gap-4' : 'gap-3'}`}>
                            <div className="text-center">
                              <div className={`${cardSize === 'full' ? 'text-4xl' : cardSize === 'medium' ? 'text-3xl' : 'text-2xl'} font-bold text-white`}>{dateInfo.dayNum}</div>
                              <div className={`${cardSize === 'full' ? 'text-sm' : 'text-xs'} text-lavender uppercase`}>{dateInfo.month}</div>
                            </div>
                            <div>
                              <div className={`font-semibold text-white ${cardSize === 'full' ? 'text-xl' : cardSize === 'medium' ? 'text-lg' : ''}`}>{dateInfo.dayName}</div>
                              <div className={`${cardSize === 'full' ? 'text-base' : 'text-sm'} text-lavender`}>
                                {signup.raidTime || '21:00'}
                                {dateInfo.isToday && !isLocked && (
                                  <span className="ml-2 px-2 py-0.5 bg-coral text-indigo text-xs rounded-full font-bold">
                                    {t('today')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* DKP Bonus indicator: show when NOT yet awarded (incentive), hide when received */}
                            {!isLocked && !signup.dkpAwarded && (
                              <div className="flex items-center gap-1 text-yellow-400 text-sm opacity-60 animate-pulse" title={t('signup_dkp_hint')}>
                                <Coins size={14} />
                                <span>+1</span>
                              </div>
                            )}
                            {isLocked && (
                              <div className="flex items-center gap-1 text-red-400 text-sm">
                                <Lock size={14} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Body - Different layout for full vs compact/medium */}
                      {cardSize === 'full' ? (
                        /* FULL CARD: Two-column layout with inline attendance */
                        <div className="p-5 flex flex-col lg:flex-row gap-5">
                          {/* Left: Status controls */}
                          <div className="flex-1 space-y-4">
                            {isLocked ? (
                              <>
                                {currentStatus ? (
                                  <div className={`flex items-center gap-2 text-base ${STATUS_CONFIG[currentStatus]?.color}`}>
                                    {(() => { const Ic = STATUS_CONFIG[currentStatus]?.Icon; return Ic ? <Ic size={18} /> : null })()}
                                    <span>{t('your_status')}: <strong>{t(currentStatus)}</strong></span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-base text-red-400">
                                    <XCircle size={18} />
                                    <span>{t('no_signup')}</span>
                                  </div>
                                )}
                                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
                                  <Lock size={16} className="inline mr-2 text-red-400" />
                                  <span className="text-red-300 text-sm">{t('signup_locked')}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                {currentStatus && (
                                  <div className={`flex items-center gap-2 text-base ${STATUS_CONFIG[currentStatus]?.color}`}>
                                    {(() => { const Ic = STATUS_CONFIG[currentStatus]?.Icon; return Ic ? <Ic size={18} /> : null })()}
                                    <span>{t('your_status')}: <strong>{t(currentStatus)}</strong></span>
                                  </div>
                                )}
                                <div className="flex gap-3">
                                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                                    <button
                                      key={status}
                                      onClick={() => handleStatusChange(signup.date, status)}
                                      disabled={isSaving}
                                      className={`flex-1 py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 ${
                                        currentStatus === status
                                          ? `${config.bg} text-white`
                                          : `bg-lavender-12/30 ${config.color} ${config.bgHover} hover:text-white`
                                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      {isSaving && saving === signup.date ? (
                                        <CircleNotch size={18} className="animate-spin" />
                                      ) : (
                                        <config.Icon size={20} />
                                      )}
                                      <span>{t(status)}</span>
                                    </button>
                                  ))}
                                </div>
                                {currentStatus === 'tentative' && (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={notes[signup.date] || ''}
                                      onChange={(e) => setNotes(prev => ({ ...prev, [signup.date]: e.target.value }))}
                                      placeholder={t('note_placeholder')}
                                      className="w-full px-3 py-2 bg-indigo border border-lavender-20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-coral"
                                    />
                                    {notes[signup.date] !== signup.notes && (
                                      <button
                                        onClick={() => handleStatusChange(signup.date, 'tentative')}
                                        disabled={isSaving}
                                        className="w-full py-1 px-3 bg-coral/20 text-coral text-sm rounded-lg hover:bg-coral/30 transition-all"
                                      >
                                        <FloppyDisk size={14} className="inline mr-2" />{t('save_status')}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Right: Inline attendance */}
                          <div className="lg:w-80 xl:w-96 bg-lavender-12/10 rounded-xl p-4 border border-lavender-20/20">
                            {attendance ? (
                              <InlineAttendance attendance={attendance} t={t} />
                            ) : (
                              <div className="flex items-center justify-center py-6">
                                <CircleNotch size={18} className="animate-spin text-coral" />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* MEDIUM/COMPACT CARDS: Original layout */
                        <div className={`${cardSize === 'medium' ? 'p-5 space-y-4' : 'p-4 space-y-3'}`}>
                          {isLocked ? (
                            <>
                              {currentStatus ? (
                                <div className={`flex items-center gap-2 text-sm ${STATUS_CONFIG[currentStatus]?.color}`}>
                                  {(() => { const Ic = STATUS_CONFIG[currentStatus]?.Icon; return Ic ? <Ic size={16} /> : null })()}
                                  <span>{t('your_status')}: <strong>{t(currentStatus)}</strong></span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-red-400">
                                  <XCircle size={16} />
                                  <span>{t('no_signup')}</span>
                                </div>
                              )}
                              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
                                <Lock size={14} className="inline mr-2 text-red-400" />
                                <span className="text-red-300 text-sm">{t('signup_locked')}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              {currentStatus && cardSize === 'medium' && (
                                <div className={`flex items-center gap-2 text-sm ${STATUS_CONFIG[currentStatus]?.color}`}>
                                  {(() => { const Ic = STATUS_CONFIG[currentStatus]?.Icon; return Ic ? <Ic size={16} /> : null })()}
                                  <span>{t('your_status')}: <strong>{t(currentStatus)}</strong></span>
                                </div>
                              )}
                              <div className={`flex ${cardSize === 'medium' ? 'gap-3' : 'gap-2'}`}>
                                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                                  <button
                                    key={status}
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(signup.date, status) }}
                                    disabled={isSaving}
                                    className={`flex-1 ${cardSize === 'medium' ? 'py-3 px-3' : 'py-2 px-2'} rounded-lg transition-all flex items-center justify-center gap-2 ${
                                      currentStatus === status
                                        ? `${config.bg} text-white`
                                        : `bg-lavender-12/30 ${config.color} ${config.bgHover} hover:text-white`
                                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {isSaving && saving === signup.date ? (
                                      <CircleNotch size={16} className="animate-spin" />
                                    ) : (
                                      <config.Icon size={cardSize === 'medium' ? 20 : 16} />
                                    )}
                                    <span className={cardSize === 'medium' ? 'inline text-sm' : 'hidden sm:inline text-xs'}>{t(status)}</span>
                                  </button>
                                ))}
                              </div>
                              {currentStatus === 'tentative' && cardSize === 'medium' && (
                                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={notes[signup.date] || ''}
                                    onChange={(e) => setNotes(prev => ({ ...prev, [signup.date]: e.target.value }))}
                                    placeholder={t('note_placeholder')}
                                    className="w-full px-3 py-2 bg-indigo border border-lavender-20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-coral"
                                  />
                                  {notes[signup.date] !== signup.notes && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStatusChange(signup.date, 'tentative') }}
                                      disabled={isSaving}
                                      className="w-full py-1 px-3 bg-coral/20 text-coral text-sm rounded-lg hover:bg-coral/30 transition-all"
                                    >
                                      <FloppyDisk size={14} className="inline mr-2" />{t('save_status')}
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          {cardSize === 'medium' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openSummary(signup.date) }}
                              className="w-full py-2 px-3 bg-lavender-12/20 text-lavender text-sm rounded-lg hover:bg-lavender-12/40 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              <Users size={16} />
                              {t('view_details')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })}

          {signups.length === 0 && (
            <div className="text-center py-12 text-lavender">
              <CalendarX size={40} className="mx-auto mb-4 opacity-50" />
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

      {/* WCL Link Modal */}
      {wclModal && (
        <WCLLinkModal
          date={wclModal}
          onClose={() => setWclModal(null)}
          onLinked={() => { setWclModal(null); loadRaidHistory() }}
          t={t}
          language={language}
        />
      )}

    </div>
  )
}

// Status icon/color config for member entries
const MEMBER_STATUS = {
  confirmed: { Icon: CheckCircle, color: 'text-green-400', opacity: '' },
  tentative: { Icon: Question, color: 'text-yellow-400', opacity: '' },
  declined: { Icon: XCircle, color: 'text-red-400', opacity: 'opacity-40' },
  noResponse: { Icon: MinusCircle, color: 'text-gray-500', opacity: 'opacity-30' },
}

// Mythic raid composition requirements
const MYTHIC_SIZE = 20
const ROLE_CONFIG = {
  Tank:   { Icon: ShieldStar, color: 'text-blue-400', bgBorder: 'border-blue-500', min: 2, max: 2 },
  Healer: { Icon: Heart,      color: 'text-green-400', bgBorder: 'border-green-500', min: 3, max: 5 },
  DPS:    { Icon: Crosshair,  color: 'text-red-400',   bgBorder: 'border-red-500',   min: 13, max: 15 },
}

// Inline Attendance for full-size cards
const InlineAttendance = ({ attendance, t }) => {
  // Group by role
  const byRole = { Tank: [], Healer: [], DPS: [] }
  const statusKeys = ['confirmed', 'tentative']

  statusKeys.forEach(statusKey => {
    ;(attendance[statusKey] || []).forEach(member => {
      const role = member.raidRole || 'DPS'
      const roleKey = role === 'Tank' ? 'Tank' : role === 'Healer' ? 'Healer' : 'DPS'
      byRole[roleKey].push({ ...member, statusKey })
    })
  })

  const confirmed = attendance.counts?.confirmed || 0
  const tentative = attendance.counts?.tentative || 0
  const total = confirmed + tentative

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white font-semibold flex items-center gap-1.5">
          <Users size={12} className="text-coral" />
          {t('raid_roster')}
        </span>
        <span className="text-lavender">
          <span className={`font-bold ${confirmed >= MYTHIC_SIZE ? 'text-green-400' : 'text-white'}`}>{confirmed}</span>
          {tentative > 0 && <span className="text-yellow-400"> +{tentative}</span>}
          <span> / {MYTHIC_SIZE}</span>
        </span>
      </div>
      <div className="h-1.5 bg-indigo rounded-full overflow-hidden flex">
        <div className={`${confirmed >= MYTHIC_SIZE ? 'bg-green-500' : confirmed >= 15 ? 'bg-yellow-500' : 'bg-red-500'} transition-all`} style={{ width: `${Math.min((confirmed / MYTHIC_SIZE) * 100, 100)}%` }}></div>
        <div className="bg-yellow-500/50 transition-all" style={{ width: `${Math.min((tentative / MYTHIC_SIZE) * 100, 100 - (confirmed / MYTHIC_SIZE) * 100)}%` }}></div>
      </div>

      {/* Role columns */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        {['Tank', 'Healer', 'DPS'].map(role => {
          const config = ROLE_CONFIG[role]
          const members = byRole[role]
          const confirmedCount = members.filter(m => m.statusKey === 'confirmed').length

          return (
            <div key={role}>
              <div className={`flex items-center gap-1.5 mb-1.5 pb-1 border-b ${config.bgBorder}/40`}>
                <config.Icon size={10} className={config.color} />
                <span className="text-white font-medium">{t(role.toLowerCase())}</span>
                <span className={`ml-auto ${confirmedCount >= config.min ? 'text-green-400' : 'text-red-400'}`}>{confirmedCount}</span>
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {members.slice(0, 8).map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-1"
                    title={member.characterClass}
                  >
                    {member.statusKey === 'confirmed' ? <CheckCircle size={8} className="text-green-400" /> : <Question size={8} className="text-yellow-400" />}
                    <span className="truncate" style={{ color: CLASS_COLORS[member.characterClass] || '#fff' }}>
                      {member.characterName}
                    </span>
                  </div>
                ))}
                {members.length > 8 && (
                  <div className="text-lavender text-xs">+{members.length - 8} {t('more')}</div>
                )}
                {members.length === 0 && (
                  <div className="text-gray-600 italic">-</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
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
      <status.Icon size={10} className={`${status.color} flex-shrink-0`} />
      <span
        className="text-xs truncate"
        style={{ color: CLASS_COLORS[member.characterClass] || '#fff' }}
      >
        {member.characterName}
      </span>
      {hasNote && (
        <span title={member.notes} className="flex-shrink-0 cursor-help">
          <ChatDots size={9} className="text-yellow-400" />
        </span>
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
      <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${config.bgBorder}/40`}>
        <config.Icon size={16} className={config.color} />
        <span className="text-white font-semibold text-sm">{t(role.toLowerCase())}</span>
        <span className="text-xs ml-auto flex items-center gap-1.5">
          <span className={`font-bold ${countColor}`}>{confirmedCount}</span>
          {tentativeCount > 0 && <span className="text-yellow-400">+{tentativeCount}</span>}
          <span className="text-gray-500">/ {reqLabel}</span>
          {isFilled && <Check size={9} className="text-green-400" />}
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
            <Skull size={10} className="text-coral" />
            Mythic
          </span>
          <span className="text-lavender">
            <span className={`font-bold ${raidReady ? 'text-green-400' : 'text-white'}`}>{confirmed}</span>
            {tentative > 0 && <span className="text-yellow-400"> +{tentative}</span>}
            <span> / {MYTHIC_SIZE}</span>
            {raidReady && <CheckCircle size={12} className="text-green-400 inline ml-1.5" />}
          </span>
        </div>
        <div className="h-2 bg-indigo rounded-full overflow-hidden flex">
          <div className={`${barColor} transition-all duration-500`} style={{ width: `${pctConfirmed}%` }}></div>
          <div className="bg-yellow-500/50 transition-all duration-500" style={{ width: `${pctTentative}%` }}></div>
        </div>
        {/* Slot markers at key thresholds */}
        <div className="relative h-0">
          <div className="absolute top-[-10px] text-xs text-gray-600" style={{ left: `${(15/MYTHIC_SIZE)*100}%`, transform: 'translateX(-50%)' }}>15</div>
          <div className="absolute top-[-10px] text-xs text-gray-600" style={{ left: '100%', transform: 'translateX(-100%)' }}>20</div>
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
      <div className="flex justify-center gap-3 text-xs text-lavender pt-1 border-t border-lavender-20/20">
        <span className="flex items-center gap-1"><CheckCircle size={10} className="text-green-400" />{t('confirmed')}</span>
        <span className="flex items-center gap-1"><Question size={10} className="text-yellow-400" />{t('tentative')}</span>
        <span className="flex items-center gap-1 opacity-50"><XCircle size={10} className="text-red-400" />{t('declined')}</span>
        <span className="flex items-center gap-1 opacity-30"><MinusCircle size={10} className="text-gray-500" />{t('members_no_response')}</span>
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-indigo border border-lavender-20/40 rounded-2xl shadow-2xl shadow-coral/10 animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-lavender-12/30 border-b border-lavender-20/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-lavender-12/40 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-white leading-none">{dateInfo.dayNum}</span>
              <span className="text-xs text-lavender uppercase">{dateInfo.month}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t('raid_roster')}</h3>
              <p className="text-sm text-lavender">{dateInfo.dayName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-lavender-12/30 text-lavender hover:text-white hover:bg-lavender-12/50 transition-all flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loadingSummary ? (
            <div className="text-center py-12">
              <CircleNotch size={32} className="animate-spin text-coral mx-auto" />
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
const AdminOverview = ({ overview, t, language, isAdmin }) => {
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
          <div className="flex bg-lavender-12/30 rounded-t-lg">
            <div className="w-48 px-4 py-3 font-semibold text-white border-r border-lavender-20/30">
              {t('character')}
            </div>
            {overview.dates.map(date => (
              <div key={date.date} className="flex-1 px-2 py-3 text-center border-r border-lavender-20/30 last:border-r-0">
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
                className={`flex ${idx % 2 === 0 ? 'bg-lavender-12/10' : ''} hover:bg-lavender-12/20 transition-all`}
              >
                <div
                  className="w-48 px-4 py-2 border-r border-lavender-20/20 flex items-center gap-2 cursor-pointer"
                  onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                  style={{ color: CLASS_COLORS[member.characterClass] || '#fff' }}
                >
                  <span className="truncate">{member.characterName}</span>
                  <span className="text-xs text-lavender">({member.raidRole})</span>
                </div>
                {overview.dates.map(date => {
                  const signup = member.signups[date.date]
                  const status = signup?.status
                  const config = status ? STATUS_CONFIG[status] : null

                  return (
                    <div
                      key={date.date}
                      className="flex-1 px-2 py-2 text-center border-r border-lavender-20/20 last:border-r-0 flex items-center justify-center"
                    >
                      {status ? (
                        <div className="flex items-center gap-1">
                          <config.Icon size={16} className={config.color} />
                          {signup.notes && (
                            <span title={signup.notes}>
                              <Note size={12} className="text-yellow-400 cursor-help" />
                            </span>
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
            <config.Icon size={16} />
            <span>{t(status)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-yellow-400">
          <Note size={16} />
          <span>{t('admin_notes')}</span>
        </div>
      </div>
    </div>
  )
}

// WCL Link Modal - allows admin to link a WCL report to a raid date
const WCLLinkModal = ({ date, onClose, onLinked, t, language }) => {
  const [autoReports, setAutoReports] = useState([])
  const [loadingAuto, setLoadingAuto] = useState(true)
  const [autoError, setAutoError] = useState(null)
  const [manualUrl, setManualUrl] = useState('')
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('select') // 'select' | 'preview'

  const dateInfo = (() => {
    const d = new Date(date + 'T00:00:00')
    const dayName = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })
    const dayNum = d.getDate()
    const month = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long' })
    return { dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1), dayNum, month: month.charAt(0).toUpperCase() + month.slice(1) }
  })()

  // Load auto-detected reports
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingAuto(true)
        const res = await warcraftLogsAPI.guildReports(date)
        setAutoReports(res.data || [])
      } catch (err) {
        const msg = err.response?.data?.error || ''
        if (msg.includes('guild ID')) {
          setAutoError('guild_not_configured')
        } else {
          setAutoError(msg || 'error')
        }
      } finally {
        setLoadingAuto(false)
      }
    }
    load()
  }, [date])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSelectReport = async (code) => {
    try {
      setLoadingPreview(true)
      setError('')
      const res = await warcraftLogsAPI.preview(`https://www.warcraftlogs.com/reports/${code}`)
      setPreview(res.data)
      setStep('preview')
    } catch (err) {
      setError(err.response?.data?.error || t('error_processing_wcl'))
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleManualSubmit = async () => {
    if (!manualUrl.trim()) return
    try {
      setLoadingPreview(true)
      setError('')
      const res = await warcraftLogsAPI.preview(manualUrl.trim())
      setPreview(res.data)
      setStep('preview')
    } catch (err) {
      setError(err.response?.data?.error || t('error_processing_wcl'))
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return
    try {
      setConfirming(true)
      setError('')
      await warcraftLogsAPI.confirm({
        reportCode: preview.report.code,
        reportTitle: preview.report.title,
        startTime: preview.report.startTime,
        endTime: preview.report.endTime,
        region: preview.report.region,
        guildName: preview.report.guildName,
        raidDate: date,
        participants: preview.participants,
        fights: preview.report.fights || []
      })
      onLinked()
    } catch (err) {
      setError(err.response?.data?.error || t('error_processing_wcl'))
    } finally {
      setConfirming(false)
    }
  }

  const matchedCount = preview?.participants?.filter(p => p.matched)?.length || 0
  const totalDkp = preview?.participants?.filter(p => p.matched)?.reduce((sum, p) => sum + (p.dkp_to_assign || 0), 0) || 0

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-indigo border border-lavender-20/40 rounded-2xl shadow-2xl animate-fade-in overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-lavender-12/30 border-b border-lavender-20/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <WclIcon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t('link_wcl_report')}</h3>
              <p className="text-sm text-lavender">{dateInfo.dayName} {dateInfo.dayNum} {dateInfo.month}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-lavender-12/30 text-lavender hover:text-white hover:bg-lavender-12/50 transition-all flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
              <WarningCircle size={14} className="inline mr-2" />{error}
            </div>
          )}

          {step === 'select' ? (
            <>
              {/* Auto-detected reports */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <MagnifyingGlass size={14} className="text-coral" />
                  {t('auto_detected_reports')}
                </h4>
                {loadingAuto ? (
                  <div className="text-center py-6"><CircleNotch size={24} className="animate-spin text-coral mx-auto" /></div>
                ) : autoError === 'guild_not_configured' ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300">
                    <Info size={14} className="inline mr-2" />{t('wcl_guild_not_configured')}
                  </div>
                ) : autoError ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                    <Warning size={14} className="inline mr-2" />{autoError}
                  </div>
                ) : autoReports.length === 0 ? (
                  <div className="text-center py-4 text-lavender text-sm">{t('no_reports_found')}</div>
                ) : (
                  <div className="space-y-2">
                    {autoReports.map(report => (
                      <div key={report.code} className="flex items-center justify-between bg-lavender-12/20 rounded-lg p-3 border border-lavender-20/20">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{report.title}</div>
                          <div className="text-xs text-lavender">{report.zone} &middot; {report.owner}</div>
                        </div>
                        {report.alreadyProcessed ? (
                          <span className="text-xs text-yellow-400 px-2 py-1 bg-yellow-500/10 rounded">{t('report_already_processed')}</span>
                        ) : report.wasReverted ? (
                          <span className="text-xs text-gray-400 px-2 py-1 bg-gray-500/10 rounded">{t('report_was_reverted')}</span>
                        ) : (
                          <button
                            onClick={() => handleSelectReport(report.code)}
                            disabled={loadingPreview}
                            className="ml-3 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm hover:bg-orange-500/30 transition-all flex-shrink-0"
                          >
                            {loadingPreview ? <CircleNotch size={14} className="animate-spin" /> : <><Link size={14} className="inline mr-1" />{t('link_this_report')}</>}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 border-t border-lavender-20/20"></div>
                <span className="text-xs text-lavender">{t('or_enter_url')}</span>
                <div className="flex-1 border-t border-lavender-20/20"></div>
              </div>

              {/* Manual URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://www.warcraftlogs.com/reports/..."
                  className="flex-1 px-3 py-2 bg-lavender-12/30 border border-lavender-20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-coral"
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualUrl.trim() || loadingPreview}
                  className="px-4 py-2 bg-coral/20 text-coral rounded-lg text-sm hover:bg-coral/30 transition-all disabled:opacity-50"
                >
                  {loadingPreview ? <CircleNotch size={14} className="animate-spin" /> : <MagnifyingGlass size={16} />}
                </button>
              </div>
            </>
          ) : (
            /* Preview step */
            <>
              <button onClick={() => { setStep('select'); setPreview(null) }} className="text-sm text-lavender hover:text-white transition-colors">
                <ArrowLeft size={14} className="inline mr-2" />{t('back') || 'Volver'}
              </button>

              {preview && (
                <div className="space-y-4">
                  {/* Report info */}
                  <div className="bg-lavender-12/20 rounded-lg p-4 border border-lavender-20/20">
                    <h4 className="font-bold text-white">{preview.report.title}</h4>
                    <div className="text-sm text-lavender mt-1">
                      {preview.report.bossesKilled}/{preview.report.totalBosses} {t('bosses')} &middot; {preview.report.participantCount} {t('participants')}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex gap-4 justify-around bg-lavender-12/10 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">{matchedCount}</div>
                      <div className="text-xs text-lavender">{t('players_to_receive')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-coral">{totalDkp}</div>
                      <div className="text-xs text-lavender">Total DKP</div>
                    </div>
                  </div>

                  {/* Matched participants list */}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {preview.participants?.filter(p => p.matched).map(p => (
                      <div key={p.user_id} className="flex items-center justify-between text-sm py-1 px-2 bg-lavender-12/10 rounded">
                        <span className="flex items-center gap-2">
                          <span style={{ color: CLASS_COLORS[p.character_class] || '#fff' }}>
                            {p.character_name}
                          </span>
                          {p.is_alt_match && (
                            <span className="text-xs text-yellow-400" title={`Matcheado vía alt: ${p.matched_character}`}>
                              (vía {p.matched_character})
                            </span>
                          )}
                        </span>
                        <span className="text-coral font-bold">+{p.dkp_to_assign} DKP</span>
                      </div>
                    ))}
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleConfirm}
                    disabled={confirming || matchedCount === 0}
                    className="w-full py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirming ? (
                      <><CircleNotch size={18} className="inline animate-spin mr-2" />{t('loading')}...</>
                    ) : (
                      <><Check size={18} className="inline mr-2" />{t('confirm_apply_to')} {matchedCount} {t('players')}</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Raid History Component - shows past raid days with WCL logs
const RaidHistory = ({ history, loading, t, language, isAdmin, onLinkWcl }) => {
  const formatDateFull = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    const dayName = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })
    const dayNum = d.getDate()
    const month = d.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' })
    return { dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1), dayNum, month }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <CircleNotch size={40} className="animate-spin text-coral" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-lavender">
        <CalendarX size={40} className="mx-auto mb-4 opacity-50" />
        <p>{t('no_past_raids')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <ClockCounterClockwise size={18} className="text-coral" />
        <h3 className="text-lg text-white">{t('past_raid_days')}</h3>
      </div>

      <div className="space-y-3">
        {history.map((raid) => {
          const dateInfo = formatDateFull(raid.date)
          const hasLog = !!raid.wclReport

          return (
            <div
              key={raid.date}
              className={`bg-lavender-12/20 rounded-xl border p-4 transition-all ${
                hasLog
                  ? 'border-orange-500/40'
                  : 'border-lavender-20/20'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Date info */}
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[50px]">
                    <div className="text-xl font-bold text-white">{dateInfo.dayNum}</div>
                    <div className="text-xs text-lavender uppercase">{dateInfo.month}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{dateInfo.dayName}</div>
                    <div className="text-sm text-lavender">{raid.raidTime}</div>
                  </div>
                </div>

                {/* Attendance info */}
                {raid.attendance && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-green-400" title={t('confirmed')}>
                      <CheckCircle size={14} className="inline mr-1" />{raid.attendance.confirmed}
                    </span>
                    <span className="text-yellow-400" title={t('tentative')}>
                      <Question size={14} className="inline mr-1" />{raid.attendance.tentative}
                    </span>
                    <span className="text-red-400" title={t('declined')}>
                      <XCircle size={14} className="inline mr-1" />{raid.attendance.declined}
                    </span>
                  </div>
                )}

                {/* WCL Info */}
                <div className="flex items-center gap-3">
                  {hasLog ? (
                    <a
                      href={`https://www.warcraftlogs.com/reports/${raid.wclReport.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 rounded-lg hover:bg-orange-500/30 transition-all"
                    >
                      <WclIcon size={18} />
                      <span className="text-sm font-semibold">{raid.wclReport.title}</span>
                      <span className="text-xs">({raid.wclReport.dkpAssigned} DKP)</span>
                      <ArrowSquareOut size={14} />
                    </a>
                  ) : isAdmin ? (
                    <button
                      onClick={() => onLinkWcl(raid.date)}
                      className="flex items-center gap-2 px-3 py-2 bg-lavender-12/30 rounded-lg hover:bg-lavender-12/50 transition-all text-lavender hover:text-white"
                    >
                      <WclIcon size={16} opacity="opacity-50" />
                      <span className="text-sm">{t('link_wcl_report')}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-lavender opacity-50">
                      <WclIcon size={16} opacity="opacity-30" />
                      <span className="text-sm">{t('no_wcl_report')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CalendarTab
