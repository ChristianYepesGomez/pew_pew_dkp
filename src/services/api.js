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
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  forgotPassword: (usernameOrEmail) => api.post('/auth/forgot-password', { usernameOrEmail }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
}

export const dkpAPI = {
  getHistory: (userId) => api.get(`/dkp/history/${userId}`),
  adjust: (userId, amount, reason) => api.post('/dkp/adjust', { userId, amount, reason }),
  bulkAdjust: (userIds, amount, reason) => api.post('/dkp/bulk-adjust', { userIds, amount, reason }),
}

export const membersAPI = {
  getAll: () => api.get('/members'),
  create: (data) => api.post('/members', data),
  remove: (id) => api.delete(`/members/${id}`),
  toggleVault: (id) => api.put(`/members/${id}/vault`),
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
  confirm: (data) => api.post('/warcraftlogs/confirm', data),
  history: (limit = 50) => api.get(`/warcraftlogs/history?limit=${limit}`),
  revert: (code) => api.post(`/warcraftlogs/revert/${code}`),
  guildReports: (date) => api.get(`/warcraftlogs/guild-reports?date=${date}`),
  reportTransactions: (code) => api.get(`/warcraftlogs/report/${code}/transactions`),
  importBossStats: (url) => api.post('/warcraftlogs/import-boss-stats', { url }),
}

export const raidItemsAPI = {
  getAll: () => api.get('/raid-items'),
  search: (query) => api.get(`/raid-items/search?q=${encodeURIComponent(query)}`),
  getByRaid: (raidName) => api.get(`/raid-items/${encodeURIComponent(raidName)}`),
  getRaidsList: () => api.get('/raids-list'),
  getStatus: () => api.get('/raid-items/status'),
  refresh: () => api.post('/raid-items/refresh'),
}

export const charactersAPI = {
  getAll: () => api.get('/characters'),
  create: (data) => api.post('/characters', data),
  update: (id, data) => api.put(`/characters/${id}`, data),
  remove: (id) => api.delete(`/characters/${id}`),
  setPrimary: (id) => api.put(`/characters/${id}/primary`),
}

export const blizzardAPI = {
  getOAuthUrl: () => api.get('/auth/blizzard/url'),
}

export const calendarAPI = {
  getRaidDays: () => api.get('/calendar/raid-days'),
  getAllRaidDays: () => api.get('/calendar/raid-days?all=true'),
  updateRaidDays: (days) => api.put('/calendar/raid-days', { days }),
  getDates: (weeks = 2) => api.get(`/calendar/dates?weeks=${weeks}`),
  getMySignups: (weeks = 2) => api.get(`/calendar/my-signups?weeks=${weeks}`),
  signup: (date, status, notes) => api.post('/calendar/signup', { date, status, notes }),
  getSummary: (date) => api.get(`/calendar/summary/${date}`),
  getOverview: (weeks = 2) => api.get(`/calendar/overview?weeks=${weeks}`),
  getDatesWithLogs: (weeks = 4) => api.get(`/calendar/dates-with-logs?weeks=${weeks}`),
  getHistory: (weeks = 8) => api.get(`/calendar/history?weeks=${weeks}`),
}

export const bossesAPI = {
  getAll: () => api.get('/bosses'),
  getDetails: (bossId) => api.get(`/bosses/${bossId}`),
  sync: () => api.post('/bosses/sync'),
  setZoneLegacy: (zoneId, isLegacy) => api.put(`/bosses/zones/${zoneId}/legacy`, { isLegacy }),
}

export const vaultAPI = {
  getStatus: () => api.get('/admin/vault/status'),
  processWeekly: () => api.post('/admin/vault/process-weekly'),
}

export const buffsAPI = {
  getActive: () => api.get('/buffs/active'),
  // SSE stream URL (not an axios call, used for EventSource)
  getStreamUrl: () => {
    const baseUrl = API_URL.replace('/api', '')
    return `${baseUrl}/api/buffs/stream`
  },
}

export default api