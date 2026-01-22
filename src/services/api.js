import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  register: (data) => api.post('/api/auth/register', data),
  getCurrentUser: () => api.get('/api/auth/me'),
};

// Members API
export const usersAPI = {
  getAll: () => api.get('/api/members'),
  getById: (id) => api.get(`/api/members/${id}`),
  update: (id, data) => api.put(`/api/members/${id}/role`, data),
  delete: (id) => api.delete(`/api/members/${id}`),
  adjustDKP: (userId, amount, reason) => api.post('/api/dkp/adjust', { userId, amount, reason }),
};

// DKP API
export const dkpAPI = {
  getHistory: (userId, limit = 50) => api.get(`/api/dkp/history/${userId}`),
};

// Auctions API
export const auctionsAPI = {
  getAll: () => api.get('/api/auctions/history'),
  getActive: () => api.get('/api/auctions/active'),
  create: (data) => api.post('/api/auctions', data),
  placeBid: (auctionId, amount) => api.post(`/api/auctions/${auctionId}/bid`, { amount }),
  end: (auctionId, winnerId) => api.post(`/api/auctions/${auctionId}/end`, { winnerId }),
  cancel: (auctionId) => api.post(`/api/auctions/${auctionId}/cancel`),
};

// Warcraft Logs API
export const warcraftLogsAPI = {
  getConfig: () => api.get('/api/warcraftlogs/config'),
  updateConfig: (key, value) => api.put('/api/warcraftlogs/config', { config_key: key, config_value: value }),
  preview: (url) => api.post('/api/warcraftlogs/preview', { url }),
  confirm: (data) => api.post('/api/warcraftlogs/confirm', data),
  getHistory: (limit = 50) => api.get(`/api/warcraftlogs/history?limit=${limit}`),
};

export default api;
