import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { calendarAPI } from '../services/api'
import Header from '../components/Layout/Header'
import MembersTab from '../components/Roster/MembersTab'
import AuctionTab from '../components/Auction/AuctionTab'
import HistoryTab from '../components/Auction/HistoryTab'
import CalendarTab from '../components/Calendar/CalendarTab'
import AdminTab from '../components/Admin/AdminTab'
import BossesTab from '../components/Bosses/BossesTab'

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('members')
  const [calendarBadge, setCalendarBadge] = useState(0)
  const { t } = useLanguage()
  const { user } = useAuth()

  const isAdmin = user?.role === 'admin'
  const isOfficer = user?.role === 'officer'
  const canManage = isAdmin || isOfficer

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
  }, [activeTab])

  const tabs = [
    { id: 'members', icon: 'fa-users', label: t('members') },
    { id: 'calendar', icon: 'fa-calendar-alt', label: t('calendar') },
    { id: 'auction', icon: 'fa-gavel', label: t('active_auction') },
    { id: 'history', icon: 'fa-history', label: t('auction_history') },
    { id: 'bosses', icon: 'fa-dragon', label: t('bosses') },
  ]

  // Only admin can see Admin tab (not officers)
  if (isAdmin) tabs.push({ id: 'admin', icon: 'fa-crown', label: t('admin') })

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Tabs - Centered */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 border-b-2 border-midnight-bright-purple border-opacity-30 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-6 py-3 rounded-t-lg font-cinzel text-base tracking-wide transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white shadow-lg'
                  : 'bg-transparent text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-10'
              }`}
            >
              <i className={`fas ${tab.icon} mr-2`}></i>
              {tab.label}
              {tab.id === 'calendar' && calendarBadge > 0 && activeTab !== 'calendar' && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse-subtle">
                  {calendarBadge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {activeTab === 'members' && <MembersTab />}
          {activeTab === 'bosses' && <BossesTab />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'auction' && <AuctionTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'admin' && isAdmin && <AdminTab />}
        </div>
      </div>
    </div>
  )
}

export default Dashboard