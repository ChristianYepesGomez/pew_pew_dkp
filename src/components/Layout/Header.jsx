import { useState, useEffect, useRef } from 'react'
import { SignOut, CaretDown, IconContext, Crown, Translate, User, Users, Coins, Question, ChartLine, Scroll } from '@phosphor-icons/react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { useSocket } from '../../hooks/useSocket'
import MyCharacterModal from '../Character/MyCharacterModal'
import { CHARACTER_MODAL_VIEW, CHARACTER_MODAL_VIEW_ORDER } from '../Character/characterModalViews'
import PillButton from '../ui/PillButton'
import PopoverMenu, { PopoverMenuDivider, PopoverMenuItem } from '../ui/PopoverMenu'
import DKPInfoModal from '../Common/DKPInfoModal'

const USER_MENU_ID = 'header-user-menu'

const VIEW_ICON_MAP = {
  [CHARACTER_MODAL_VIEW.ACCOUNT]: User,
  [CHARACTER_MODAL_VIEW.CHARACTERS]: Users,
  [CHARACTER_MODAL_VIEW.DKP]: Coins,
}

const VIEW_LABEL_KEY_MAP = {
  [CHARACTER_MODAL_VIEW.ACCOUNT]: 'tab_account',
  [CHARACTER_MODAL_VIEW.CHARACTERS]: 'tab_characters',
  [CHARACTER_MODAL_VIEW.DKP]: 'tab_dkp',
}

const Header = ({ tabs = [], activeTab, onTabChange }) => {
  const { user, logout, refreshUser } = useAuth()
  const { t, language, changeLanguage } = useLanguage()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [characterModalTab, setCharacterModalTab] = useState(CHARACTER_MODAL_VIEW.ACCOUNT)
  const [showDkpInfo, setShowDkpInfo] = useState(false)
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(
    () => !!localStorage.getItem(`dkp_onboarding_seen_${user?.id}`)
  )
  const helpButtonRef = useRef(null)
  const isAdmin = user?.role === 'admin'

  // Block all clicks except the ? button until onboarding is done.
  // Uses capture phase so it fires before any other handler, bypassing z-index issues.
  useEffect(() => {
    if (hasSeenOnboarding) return
    const blockClick = (e) => {
      if (helpButtonRef.current?.contains(e.target)) return
      e.stopPropagation()
      e.preventDefault()
    }
    document.addEventListener('click', blockClick, true)
    document.addEventListener('mousedown', blockClick, true)
    return () => {
      document.removeEventListener('click', blockClick, true)
      document.removeEventListener('mousedown', blockClick, true)
    }
  }, [hasSeenOnboarding])

  const markOnboardingSeen = () => {
    if (user?.id) localStorage.setItem(`dkp_onboarding_seen_${user.id}`, '1')
    setHasSeenOnboarding(true)
  }

  const handleHelpClick = () => {
    if (!hasSeenOnboarding) markOnboardingSeen()
    setShowDkpInfo(true)
  }

  useSocket({
    dkp_updated: (data) => {
      if (data.userId === user?.id) refreshUser()
    },
    dkp_bulk_updated: () => refreshUser(),
  })

  const closeUserMenu = () => setShowUserMenu(false)

  const openCharacterView = (view) => {
    setCharacterModalTab(view)
    setShowCharacterModal(true)
    closeUserMenu()
  }

  const handleStatsClick = () => {
    onTabChange?.('stats')
    closeUserMenu()
  }

  const handleBisClick = () => {
    onTabChange?.('bis')
    closeUserMenu()
  }

  const handleAdminClick = () => {
    onTabChange?.('admin')
    closeUserMenu()
  }

  const handleToggleLanguage = () => {
    changeLanguage(language === 'es' ? 'en' : 'es')
    closeUserMenu()
  }

  const handleLogout = () => {
    closeUserMenu()
    logout()
  }

  return (
    <>
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/logo.svg"
            alt="Pew Pew Kittens with Guns"
            className="h-16 w-auto object-contain"
          />
        </div>

        <IconContext.Provider value={{ weight: 'regular' }}>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {tabs.map((tab) => (
              <PillButton
                key={tab.id}
                icon={tab.icon}
                active={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </PillButton>
            ))}
          </div>
        </IconContext.Provider>

        <div className={`shrink-0${!hasSeenOnboarding ? ' relative' : ''}`}>
          {!hasSeenOnboarding && (
            <span className="absolute inset-0 rounded-full bg-coral/50 animate-ping pointer-events-none" />
          )}
          <button
            ref={helpButtonRef}
            onClick={handleHelpClick}
            className={`relative shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              !hasSeenOnboarding
                ? 'text-cream bg-coral hover:bg-coral/80'
                : 'text-lavender hover:text-cream hover:bg-lavender-12'
            }`}
            title={t('dkp_how_it_works')}
          >
            <Question size={20} />
          </button>
          {!hasSeenOnboarding && (
            <div className="absolute top-full right-0 mt-2 flex flex-col items-end pointer-events-none">
              <div className="mr-[14px] w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent border-b-coral" />
              <div className="bg-coral text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap font-semibold shadow-lg">
                {t('onboarding_hint')}
              </div>
            </div>
          )}
        </div>

        <PopoverMenu
          open={showUserMenu}
          onOpenChange={setShowUserMenu}
          menuId={USER_MENU_ID}
          menuClassName="w-56"
          containerClassName="shrink-0"
          trigger={({ open, triggerProps }) => (
            <button
              {...triggerProps}
              className="flex items-center gap-3 h-12 rounded-full bg-lavender-12 pl-5 pr-4 py-2 transition-colors hover:bg-lavender-20"
              aria-label={t('my_character')}
            >
              <span className="text-base font-semibold text-cream">
                {user?.characterName || user?.username}
              </span>
              <span className="flex items-center justify-center h-full bg-indigo text-teal rounded-full px-3 py-1.5 text-sm font-bold">
                {user?.currentDkp || 0} DKP
              </span>
              <CaretDown
                size={16}
                className={`text-cream transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        >
        
          {CHARACTER_MODAL_VIEW_ORDER.map((view) => {
            const ViewIcon = VIEW_ICON_MAP[view]
            return (
              <PopoverMenuItem
                key={view}
                leading={<ViewIcon size={18} />}
                onClick={() => openCharacterView(view)}
              >
                {t(VIEW_LABEL_KEY_MAP[view])}
              </PopoverMenuItem>
            )
          })}

          <PopoverMenuDivider />

          <PopoverMenuItem
            leading={<ChartLine size={18} />}
            onClick={handleStatsClick}
          >
            {t('stats')}
          </PopoverMenuItem>

          <PopoverMenuItem
            leading={<Scroll size={18} />}
            onClick={handleBisClick}
          >
            {t('bis')}
          </PopoverMenuItem>

          {isAdmin && (
            <>
              <PopoverMenuItem
                leading={<Crown size={18} />}
                onClick={handleAdminClick}
              >
                {t('admin')}
              </PopoverMenuItem>
            </>
          )}

          <PopoverMenuItem
            leading={<Translate size={18} />}
            onClick={handleToggleLanguage}
            trailing={(
              <span className="rounded-full bg-indigo px-2.5 py-1 text-xs font-bold uppercase text-teal">
                {language}
              </span>
            )}
          >
            {t('language')}
          </PopoverMenuItem>

          <PopoverMenuItem
            leading={<SignOut size={18} />}
            onClick={handleLogout}
          >
            {t('logout')}
          </PopoverMenuItem>
        </PopoverMenu>
      </nav>

      {!hasSeenOnboarding && (
        <div className="fixed inset-0 z-[49] bg-black/70 pointer-events-none" />
      )}

      {showCharacterModal && (
        <MyCharacterModal
          initialTab={characterModalTab}
          showTabs={false}
          onClose={() => setShowCharacterModal(false)}
        />
      )}

      {showDkpInfo && <DKPInfoModal onClose={() => setShowDkpInfo(false)} />}
    </>
  )
}

export default Header
