import { useState, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  const btnRef = useRef(null)
  const [btnRect, setBtnRect] = useState(null)
  const isAdmin = user?.role === 'admin'

  // Measure the real button's position so the portal clone can sit on top of it exactly.
  useLayoutEffect(() => {
    if (hasSeenOnboarding) return
    const el = btnRef.current
    if (!el) return
    setBtnRect(el.getBoundingClientRect())
    const onResize = () => setBtnRect(el.getBoundingClientRect())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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

        {/* Real button — invisible during onboarding, stays in layout for measurement */}
        <button
          ref={btnRef}
          onClick={handleHelpClick}
          style={!hasSeenOnboarding ? { visibility: 'hidden' } : undefined}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lavender hover:text-cream hover:bg-lavender-12 transition-colors"
          title={t('dkp_how_it_works')}
        >
          <Question size={20} />
        </button>

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

      {showCharacterModal && (
        <MyCharacterModal
          initialTab={characterModalTab}
          showTabs={false}
          onClose={() => setShowCharacterModal(false)}
        />
      )}

      {showDkpInfo && <DKPInfoModal onClose={() => setShowDkpInfo(false)} />}

      {/* Onboarding portal — renders directly in document.body, above everything */}
      {!hasSeenOnboarding && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          {/* Dark overlay — covers all content */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />

          {/* Clone button + callout — only rendered once position is measured */}
          {btnRect && (
            <>
              {/* Ping beacon */}
              <span
                className="animate-ping"
                style={{
                  position: 'absolute',
                  left: btnRect.left,
                  top: btnRect.top,
                  width: btnRect.width,
                  height: btnRect.height,
                  borderRadius: '50%',
                  background: 'rgba(255,175,157,0.5)',
                  pointerEvents: 'none',
                }}
              />
              {/* Clickable clone button */}
              <button
                onClick={handleHelpClick}
                style={{
                  position: 'absolute',
                  left: btnRect.left,
                  top: btnRect.top,
                  width: btnRect.width,
                  height: btnRect.height,
                  borderRadius: '50%',
                  background: '#ffaf9d',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
                title={t('dkp_how_it_works')}
              >
                <Question size={20} />
              </button>
              {/* Callout tooltip */}
              <div
                style={{
                  position: 'absolute',
                  top: btnRect.bottom + 8,
                  right: window.innerWidth - btnRect.right,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{
                  marginRight: 14,
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderBottom: '7px solid #ffaf9d',
                }} />
                <div style={{
                  background: '#ffaf9d',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '6px 12px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}>
                  {t('onboarding_hint')}
                </div>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

export default Header
