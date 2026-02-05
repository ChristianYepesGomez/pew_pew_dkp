import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI, warcraftLogsAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
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

  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleBulkAdjust = async () => {
    if (!bulkAmount || !bulkReason) {
      showNotification('error', t('please_complete_fields'))
      return
    }
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
  }, [])

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
            ? 'bg-green-500 bg-opacity-15 border-green-500 border-opacity-40 text-green-400'
            : 'bg-red-500 bg-opacity-15 border-red-500 border-opacity-40 text-red-400'
        }`}>
          <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`}></i>
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Bulk Adjustment */}
      <div className="info-card">
        <h3><i className="fas fa-users-cog mr-3"></i>{t('bulk_adjustment')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder={t('amount')} className="px-4 py-3 rounded-lg bg-midnight-spaceblue border border-midnight-bright-purple text-midnight-silver focus:outline-none focus:ring-2 focus:ring-midnight-glow" />
          <input type="text" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder={t('reason')} className="px-4 py-3 rounded-lg bg-midnight-spaceblue border border-midnight-bright-purple text-midnight-silver focus:outline-none focus:ring-2 focus:ring-midnight-glow" />
          <button onClick={handleBulkAdjust} disabled={bulkLoading} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50 transition-all">
            {bulkLoading ? (
              <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
            ) : (
              <><i className="fas fa-users mr-2"></i>{t('apply_to_all')}</>
            )}
          </button>
        </div>
      </div>

      {/* Warcraft Logs */}
      <div className="info-card">
        <h3><i className="fas fa-scroll mr-3"></i>{t('wcl_integration')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <input type="text" value={wclUrl} onChange={(e) => setWclUrl(e.target.value)} placeholder={t('wcl_url')} className="md:col-span-3 px-4 py-3 rounded-lg bg-midnight-spaceblue border border-midnight-bright-purple text-midnight-silver focus:outline-none focus:ring-2 focus:ring-midnight-glow" />
          <button onClick={handleWclPreview} disabled={loading} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold disabled:opacity-50">
            {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <><i className="fas fa-eye mr-2"></i>{t('preview')}</>}
          </button>
        </div>

        {wclPreview && (
          <div className="mt-6 space-y-4">
            <div className="bg-blue-900 bg-opacity-50 rounded-lg p-4">
              <h6 className="font-bold mb-2"><i className="fas fa-scroll mr-2"></i>{wclPreview.report.title}</h6>
              <p>{t('bosses')}: {wclPreview.report.bossesKilled}/{wclPreview.report.totalBosses} | {t('participants')}: {wclPreview.report.participantCount} | {t('dkp_per_player')}: {dkpPerPlayer}</p>
            </div>

            {matchedParticipants.length > 0 && (
              <div>
                <h6 className="font-bold mb-2">{t('players_to_receive')}:</h6>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-midnight-bright-purple">
                      <th className="text-left py-2">{t('character')}</th>
                      <th className="text-right py-2">{t('current_dkp_label')}</th>
                      <th className="text-right py-2">{t('after')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchedParticipants.map((p, i) => (
                      <tr key={i} className="border-b border-midnight-bright-purple border-opacity-20">
                        <td className="py-2">
                          <span className="font-bold" style={{ color: CLASS_COLORS[p.wcl_class] || '#FFF' }}>
                            {p.character_name}
                          </span>
                        </td>
                        <td className="py-2 text-right text-midnight-glow">{p.current_dkp || 0}</td>
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
                  <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
                ) : (
                  <><i className="fas fa-check mr-2"></i>{t('confirm_apply_to')} {matchedParticipants.length} {t('players')}</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* WCL History */}
      <div className="info-card">
        <h3><i className="fas fa-history mr-3"></i>{t('wcl_history')}</h3>
        {loadingHistory ? (
          <div className="text-center py-8"><i className="fas fa-circle-notch fa-spin text-2xl text-midnight-glow"></i></div>
        ) : wclHistory.length === 0 ? (
          <p className="text-midnight-silver mt-4 text-center">{t('no_data')}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {wclHistory.map(report => (
              <div key={report.report_code} className={`rounded-lg border overflow-hidden transition-all ${
                report.is_reverted
                  ? 'border-red-500 border-opacity-30 bg-red-900 bg-opacity-10'
                  : 'border-midnight-bright-purple border-opacity-20 bg-midnight-purple bg-opacity-10'
              }`}>
                {/* Report Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-midnight-purple hover:bg-opacity-20 transition-all"
                  onClick={() => handleExpandReport(report.report_code)}
                >
                  <i className={`fas fa-scroll ${report.is_reverted ? 'text-red-400' : 'text-orange-400'}`}></i>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm truncate">{report.report_title}</span>
                      {report.is_reverted && (
                        <span className="text-xs bg-red-500 bg-opacity-20 text-red-400 px-2 py-0.5 rounded">{t('reverted')}</span>
                      )}
                    </div>
                    <div className="text-xs text-midnight-silver flex items-center gap-2 flex-wrap">
                      {report.raid_date && <span><i className="fas fa-calendar-day mr-1"></i>{report.raid_date}</span>}
                      <span><i className="fas fa-users mr-1"></i>{report.participants_count}</span>
                      <span className="text-midnight-glow"><i className="fas fa-coins mr-1"></i>{report.dkp_assigned}</span>
                      <span><i className="fas fa-user mr-1"></i>{report.processed_by_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!report.is_reverted && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRevertConfirm(report.report_code) }}
                        className="px-3 py-1.5 bg-red-500 bg-opacity-10 text-red-400 rounded-lg text-xs hover:bg-opacity-20 transition-all"
                        title={t('revert_dkp')}
                      >
                        <i className="fas fa-undo mr-1"></i>{t('revert_dkp')}
                      </button>
                    )}
                    <i className={`fas fa-chevron-${expandedReport === report.report_code ? 'up' : 'down'} text-midnight-silver text-xs`}></i>
                  </div>
                </div>

                {/* Expanded Transactions */}
                {expandedReport === report.report_code && (
                  <div className="px-4 pb-3 border-t border-midnight-bright-purple border-opacity-20">
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
                        <p className="text-midnight-silver text-sm mt-2">{t('no_data')}</p>
                      )
                    ) : (
                      <div className="text-center py-4"><i className="fas fa-circle-notch fa-spin text-midnight-glow"></i></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revert Confirmation Dialog */}
      {revertConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setRevertConfirm(null)}>
          <div className="absolute inset-0 bg-black bg-opacity-70"></div>
          <div className="relative bg-midnight-deepblue border border-red-500 border-opacity-40 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500 bg-opacity-20 flex items-center justify-center mx-auto">
                <i className="fas fa-exclamation-triangle text-red-400 text-2xl"></i>
              </div>
              <h3 className="text-lg font-bold text-white">{t('revert_dkp')}</h3>
              <p className="text-midnight-silver text-sm">{t('confirm_revert')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRevertConfirm(null)}
                  className="flex-1 py-2 px-4 border border-midnight-bright-purple text-midnight-silver rounded-lg hover:bg-midnight-purple hover:bg-opacity-20 transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleRevert(revertConfirm)}
                  disabled={reverting}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {reverting ? <i className="fas fa-circle-notch fa-spin"></i> : <><i className="fas fa-undo mr-2"></i>{t('revert_dkp')}</>}
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
