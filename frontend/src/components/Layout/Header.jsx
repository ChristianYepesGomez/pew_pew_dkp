import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import CatLogo from './CatLogo'

const Header = ({ isConnected, userDkp = 0, onProfileClick, onRefreshDkp, refreshingDkp = false }) => {
  const { user, logout } = useAuth()
  const { t, language, changeLanguage } = useLanguage()

  return (
    <nav className="bg-gradient-to-r from-midnight-deepblue to-midnight-purple backdrop-blur-lg shadow-lg border-b-2 border-midnight-bright-purple py-4 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center">
          <CatLogo size={42} className="mr-3 drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
          <div>
            <h1 className="font-cinzel text-xl font-bold text-midnight-silver" style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.8)' }}>
              {t('guild_name')}
            </h1>
            <small className="text-xs text-midnight-glow opacity-80">{t('midnight_edition')}</small>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center">
            <span className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-400'}`}></span>
            <small className="text-midnight-silver">{isConnected ? t('connected') : t('disconnected')}</small>
          </div>

          {/* User Profile Button */}
          <div className="flex items-center rounded-lg border border-midnight-bright-purple overflow-hidden">
            <button
              onClick={onProfileClick}
              className="flex items-center px-4 py-2 hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
            >
              <i className="fas fa-user mr-2 text-midnight-glow"></i>
              <span className="text-midnight-silver">{user?.characterName || user?.username}</span>
            </button>
            <button
              onClick={onRefreshDkp}
              disabled={refreshingDkp}
              className="px-3 py-2 bg-midnight-bright-purple bg-opacity-20 hover:bg-opacity-40 transition-all border-l border-midnight-bright-purple"
              title={t('refresh')}
            >
              {refreshingDkp ? (
                <i className="fas fa-circle-notch fa-spin text-midnight-glow"></i>
              ) : (
                <span className="text-midnight-glow font-bold">({userDkp})</span>
              )}
            </button>
          </div>

          {/* Language */}
          <button onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')} className="px-3 py-1 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all">
            {language === 'es' ? '🇪🇸' : '🇬🇧'}
          </button>

          {/* Logout */}
          <button onClick={logout} className="px-4 py-2 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-red-500 hover:border-red-500 transition-all">
            <i className="fas fa-sign-out-alt mr-2"></i>
            {t('logout')}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Header