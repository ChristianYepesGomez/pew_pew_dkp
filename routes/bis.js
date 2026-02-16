import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:BIS');
const router = Router();

// Get my BIS list
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const items = await req.db.all(`
      SELECT id, user_id, item_id, item_name, item_name_en, item_image, item_rarity,
             item_slot, item_level, boss_name, raid_name, priority, obtained, notes,
             created_at, source_type, slot_position
      FROM bis_items WHERE user_id = ? ORDER BY priority ASC, created_at DESC
    `, req.user.userId);
    return success(res, items);
  } catch (err) {
    log.error('Get my BIS error', err);
    return error(res, 'Failed to get BIS list', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get another user's BIS list
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return error(res, 'Invalid user ID', 400, ErrorCodes.VALIDATION_ERROR);

    const items = await req.db.all(`
      SELECT id, user_id, item_id, item_name, item_name_en, item_image, item_rarity,
             item_slot, item_level, boss_name, raid_name, priority, obtained, notes,
             created_at, source_type, slot_position
      FROM bis_items WHERE user_id = ? ORDER BY priority ASC, created_at DESC
    `, userId);
    return success(res, items);
  } catch (err) {
    log.error('Get user BIS error', err);
    return error(res, 'Failed to get BIS list', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get all users who want a specific item (for auction integration)
router.get('/item/:itemId', authenticateToken, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId)) return error(res, 'Invalid item ID', 400, ErrorCodes.VALIDATION_ERROR);

    const results = await req.db.all(`
      SELECT bi.user_id, bi.priority, bi.obtained,
             u.character_name, u.character_class
      FROM bis_items bi
      JOIN users u ON bi.user_id = u.id
      WHERE bi.item_id = ? AND bi.obtained = 0
      ORDER BY bi.priority ASC
    `, itemId);
    return success(res, results);
  } catch (err) {
    log.error('Get BIS item users error', err);
    return error(res, 'Failed to get BIS item data', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Add item to my BIS list
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { item_id, item_name, item_name_en, item_image, item_rarity, item_slot, item_level, boss_name, raid_name, priority, notes, source_type, slot_position } = req.body;

    if (!item_id || !item_name) {
      return error(res, 'item_id and item_name are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await req.db.run(`
      INSERT INTO bis_items (user_id, item_id, item_name, item_name_en, item_image, item_rarity, item_slot, item_level, boss_name, raid_name, priority, notes, source_type, slot_position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, req.user.userId, item_id, item_name, item_name_en || null, item_image || null, item_rarity || 'epic', item_slot || null, item_level || null, boss_name || null, raid_name || null, priority || 0, notes || null, source_type || 'raid', slot_position || null);

    const newItem = await req.db.get(`
      SELECT id, user_id, item_id, item_name, item_name_en, item_image, item_rarity,
             item_slot, item_level, boss_name, raid_name, priority, obtained, notes,
             created_at, source_type, slot_position
      FROM bis_items WHERE id = ?
    `, result.lastInsertRowid);
    return success(res, newItem, null, 201);
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return error(res, 'Item already in your BIS list', 409, ErrorCodes.ALREADY_EXISTS);
    }
    log.error('Add BIS item error', err);
    return error(res, 'Failed to add BIS item', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Batch reorder BIS priorities (must be before :id route)
router.put('/reorder', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body; // [{ id, priority }]
    if (!Array.isArray(items)) return error(res, 'items array required', 400, ErrorCodes.VALIDATION_ERROR);

    await req.db.transaction(async (tx) => {
      for (const { id, priority } of items) {
        const item = await tx.get('SELECT user_id FROM bis_items WHERE id = ?', id);
        if (!item || item.user_id !== req.user.userId) {
          throw new Error('UNAUTHORIZED_ITEM');
        }
        await tx.run('UPDATE bis_items SET priority = ? WHERE id = ?', priority, id);
      }
    });

    const updated = await req.db.all(`
      SELECT id, user_id, item_id, item_name, item_name_en, item_image, item_rarity,
             item_slot, item_level, boss_name, raid_name, priority, obtained, notes,
             created_at, source_type, slot_position
      FROM bis_items WHERE user_id = ? ORDER BY priority ASC
    `, req.user.userId);
    return success(res, updated);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED_ITEM') {
      return error(res, 'Cannot reorder items that are not yours', 403, ErrorCodes.FORBIDDEN);
    }
    log.error('Reorder BIS error', err);
    return error(res, 'Failed to reorder BIS items', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Update BIS item (priority, notes, obtained)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid BIS item ID', 400, ErrorCodes.VALIDATION_ERROR);

    const item = await req.db.get('SELECT id, user_id FROM bis_items WHERE id = ?', id);
    if (!item) return error(res, 'BIS item not found', 404, ErrorCodes.NOT_FOUND);
    if (item.user_id !== req.user.userId) return error(res, 'Not your BIS item', 403, ErrorCodes.FORBIDDEN);

    const { priority, notes, obtained, slot_position } = req.body;
    await req.db.run(`
      UPDATE bis_items SET
        priority = COALESCE(?, priority),
        notes = COALESCE(?, notes),
        obtained = COALESCE(?, obtained),
        slot_position = COALESCE(?, slot_position)
      WHERE id = ?
    `, priority ?? null, notes ?? null, obtained ?? null, slot_position ?? null, id);

    const updated = await req.db.get(`
      SELECT id, user_id, item_id, item_name, item_name_en, item_image, item_rarity,
             item_slot, item_level, boss_name, raid_name, priority, obtained, notes,
             created_at, source_type, slot_position
      FROM bis_items WHERE id = ?
    `, id);
    return success(res, updated);
  } catch (err) {
    log.error('Update BIS item error', err);
    return error(res, 'Failed to update BIS item', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Delete BIS item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid BIS item ID', 400, ErrorCodes.VALIDATION_ERROR);

    const item = await req.db.get('SELECT id, user_id FROM bis_items WHERE id = ?', id);
    if (!item) return error(res, 'BIS item not found', 404, ErrorCodes.NOT_FOUND);
    if (item.user_id !== req.user.userId) return error(res, 'Not your BIS item', 403, ErrorCodes.FORBIDDEN);

    await req.db.run('DELETE FROM bis_items WHERE id = ?', id);
    return success(res, null, 'BIS item removed');
  } catch (err) {
    log.error('Delete BIS item error', err);
    return error(res, 'Failed to delete BIS item', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
