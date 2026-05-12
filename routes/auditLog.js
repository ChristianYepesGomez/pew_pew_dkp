import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { parsePagination } from '../lib/pagination.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:AuditLog');
const router = Router();

// Get audit log (admin/officer only)
// Supports filtering by: action, performedBy, resourceType, resourceId, from (date), to (date)
router.get('/', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query, { limit: 50, maxLimit: 200 });
    const { action, performedBy, resourceType, resourceId, from, to } = req.query;

    const conditions = [];
    const args = [];

    if (action) {
      conditions.push('al.action = ?');
      args.push(action);
    }
    if (performedBy) {
      const uid = parseInt(performedBy, 10);
      if (isNaN(uid)) return error(res, 'Invalid performedBy', 400, ErrorCodes.VALIDATION_ERROR);
      conditions.push('al.performed_by = ?');
      args.push(uid);
    }
    if (resourceType) {
      conditions.push('al.resource_type = ?');
      args.push(resourceType);
    }
    if (resourceId) {
      const rid = parseInt(resourceId, 10);
      if (isNaN(rid)) return error(res, 'Invalid resourceId', 400, ErrorCodes.VALIDATION_ERROR);
      conditions.push('al.resource_id = ?');
      args.push(rid);
    }
    if (from) {
      conditions.push("al.created_at >= ?");
      args.push(from);
    }
    if (to) {
      conditions.push("al.created_at <= ?");
      args.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { total } = await req.db.get(
      `SELECT COUNT(*) as total FROM audit_log al ${where}`,
      ...args
    );

    const rows = await req.db.all(
      `SELECT al.id, al.action, al.resource_type, al.resource_id, al.details,
              al.ip_address, al.created_at,
              al.performed_by,
              u.character_name as actor_name, u.role as actor_role
       FROM audit_log al
       LEFT JOIN users u ON al.performed_by = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      ...args, limit, offset
    );

    const entries = rows.map(r => ({
      id: r.id,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      details: r.details ? JSON.parse(r.details) : null,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
      performedBy: r.performed_by,
      actorName: r.actor_name || null,
      actorRole: r.actor_role || null,
    }));

    return success(res, { entries, total, limit, offset });
  } catch (err) {
    log.error('Get audit log error', err);
    return error(res, 'Failed to get audit log', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get distinct action types for filter UI
router.get('/actions', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const rows = await req.db.all('SELECT DISTINCT action FROM audit_log ORDER BY action ASC');
    return success(res, rows.map(r => r.action));
  } catch (err) {
    log.error('Get audit actions error', err);
    return error(res, 'Failed to get audit actions', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
