import { useState } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { useAuth } from '../../hooks/useAuth'

const BottomNav = ({ activeTab, setActiveTab, calendarBadge, auctionCount }) => {
  const [showMore, setShowMore] = useState(false)
  const { t } = useLanguage()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const mainTabs = [
    { id: 'members', icon: 'fa-users', label: t('members') },
    { id: 'auction', icon: 'fa-gavel', label: t('active_auction') },
    { id: 'calendar', icon: 'fa-calendar-alt', label: t('calendar') },
    { id: 'stats', icon: 'fa-chart-line', label: t('stats') },
  ]

  const moreTabs = [
    { id: 'history', icon: 'fa-history', label: t('auction_history') },
    { id: 'bosses', icon: 'fa-dragon', label: t('bosses') },
    { id: 'bis', icon: 'fa-scroll', label: t('bis') },
    ...(isAdmin ? [{ id: 'admin', icon: 'fa-crown', label: t('admin') }] : []),
  ]

  const isMoreActive = moreTabs.some(tab => tab.id === activeTab)

  const handleTabClick = (id) => {
    setActiveTab(id)
    setShowMore(false)
  }

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 left-0 right-0 bg-midnight-deepblue border-t border-midnight-bright-purple border-opacity-30 shadow-2xl animate-slide-up">
            {moreTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={(e) => { e.stopPropagation(); handleTabClick(tab.id) }}
                className={`w-full flex items-center gap-3 px-6 py-3.5 text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-midnight-purple bg-opacity-30 text-midnight-glow'
                    : 'text-midnight-silver hover:bg-midnight-purple hover:bg-opacity-10'
                }`}
              >
                <i className={`fas ${tab.icon} w-5 text-center`}></i>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-midnight-deepblue border-t border-midnight-bright-purple border-opacity-30 safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          {mainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                activeTab === tab.id
                  ? 'text-midnight-glow'
                  : 'text-midnight-silver opacity-60'
              }`}
            >
              <i className={`fas ${tab.icon} text-lg`}></i>
              <span className="text-[10px] mt-1 font-medium leading-none">{tab.label}</span>
              {/* Calendar badge */}
              {tab.id === 'calendar' && calendarBadge > 0 && activeTab !== 'calendar' && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse-subtle">
                  {calendarBadge}
                </span>
              )}
              {/* Auction count badge */}
              {tab.id === 'auction' && auctionCount > 0 && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 w-4 h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {auctionCount}
                </span>
              )}
            </button>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isMoreActive || showMore
                ? 'text-midnight-glow'
                : 'text-midnight-silver opacity-60'
            }`}
          >
            <i className={`fas fa-ellipsis-h text-lg`}></i>
            <span className="text-[10px] mt-1 font-medium leading-none">{t('more')}</span>
          </button>
        </div>
      </nav>
    </>
  )
}

export default BottomNav
