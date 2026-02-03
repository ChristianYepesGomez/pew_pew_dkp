import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import Header from '../components/Layout/Header'
import MembersTab from '../components/Roster/MembersTab'
import AuctionTab from '../components/Auction/AuctionTab'
import HistoryTab from '../components/Auction/HistoryTab'
import CalendarTab from '../components/Calendar/CalendarTab'
import AdminTab from '../components/Admin/AdminTab'

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('members')
  const { t } = useLanguage()
  const { user } = useAuth()

  const isAdmin = user?.role === 'admin'
  const isOfficer = user?.role === 'officer'
  const canManage = isAdmin || isOfficer

  const tabs = [
    { id: 'members', icon: 'fa-users', label: t('members') },
    { id: 'calendar', icon: 'fa-calendar-alt', label: t('calendar') },
    { id: 'auction', icon: 'fa-gavel', label: t('active_auction') },
    { id: 'history', icon: 'fa-history', label: t('auction_history') },
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
              className={`px-6 py-3 rounded-t-lg font-cinzel text-base tracking-wide transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white shadow-lg'
                  : 'bg-transparent text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-10'
              }`}
            >
              <i className={`fas ${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {activeTab === 'members' && <MembersTab />}
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