import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI } from '../../services/api'
import { CircleNotch, ShieldStar, ChartLineUp, FileText, Coins, ArrowUp, ArrowDown } from '@phosphor-icons/react'

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

  if (loading) return <div className="text-center py-20"><CircleNotch size={48} weight="bold" className="animate-spin text-coral mx-auto" /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Character Info */}
        <div className="rounded-2xl bg-lavender-12 p-8">
          <h3 className="flex items-center gap-3"><ShieldStar size={20} weight="bold" />{t('information')}</h3>
          <div className="space-y-3">
            <p><strong className="text-coral">{t('name')}:</strong> <span className={classCSS}>{user?.characterName || '-'}</span></p>
            <p><strong className="text-coral">{t('class')}:</strong> <span className={classCSS}>{user?.characterClass || '-'}</span></p>
            <p><strong className="text-coral">{t('spec')}:</strong> <span>{user?.spec || '-'}</span></p>
            <p><strong className="text-coral">{t('role')}:</strong>
              <span className={`ml-2 px-3 py-1 rounded-lg text-xs font-bold ${user?.raidRole === 'Tank' ? 'bg-blue-500' : user?.raidRole === 'Healer' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                {user?.raidRole || 'DPS'}
              </span>
            </p>
            <p><strong className="text-coral">{t('rank')}:</strong>
              <span className={`ml-2 px-3 py-1 rounded-lg text-sm ${user?.role === 'admin' ? 'bg-yellow-600' : user?.role === 'officer' ? 'bg-purple-600' : 'bg-gray-600'} text-white`}>
                {t('role_' + (user?.role || 'raider'))}
              </span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-2xl bg-lavender-12 p-8">
          <h3 className="flex items-center gap-3"><ChartLineUp size={20} weight="bold" />{t('statistics')}</h3>
          <div className="space-y-3">
            <p><strong className="text-coral">{t('total_gained')}:</strong> <span className="amount-positive">{dkpData.lifetimeGained || 0} DKP</span></p>
            <p><strong className="text-coral">{t('total_spent')}:</strong> <span className="amount-negative">{dkpData.lifetimeSpent || 0} DKP</span></p>
          </div>
        </div>
      </div>

      {/* Right Column - DKP Badge */}
      <div>
        <div className="rounded-2xl bg-lavender-12 p-8">
          <div className="dkp-badge">
            <h4 className="text-lg text-lavender">{t('current_dkp')}</h4>
            <div className="dkp-amount">{dkpData.currentDkp || 0}</div>
            <small className="text-lavender opacity-80">{t('dragon_kill_points')}</small>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl bg-lavender-12 p-8">
          <h3 className="flex items-center gap-3"><FileText size={20} weight="bold" />{t('my_dkp_history')}</h3>
          {dkpData.transactions?.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t('no_transactions')}</p>
          ) : (
            <div className="space-y-3 mt-4">
              {dkpData.transactions?.map((trans, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-lavender-20/20 pb-3">
                  <div>
                    <Coins size={16} weight="bold" className="inline text-coral mr-2" />
                    <strong>{trans.reason}</strong>
                    <div className="text-sm text-gray-400 ml-6">{new Date(trans.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={trans.amount > 0 ? 'amount-positive' : 'amount-negative'}>
                    {trans.amount > 0 ? <ArrowUp size={14} weight="bold" className="inline mr-1" /> : <ArrowDown size={14} weight="bold" className="inline mr-1" />}
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
