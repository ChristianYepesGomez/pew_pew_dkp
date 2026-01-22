import { useState, useEffect } from 'react';
import { usersAPI } from '../services/api';
import Header from '../components/Header';
import TabNavigation from '../components/TabNavigation';
import RosterTab from '../components/tabs/RosterTab';
import AuctionsTab from '../components/tabs/AuctionsTab';
import HistoryTab from '../components/tabs/HistoryTab';
import AdminTab from '../components/tabs/AdminTab';

export default function DashboardPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('roster');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'roster', label: 'Roster', component: RosterTab },
    { id: 'auctions', label: 'Auctions', component: AuctionsTab },
    { id: 'history', label: 'History', component: HistoryTab },
  ];

  // Add admin tab if user is admin or officer
  if (user.role === 'admin' || user.role === 'officer') {
    tabs.push({ id: 'admin', label: 'Admin', component: AdminTab, isAdmin: true });
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="dashboard">
      <Header user={user} onLogout={onLogout} />
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="container">
        {loading ? (
          <div className="loading-screen">
            <div className="loader"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <ActiveComponent user={user} users={users} onUsersUpdate={loadUsers} />
        )}
      </main>
    </div>
  );
}
