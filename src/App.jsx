import { Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'

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
        <div style={{ background: '#1a1a2e', color: '#e0e0e0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <h2 style={{ color: '#ff6b6b' }}>Something went wrong</h2>
            <p style={{ color: '#888', fontSize: 14 }}>{this.state.error?.message || 'Unknown error'}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 16, padding: '8px 24px', background: '#6c5ce7', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
            >
              Reload page
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
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" />} />
        <Route path="/reset-password/:token" element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/" />} />
        <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
