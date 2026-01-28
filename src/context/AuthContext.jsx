import { createContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

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
      const { token: newToken, user: userData } = response.data
      localStorage.setItem('token', newToken)
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
      const { token: newToken, user: newUser } = response.data
      localStorage.setItem('token', newToken)
      setToken(newToken)
      setUser(newUser)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Error al registrarse' }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    refreshUser: loadUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}