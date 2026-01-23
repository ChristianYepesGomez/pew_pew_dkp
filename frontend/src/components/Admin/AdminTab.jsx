import { useState } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI, membersAPI, warcraftLogsAPI } from '../../services/api'

const AdminTab = () => {
  const { t } = useLanguage()
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkReason, setBulkReason] = useState('')
  const [wclURL, setWclURL] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleBulkAdjust = async () => {
    if (!bulkAmount || !bulkReason) {
      alert(t('please_complete_fields'))
      return
    }

    const amount = parseInt(bulkAmount)
    if (isNaN(amount)) {
      alert(t('please_complete_fields'))
      return
    }

    if (!confirm(`${t('confirm')} ${amount} DKP ${t('apply_to_all')}?`)) {
      return
    }

    setLoading(true)
    try {
      // Get all member IDs
      const response = await membersAPI.getAll()
      const userIds = response.data.map((m) => m.id)

      // Apply bulk adjustment
      await dkpAPI.bulkAdjust(userIds, amount, bulkReason)
      alert(`✅ ${t('dkp_adjusted_for_all')}`)
      setBulkAmount('')
      setBulkReason('')
    } catch (error) {
      console.error('Error adjusting bulk DKP:', error)
      alert(`❌ ${t('error_adjusting_dkp')}`)
    } finally {
      setLoading(false)
    }
  }

  const handleWCLPreview = async () => {
    if (!wclURL) {
      alert(t('please_complete_fields'))
      return
    }

    setLoading(true)
    setPreview(null)

    try {
      const response = await warcraftLogsAPI.preview(wclURL)
      setPreview(response.data)
    } catch (error) {
      console.error('Error previewing WCL:', error)
      alert(`❌ ${error.response?.data?.error || t('error_processing_wcl')}`)
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const handleWCLConfirm = async () => {
    if (!preview || !preview.report) {
      return
    }

    if (!confirm(`${t('confirm')} ${preview.participants.filter(p => p.matched).length} ${t('players')}?`)) {
      return
    }

    setLoading(true)
    try {
      await warcraftLogsAPI.confirm(preview.report.code)
      alert(`✅ ${t('dkp_applied_from_wcl')}`)
      setWclURL('')
      setPreview(null)
    } catch (error) {
      console.error('Error confirming WCL:', error)
      alert(`❌ ${t('error_adjusting_dkp')}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Bulk DKP Adjustment */}
      <div className="info-card">
        <h3>
          <i className="fas fa-users-cog mr-3"></i>
          {t('bulk_adjustment')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-midnight-silver mb-2">{t('amount')}</label>
            <input
              type="number"
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value)}
              placeholder="+/- DKP"
              className="w-full px-4 py-3 rounded-lg bg-midnight-deepblue border border-midnight-bright-purple text-midnight-silver focus:border-midnight-glow focus:ring-2 focus:ring-midnight-glow focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-midnight-silver mb-2">{t('reason')}</label>
            <input
              type="text"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder={t('reason')}
              className="w-full px-4 py-3 rounded-lg bg-midnight-deepblue border border-midnight-bright-purple text-midnight-silver focus:border-midnight-glow focus:ring-2 focus:ring-midnight-glow focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleBulkAdjust}
              disabled={loading}
              className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-users mr-2"></i>
              {t('apply_to_all')}
            </button>
          </div>
        </div>
      </div>

      {/* Warcraft Logs Integration */}
      <div className="info-card">
        <h3>
          <i className="fas fa-scroll mr-3"></i>
          {t('wcl_integration')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <label className="block text-midnight-silver mb-2">{t('wcl_url')}</label>
            <input
              type="text"
              value={wclURL}
              onChange={(e) => setWclURL(e.target.value)}
              placeholder="https://www.warcraftlogs.com/reports/..."
              className="w-full px-4 py-3 rounded-lg bg-midnight-deepblue border border-midnight-bright-purple text-midnight-silver focus:border-midnight-glow focus:ring-2 focus:ring-midnight-glow focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleWCLPreview}
              disabled={loading}
              className="w-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="fas fa-eye mr-2"></i>
              {t('preview')}
            </button>
          </div>
        </div>

        {/* Preview Results */}
        {loading && (
          <div className="mt-6 text-center text-midnight-silver">
            <i className="fas fa-circle-notch fa-spin text-4xl mb-2"></i>
            <p>{t('processing')}...</p>
          </div>
        )}

        {preview && !loading && (
          <div className="mt-6 space-y-4">
            {/* Report Info */}
            <div className="bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple rounded-lg p-4">
              <h6 className="text-lg font-cinzel text-midnight-glow mb-2">
                <i className="fas fa-scroll mr-2"></i>
                {preview.report.title}
              </h6>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-midnight-silver">
                <div>
                  <strong>{t('bosses')}:</strong> {preview.report.bossesKilled}/{preview.report.totalBosses}
                </div>
                <div>
                  <strong>{t('participants')}:</strong> {preview.report.participantCount}
                </div>
                <div>
                  <strong>{t('dkp_per_player')}:</strong> {preview.dkp_calculation.dkp_per_player}
                </div>
                <div>
                  <strong>Intentos:</strong> {preview.report.totalAttempts}
                </div>
              </div>
            </div>

            {/* Matched Players */}
            {preview.participants.filter((p) => p.matched).length > 0 && (
              <div>
                <h6 className="text-midnight-glow font-semibold mb-3">
                  {t('players_to_receive')} ({preview.participants.filter((p) => p.matched).length}):
                </h6>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-midnight-bright-purple">
                        <th className="text-left py-2 px-3 text-midnight-glow">{t('character')}</th>
                        <th className="text-left py-2 px-3 text-midnight-glow">{t('current_dkp_label')}</th>
                        <th className="text-left py-2 px-3 text-midnight-glow">{t('dkp_to_grant')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.participants
                        .filter((p) => p.matched)
                        .map((p, index) => (
                          <tr
                            key={index}
                            className="border-b border-midnight-bright-purple border-opacity-20"
                          >
                            <td className="py-2 px-3 text-midnight-silver">{p.character_name}</td>
                            <td className="py-2 px-3 text-midnight-silver">{p.current_dkp || 0}</td>
                            <td className="py-2 px-3 amount-positive">
                              +{p.dkp_to_assign} DKP
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Not Matched Players */}
            {preview.participants.filter((p) => !p.matched).length > 0 && (
              <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg p-4">
                <strong className="text-yellow-400">
                  ⚠️ {preview.participants.filter((p) => !p.matched).length} {t('not_found_in_db')}:
                </strong>
                <ul className="mt-2 ml-6 list-disc text-midnight-silver">
                  {preview.participants
                    .filter((p) => !p.matched)
                    .map((p, index) => (
                      <li key={index}>
                        {p.wcl_name} ({p.wcl_server}) - {p.wcl_class}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Confirm Button */}
            {preview.can_proceed && preview.participants.filter((p) => p.matched).length > 0 && (
              <button
                onClick={handleWCLConfirm}
                disabled={loading}
                className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-check mr-2"></i>
                {t('confirm_apply_to')} {preview.participants.filter((p) => p.matched).length} {t('players')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTab
