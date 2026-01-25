import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  forgotPassword: (username) => api.post('/auth/forgot-password', { username }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
}

export const dkpAPI = {
  getHistory: (userId) => api.get(`/dkp/history/${userId}`),
  adjust: (userId, amount, reason) => api.post('/dkp/adjust', { userId, amount, reason }),
  bulkAdjust: (userIds, amount, reason) => api.post('/dkp/bulk-adjust', { userIds, amount, reason }),
}

export const membersAPI = {
  getAll: () => api.get('/members'),
}

export const auctionsAPI = {
  getActive: () => api.get('/auctions/active'),
  getHistory: () => api.get('/auctions/history'),
  create: (data) => api.post('/auctions', data),
  bid: (auctionId, amount) => api.post(`/auctions/${auctionId}/bid`, { amount }),
  end: (auctionId) => api.post(`/auctions/${auctionId}/end`),
  cancel: (auctionId) => api.post(`/auctions/${auctionId}/cancel`),
}

export const warcraftLogsAPI = {
  preview: (url) => api.post('/warcraftlogs/preview', { url }),
  confirm: (reportId) => api.post('/warcraftlogs/confirm', { reportId }),
}

export default api