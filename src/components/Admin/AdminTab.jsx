import { useState } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI, warcraftLogsAPI } from '../../services/api'

const AdminTab = () => {
  const { t } = useLanguage()
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkReason, setBulkReason] = useState('')
  const [wclUrl, setWclUrl] = useState('')
  const [wclPreview, setWclPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleBulkAdjust = async () => {
    if (!bulkAmount || !bulkReason) { alert(t('please_complete_fields')); return }
    if (!confirm(t('confirm'))) return
    try {
      const members = await membersAPI.getAll()
      const userIds = members.data.map(m => m.id)
      await dkpAPI.bulkAdjust(userIds, parseInt(bulkAmount), bulkReason)
      alert(t('dkp_adjusted_for_all'))
      setBulkAmount('')
      setBulkReason('')
    } catch (error) {
      alert(t('error_adjusting_dkp'))
    }
  }

  const handleWclPreview = async () => {
    if (!wclUrl) { alert(t('please_complete_fields')); return }
    setLoading(true)
    try {
      const response = await warcraftLogsAPI.preview(wclUrl)
      setWclPreview(response.data)
    } catch (error) {
      alert(t('error_processing_wcl'))
    } finally {
      setLoading(false)
    }
  }

  const handleWclConfirm = async () => {
    if (!confirm(t('confirm'))) return
    try {
      await warcraftLogsAPI.confirm(wclPreview.report.code)
      alert(t('dkp_applied_from_wcl'))
      setWclUrl('')
      setWclPreview(null)
    } catch (error) {
      alert(t('error_adjusting_dkp'))
    }
  }

  return (
    <div className="space-y-6">
      {/* Bulk Adjustment */}
      <div className="info-card">
        <h3><i className="fas fa-users-cog mr-3"></i>{t('bulk_adjustment')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder={t('amount')} className="px-4 py-3 rounded-lg bg-midnight-spaceblue border border-midnight-bright-purple text-midnight-silver focus:outline-none focus:ring-2 focus:ring-midnight-glow" />
          <input type="text" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} placeholder={t('reason')} className="px-4 py-3 rounded-lg bg-midnight-spaceblue border border-midnight-bright-purple text-midnight-silver focus:outline-none focus:ring-2 focus:ring-midnight-glow" />
          <button onClick={handleBulkAdjust} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold">
            <i className="fas fa-users mr-2"></i>{t('apply_to_all')}
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
              <p>{t('bosses')}: {wclPreview.report.bossesKilled}/{wclPreview.report.totalBosses} | {t('participants')}: {wclPreview.report.participantCount} | {t('dkp_per_player')}: {wclPreview.dkp_calculation.dkp_per_player}</p>
            </div>

            {wclPreview.participants.filter(p => p.matched).length > 0 && (
              <div>
                <h6 className="font-bold mb-2">{t('players_to_receive')}:</h6>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-midnight-bright-purple">
                      <th className="text-left py-2">{t('character')}</th>
                      <th className="text-left py-2">{t('current_dkp_label')}</th>
                      <th className="text-left py-2">{t('dkp_to_grant')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wclPreview.participants.filter(p => p.matched).map((p, i) => (
                      <tr key={i} className="border-b border-midnight-bright-purple border-opacity-20">
                        <td className="py-2">{p.character_name}</td>
                        <td className="py-2">{p.current_dkp || 0}</td>
                        <td className="py-2 text-green-400">+{p.dkp_to_assign} DKP</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {wclPreview.can_proceed && (
              <button onClick={handleWclConfirm} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold">
                <i className="fas fa-check mr-2"></i>{t('confirm_apply_to')} {wclPreview.participants.filter(p => p.matched).length} {t('players')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTab