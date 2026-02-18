import { useState, useEffect } from 'react'
import { Users, CalendarDots, Gavel, ClockCounterClockwise, Skull } from '@phosphor-icons/react'
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
import AnalyticsTab from '../components/Analytics/AnalyticsTab'

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('members')
  const [calendarBadge, setCalendarBadge] = useState(0)
  const { t } = useLanguage()
  const { user } = useAuth()

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const checkUnconfirmed = async () => {
      try {
        const res = await calendarAPI.getMySignups(2)
        const dates = res.data.dates || []

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const getRaidWeekEndThursday = (dateStr) => {
          const d = new Date(dateStr + 'T00:00:00')
          const dayOfWeek = d.getDay()
          const thursdayDate = new Date(d)
          if (dayOfWeek === 1) thursdayDate.setDate(thursdayDate.getDate() + 3)
          else if (dayOfWeek === 3) thursdayDate.setDate(thursdayDate.getDate() + 1)
          return thursdayDate.toISOString().split('T')[0]
        }

        const sortedDates = [...dates].sort((a, b) => a.date.localeCompare(b.date))
        const weekMap = new Map()
        for (const signup of sortedDates) {
          const weekKey = getRaidWeekEndThursday(signup.date)
          if (!weekMap.has(weekKey)) weekMap.set(weekKey, [])
          weekMap.get(weekKey).push(signup)
        }

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
    { id: 'members', icon: Users, label: t('members') },
    { id: 'calendar', icon: CalendarDots, label: t('calendar') },
    { id: 'auction', icon: Gavel, label: t('active_auction') },
    { id: 'history', icon: ClockCounterClockwise, label: t('auction_history') },
    { id: 'bosses', icon: Skull, label: t('bosses') },
  ]

  return (
    <div className="flex min-h-screen flex-col gap-14 p-12">
      <Header tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mx-auto w-full max-w-[960px] animate-fade-in">
        {activeTab === 'members' && <MembersTab />}
        {activeTab === 'bosses' && <BossesTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'auction' && <AuctionTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'stats' && <AnalyticsTab />}
        {activeTab === 'admin' && isAdmin && <AdminTab />}
      </div>
    </div>
  )
}

export default Dashboard
