import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { dkpAPI } from '../services/api'
import Header from '../components/Layout/Header'
import MembersTab from '../components/Roster/MembersTab'
import AuctionTab from '../components/Auction/AuctionTab'
import HistoryTab from '../components/Auction/HistoryTab'
import AdminTab from '../components/Admin/AdminTab'
import CharacterProfileModal from '../components/Profile/CharacterProfileModal'

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('members')
  const [profileOpen, setProfileOpen] = useState(false)
  const [userDkp, setUserDkp] = useState(0)
  const [refreshingDkp, setRefreshingDkp] = useState(false)
  const { t } = useLanguage()
  const { user } = useAuth()
  const isConnected = false

  const isAdmin = user?.role === 'admin' || user?.role === 'officer'

  // Load user's DKP
  const loadUserDkp = async () => {
    if (!user?.id) return
    try {
      const response = await dkpAPI.getHistory(user.id)
      setUserDkp(response.data.currentDkp || 0)
    } catch (error) {
      console.error('Error loading user DKP:', error)
    }
  }

  useEffect(() => {
    loadUserDkp()
  }, [user?.id])

  const handleRefreshDkp = async () => {
    setRefreshingDkp(true)
    await loadUserDkp()
    setTimeout(() => setRefreshingDkp(false), 500)
  }

  const tabs = [
    { id: 'members', icon: 'fa-users', label: t('members') },
    { id: 'auction', icon: 'fa-gavel', label: t('active_auction') },
    { id: 'history', icon: 'fa-history', label: t('auction_history') },
  ]

  if (isAdmin) tabs.push({ id: 'admin', icon: 'fa-crown', label: t('admin') })

  return (
    <div className="min-h-screen">
      <Header
        isConnected={isConnected}
        userDkp={userDkp}
        onProfileClick={() => setProfileOpen(true)}
        onRefreshDkp={handleRefreshDkp}
        refreshingDkp={refreshingDkp}
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b-2 border-midnight-bright-purple border-opacity-30 pb-4">
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
          {activeTab === 'auction' && <AuctionTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'admin' && isAdmin && <AdminTab />}
        </div>
      </div>

      {/* Character Profile Modal */}
      <CharacterProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  )
}

export default Dashboard
