import { useState, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { SignOut, CaretDown, IconContext, Crown, Translate, User, Users, Coins, Question, ClockCounterClockwise, Scroll, ShieldStar } from '@phosphor-icons/react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { useSocket } from '../../hooks/useSocket'
import { authAPI } from '../../services/api'
import MyCharacterModal from '../Character/MyCharacterModal'
import { CHARACTER_MODAL_VIEW, CHARACTER_MODAL_VIEW_ORDER } from '../Character/characterModalViews'
import PillButton from '../ui/PillButton'
import PopoverMenu, { PopoverMenuDivider, PopoverMenuItem } from '../ui/PopoverMenu'
import DKPInfoModal from '../Common/DKPInfoModal'
import MyCooldownsWidget from '../Cooldowns/MyCooldownsWidget'

const USER_MENU_ID = 'header-user-menu'

// Step 2 onboarding accent color (Blizzard blue)
const STEP2_COLOR = '#0ea5e9'

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

  // Onboarding step comes from the server (user.onboardingStep):
  //   0 = show DKP help button beacon (1/3)
  //   1 = inside DKP modal — Addons tab highlighted (2/3)
  //   2 = show user menu beacon → import button beacon inside modal (3/3)
  //   3 = done
  const [onboardingStep, setOnboardingStep] = useState(() => user?.onboardingStep ?? 3)

  const btnRef = useRef(null)
  const [btnRect, setBtnRect] = useState(null)
  const userMenuBtnRef = useRef(null)
  const [userMenuBtnRect, setUserMenuBtnRect] = useState(null)
  const isAdmin = user?.role === 'admin'
  const canManageCDs = isAdmin || user?.role === 'officer'

  // --- Cat logo easter egg ---
  const [isBaldomero, setIsBaldomero] = useState(false)
  const clickTimestampsRef = useRef([])
  const audioCtxRef = useRef(null)

  const playMeow = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
      const ctx = audioCtxRef.current
      const now = ctx.currentTime
      const duration = 0.65

      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(580, now)
      osc.frequency.linearRampToValueAtTime(880, now + 0.18)
      osc.frequency.linearRampToValueAtTime(500, now + 0.5)
      osc.frequency.linearRampToValueAtTime(380, now + duration)

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(900, now)
      filter.frequency.linearRampToValueAtTime(1700, now + 0.18)
      filter.frequency.linearRampToValueAtTime(1000, now + duration)
      filter.Q.value = 2

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.22, now + 0.06)
      gain.gain.setValueAtTime(0.18, now + 0.45)
      gain.gain.linearRampToValueAtTime(0, now + duration)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + duration)
    } catch (_e) {
      // Ignore audio errors silently
    }
  }, [])

  const handleLogoClick = useCallback(() => {
    playMeow()

    const now = Date.now()
    const recent = clickTimestampsRef.current.filter(t => now - t < 10000)
    recent.push(now)
    clickTimestampsRef.current = recent

    if (recent.length >= 10) {
      setIsBaldomero(prev => !prev)
      clickTimestampsRef.current = []
    }
  }, [playMeow])
  // --- end easter egg ---

  const showStep1Onboarding = onboardingStep === 0
  const showStep2Onboarding = onboardingStep === 2 && !showDkpInfo && !showCharacterModal
  const importOnboarding = onboardingStep === 2 && showCharacterModal

  // Measure help button for step 1
  useLayoutEffect(() => {
    if (!showStep1Onboarding) return
    const el = btnRef.current
    if (!el) return
    const update = () => setBtnRect(el.getBoundingClientRect())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [showStep1Onboarding])

  // Measure user menu button for step 2
  useLayoutEffect(() => {
    if (!showStep2Onboarding) return
    const el = userMenuBtnRef.current
    if (!el) return
    const update = () => setUserMenuBtnRect(el.getBoundingClientRect())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [showStep2Onboarding])

  const advanceOnboardingStep = async (step) => {
    setOnboardingStep(step)
    try {
      await authAPI.setOnboardingStep(step)
    } catch (_e) {
      // Non-critical: onboarding state may reset on next login, not worth blocking the user
    }
  }

  const handleHelpClick = () => {
    if (onboardingStep === 0) advanceOnboardingStep(1)
    setShowDkpInfo(true)
  }

  // Open Characters tab — onboarding completes only when user clicks "Import" inside modal
  const handleCharOnboardingClick = () => {
    openCharacterView(CHARACTER_MODAL_VIEW.CHARACTERS)
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

  const handleHistoryClick = () => {
    onTabChange?.('history')
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

  const handleCdManagerClick = () => {
    onTabChange?.('cooldowns')
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
          {/* Logo with clickable cat face — meow on every click, Baldomero after 10 clicks in 10s */}
          <div className="relative h-16" style={{ width: 'max-content' }}>
            <img
              src={isBaldomero ? '/logo-baldomero.svg' : '/logo.svg'}
              alt="Pew Pew Kittens with Guns"
              className="h-16 w-auto object-contain"
              style={{ transition: 'opacity 0.2s' }}
            />
            {/* Transparent overlay covering only the cat faces (~42.5% of SVG width = 104/245) */}
            <button
              onClick={handleLogoClick}
              className="absolute inset-y-0 left-0"
              style={{ width: '42.5%', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
              aria-label={isBaldomero ? '¡Baldomero!' : 'Meow!'}
              title={isBaldomero ? '¡Baldomero, el gato de Kel\'thuzad!' : 'Meow!'}
            />
          </div>
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

        <div className="flex items-center gap-3 shrink-0">
          {/* My cooldowns widget — visible only when user has assignments */}
          <MyCooldownsWidget />

          {/* Real button — invisible during step 1 onboarding, stays in layout for measurement */}
          <button
            ref={btnRef}
            onClick={handleHelpClick}
            style={showStep1Onboarding ? { visibility: 'hidden' } : undefined}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lavender hover:text-cream hover:bg-lavender-12 transition-colors"
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
              ref={userMenuBtnRef}
              style={showStep2Onboarding ? { visibility: 'hidden' } : undefined}
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
            leading={<ClockCounterClockwise size={18} />}
            onClick={handleHistoryClick}
          >
            {t('auction_history')}
          </PopoverMenuItem>

          <PopoverMenuItem
            leading={<Scroll size={18} />}
            onClick={handleBisClick}
          >
            {t('bis')}
          </PopoverMenuItem>

          {canManageCDs && (
            <PopoverMenuItem
              leading={<ShieldStar size={18} />}
              onClick={handleCdManagerClick}
            >
              CD Manager
            </PopoverMenuItem>
          )}

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
        </div>
      </nav>

      {showCharacterModal && (
        <MyCharacterModal
          initialTab={characterModalTab}
          showTabs={false}
          importOnboarding={importOnboarding}
          onImportClicked={() => advanceOnboardingStep(3)}
          onClose={() => setShowCharacterModal(false)}
        />
      )}

      {showDkpInfo && (
        <DKPInfoModal
          onClose={() => setShowDkpInfo(false)}
          onboardingStep={onboardingStep}
          onAdvanceOnboarding={advanceOnboardingStep}
        />
      )}

      {/* Onboarding portal — renders directly in document.body, above everything */}
      {(showStep1Onboarding || showStep2Onboarding) && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          {/* Dark overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />

          {/* Step 1: highlight the "?" help button */}
          {showStep1Onboarding && btnRect && (
            <>
              <span
                className="animate-ping"
                style={{
                  position: 'absolute',
                  left: btnRect.left,
                  top: btnRect.top,
                  width: btnRect.width,
                  height: btnRect.height,
                  borderRadius: '50%',
                  background: 'rgba(14,165,233,0.35)',
                  pointerEvents: 'none',
                }}
              />
              <button
                onClick={handleHelpClick}
                style={{
                  position: 'absolute',
                  left: btnRect.left,
                  top: btnRect.top,
                  width: btnRect.width,
                  height: btnRect.height,
                  borderRadius: '50%',
                  background: STEP2_COLOR,
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
                  borderBottom: `7px solid ${STEP2_COLOR}`,
                }} />
                <div style={{
                  background: STEP2_COLOR,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '6px 12px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}>
                  {t('onboarding_hint')}
                  <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 6 }}>1/3</span>
                </div>
              </div>
            </>
          )}

          {/* Step 2: highlight the user menu pill button */}
          {showStep2Onboarding && userMenuBtnRect && (
            <>
              <span
                className="animate-ping"
                style={{
                  position: 'absolute',
                  left: userMenuBtnRect.left - 4,
                  top: userMenuBtnRect.top - 4,
                  width: userMenuBtnRect.width + 8,
                  height: userMenuBtnRect.height + 8,
                  borderRadius: 9999,
                  background: 'rgba(14,165,233,0.35)',
                  pointerEvents: 'none',
                }}
              />
              <button
                onClick={handleCharOnboardingClick}
                style={{
                  position: 'absolute',
                  left: userMenuBtnRect.left,
                  top: userMenuBtnRect.top,
                  width: userMenuBtnRect.width,
                  height: userMenuBtnRect.height,
                  borderRadius: 9999,
                  background: STEP2_COLOR,
                  border: '2px solid rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  paddingLeft: 20,
                  paddingRight: 16,
                  zIndex: 1,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
                  {user?.characterName || user?.username}
                </span>
                <span style={{
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 9999,
                  padding: '4px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                }}>
                  {user?.currentDkp || 0} DKP
                </span>
              </button>
              <div
                style={{
                  position: 'absolute',
                  top: userMenuBtnRect.bottom + 8,
                  right: window.innerWidth - userMenuBtnRect.right,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{
                  marginRight: userMenuBtnRect.width / 2 - 7,
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderBottom: `7px solid ${STEP2_COLOR}`,
                }} />
                <div style={{
                  background: STEP2_COLOR,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '8px 14px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 3,
                }}>
                  <span>
                    {t('onboarding_chars_hint')}
                    <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 6 }}>3/3</span>
                  </span>
                  <span style={{ opacity: 0.85, fontWeight: 400, fontSize: 11 }}>
                    {t('onboarding_chars_sub')}
                  </span>
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
