// ── Centralized Configuration ──
// Single source of truth for env-based config used across multiple modules.

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Security: warn if using default JWT secret in production
if (JWT_SECRET === 'your-secret-key-change-in-production' && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: Using default JWT_SECRET in production! Set a strong secret in your environment variables.');
}
