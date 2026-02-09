import { useState } from 'react'
import { SignOut, CaretDown } from '@phosphor-icons/react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { useSocket } from '../../hooks/useSocket'
import MyCharacterModal from '../Character/MyCharacterModal'
import DKPInfoModal from '../Common/DKPInfoModal'
import PillButton from '../UI/PillButton'

const Header = ({ tabs = [], activeTab, onTabChange }) => {
  const { user, logout, refreshUser } = useAuth()
  const { t, language, changeLanguage } = useLanguage()
  const [showCharacterModal, setShowCharacterModal] = useState(false)
  const [showDkpInfo, setShowDkpInfo] = useState(false)

  useSocket({
    dkp_updated: (data) => {
      if (data.userId === user?.id) refreshUser()
    },
    dkp_bulk_updated: () => refreshUser(),
  })

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

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => setShowCharacterModal(true)}
            className="flex items-center gap-3 h-12 rounded-full bg-lavender-12 pl-5 pr-2 py-2 transition-colors hover:bg-lavender-20"
          >
            <span className="text-base font-semibold text-cream">
              {user?.characterName || user?.username}
            </span>
            <span className="flex items-center justify-center h-full bg-indigo text-teal rounded-full px-3 py-1.5 text-sm font-bold">
              {user?.currentDkp || 0} DKP
            </span>
          </button>

          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="flex items-center gap-3 h-12 rounded-full bg-lavender-12 pl-5 pr-4 py-2 transition-colors hover:bg-lavender-20"
          >
            <span className="text-base font-semibold text-cream uppercase">
              {language}
            </span>
            <CaretDown size={16} weight="bold" className="text-cream" />
          </button>

          <PillButton
            icon={SignOut}
            iconOnly
            variant="inactive"
            onClick={logout}
            title={t('logout')}
          />
        </div>
      </nav>

      {showCharacterModal && (
        <MyCharacterModal onClose={() => setShowCharacterModal(false)} />
      )}
      {showDkpInfo && <DKPInfoModal onClose={() => setShowDkpInfo(false)} />}
    </>
  )
}

export default Header
