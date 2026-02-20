import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter, userLimiter } from '../lib/rateLimiters.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Addons');
const router = Router();

// ── GET /api/addons ───────────────────────────────────────────────
// All authenticated users — returns addons grouped by category
router.get('/', authenticateToken, userLimiter, async (req, res) => {
  try {
    const addons = await req.db.all(
      'SELECT * FROM addons ORDER BY category, display_order, id'
    );
    return success(res, addons);
  } catch (err) {
    log.error('Get addons error', err);
    return error(res, 'Failed to get addons', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── POST /api/addons ──────────────────────────────────────────────
// Admin only — create a new addon entry
router.post('/', authenticateToken, authorizeRole('admin'), adminLimiter, async (req, res) => {
  const { title, body, category } = req.body;

  if (!title?.trim()) return error(res, 'Title is required', 400, ErrorCodes.VALIDATION_ERROR);
  if (!body?.trim()) return error(res, 'Body is required', 400, ErrorCodes.VALIDATION_ERROR);
  if (!['required', 'recommended'].includes(category)) {
    return error(res, 'Category must be "required" or "recommended"', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const result = await req.db.run(
      'INSERT INTO addons (title, body, category) VALUES (?, ?, ?)',
      title.trim(), body.trim(), category
    );
    const addon = await req.db.get('SELECT * FROM addons WHERE id = ?', result.lastInsertRowid);
    return success(res, addon, 'Addon created', 201);
  } catch (err) {
    log.error('Create addon error', err);
    return error(res, 'Failed to create addon', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── PUT /api/addons/:id ───────────────────────────────────────────
// Admin only — update an existing addon
router.put('/:id', authenticateToken, authorizeRole('admin'), adminLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return error(res, 'Invalid addon ID', 400, ErrorCodes.VALIDATION_ERROR);

  const { title, body, category } = req.body;

  if (!title?.trim()) return error(res, 'Title is required', 400, ErrorCodes.VALIDATION_ERROR);
  if (!body?.trim()) return error(res, 'Body is required', 400, ErrorCodes.VALIDATION_ERROR);
  if (!['required', 'recommended'].includes(category)) {
    return error(res, 'Category must be "required" or "recommended"', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const result = await req.db.run(
      'UPDATE addons SET title = ?, body = ?, category = ? WHERE id = ?',
      title.trim(), body.trim(), category, id
    );
    if (result.changes === 0) return error(res, 'Addon not found', 404, ErrorCodes.NOT_FOUND);
    const addon = await req.db.get('SELECT * FROM addons WHERE id = ?', id);
    return success(res, addon, 'Addon updated');
  } catch (err) {
    log.error('Update addon error', err);
    return error(res, 'Failed to update addon', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── DELETE /api/addons/:id ────────────────────────────────────────
// Admin only — delete an addon entry
router.delete('/:id', authenticateToken, authorizeRole('admin'), adminLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return error(res, 'Invalid addon ID', 400, ErrorCodes.VALIDATION_ERROR);

  try {
    const result = await req.db.run('DELETE FROM addons WHERE id = ?', id);
    if (result.changes === 0) return error(res, 'Addon not found', 404, ErrorCodes.NOT_FOUND);
    return success(res, null, 'Addon deleted');
  } catch (err) {
    log.error('Delete addon error', err);
    return error(res, 'Failed to delete addon', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
