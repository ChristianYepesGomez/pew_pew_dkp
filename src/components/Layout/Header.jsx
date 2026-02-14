import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { useSocket } from '../../hooks/useSocket'
import MyCharacterModal from '../Character/MyCharacterModal'
import DKPInfoModal from '../Common/DKPInfoModal'
import { CLASS_COLORS } from '../../utils/constants'

const Header = () => {
  const { user, logout, refreshUser } = useAuth()
  const { t, language, changeLanguage } = useLanguage()
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [showDkpInfo, setShowDkpInfo] = useState(false)

  // Refresh user data when DKP changes
  useSocket({
    dkp_updated: (data) => {
      if (data.userId === user?.id) refreshUser()
    },
    dkp_bulk_updated: () => refreshUser(),
  })

  return (
    <>
      <nav className="bg-gradient-to-r from-midnight-deepblue to-midnight-purple backdrop-blur-lg shadow-lg border-b-2 border-midnight-bright-purple py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center">
            <div>
              <h1 className="font-cinzel text-xl font-bold text-midnight-silver" style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.8)' }}>
                {t('guild_name')}
              </h1>
              <small className="text-xs text-midnight-glow opacity-80">{t('midnight_edition')}</small>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* User button - opens character modal */}
            <button
              onClick={() => setShowCharacterModal(true)}
              className="flex items-center text-midnight-silver hover:text-white transition-colors cursor-pointer px-3 py-2 rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20"
            >
              <div
                className="w-8 h-8 rounded-full mr-2 overflow-hidden border-2 flex-shrink-0"
                style={{ borderColor: user?.characterClass ? (CLASS_COLORS[user.characterClass] || '#A78BFA') : '#A78BFA' }}
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src="/logo.png" alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <span style={{ color: user?.characterClass ? (CLASS_COLORS[user.characterClass] || '#A78BFA') : '#A78BFA' }}>
                {user?.characterName || user?.username}
              </span>
              {!user?.characterName && (
                <span className="ml-1 text-xs text-midnight-silver opacity-60">({t('no_character')})</span>
              )}
              <span className="ml-2 text-midnight-glow font-bold">({user?.currentDkp || 0} DKP)</span>
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="px-3 py-2 rounded-lg text-red-400 hover:bg-red-500 hover:bg-opacity-20 transition-all"
              title={t('logout')}
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>

            {/* DKP Help */}
            <button
              onClick={() => setShowDkpInfo(true)}
              className="px-3 py-2 rounded-lg text-midnight-silver hover:text-midnight-glow hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
              title={t('dkp_how_it_works')}
            >
              <i className="fas fa-question-circle"></i>
            </button>

            {/* Language */}
            <button onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')} className="px-3 py-1 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all">
              {language === 'es' ? '🇪🇸' : '🇬🇧'}
            </button>
          </div>
        </div>
      </nav>

      {/* Character Modal - rendered outside nav to avoid positioning issues */}
      {showCharacterModal && (
        <MyCharacterModal onClose={() => setShowCharacterModal(false)} />
      )}

      {/* DKP Info Modal */}
      {showDkpInfo && <DKPInfoModal onClose={() => setShowDkpInfo(false)} />}
    </>
  )
}

export default Header