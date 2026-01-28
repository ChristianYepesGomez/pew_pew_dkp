import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI } from '../../services/api'

const CharacterTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [dkpData, setDkpData] = useState({ currentDkp: 0, lifetimeGained: 0, lifetimeSpent: 0, transactions: [] })
  const [loading, setLoading] = useState(true)

  const loadDKP = async () => {
    if (!user?.id) return
    try {
      const response = await dkpAPI.getHistory(user.id)
      setDkpData(response.data)
    } catch (error) {
      console.error('Error loading DKP:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDKP() }, [user?.id])

  useSocket({ dkp_updated: (data) => { if (data.userId === user?.id) loadDKP() } })

  const classCSS = `class-${(user?.characterClass || '').toLowerCase().replace(' ', '-')}`

  if (loading) return <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Character Info */}
        <div className="info-card">
          <h3><i className="fas fa-user-shield mr-3"></i>{t('information')}</h3>
          <div className="space-y-3">
            <p><strong className="text-midnight-glow">{t('name')}:</strong> <span className={classCSS}>{user?.characterName || '-'}</span></p>
            <p><strong className="text-midnight-glow">{t('class')}:</strong> <span className={classCSS}>{user?.characterClass || '-'}</span></p>
            <p><strong className="text-midnight-glow">{t('spec')}:</strong> <span>{user?.spec || '-'}</span></p>
            <p><strong className="text-midnight-glow">{t('role')}:</strong>
              <span className={`ml-2 px-3 py-1 rounded-lg text-xs font-bold ${user?.raidRole === 'Tank' ? 'bg-blue-500' : user?.raidRole === 'Healer' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                {user?.raidRole || 'DPS'}
              </span>
            </p>
            <p><strong className="text-midnight-glow">{t('rank')}:</strong>
              <span className={`ml-2 px-3 py-1 rounded-lg text-sm ${user?.role === 'admin' ? 'bg-yellow-600' : user?.role === 'officer' ? 'bg-purple-600' : 'bg-gray-600'} text-white`}>
                {t('role_' + (user?.role || 'raider'))}
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="info-card">
          <h3><i className="fas fa-chart-line mr-3"></i>{t('statistics')}</h3>
          <div className="space-y-3">
            <p><strong className="text-midnight-glow">{t('total_gained')}:</strong> <span className="amount-positive">{dkpData.lifetimeGained || 0} DKP</span></p>
            <p><strong className="text-midnight-glow">{t('total_spent')}:</strong> <span className="amount-negative">{dkpData.lifetimeSpent || 0} DKP</span></p>
          </div>
        </div>
      </div>

      {/* Right Column - DKP Badge */}
      <div>
        <div className="info-card">
          <div className="dkp-badge">
            <h4 className="font-cinzel text-lg text-midnight-silver">{t('current_dkp')}</h4>
            <div className="dkp-amount">{dkpData.currentDkp || 0}</div>
            <small className="text-midnight-silver opacity-80">{t('dragon_kill_points')}</small>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="lg:col-span-2">
        <div className="info-card">
          <h3><i className="fas fa-file-invoice mr-3"></i>{t('my_dkp_history')}</h3>
          {dkpData.transactions?.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t('no_transactions')}</p>
          ) : (
            <div className="space-y-3 mt-4">
              {dkpData.transactions?.map((trans, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-midnight-bright-purple border-opacity-20 pb-3">
                  <div>
                    <i className="fas fa-coins text-midnight-glow mr-2"></i>
                    <strong>{trans.reason}</strong>
                    <div className="text-sm text-gray-400 ml-6">{new Date(trans.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={trans.amount > 0 ? 'amount-positive' : 'amount-negative'}>
                    <i className={`fas ${trans.amount > 0 ? 'fa-arrow-up' : 'fa-arrow-down'} mr-1`}></i>
                    {trans.amount > 0 ? '+' : ''}{trans.amount} DKP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CharacterTab