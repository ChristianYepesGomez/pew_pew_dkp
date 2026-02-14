import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { EPGPSystem } from '../lib/lootSystems/epgp.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:EPGP');
const router = Router();

// Get EPGP standings (leaderboard by EP/GP ratio)
router.get('/standings', authenticateToken, async (req, res) => {
  try {
    const epgp = new EPGPSystem(req.db);
    const standings = await epgp.getLeaderboard();
    return success(res, standings);
  } catch (err) {
    log.error('EPGP standings error', err);
    return error(res, 'Failed to get EPGP standings', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Award EP to one or more users (officer+)
router.post('/ep/award', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userIds, userId, amount, reason } = req.body;

    if (amount === undefined || amount <= 0) {
      return error(res, 'Positive amount is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const targets = userIds || (userId ? [userId] : []);
    if (targets.length === 0) {
      return error(res, 'userId or userIds is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const epgp = new EPGPSystem(req.db);
    await epgp.bulkAwardEP(targets, amount, reason || 'EP award');

    req.app.get('io').emit('epgp_updated', { userIds: targets, type: 'ep_gain', amount });
    return success(res, null, `${amount} EP awarded to ${targets.length} player(s)`);
  } catch (err) {
    log.error('Award EP error', err);
    return error(res, 'Failed to award EP', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Charge GP when a player receives loot (officer+)
router.post('/gp/charge', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, amount, reason, itemId } = req.body;

    if (!userId) return error(res, 'userId is required', 400, ErrorCodes.VALIDATION_ERROR);
    if (amount === undefined || amount <= 0) return error(res, 'Positive amount is required', 400, ErrorCodes.VALIDATION_ERROR);

    const epgp = new EPGPSystem(req.db);
    await epgp.chargeGP(userId, amount, reason || 'GP charge', itemId);

    const updated = await req.db.get('SELECT effort_points, gear_points FROM member_epgp WHERE user_id = ?', userId);
    const priority = updated ? (updated.effort_points / Math.max(updated.gear_points, 1)).toFixed(2) : 0;

    req.app.get('io').emit('epgp_updated', { userId, type: 'gp_spend', amount, priority });
    return success(res, {
      effortPoints: updated?.effort_points || 0,
      gearPoints: updated?.gear_points || 0,
      priority: parseFloat(priority),
    }, `${amount} GP charged`);
  } catch (err) {
    log.error('Charge GP error', err);
    return error(res, 'Failed to charge GP', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Apply EPGP decay (admin only)
router.post('/decay', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { percentage } = req.body;

    if (!percentage || percentage <= 0 || percentage > 100) {
      return error(res, 'Invalid decay percentage (1-100)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const epgp = new EPGPSystem(req.db);
    await epgp.applyDecay(percentage, req.user.userId);

    req.app.get('io').emit('epgp_decay_applied', { percentage });
    return success(res, null, `${percentage}% EPGP decay applied to both EP and GP`);
  } catch (err) {
    log.error('EPGP decay error', err);
    return error(res, 'Failed to apply EPGP decay', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get EPGP transaction history for a user
router.get('/history/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return error(res, 'Invalid user ID', 400, ErrorCodes.VALIDATION_ERROR);

    const limit = parseInt(req.query.limit) || 50;

    // Access control: own history or officer+
    if (req.user.userId !== userId && !['admin', 'officer'].includes(req.user.role)) {
      return error(res, 'Unauthorized to view this history', 403, ErrorCodes.FORBIDDEN);
    }

    const epgpStats = await req.db.get('SELECT effort_points, gear_points FROM member_epgp WHERE user_id = ?', userId);
    const epgp = new EPGPSystem(req.db);
    const history = await epgp.getHistory(userId, limit);

    return success(res, {
      effortPoints: epgpStats?.effort_points || 0,
      gearPoints: epgpStats?.gear_points || 0,
      priority: epgpStats ? parseFloat((epgpStats.effort_points / Math.max(epgpStats.gear_points, 1)).toFixed(2)) : 0,
      transactions: history,
    });
  } catch (err) {
    log.error('EPGP history error', err);
    return error(res, 'Failed to get EPGP history', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get GP item values table
router.get('/item-values', authenticateToken, async (req, res) => {
  try {
    const epgp = new EPGPSystem(req.db);
    const values = await epgp.getItemValues();
    return success(res, values);
  } catch (err) {
    log.error('EPGP item values error', err);
    return error(res, 'Failed to get item values', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Update a GP item value (admin only)
router.put('/item-values/:id', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid item value ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { gpValue } = req.body;
    if (gpValue === undefined || gpValue < 0) {
      return error(res, 'Valid gpValue is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const epgp = new EPGPSystem(req.db);
    const updated = await epgp.updateItemValue(id, gpValue);
    if (!updated) return error(res, 'Item value not found', 404, ErrorCodes.NOT_FOUND);

    return success(res, updated);
  } catch (err) {
    log.error('Update EPGP item value error', err);
    return error(res, 'Failed to update item value', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
