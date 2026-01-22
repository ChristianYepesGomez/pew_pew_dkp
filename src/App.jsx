import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './styles/App.css';

function App() {
  const { user, login, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {!user ? (
        <LoginPage onLogin={login} />
      ) : (
        <DashboardPage user={user} onLogout={logout} />
      )}
    </div>
  );
}

export default App;
