import { createContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  // Dev mode: role simulation (only for admins)
  const [simulatedRole, setSimulatedRole] = useState(localStorage.getItem('dev_simulated_role'))

  useEffect(() => {
    if (token) {
      loadUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const loadUser = async () => {
    try {
      const response = await authAPI.me()
      setUser(response.data)
    } catch (error) {
      console.error('Error loading user:', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      const response = await authAPI.login(username, password)
      const { token: newToken, refreshToken, user: userData } = response.data
      localStorage.setItem('token', newToken)
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
      setToken(newToken)
      setUser(userData)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al iniciar sesión' }
    }
  }

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData)
      const { token: newToken, refreshToken, user: newUser } = response.data
      localStorage.setItem('token', newToken)
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
      setToken(newToken)
      setUser(newUser)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al registrarse' }
    }
  }

  const logout = () => {
    // Best-effort server-side revocation (don't block on it)
    const rt = localStorage.getItem('refreshToken')
    const at = localStorage.getItem('token')
    if (rt && at) {
      authAPI.logout(rt).catch(() => {})
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('dev_simulated_role')
    setToken(null)
    setUser(null)
    setSimulatedRole(null)
  }

  // Dev: Set simulated role (only for admins)
  const setDevRole = (role) => {
    if (user?.role !== 'admin') return // Only admins can use this
    if (role) {
      localStorage.setItem('dev_simulated_role', role)
      setSimulatedRole(role)
    } else {
      localStorage.removeItem('dev_simulated_role')
      setSimulatedRole(null)
    }
  }

  // Return user with simulated role if active (and user is actually admin)
  const effectiveUser = user && simulatedRole && user.role === 'admin'
    ? { ...user, role: simulatedRole, _realRole: user.role }
    : user

  const value = {
    user: effectiveUser,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    refreshUser: loadUser,
    // Dev mode
    isDevMode: !!simulatedRole && user?.role === 'admin',
    realRole: user?.role,
    setDevRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}