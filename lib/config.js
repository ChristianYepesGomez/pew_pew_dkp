// ── Centralized Configuration ──
// Single source of truth for env-based config used across multiple modules.

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Discord Bot (optional — bot only starts when DISCORD_TOKEN is set)
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
export const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';

// Web Push / VAPID (optional — push notifications only work when keys are set)
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@pewpewkittens.com';

// Fail-fast: refuse to start in production with default secrets
if (process.env.NODE_ENV === 'production') {
  if (JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('FATAL: JWT_SECRET must be set in production. Refusing to start with default value.');
  }
  if (JWT_REFRESH_SECRET === 'your-refresh-secret-change-in-production') {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be set in production. Refusing to start with default value.');
  }
}
