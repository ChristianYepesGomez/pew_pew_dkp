import { useState } from 'react'
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
    </div>
  )
}

export default AdminTab
