import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Get my BIS list
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const items = await db.all(
      'SELECT * FROM bis_items WHERE user_id = ? ORDER BY priority ASC, created_at DESC',
      req.user.userId
    );
    res.json(items);
  } catch (error) {
    console.error('Get my BIS error:', error);
    res.status(500).json({ error: 'Failed to get BIS list' });
  }
});

// Get another user's BIS list
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const items = await db.all(
      'SELECT * FROM bis_items WHERE user_id = ? ORDER BY priority ASC, created_at DESC',
      userId
    );
    res.json(items);
  } catch (error) {
    console.error('Get user BIS error:', error);
    res.status(500).json({ error: 'Failed to get BIS list' });
  }
});

// Get all users who want a specific item (for auction integration)
router.get('/item/:itemId', authenticateToken, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid item ID' });

    const results = await db.all(`
      SELECT bi.user_id, bi.priority, bi.obtained,
             u.character_name, u.character_class
      FROM bis_items bi
      JOIN users u ON bi.user_id = u.id
      WHERE bi.item_id = ? AND bi.obtained = 0
      ORDER BY bi.priority ASC
    `, itemId);
    res.json(results);
  } catch (error) {
    console.error('Get BIS item users error:', error);
    res.status(500).json({ error: 'Failed to get BIS item data' });
  }
});

// Add item to my BIS list
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { item_id, item_name, item_name_en, item_image, item_rarity, item_slot, item_level, boss_name, raid_name, priority, notes, source_type, slot_position } = req.body;

    if (!item_id || !item_name) {
      return res.status(400).json({ error: 'item_id and item_name are required' });
    }

    const result = await db.run(`
      INSERT INTO bis_items (user_id, item_id, item_name, item_name_en, item_image, item_rarity, item_slot, item_level, boss_name, raid_name, priority, notes, source_type, slot_position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, req.user.userId, item_id, item_name, item_name_en || null, item_image || null, item_rarity || 'epic', item_slot || null, item_level || null, boss_name || null, raid_name || null, priority || 0, notes || null, source_type || 'raid', slot_position || null);

    const newItem = await db.get('SELECT * FROM bis_items WHERE id = ?', result.lastInsertRowid);
    res.status(201).json(newItem);
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Item already in your BIS list' });
    }
    console.error('Add BIS item error:', error);
    res.status(500).json({ error: 'Failed to add BIS item' });
  }
});

// Batch reorder BIS priorities (must be before :id route)
router.put('/reorder', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body; // [{ id, priority }]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    await db.transaction(async (tx) => {
      for (const { id, priority } of items) {
        const item = await tx.get('SELECT user_id FROM bis_items WHERE id = ?', id);
        if (!item || item.user_id !== req.user.userId) {
          throw new Error('UNAUTHORIZED_ITEM');
        }
        await tx.run('UPDATE bis_items SET priority = ? WHERE id = ?', priority, id);
      }
    });

    const updated = await db.all(
      'SELECT * FROM bis_items WHERE user_id = ? ORDER BY priority ASC',
      req.user.userId
    );
    res.json(updated);
  } catch (error) {
    if (error.message === 'UNAUTHORIZED_ITEM') {
      return res.status(403).json({ error: 'Cannot reorder items that are not yours' });
    }
    console.error('Reorder BIS error:', error);
    res.status(500).json({ error: 'Failed to reorder BIS items' });
  }
});

// Update BIS item (priority, notes, obtained)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid BIS item ID' });

    const item = await db.get('SELECT * FROM bis_items WHERE id = ?', id);
    if (!item) return res.status(404).json({ error: 'BIS item not found' });
    if (item.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your BIS item' });

    const { priority, notes, obtained, slot_position } = req.body;
    await db.run(`
      UPDATE bis_items SET
        priority = COALESCE(?, priority),
        notes = COALESCE(?, notes),
        obtained = COALESCE(?, obtained),
        slot_position = COALESCE(?, slot_position)
      WHERE id = ?
    `, priority ?? null, notes ?? null, obtained ?? null, slot_position ?? null, id);

    const updated = await db.get('SELECT * FROM bis_items WHERE id = ?', id);
    res.json(updated);
  } catch (error) {
    console.error('Update BIS item error:', error);
    res.status(500).json({ error: 'Failed to update BIS item' });
  }
});

// Delete BIS item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid BIS item ID' });

    const item = await db.get('SELECT * FROM bis_items WHERE id = ?', id);
    if (!item) return res.status(404).json({ error: 'BIS item not found' });
    if (item.user_id !== req.user.userId) return res.status(403).json({ error: 'Not your BIS item' });

    await db.run('DELETE FROM bis_items WHERE id = ?', id);
    res.json({ message: 'BIS item removed' });
  } catch (error) {
    console.error('Delete BIS item error:', error);
    res.status(500).json({ error: 'Failed to delete BIS item' });
  }
});

export default router;
