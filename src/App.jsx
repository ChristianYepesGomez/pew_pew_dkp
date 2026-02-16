import { Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CircleNotch } from '@phosphor-icons/react'
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
        <div className="min-h-screen flex items-center justify-center bg-indigo text-cream">
          <div className="text-center max-w-[400px]">
            <h2 className="text-coral text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-lavender text-sm mb-4">{this.state.error?.message || 'Unknown error'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-coral text-indigo rounded-full font-semibold hover:opacity-90 transition-opacity"
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
        <CircleNotch size={48} className="text-coral animate-spin" />
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
        <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />} />
      </Routes>
      {isAuthenticated && <RoleSwitcher />}
    </ErrorBoundary>
  )
}

export default App
