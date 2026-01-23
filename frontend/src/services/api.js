import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
}

// Members endpoints
export const membersAPI = {
  getAll: () => api.get('/members'),
  updateRole: (id, role) => api.put(`/members/${id}/role`, { role }),
  delete: (id) => api.delete(`/members/${id}`),
}

// DKP endpoints
export const dkpAPI = {
  adjust: (userId, amount, reason) =>
    api.post('/dkp/adjust', { userId, amount, reason }),
  bulkAdjust: (userIds, amount, reason) =>
    api.post('/dkp/bulk-adjust', { userIds, amount, reason }),
  decay: (percentage) => api.post('/dkp/decay', { percentage }),
  getHistory: (userId) => api.get(`/dkp/history/${userId}`),
}

// Auctions endpoints
export const auctionsAPI = {
  getActive: () => api.get('/auctions/active'),
  create: (auctionData) => api.post('/auctions', auctionData),
  bid: (auctionId, amount) => api.post(`/auctions/${auctionId}/bid`, { amount }),
  end: (auctionId) => api.post(`/auctions/${auctionId}/end`),
  cancel: (auctionId) => api.post(`/auctions/${auctionId}/cancel`),
  getHistory: () => api.get('/auctions/history'),
}

// Warcraft Logs endpoints
export const warcraftLogsAPI = {
  preview: (url) => api.post('/warcraftlogs/preview', { url }),
  confirm: (reportId) => api.post('/warcraftlogs/confirm', { reportId }),
  getConfig: () => api.get('/warcraftlogs/config'),
  updateConfig: (config) => api.put('/warcraftlogs/config', config),
}

export default api
