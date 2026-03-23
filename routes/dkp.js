import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { addDkpWithCap } from '../lib/helpers.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { parsePagination } from '../lib/pagination.js';

const log = createLogger('Route:DKP');
const router = Router();

// Adjust DKP for single member (officer+)
router.post('/adjust', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined) {
      return error(res, 'Missing userId or amount', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const currentDkp = await req.db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    if (!currentDkp) {
      return error(res, 'Member not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get DKP cap
    const capConfig = await req.db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    let newDkp;
    let actualAmount = amount;

    if (amount > 0) {
      // Apply cap when adding DKP
      newDkp = Math.min(currentDkp.current_dkp + amount, dkpCap);
      actualAmount = newDkp - currentDkp.current_dkp;

      await req.db.run(`
        UPDATE member_dkp
        SET current_dkp = ?, lifetime_gained = lifetime_gained + ?
        WHERE user_id = ?
      `, newDkp, actualAmount, userId);
    } else {
      // No cap on removal
      newDkp = Math.max(0, currentDkp.current_dkp + amount);
      await req.db.run(`
        UPDATE member_dkp SET current_dkp = ? WHERE user_id = ?
      `, newDkp, userId);
    }

    await req.db.run(`
      INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
      VALUES (?, ?, ?, ?)
    `, userId, actualAmount, reason || 'Manual adjustment', req.user.userId);

    req.app.get('io').emit('dkp_updated', { userId, newDkp, amount: actualAmount });
    return success(res, { newDkp }, 'DKP adjusted');
  } catch (err) {
    log.error('Adjust DKP error', err);
    return error(res, 'Failed to adjust DKP', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Bulk DKP adjustment (raid attendance, etc.)
router.post('/bulk-adjust', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userIds, amount, reason } = req.body;

    if (!userIds || !Array.isArray(userIds) || amount === undefined) {
      return error(res, 'Invalid request', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get DKP cap
    const capConfig = await req.db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    await req.db.transaction(async (tx) => {
      for (const userId of userIds) {
        let logAmount = amount;

        if (amount > 0) {
          // Use cap-aware function for positive amounts
          const result = await addDkpWithCap(tx, userId, amount, dkpCap);
          logAmount = result.actualGain;
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
        `, userId, logAmount, reason || 'Bulk adjustment', req.user.userId);
      }
    });

    req.app.get('io').emit('dkp_bulk_updated', { userIds, amount });
    return success(res, null, `DKP adjusted for ${userIds.length} members`);
  } catch (err) {
    log.error('Bulk adjust error', err);
    return error(res, 'Failed to bulk adjust DKP', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Apply DKP decay (admin only)
router.post('/decay', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { percentage } = req.body;

    if (!percentage || percentage <= 0 || percentage > 100) {
      return error(res, 'Invalid decay percentage', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const multiplier = 1 - (percentage / 100);

    // Atomic decay: capture amounts BEFORE update, then update + log in one transaction
    await req.db.transaction(async (tx) => {
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
    return success(res, null, `${percentage}% DKP decay applied`);
  } catch (err) {
    log.error('DKP decay error', err);
    return error(res, 'Failed to apply DKP decay', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get DKP history for a user
router.get('/history/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return error(res, 'Invalid user ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { limit, offset } = parsePagination(req.query);

    // Access control: only own history, or admin/officer can view any
    if (req.user.userId !== userId && !['admin', 'officer'].includes(req.user.role)) {
      return error(res, 'Unauthorized to view this history', 403, ErrorCodes.FORBIDDEN);
    }

    const dkpStats = await req.db.get(`
      SELECT current_dkp, lifetime_gained, lifetime_spent, last_decay_at
      FROM member_dkp
      WHERE user_id = ?
    `, userId);

    const history = await req.db.all(`
      SELECT dt.*, u.character_name, u.username,
             a.item_name AS auction_item_name, a.item_image AS auction_item_image,
             a.item_rarity AS auction_item_rarity, a.item_id AS auction_item_id
      FROM dkp_transactions dt
      LEFT JOIN users u ON dt.performed_by = u.id
      LEFT JOIN auctions a ON dt.auction_id = a.id
      WHERE dt.user_id = ?
      ORDER BY dt.created_at DESC
      LIMIT ? OFFSET ?
    `, userId, limit, offset);

    return success(res, {
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
  } catch (err) {
    log.error('DKP history error', err);
    return error(res, 'Failed to get DKP history', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Revert a single DKP transaction (admin only)
router.post('/revert/:transactionId', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const txId = parseInt(req.params.transactionId, 10);
    if (isNaN(txId)) return error(res, 'Invalid transaction ID', 400, ErrorCodes.VALIDATION_ERROR);

    const tx = await req.db.get(`
      SELECT id, user_id, amount, reason, reverted FROM dkp_transactions WHERE id = ?
    `, txId);

    if (!tx) return error(res, 'Transaction not found', 404, ErrorCodes.NOT_FOUND);
    if (tx.reverted) return error(res, 'Transaction already reverted', 400, ErrorCodes.VALIDATION_ERROR);

    // Get DKP cap for capping if reverting a negative (spend) transaction
    const capConfig = await req.db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    await req.db.transaction(async (dbTx) => {
      const reverseAmount = -tx.amount;

      if (reverseAmount > 0) {
        // Reverting a spend → add DKP back (cap-aware)
        await addDkpWithCap(dbTx, tx.user_id, reverseAmount, dkpCap);
        // Also reduce lifetime_spent
        await dbTx.run('UPDATE member_dkp SET lifetime_spent = MAX(0, lifetime_spent - ?) WHERE user_id = ?', Math.abs(tx.amount), tx.user_id);
      } else {
        // Reverting a gain → subtract DKP
        await dbTx.run('UPDATE member_dkp SET current_dkp = MAX(0, current_dkp + ?), lifetime_gained = MAX(0, lifetime_gained + ?) WHERE user_id = ?',
          reverseAmount, reverseAmount, tx.user_id);
      }

      // Create the reverse transaction
      const result = await dbTx.run(`
        INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
        VALUES (?, ?, ?, ?)
      `, tx.user_id, reverseAmount, `Revert: ${tx.reason}`, req.user.userId);

      // Mark original as reverted
      await dbTx.run('UPDATE dkp_transactions SET reverted = 1, reverted_by_tx = ? WHERE id = ?', result.lastInsertRowid, tx.id);
    });

    return success(res, null, 'Transaction reverted');
  } catch (err) {
    log.error('Revert transaction error', err);
    return error(res, 'Failed to revert transaction', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Revert multiple DKP transactions (admin only) — for undoing bulk operations
router.post('/revert-bulk', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { transactionIds } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return error(res, 'Transaction IDs array required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (transactionIds.length > 100) {
      return error(res, 'Maximum 100 transactions per revert', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const capConfig = await req.db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    const placeholders = transactionIds.map(() => '?').join(',');
    const transactions = await req.db.all(`
      SELECT id, user_id, amount, reason, reverted FROM dkp_transactions WHERE id IN (${placeholders})
    `, ...transactionIds);

    const alreadyReverted = transactions.filter(t => t.reverted);
    if (alreadyReverted.length > 0) {
      return error(res, `${alreadyReverted.length} transactions already reverted`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    let revertedCount = 0;

    await req.db.transaction(async (dbTx) => {
      for (const tx of transactions) {
        const reverseAmount = -tx.amount;

        if (reverseAmount > 0) {
          await addDkpWithCap(dbTx, tx.user_id, reverseAmount, dkpCap);
          await dbTx.run('UPDATE member_dkp SET lifetime_spent = MAX(0, lifetime_spent - ?) WHERE user_id = ?', Math.abs(tx.amount), tx.user_id);
        } else {
          await dbTx.run('UPDATE member_dkp SET current_dkp = MAX(0, current_dkp + ?), lifetime_gained = MAX(0, lifetime_gained + ?) WHERE user_id = ?',
            reverseAmount, reverseAmount, tx.user_id);
        }

        const result = await dbTx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, tx.user_id, reverseAmount, `Revert: ${tx.reason}`, req.user.userId);

        await dbTx.run('UPDATE dkp_transactions SET reverted = 1, reverted_by_tx = ? WHERE id = ?', result.lastInsertRowid, tx.id);
        revertedCount++;
      }
    });

    req.app.get('io').emit('dkp_bulk_updated', { reason: 'bulk_revert', count: revertedCount });
    return success(res, { revertedCount }, `${revertedCount} transactions reverted`);
  } catch (err) {
    log.error('Bulk revert error', err);
    return error(res, 'Failed to revert transactions', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
