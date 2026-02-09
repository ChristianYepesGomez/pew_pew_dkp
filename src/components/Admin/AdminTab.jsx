import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI, warcraftLogsAPI, calendarAPI } from '../../services/api'
import { CheckCircle, WarningCircle, Users, CircleNotch, Eye, Check, ClockCounterClockwise, CalendarBlank, Sword, Coins, User, CaretUp, CaretDown, ArrowCounterClockwise, Warning, Bell, ArrowsClockwise, Lightning, ArrowSquareOut, FloppyDisk, CalendarDots, Note } from '@phosphor-icons/react'

const WCL_ICON = 'https://assets.rpglogs.com/img/warcraft/favicon.png'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#3FC7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
  DeathKnight: '#C41F3B', DemonHunter: '#A330C9', Monk: '#00FF96', Evoker: '#33937F',
}

const AdminTab = () => {
  const { t } = useLanguage()
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkReason, setBulkReason] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [notification, setNotification] = useState(null)
  const [wclUrl, setWclUrl] = useState('')
  const [wclPreview, setWclPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [wclHistory, setWclHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedReport, setExpandedReport] = useState(null)
  const [reportTransactions, setReportTransactions] = useState({})
  const [revertConfirm, setRevertConfirm] = useState(null)
  const [reverting, setReverting] = useState(false)
  // Raid days state
  const [raidDays, setRaidDays] = useState([])
  const [raidDaysLoading, setRaidDaysLoading] = useState(true)
  const [raidDaysSaving, setRaidDaysSaving] = useState(false)
  // Pending WCL reports state
  const [pendingReports, setPendingReports] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [pendingUploaderName, setPendingUploaderName] = useState('')

  const DAY_NAMES = {
    1: { es: 'Lunes', en: 'Monday' },
    2: { es: 'Martes', en: 'Tuesday' },
    3: { es: 'Miércoles', en: 'Wednesday' },
    4: { es: 'Jueves', en: 'Thursday' },
    5: { es: 'Viernes', en: 'Friday' },
    6: { es: 'Sábado', en: 'Saturday' },
    7: { es: 'Domingo', en: 'Sunday' },
  }

  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleBulkAdjust = async () => {
    if (!bulkAmount || !bulkReason) {
      showNotification('error', t('please_complete_fields'))
      return
    }

    // Confirmation dialog before applying bulk DKP to all members
    const confirmed = window.confirm(
      `${t('bulk_dkp_confirm') || `Are you sure you want to adjust DKP by ${bulkAmount} for ALL guild members?\n\nReason: ${bulkReason}\n\nThis action cannot be easily undone.`}`
    )
    if (!confirmed) return

    setBulkLoading(true)
    try {
      const members = await membersAPI.getAll()
      const userIds = members.data.map(m => m.id)
      await dkpAPI.bulkAdjust(userIds, parseInt(bulkAmount), bulkReason)
      showNotification('success', t('dkp_adjusted_for_all'))
      setBulkAmount('')
      setBulkReason('')
    } catch (error) {
      showNotification('error', t('error_adjusting_dkp'))
    } finally {
      setBulkLoading(false)
    }
  }

  const handleWclPreview = async () => {
    if (!wclUrl) {
      showNotification('error', t('please_complete_fields'))
      return
    }
    setLoading(true)
    try {
      const response = await warcraftLogsAPI.preview(wclUrl)
      setWclPreview(response.data)
    } catch (error) {
      const msg = error.response?.data?.error || t('error_processing_wcl')
      showNotification('error', msg)
    } finally {
      setLoading(false)
    }
  }

  const handleWclConfirm = async () => {
    setLoading(true)
    try {
      await warcraftLogsAPI.confirm({
        reportCode: wclPreview.report.code,
        reportTitle: wclPreview.report.title,
        startTime: wclPreview.report.startTime,
        endTime: wclPreview.report.endTime,
        region: wclPreview.report.region,
        guildName: wclPreview.report.guildName,
        participants: wclPreview.participants,
        fights: wclPreview.report.fights || [],
      })
      showNotification('success', t('dkp_applied_from_wcl'))
      setWclUrl('')
      setWclPreview(null)
    } catch (error) {
      const msg = error.response?.data?.error || t('error_adjusting_dkp')
      showNotification('error', msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWclHistory()
    loadRaidDays()
    checkPendingReports()
  }, [])

  const checkPendingReports = async () => {
    setPendingLoading(true)
    try {
      const res = await warcraftLogsAPI.pendingReports()
      setPendingReports(res.data.pending || [])
      setPendingUploaderName(res.data.uploaderName || '')
    } catch (error) {
      console.error('Error checking pending reports:', error)
      setPendingReports([])
    } finally {
      setPendingLoading(false)
    }
  }

  const handleAutoProcess = async (code) => {
    try {
      const res = await warcraftLogsAPI.autoProcess(code)
      // Set the preview data and open it
      setWclPreview(res.data)
      showNotification('info', t('auto_process_preview') || 'Log previewed. Confirm to apply DKP.')
    } catch (error) {
      showNotification('error', error.response?.data?.error || 'Failed to process report')
    }
  }

  const loadRaidDays = async () => {
    setRaidDaysLoading(true)
    try {
      const res = await calendarAPI.getAllRaidDays()
      // Create all 7 days with their current status
      const allDays = [1, 2, 3, 4, 5, 6, 7].map(dayOfWeek => {
        const existing = res.data.find(d => d.day_of_week === dayOfWeek)
        return {
          dayOfWeek,
          isActive: existing?.is_active === 1,
          raidTime: existing?.raid_time || '20:00',
        }
      })
      setRaidDays(allDays)
    } catch (error) {
      console.error('Error loading raid days:', error)
    } finally {
      setRaidDaysLoading(false)
    }
  }

  const toggleRaidDay = (dayOfWeek) => {
    setRaidDays(prev =>
      prev.map(day =>
        day.dayOfWeek === dayOfWeek ? { ...day, isActive: !day.isActive } : day
      )
    )
  }

  const updateRaidTime = (dayOfWeek, time) => {
    setRaidDays(prev =>
      prev.map(day =>
        day.dayOfWeek === dayOfWeek ? { ...day, raidTime: time } : day
      )
    )
  }

  const saveRaidDays = async () => {
    setRaidDaysSaving(true)
    try {
      const activeDays = raidDays
        .filter(d => d.isActive)
        .map(d => ({
          dayOfWeek: d.dayOfWeek,
          raidTime: d.raidTime,
        }))
      await calendarAPI.updateRaidDays(activeDays)
      showNotification('success', t('raid_days_saved'))
    } catch (error) {
      showNotification('error', error.response?.data?.error || 'Error')
    } finally {
      setRaidDaysSaving(false)
    }
  }

  const loadWclHistory = async () => {
    try {
      setLoadingHistory(true)
      const res = await warcraftLogsAPI.history(50)
      setWclHistory(res.data || [])
    } catch (error) {
      console.error('Error loading WCL history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleExpandReport = async (code) => {
    if (expandedReport === code) {
      setExpandedReport(null)
      return
    }
    setExpandedReport(code)
    if (!reportTransactions[code]) {
      try {
        const res = await warcraftLogsAPI.reportTransactions(code)
        setReportTransactions(prev => ({ ...prev, [code]: res.data.transactions || [] }))
      } catch (error) {
        console.error('Error loading report transactions:', error)
      }
    }
  }

  const handleRevert = async (code) => {
    try {
      setReverting(true)
      await warcraftLogsAPI.revert(code)
      showNotification('success', t('dkp_reverted'))
      setRevertConfirm(null)
      loadWclHistory()
    } catch (error) {
      showNotification('error', error.response?.data?.error || t('error_generic'))
    } finally {
      setReverting(false)
    }
  }

  const matchedParticipants = wclPreview?.participants?.filter(p => p.matched) || []
  const dkpPerPlayer = wclPreview?.dkp_calculation?.dkp_per_player || 0

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg animate-fade-in ${
          notification.type === 'success'
            ? 'bg-green-500/15 border-green-500/40 text-green-400'
            : 'bg-red-500/15 border-red-500/40 text-red-400'
        }`}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <WarningCircle size={20} />}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Bulk Adjustment */}
      <div className="rounded-2xl bg-lavender-12 p-8">
        <h3 className="flex items-center gap-3"><Users size={20} />{t('bulk_adjustment')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder={t('amount')} className="px-4 py-3 rounded-lg bg-indigo border border-lavender-20 text-lavender focus:outline-none focus:ring-2 focus:ring-coral" />
          <input type="text" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder={t('reason')} className="px-4 py-3 rounded-lg bg-indigo border border-lavender-20 text-lavender focus:outline-none focus:ring-2 focus:ring-coral" />
          <button onClick={handleBulkAdjust} disabled={bulkLoading} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50 transition-all">
            {bulkLoading ? (
              <><CircleNotch size={18} className="inline animate-spin mr-2" />{t('loading')}...</>
            ) : (
              <><Users size={18} className="inline mr-2" />{t('apply_to_all')}</>
            )}
          </button>
        </div>
      </div>

      {/* Warcraft Logs */}
      <div className="rounded-2xl bg-lavender-12 p-8">
        <h3 className="flex items-center gap-3"><img src={WCL_ICON} alt="WCL" className="inline-block w-6 h-6" />{t('wcl_integration')}</h3>

        {/* Pending Reports - Auto-detected */}
        {pendingReports.length > 0 && (
          <div className="mb-6 bg-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-yellow-400 font-bold flex items-center gap-2 m-0">
                <Bell size={18} className="animate-pulse" />
                {t('pending_wcl_reports') || 'Logs pendientes'}
                <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingReports.length}</span>
              </h4>
              <button
                onClick={checkPendingReports}
                disabled={pendingLoading}
                className="text-sm text-yellow-400 hover:text-yellow-300"
              >
                {pendingLoading ? <CircleNotch size={14} className="inline animate-spin mr-1" /> : <ArrowsClockwise size={14} className="inline mr-1" />}
                {t('refresh')}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              {t('logs_from') || 'Logs de'}: <span className="text-yellow-400">{pendingUploaderName}</span>
            </p>
            <div className="space-y-2">
              {pendingReports.map(report => (
                <div
                  key={report.code}
                  className="flex items-center justify-between bg-indigo/50 rounded-lg px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{report.title}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-3">
                      <span><CalendarBlank size={12} className="inline mr-1" />{report.raidDate}</span>
                      <span><Sword size={12} className="inline mr-1" />{report.zone}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://www.warcraftlogs.com/reports/${report.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-blue-600/30 hover:bg-blue-600/50 rounded-lg text-sm transition-all"
                      title={t('view_on_wcl') || 'Ver en WCL'}
                    >
                      <ArrowSquareOut size={16} />
                    </a>
                    <button
                      onClick={() => handleAutoProcess(report.code)}
                      className="px-4 py-2 bg-green-600/30 hover:bg-green-600/50 text-green-400 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                    >
                      <Lightning size={16} />
                      {t('process') || 'Procesar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual URL Input */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <input type="text" value={wclUrl} onChange={(e) => setWclUrl(e.target.value)} placeholder={t('wcl_url')} className="md:col-span-3 px-4 py-3 rounded-lg bg-indigo border border-lavender-20 text-lavender focus:outline-none focus:ring-2 focus:ring-coral" />
          <button onClick={handleWclPreview} disabled={loading} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold disabled:opacity-50">
            {loading ? <CircleNotch size={18} className="inline animate-spin" /> : <><Eye size={18} className="inline mr-2" />{t('preview')}</>}
          </button>
        </div>

        {wclPreview && (
          <div className="mt-6 space-y-4">
            <div className="bg-blue-900/50 rounded-lg p-4">
              <h6 className="font-bold mb-2"><img src={WCL_ICON} alt="WCL" className="inline-block mr-2 w-5 h-5" />{wclPreview.report.title}</h6>
              <p>{t('bosses')}: {wclPreview.report.bossesKilled}/{wclPreview.report.totalBosses} | {t('participants')}: {wclPreview.report.participantCount} | {t('dkp_per_player')}: {dkpPerPlayer}</p>
            </div>

            {matchedParticipants.length > 0 && (
              <div>
                <h6 className="font-bold mb-2">{t('players_to_receive')}:</h6>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-lavender-20">
                      <th className="text-left py-2">{t('character')}</th>
                      <th className="text-right py-2">{t('current_dkp_label')}</th>
                      <th className="text-right py-2">{t('after')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedParticipants.map((p, i) => (
                      <tr key={i} className="border-b border-lavender-20/20">
                        <td className="py-2">
                          <span className="font-bold" style={{ color: CLASS_COLORS[p.wcl_class] || '#FFF' }}>
                            {p.character_name}
                          </span>
                        </td>
                        <td className="py-2 text-right text-coral">{p.current_dkp || 0}</td>
                        <td className="py-2 text-right">
                          <span className="text-green-400 font-bold">{(p.current_dkp || 0) + p.dkp_to_assign}</span>
                          <span className="text-green-500 text-sm ml-2">(+{p.dkp_to_assign})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {wclPreview.can_proceed && matchedParticipants.length > 0 && (
              <button onClick={handleWclConfirm} disabled={loading} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50 transition-all">
                {loading ? (
                  <><CircleNotch size={18} className="inline animate-spin mr-2" />{t('loading')}...</>
                ) : (
                  <><Check size={18} className="inline mr-2" />{t('confirm_apply_to')} {matchedParticipants.length} {t('players')}</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* WCL History */}
      <div className="rounded-2xl bg-lavender-12 p-8">
        <h3 className="flex items-center gap-3"><ClockCounterClockwise size={20} />{t('wcl_history')}</h3>
        {loadingHistory ? (
          <div className="text-center py-8"><CircleNotch size={24} className="animate-spin text-coral mx-auto" /></div>
        ) : wclHistory.length === 0 ? (
          <p className="text-lavender mt-4 text-center">{t('no_data')}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {wclHistory.map(report => (
              <div key={report.report_code} className={`rounded-lg border overflow-hidden transition-all ${
                report.is_reverted
                  ? 'border-red-500/30 bg-red-900/10'
                  : 'border-lavender-20/20 bg-lavender-12/10'
              }`}>
                {/* Report Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-lavender-12/20 transition-all"
                  onClick={() => handleExpandReport(report.report_code)}
                >
                  <img src={WCL_ICON} alt="WCL" className={`inline-block w-5 h-5 ${report.is_reverted ? 'opacity-40 grayscale' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm truncate">{report.report_title}</span>
                      {report.is_reverted && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">{t('reverted')}</span>
                      )}
                    </div>
                    <div className="text-xs text-lavender flex items-center gap-2 flex-wrap">
                      {report.raid_date && <span><CalendarBlank size={12} className="inline mr-1" />{report.raid_date}</span>}
                      <span><Users size={12} className="inline mr-1" />{report.participants_count}</span>
                      <span className="text-coral"><Coins size={12} className="inline mr-1" />{report.dkp_assigned}</span>
                      <span><User size={12} className="inline mr-1" />{report.processed_by_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!report.is_reverted && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRevertConfirm(report.report_code) }}
                        className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all flex items-center gap-1"
                        title={t('revert_dkp')}
                      >
                        <ArrowCounterClockwise size={12} />{t('revert_dkp')}
                      </button>
                    )}
                    {expandedReport === report.report_code ? <CaretUp size={14} className="text-lavender" /> : <CaretDown size={14} className="text-lavender" />}
                  </div>
                </div>

                {/* Expanded Transactions */}
                {expandedReport === report.report_code && (
                  <div className="px-4 pb-3 border-t border-lavender-20/20">
                    {reportTransactions[report.report_code] ? (
                      reportTransactions[report.report_code].length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {reportTransactions[report.report_code].map(txn => (
                            <div key={txn.id} className="flex items-center justify-between text-sm py-1">
                              <span style={{ color: CLASS_COLORS[txn.character_class] || '#fff' }}>{txn.character_name}</span>
                              <span className={txn.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                                {txn.amount > 0 ? '+' : ''}{txn.amount} DKP
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-lavender text-sm mt-2">{t('no_data')}</p>
                      )
                    ) : (
                      <div className="text-center py-4"><CircleNotch size={18} className="animate-spin text-coral mx-auto" /></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raid Days Configuration - Hidden for now, keeping code for future use */}
      {false && (
      <div className="rounded-2xl bg-lavender-12 p-8">
        <h3 className="flex items-center gap-3"><CalendarDots size={20} />{t('raid_schedule')}</h3>
        {raidDaysLoading ? (
          <div className="text-center py-8"><CircleNotch size={24} className="animate-spin text-coral mx-auto" /></div>
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {raidDays.map(day => (
                <div
                  key={day.dayOfWeek}
                  className={`rounded-lg border p-4 transition-all cursor-pointer ${
                    day.isActive
                      ? 'border-coral bg-coral/10'
                      : 'border-lavender-20/30 bg-lavender-12/10'
                  }`}
                  onClick={() => toggleRaidDay(day.dayOfWeek)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold ${day.isActive ? 'text-coral' : 'text-lavender'}`}>
                      {DAY_NAMES[day.dayOfWeek]?.[t('lang_code') || 'en'] || DAY_NAMES[day.dayOfWeek]?.en}
                    </span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      day.isActive ? 'bg-coral' : 'bg-gray-600'
                    }`}>
                      {day.isActive && <Check size={12} className="text-white" />}
                    </div>
                  </div>
                  {day.isActive && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="time"
                        value={day.raidTime}
                        onChange={(e) => updateRaidTime(day.dayOfWeek, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-indigo border border-lavender-20/30 text-white text-sm focus:outline-none focus:border-coral"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={saveRaidDays}
              disabled={raidDaysSaving}
              className="mt-4 px-6 py-3 bg-lavender-20 hover:bg-lavender-20/80 text-white rounded-lg font-bold disabled:opacity-50 transition-all"
            >
              {raidDaysSaving ? (
                <><CircleNotch size={18} className="inline animate-spin mr-2" />{t('loading')}...</>
              ) : (
                <><FloppyDisk size={18} className="inline mr-2" />{t('save_raid_days')}</>
              )}
            </button>
          </div>
        )}
      </div>
      )}

      {/* Revert Confirmation Dialog */}
      {revertConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setRevertConfirm(null)}>
          <div className="absolute inset-0 bg-black/70"></div>
          <div className="relative bg-indigo border border-red-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <Warning size={28} className="text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('revert_dkp')}</h3>
              <p className="text-lavender text-sm">{t('confirm_revert')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRevertConfirm(null)}
                  className="flex-1 py-2 px-4 border border-lavender-20 text-lavender rounded-lg hover:bg-lavender-12/20 transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleRevert(revertConfirm)}
                  disabled={reverting}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {reverting ? <CircleNotch size={18} className="inline animate-spin" /> : <><ArrowCounterClockwise size={16} className="inline mr-2" />{t('revert_dkp')}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminTab
