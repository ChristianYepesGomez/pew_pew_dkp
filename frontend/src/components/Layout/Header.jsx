import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'

const Header = ({ isConnected }) => {
  const { user, logout } = useAuth()
  const { t, language, changeLanguage } = useLanguage()

  return (
    <nav className="bg-gradient-to-r from-midnight-deepblue to-midnight-purple backdrop-blur-lg shadow-lg border-b-2 border-midnight-bright-purple py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center">
          <i className="fas fa-moon text-midnight-glow text-2xl mr-3"></i>
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

          {/* User */}
          <div className="flex items-center text-midnight-silver">
            <i className="fas fa-user mr-2"></i>
            <span>{user?.characterName || user?.username}</span>
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