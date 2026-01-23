import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'

const Header = () => {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const { t, language, changeLanguage } = useLanguage()

  return (
    <nav className="bg-gradient-to-r from-midnight-deepblue to-midnight-purple backdrop-blur-xl shadow-lg border-b-2 border-midnight-bright-purple py-4">
      <div className="container mx-auto px-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <i className="fas fa-moon text-3xl text-midnight-glow"></i>
          <div className="font-cinzel">
            <div className="text-2xl text-midnight-silver font-bold tracking-wider" style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.8), 0 0 20px rgba(139, 92, 246, 0.6)' }}>
              {t('guild_name')}
            </div>
            <div className="text-xs text-midnight-silver opacity-80 tracking-widest uppercase">
              {t('midnight_edition')}
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-green-400 shadow-glow-green' : 'bg-red-400'
              }`}
              style={connected ? { boxShadow: '0 0 10px #34d399' } : {}}
            ></div>
            <span className="text-sm text-midnight-silver">
              {connected ? t('connected') : t('disconnected')}
            </span>
          </div>

          {/* Username */}
          <div className="flex items-center space-x-2 text-midnight-silver">
            <i className="fas fa-user"></i>
            <span>{user?.characterName || user?.username}</span>
          </div>

          {/* Language Selector */}
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="px-3 py-1 rounded-lg bg-midnight-purple bg-opacity-50 hover:bg-opacity-70 text-midnight-silver text-sm transition-all"
          >
            {language === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all flex items-center space-x-2"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span>{t('logout')}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Header
