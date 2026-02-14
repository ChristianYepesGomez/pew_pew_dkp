import { useState, useEffect, lazy, Suspense } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { calendarAPI, membersAPI, auctionsAPI, bossesAPI } from '../services/api'
import Header from '../components/Layout/Header'
import BottomNav from '../components/PWA/BottomNav'
import InstallPrompt from '../components/PWA/InstallPrompt'
import OfflineBanner from '../components/PWA/OfflineBanner'
import MembersTab from '../components/Roster/MembersTab'

// Lazy load non-critical tabs
const AuctionTab = lazy(() => import('../components/Auction/AuctionTab'))
const HistoryTab = lazy(() => import('../components/Auction/HistoryTab'))
const CalendarTab = lazy(() => import('../components/Calendar/CalendarTab'))
const AdminTab = lazy(() => import('../components/Admin/AdminTab'))
const BossesTab = lazy(() => import('../components/Bosses/BossesTab'))
const BISTab = lazy(() => import('../components/BIS/BISTab'))
const AnalyticsTab = lazy(() => import('../components/Analytics/AnalyticsTab'))

const TabFallback = () => (
  <div className="flex items-center justify-center py-16">
    <i className="fas fa-circle-notch fa-spin text-3xl text-midnight-glow"></i>
  </div>
)

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('members')
  const [calendarBadge, setCalendarBadge] = useState(0)
  const [auctionCount, setAuctionCount] = useState(0)
  const { t } = useLanguage()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const prefetchMap = {
    members: () => queryClient.prefetchQuery({ queryKey: ['members'], queryFn: () => membersAPI.getAll().then(r => r.data) }),
    auction: () => queryClient.prefetchQuery({ queryKey: ['auctions', 'active'], queryFn: () => auctionsAPI.getActive().then(r => r.data) }),
    history: () => queryClient.prefetchQuery({ queryKey: ['auctions', 'history'], queryFn: () => auctionsAPI.getHistory().then(r => r.data) }),
    calendar: () => queryClient.prefetchQuery({ queryKey: ['calendar', 'signups', 2], queryFn: () => calendarAPI.getMySignups(2).then(r => r.data) }),
    bosses: () => queryClient.prefetchQuery({ queryKey: ['bosses'], queryFn: () => bossesAPI.getAll().then(r => r.data) }),
  }

  const isAdmin = user?.role === 'admin'

  // Check for unconfirmed calendar days to show badge
  // Must match CalendarTab logic: group by raid week, limit to 2 weeks, exclude past days
  useEffect(() => {
    const checkUnconfirmed = async () => {
      try {
        const res = await calendarAPI.getMySignups(2)
        const dates = res.data.dates || []

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Helper: get the Thursday that ends this raid week (matches CalendarTab)
        const getRaidWeekEndThursday = (dateStr) => {
          const d = new Date(dateStr + 'T00:00:00')
          const dayOfWeek = d.getDay()
          const thursdayDate = new Date(d)
          if (dayOfWeek === 1) thursdayDate.setDate(thursdayDate.getDate() + 3)
          else if (dayOfWeek === 3) thursdayDate.setDate(thursdayDate.getDate() + 1)
          return thursdayDate.toISOString().split('T')[0]
        }

        // Group by raid week
        const sortedDates = [...dates].sort((a, b) => a.date.localeCompare(b.date))
        const weekMap = new Map()
        for (const signup of sortedDates) {
          const weekKey = getRaidWeekEndThursday(signup.date)
          if (!weekMap.has(weekKey)) weekMap.set(weekKey, [])
          weekMap.get(weekKey).push(signup)
        }

        // Limit to 2 weeks, count unconfirmed (excluding past days)
        const weeks = Array.from(weekMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(0, 2)

        const count = weeks.reduce((total, [, weekSignups]) => {
          return total + weekSignups.filter(s => {
            const signupDate = new Date(s.date + 'T00:00:00')
            const isPast = signupDate < today
            return !s.status && !s.isLocked && !isPast
          }).length
        }, 0)

        setCalendarBadge(count)
      } catch { /* silent */ }
    }
    checkUnconfirmed()

    // Fetch active auction count for bottom nav badge
    const fetchAuctionCount = async () => {
      try {
        const res = await auctionsAPI.getActive()
        setAuctionCount(res.data.auctions?.length || 0)
      } catch { /* silent */ }
    }
    fetchAuctionCount()
  }, [activeTab])

  const tabs = [
    { id: 'members', icon: 'fa-users', label: t('members') },
    { id: 'calendar', icon: 'fa-calendar-alt', label: t('calendar') },
    { id: 'auction', icon: 'fa-gavel', label: t('active_auction') },
    { id: 'history', icon: 'fa-history', label: t('auction_history') },
    { id: 'bosses', icon: 'fa-dragon', label: t('bosses') },
    { id: 'bis', icon: 'fa-scroll', label: t('bis') },
    { id: 'stats', icon: 'fa-chart-line', label: t('stats') },
  ]

  // Only admin can see Admin tab (not officers)
  if (isAdmin) tabs.push({ id: 'admin', icon: 'fa-crown', label: t('admin') })

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <OfflineBanner />
      <InstallPrompt />
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Tabs - Hidden on mobile (replaced by BottomNav), visible on desktop */}
        <div className="hidden md:flex flex-wrap justify-center gap-2 mb-8 border-b-2 border-midnight-bright-purple border-opacity-30 pb-4" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => prefetchMap[tab.id]?.()}
              className={`relative px-4 sm:px-6 py-3 rounded-t-lg font-cinzel text-sm sm:text-base tracking-wide transition-all duration-300 min-h-[44px] ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white shadow-lg'
                  : 'bg-transparent text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-10'
              }`}
            >
              <i className={`fas ${tab.icon} mr-1 sm:mr-2`}></i>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === 'calendar' && calendarBadge > 0 && activeTab !== 'calendar' && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse-subtle" aria-label={`${calendarBadge} unconfirmed`}>
                  {calendarBadge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in" role="tabpanel">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'members' && <MembersTab />}
            {activeTab === 'bosses' && <BossesTab />}
            {activeTab === 'calendar' && <CalendarTab />}
            {activeTab === 'auction' && <AuctionTab />}
            {activeTab === 'history' && <HistoryTab />}
            {activeTab === 'bis' && <BISTab />}
            {activeTab === 'stats' && <AnalyticsTab />}
            {activeTab === 'admin' && isAdmin && <AdminTab />}
          </Suspense>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        calendarBadge={calendarBadge}
        auctionCount={auctionCount}
      />
    </div>
  )
}

export default Dashboard
