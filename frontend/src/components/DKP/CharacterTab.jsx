import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI } from '../../services/api'

const CharacterTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [dkpData, setDkpData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUserDKP = async () => {
    if (!user?.id) return

    try {
      const response = await dkpAPI.getHistory(user.id)
      setDkpData(response.data)
    } catch (error) {
      console.error('Error loading DKP data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUserDKP()
  }, [user])

  // Listen to DKP updates via socket
  useSocket({
    dkp_updated: (data) => {
      if (data.userId === user?.id) {
        loadUserDKP()
      }
    },
    dkp_bulk_updated: () => {
      loadUserDKP()
    },
    dkp_decay_applied: () => {
      loadUserDKP()
    },
  })

  if (loading) {
    return (
      <div className="text-center py-20">
        <i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i>
        <p className="mt-4 text-midnight-silver">{t('loading')}...</p>
      </div>
    )
  }

  const classCSS = `class-${(user?.characterClass || '').toLowerCase().replace(' ', '-')}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Character Info Card */}
        <div className="info-card">
          <h3>
            <i className="fas fa-user-shield mr-3"></i>
            {t('information')}
          </h3>
          <div className="space-y-3 text-midnight-silver">
            <p>
              <strong className="text-midnight-glow">{t('name')}:</strong>{' '}
              <span className={classCSS}>{user?.characterName || '-'}</span>
            </p>
            <p>
              <strong className="text-midnight-glow">{t('class')}:</strong>{' '}
              <span className={classCSS}>{user?.characterClass || '-'}</span>
            </p>
            <p>
              <strong className="text-midnight-glow">{t('role')}:</strong>{' '}
              <span>{user?.raidRole || '-'}</span>
            </p>
            <p>
              <strong className="text-midnight-glow">{t('rank')}:</strong>{' '}
              <span className="inline-block bg-midnight-purple bg-opacity-50 px-3 py-1 rounded-lg text-midnight-glow font-semibold">
                {t(`role_${user?.role || 'raider'}`)}
              </span>
            </p>
          </div>
        </div>

        {/* Statistics Card */}
        <div className="info-card">
          <h3>
            <i className="fas fa-chart-line mr-3"></i>
            {t('statistics')}
          </h3>
          <div className="space-y-3 text-midnight-silver">
            <p>
              <strong className="text-midnight-glow">{t('total_gained')}:</strong>{' '}
              <span className="amount-positive">{dkpData?.lifetimeGained || 0} DKP</span>
            </p>
            <p>
              <strong className="text-midnight-glow">{t('total_spent')}:</strong>{' '}
              <span className="amount-negative">{dkpData?.lifetimeSpent || 0} DKP</span>
            </p>
            <p>
              <strong className="text-midnight-glow">{t('last_decay')}:</strong>{' '}
              <span>
                {dkpData?.lastDecay
                  ? new Date(dkpData.lastDecay).toLocaleDateString()
                  : t('never')}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - DKP Badge */}
      <div>
        <div className="info-card">
          <div
            className="dkp-badge"
            onClick={() => {
              // Animate on click
              const element = document.getElementById('dkp-amount')
              if (element) {
                element.style.transform = 'scale(1.3)'
                setTimeout(() => {
                  element.style.transform = 'scale(1)'
                }, 500)
              }
            }}
          >
            <h4 className="text-lg font-cinzel text-midnight-silver mb-2 tracking-wide">
              {t('current_dkp')}
            </h4>
            <div id="dkp-amount" className="dkp-amount transition-transform duration-500">
              {dkpData?.currentDkp || 0}
            </div>
            <small className="text-midnight-silver opacity-90 tracking-wide">
              {t('dragon_kill_points')}
            </small>
          </div>
        </div>
      </div>

      {/* Full Width - Transaction History */}
      <div className="lg:col-span-2">
        <div className="info-card">
          <h3>
            <i className="fas fa-file-invoice mr-3"></i>
            {t('my_dkp_history')}
          </h3>
          <div className="mt-4">
            {!dkpData?.transactions || dkpData.transactions.length === 0 ? (
              <p className="text-center text-gray-400 py-8">{t('no_transactions')}</p>
            ) : (
              <div className="space-y-2">
                {dkpData.transactions.map((trans, index) => {
                  const isPositive = trans.amount > 0
                  const icon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down'
                  const date = new Date(trans.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <div key={index} className="transaction-row">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <i className="fas fa-coins text-midnight-glow"></i>
                            <div>
                              <strong className="text-midnight-silver">{trans.reason}</strong>
                              <div className="text-sm text-gray-400 mt-1">
                                <i className="far fa-calendar-alt mr-1"></i>
                                {date}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-bold ${isPositive ? 'amount-positive' : 'amount-negative'}`}>
                            <i className={`fas ${icon} mr-1`}></i>
                            {isPositive ? '+' : ''}{trans.amount} DKP
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CharacterTab
