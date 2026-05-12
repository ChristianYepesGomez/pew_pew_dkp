import { createLogger } from './logger.js';

const log = createLogger('Audit');

/**
 * Writes a security-relevant event to audit_log.
 * Never throws — audit failures are logged but must not break the main request flow.
 *
 * @param {object} db - DB instance (req.db or a transaction db)
 * @param {object} opts
 * @param {number|null} opts.performedBy - user_id of the actor (null for system/cron/anonymous)
 * @param {string} opts.action - snake_case event name (e.g. 'login', 'role_changed')
 * @param {string|null} [opts.resourceType] - entity type ('user', 'character', 'auction', 'config', ...)
 * @param {number|null} [opts.resourceId] - primary key of the affected entity
 * @param {object|null} [opts.details] - extra context (before/after values, names, etc.)
 * @param {string|null} [opts.ip] - client IP address
 */
export async function audit(db, { performedBy, action, resourceType = null, resourceId = null, details = null, ip = null }) {
  try {
    await db.run(
      `INSERT INTO audit_log (performed_by, action, resource_type, resource_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      performedBy ?? null,
      action,
      resourceType,
      resourceId ?? null,
      details ? JSON.stringify(details) : null,
      ip ?? null
    );
  } catch (err) {
    log.error('Failed to write audit log', { action, performedBy, err: err.message });
  }
}

/**
 * Extracts the real client IP from a request object,
 * respecting the x-forwarded-for header set by proxies (Render, Cloudflare).
 */
export function getIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip ?? null;
}
