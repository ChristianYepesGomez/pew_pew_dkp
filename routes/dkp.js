import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { addDkpWithCap } from '../lib/helpers.js';

const router = Router();

// Adjust DKP for single member (officer+)
router.post('/adjust', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'Missing userId or amount' });
    }

    const currentDkp = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    if (!currentDkp) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get DKP cap
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    let newDkp;
    let actualAmount = amount;

    if (amount > 0) {
      // Apply cap when adding DKP
      newDkp = Math.min(currentDkp.current_dkp + amount, dkpCap);
      actualAmount = newDkp - currentDkp.current_dkp;

      await db.run(`
        UPDATE member_dkp
        SET current_dkp = ?, lifetime_gained = lifetime_gained + ?
        WHERE user_id = ?
      `, newDkp, actualAmount, userId);
    } else {
      // No cap on removal
      newDkp = Math.max(0, currentDkp.current_dkp + amount);
      await db.run(`
        UPDATE member_dkp SET current_dkp = ? WHERE user_id = ?
      `, newDkp, userId);
    }

    await db.run(`
      INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
      VALUES (?, ?, ?, ?)
    `, userId, amount, reason || 'Manual adjustment', req.user.userId);

    req.app.get('io').emit('dkp_updated', { userId, newDkp, amount });
    res.json({ message: 'DKP adjusted', newDkp });
  } catch (error) {
    console.error('Adjust DKP error:', error);
    res.status(500).json({ error: 'Failed to adjust DKP' });
  }
});

// Bulk DKP adjustment (raid attendance, etc.)
router.post('/bulk-adjust', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userIds, amount, reason } = req.body;

    if (!userIds || !Array.isArray(userIds) || amount === undefined) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Get DKP cap
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    await db.transaction(async (tx) => {
      for (const userId of userIds) {
        if (amount > 0) {
          // Use cap-aware function for positive amounts
          await addDkpWithCap(tx, userId, amount, dkpCap);
        } else {
          // No cap for negative amounts
          await tx.run(`
            UPDATE member_dkp
            SET current_dkp = MAX(0, current_dkp + ?)
            WHERE user_id = ?
          `, amount, userId);
        }

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, userId, amount, reason || 'Bulk adjustment', req.user.userId);
      }
    });

    req.app.get('io').emit('dkp_bulk_updated', { userIds, amount });
    res.json({ message: `DKP adjusted for ${userIds.length} members` });
  } catch (error) {
    console.error('Bulk adjust error:', error);
    res.status(500).json({ error: 'Failed to bulk adjust DKP' });
  }
});

// Apply DKP decay (admin only)
router.post('/decay', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { percentage } = req.body;

    if (!percentage || percentage <= 0 || percentage > 100) {
      return res.status(400).json({ error: 'Invalid decay percentage' });
    }

    const multiplier = 1 - (percentage / 100);

    // Atomic decay: capture amounts BEFORE update, then update + log in one transaction
    await db.transaction(async (tx) => {
      // 1. Capture current DKP values before decay
      const members = await tx.all('SELECT user_id, current_dkp FROM member_dkp WHERE current_dkp > 0');

      // 2. Apply decay
      await tx.run(`
        UPDATE member_dkp
        SET current_dkp = CAST(current_dkp * ? AS INTEGER),
            last_decay_at = CURRENT_TIMESTAMP
      `, multiplier);

      // 3. Insert accurate transaction logs using pre-decay amounts
      for (const member of members) {
        const decayAmount = Math.floor(member.current_dkp * (percentage / 100));
        if (decayAmount > 0) {
          await tx.run(`
            INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
            VALUES (?, ?, ?, ?)
          `, member.user_id, -decayAmount, `DKP Decay ${percentage}%`, req.user.userId);
        }
      }
    });

    req.app.get('io').emit('dkp_decay_applied', { percentage });
    res.json({ message: `${percentage}% DKP decay applied` });
  } catch (error) {
    console.error('DKP decay error:', error);
    res.status(500).json({ error: 'Failed to apply DKP decay' });
  }
});

// Get DKP history for a user
router.get('/history/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const limit = parseInt(req.query.limit) || 50;

    // Access control: only own history, or admin/officer can view any
    if (req.user.userId !== userId && !['admin', 'officer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized to view this history' });
    }

    const dkpStats = await db.get(`
      SELECT current_dkp, lifetime_gained, lifetime_spent, last_decay_at
      FROM member_dkp
      WHERE user_id = ?
    `, userId);

    const history = await db.all(`
      SELECT dt.*, u.character_name, u.username,
             a.item_name AS auction_item_name, a.item_image AS auction_item_image,
             a.item_rarity AS auction_item_rarity, a.item_id AS auction_item_id
      FROM dkp_transactions dt
      LEFT JOIN users u ON dt.performed_by = u.id
      LEFT JOIN auctions a ON dt.auction_id = a.id
      WHERE dt.user_id = ?
      ORDER BY dt.created_at DESC
      LIMIT ?
    `, userId, limit);

    res.json({
      currentDkp: dkpStats?.current_dkp || 0,
      lifetimeGained: dkpStats?.lifetime_gained || 0,
      lifetimeSpent: dkpStats?.lifetime_spent || 0,
      lastDecay: dkpStats?.last_decay_at,
      transactions: history.map(h => ({
        id: h.id,
        userId: h.user_id,
        amount: h.amount,
        reason: h.reason,
        performedBy: h.performed_by,
        characterName: h.character_name,
        username: h.username,
        createdAt: h.created_at,
        auctionItem: h.auction_item_name ? {
          name: h.auction_item_name,
          image: h.auction_item_image,
          rarity: h.auction_item_rarity,
          itemId: h.auction_item_id
        } : null
      }))
    });
  } catch (error) {
    console.error('DKP history error:', error);
    res.status(500).json({ error: 'Failed to get DKP history' });
  }
});

export default router;
