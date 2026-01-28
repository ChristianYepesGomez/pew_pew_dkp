import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
}

const CharacterProfileModal = ({ isOpen, onClose }) => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [dkpData, setDkpData] = useState({ currentDkp: 0, lifetimeGained: 0, lifetimeSpent: 0 })
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  useEffect(() => {
    if (isOpen && user?.id) {
      setLoading(true)
      loadDKP()
    }
  }, [isOpen, user?.id])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDKP()
    setTimeout(() => setRefreshing(false), 500)
  }

  if (!isOpen) return null

  const classColor = CLASS_COLORS[user?.characterClass] || '#FFF'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-midnight-spaceblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-md shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-midnight-bright-purple bg-gradient-to-r from-midnight-purple to-midnight-bright-purple rounded-t-2xl">
          <h3 className="font-cinzel text-xl text-white flex items-center">
            <i className="fas fa-user-shield mr-3"></i>
            {t('character_stats') || 'Character Stats'}
          </h3>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <i className="fas fa-circle-notch fa-spin text-4xl text-midnight-glow"></i>
            </div>
          ) : (
            <>
              {/* Character Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-midnight-glow mb-1">{t('name')}</p>
                  <p className="text-lg font-bold" style={{ color: classColor }}>{user?.characterName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-midnight-glow mb-1">{t('class')}</p>
                  <p className="text-lg font-bold" style={{ color: classColor }}>{user?.characterClass || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-midnight-glow mb-1">{t('spec')}</p>
                  <p className="text-midnight-silver">{user?.spec || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-midnight-glow mb-1">{t('role')}</p>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    user?.raidRole === 'Tank' ? 'bg-blue-500' :
                    user?.raidRole === 'Healer' ? 'bg-green-500' : 'bg-red-500'
                  } text-white`}>
                    {user?.raidRole || 'DPS'}
                  </span>
                </div>
              </div>

              {/* DKP Stats */}
              <div className="border-t border-midnight-bright-purple border-opacity-30 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-midnight-glow">{t('total_gained') || 'Total Gained'}</span>
                  <span className="text-green-400 font-bold">+{dkpData.lifetimeGained || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-midnight-glow">{t('total_spent') || 'Total Spent'}</span>
                  <span className="text-red-400 font-bold">-{dkpData.lifetimeSpent || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-midnight-bright-purple border-opacity-30">
                  <span className="text-midnight-glow font-bold">{t('current_dkp') || 'Current DKP'}</span>
                  <span className="text-2xl font-bold text-midnight-glow" style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.8)' }}>
                    {dkpData.currentDkp || 0}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {refreshing ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <><i className="fas fa-sync-alt mr-2"></i>{t('refresh') || 'Refresh'}</>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-midnight-bright-purple text-midnight-silver rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
                >
                  {t('close') || 'Close'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CharacterProfileModal
