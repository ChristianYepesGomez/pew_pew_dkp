import { Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import RoleSwitcher from './components/Dev/RoleSwitcher'
import OfflineBanner from './components/Common/OfflineBanner'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('React ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f0a1e 50%, #000000 100%)' }}>
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-500 border-opacity-40">
              <i className="fas fa-exclamation-triangle text-red-400 text-3xl"></i>
            </div>
            <h2 className="text-2xl font-cinzel font-bold text-red-400 mb-3">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-2">Algo ha salido mal</p>
            <p className="text-gray-500 text-xs mb-6 break-words">{this.state.error?.message || 'Unknown error'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold rounded-lg hover:shadow-lg hover:shadow-midnight-glow/30 transition-all min-h-[44px]"
            >
              <i className="fas fa-redo mr-2"></i>Reload / Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" />} />
        <Route path="/reset-password/:token" element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/" />} />
        <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
      </Routes>
      {/* DEV: Role switcher for admin testing */}
      {isAuthenticated && <RoleSwitcher />}
    </ErrorBoundary>
  )
}

export default App
