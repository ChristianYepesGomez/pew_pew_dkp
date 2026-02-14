import { useState, useEffect, useCallback } from 'react'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Refresh user data when DKP changes
  useSocket({
    dkp_updated: (data) => {
      if (data.userId === user?.id) refreshUser()
    },
    dkp_bulk_updated: () => refreshUser(),
  })

  // Close mobile menu on ESC
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') setMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen, handleKeyDown])

  return (
    <>
      <nav className="bg-gradient-to-r from-midnight-deepblue to-midnight-purple backdrop-blur-lg shadow-lg border-b-2 border-midnight-bright-purple py-4" role="navigation" aria-label="Main navigation">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center">
            <div>
              <h1 className="font-cinzel text-xl font-bold text-midnight-silver" style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.8)' }}>
                {t('guild_name')}
              </h1>
              <small className="text-xs text-midnight-glow opacity-80">{t('midnight_edition')}</small>
            </div>
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center space-x-4">
            {/* User button - opens character modal */}
            <button
              onClick={() => setShowCharacterModal(true)}
              className="flex items-center text-midnight-silver hover:text-white transition-colors cursor-pointer px-3 py-2 rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20 min-h-[44px]"
              aria-label={t('my_character')}
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
              className="px-3 py-2 rounded-lg text-red-400 hover:bg-red-500 hover:bg-opacity-20 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t('logout')}
              title={t('logout')}
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>

            {/* DKP Help */}
            <button
              onClick={() => setShowDkpInfo(true)}
              className="px-3 py-2 rounded-lg text-midnight-silver hover:text-midnight-glow hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t('dkp_how_it_works')}
              title={t('dkp_how_it_works')}
            >
              <i className="fas fa-question-circle"></i>
            </button>

            {/* Language */}
            <button
              onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
              className="px-3 py-1 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all min-h-[44px] flex items-center justify-center"
              aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              {language === 'es' ? '🇪🇸' : '🇬🇧'}
            </button>
          </div>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-midnight-silver hover:text-white transition-colors rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20"
            aria-label={mobileMenuOpen ? t('close_menu') : t('open_menu')}
            aria-expanded={mobileMenuOpen}
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </button>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-midnight-bright-purple border-opacity-30 mt-4 pt-4 px-4 space-y-2 animate-fade-in">
            {/* User info */}
            <button
              onClick={() => { setShowCharacterModal(true); setMobileMenuOpen(false) }}
              className="w-full flex items-center text-midnight-silver hover:text-white transition-colors px-3 py-3 rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20 min-h-[44px]"
            >
              <div
                className="w-8 h-8 rounded-full mr-3 overflow-hidden border-2 flex-shrink-0"
                style={{ borderColor: user?.characterClass ? (CLASS_COLORS[user.characterClass] || '#A78BFA') : '#A78BFA' }}
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src="/logo.png" alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="text-left flex-1">
                <span className="block font-bold" style={{ color: user?.characterClass ? (CLASS_COLORS[user.characterClass] || '#A78BFA') : '#A78BFA' }}>
                  {user?.characterName || user?.username}
                </span>
                <span className="text-midnight-glow text-sm font-bold">{user?.currentDkp || 0} DKP</span>
              </div>
              <i className="fas fa-chevron-right text-midnight-silver opacity-50"></i>
            </button>

            {/* DKP Help */}
            <button
              onClick={() => { setShowDkpInfo(true); setMobileMenuOpen(false) }}
              className="w-full flex items-center gap-3 text-midnight-silver hover:text-white transition-colors px-3 py-3 rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20 min-h-[44px]"
            >
              <i className="fas fa-question-circle w-5 text-center"></i>
              <span>{t('dkp_how_it_works')}</span>
            </button>

            {/* Language */}
            <button
              onClick={() => { changeLanguage(language === 'es' ? 'en' : 'es'); setMobileMenuOpen(false) }}
              className="w-full flex items-center gap-3 text-midnight-silver hover:text-white transition-colors px-3 py-3 rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20 min-h-[44px]"
            >
              <span className="w-5 text-center">{language === 'es' ? '🇪🇸' : '🇬🇧'}</span>
              <span>{language === 'es' ? 'Español' : 'English'}</span>
            </button>

            {/* Logout */}
            <button
              onClick={() => { logout(); setMobileMenuOpen(false) }}
              className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors px-3 py-3 rounded-lg hover:bg-red-500 hover:bg-opacity-20 min-h-[44px]"
            >
              <i className="fas fa-sign-out-alt w-5 text-center"></i>
              <span>{t('logout')}</span>
            </button>
          </div>
        )}
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
