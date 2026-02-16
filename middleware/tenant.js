import { platformDb } from '../platformDb.js';
import { getTenantDb } from '../lib/tenantDb.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Middleware:Tenant');

/**
 * Tenant resolution middleware.
 * Must run AFTER authenticateToken (needs req.user).
 * Sets req.guild and req.db for downstream route handlers.
 */
export function resolveTenant(req, res, next) {
  const guildId = req.user?.guildId;

  if (!guildId) {
    // No guild in token — use default db (set by base middleware in server.js).
    // This maintains backward compat for single-tenant mode and tests.
    return next();
  }

  platformDb.get('SELECT * FROM guilds WHERE id = ?', guildId)
    .then(guild => {
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      req.guild = guild;
      req.db = getTenantDb(guild.database_name);
      next();
    })
    .catch(err => {
      log.error('Tenant resolution failed', err);
      res.status(500).json({ error: 'Internal server error' });
    });
}

/**
 * Lightweight tenant middleware for routes that already have the guild DB
 * injected (e.g., tests or backward-compat single-tenant mode).
 * If req.db is already set, skip resolution.
 */
export function resolveTenantIfNeeded(req, res, next) {
  if (req.db) return next();
  return resolveTenant(req, res, next);
}
