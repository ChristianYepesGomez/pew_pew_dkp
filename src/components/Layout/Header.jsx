import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
}

const Header = () => {
  const { user, logout } = useAuth()
  const { t, language, changeLanguage } = useLanguage()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
          {/* User dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center text-midnight-silver hover:text-white transition-colors cursor-pointer px-3 py-2 rounded-lg hover:bg-midnight-bright-purple hover:bg-opacity-20"
            >
              <i className="fas fa-user mr-2"></i>
              <span style={{ color: CLASS_COLORS[user?.characterClass] || '#FFF' }}>
                {user?.characterName || user?.username}
              </span>
              <i className={`fas fa-chevron-down ml-2 text-xs transition-transform ${showUserMenu ? 'rotate-180' : ''}`}></i>
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-midnight-deepblue border border-midnight-bright-purple rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-4 border-b border-midnight-bright-purple border-opacity-30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-midnight-purple flex items-center justify-center">
                      <i className="fas fa-user-shield text-2xl text-midnight-glow"></i>
                    </div>
                    <div>
                      <p className="font-bold text-lg" style={{ color: CLASS_COLORS[user?.characterClass] || '#FFF' }}>
                        {user?.characterName}
                      </p>
                      <p className="text-sm text-midnight-silver">{user?.characterClass} - {user?.spec || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-midnight-purple bg-opacity-30 rounded-lg p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${user?.raidRole === 'Tank' ? 'bg-blue-500' : user?.raidRole === 'Healer' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                        {user?.raidRole || 'DPS'}
                      </span>
                    </div>
                    <div className="bg-midnight-purple bg-opacity-30 rounded-lg p-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${user?.role === 'admin' ? 'bg-yellow-600' : user?.role === 'officer' ? 'bg-purple-600' : 'bg-gray-600'} text-white`}>
                        {t('role_' + (user?.role || 'raider'))}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-midnight-glow font-bold text-2xl">{user?.currentDkp || 0}</span>
                    <span className="text-midnight-silver text-sm ml-2">DKP</span>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500 hover:bg-opacity-20 rounded-lg transition-colors"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                    {t('logout')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Language */}
          <button onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')} className="px-3 py-1 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all">
            {language === 'es' ? '🇪🇸' : '🇬🇧'}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Header