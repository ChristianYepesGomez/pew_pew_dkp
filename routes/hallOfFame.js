import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:HallOfFame');
const router = Router();

// Get all Hall of Fame entries (any authenticated user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const entries = await req.db.all(`
      SELECT hof.*,
             u.character_name AS added_by_name
      FROM hall_of_fame hof
      LEFT JOIN users u ON hof.added_by = u.id
      ORDER BY hof.leave_date DESC
    `);

    return success(res, entries.map(e => ({
      id: e.id,
      userId: e.user_id,
      characterName: e.character_name,
      characterClass: e.character_class,
      spec: e.spec,
      raidRole: e.raid_role,
      joinDate: e.join_date,
      leaveDate: e.leave_date,
      tribute: e.tribute,
      lifetimeDkpGained: e.lifetime_dkp_gained,
      lifetimeDkpSpent: e.lifetime_dkp_spent,
      totalRaids: e.total_raids,
      totalBossKills: e.total_boss_kills,
      avatar: e.avatar,
      addedByName: e.added_by_name,
      createdAt: e.created_at,
    })));
  } catch (err) {
    log.error('Get hall of fame error', err);
    return error(res, 'Failed to get hall of fame', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get single Hall of Fame entry with detailed stats
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid entry ID', 400, ErrorCodes.VALIDATION_ERROR);

    const entry = await req.db.get(`
      SELECT hof.*,
             u.character_name AS added_by_name
      FROM hall_of_fame hof
      LEFT JOIN users u ON hof.added_by = u.id
      WHERE hof.id = ?
    `, id);

    if (!entry) {
      return error(res, 'Entry not found', 404, ErrorCodes.NOT_FOUND);
    }

    // If linked to a user, fetch their notable items won
    let itemsWon = [];
    if (entry.user_id) {
      itemsWon = await req.db.all(`
        SELECT a.item_name, a.item_image, a.item_rarity, a.item_id,
               a.winning_bid, a.ended_at
        FROM auctions a
        WHERE a.winner_id = ? AND a.status = 'completed' AND a.farewell_data IS NULL
        ORDER BY a.ended_at DESC
        LIMIT 20
      `, entry.user_id);
    }

    return success(res, {
      id: entry.id,
      userId: entry.user_id,
      characterName: entry.character_name,
      characterClass: entry.character_class,
      spec: entry.spec,
      raidRole: entry.raid_role,
      joinDate: entry.join_date,
      leaveDate: entry.leave_date,
      tribute: entry.tribute,
      lifetimeDkpGained: entry.lifetime_dkp_gained,
      lifetimeDkpSpent: entry.lifetime_dkp_spent,
      totalRaids: entry.total_raids,
      totalBossKills: entry.total_boss_kills,
      avatar: entry.avatar,
      addedByName: entry.added_by_name,
      createdAt: entry.created_at,
      itemsWon: itemsWon.map(i => ({
        itemName: i.item_name,
        itemImage: i.item_image,
        itemRarity: i.item_rarity,
        itemId: i.item_id,
        winningBid: i.winning_bid,
        endedAt: i.ended_at,
      })),
    });
  } catch (err) {
    log.error('Get hall of fame entry error', err);
    return error(res, 'Failed to get hall of fame entry', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Add entry to Hall of Fame (admin/officer only)
router.post('/', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, characterName, characterClass, spec, raidRole, joinDate, leaveDate, tribute } = req.body;

    if (!characterName || !characterClass) {
      return error(res, 'Character name and class are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // If userId provided, check it's not already in hall of fame
    if (userId) {
      const parsedUserId = parseInt(userId, 10);
      if (isNaN(parsedUserId)) return error(res, 'Invalid user ID', 400, ErrorCodes.VALIDATION_ERROR);

      const existing = await req.db.get('SELECT id FROM hall_of_fame WHERE user_id = ?', parsedUserId);
      if (existing) {
        return error(res, 'This member is already in the Hall of Fame', 409, ErrorCodes.ALREADY_EXISTS);
      }
    }

    // Gather stats from DB if userId is linked
    let stats = { lifetimeGained: 0, lifetimeSpent: 0, totalRaids: 0, totalBossKills: 0, avatar: null };
    if (userId) {
      const parsedUserId = parseInt(userId, 10);
      const dkpData = await req.db.get(
        'SELECT lifetime_gained, lifetime_spent FROM member_dkp WHERE user_id = ?', parsedUserId
      );
      if (dkpData) {
        stats.lifetimeGained = dkpData.lifetime_gained || 0;
        stats.lifetimeSpent = dkpData.lifetime_spent || 0;
      }

      const raidCount = await req.db.get(
        'SELECT COUNT(*) as count FROM raid_attendance WHERE user_id = ?', parsedUserId
      );
      stats.totalRaids = raidCount?.count || 0;

      const killCount = await req.db.get(`
        SELECT COUNT(*) as count FROM player_fight_performance
        WHERE user_id = ? AND is_kill = 1
      `, parsedUserId);
      stats.totalBossKills = killCount?.count || 0;

      const userData = await req.db.get('SELECT avatar FROM users WHERE id = ?', parsedUserId);
      stats.avatar = userData?.avatar || null;
    }

    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : null;

    const result = await req.db.run(`
      INSERT INTO hall_of_fame (user_id, character_name, character_class, spec, raid_role,
                                join_date, leave_date, tribute,
                                lifetime_dkp_gained, lifetime_dkp_spent,
                                total_raids, total_boss_kills, avatar, added_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, userId ? parseInt(userId, 10) : null,
       characterName, characterClass, spec || null, validRaidRole,
       joinDate || null, leaveDate || null, tribute || null,
       stats.lifetimeGained, stats.lifetimeSpent,
       stats.totalRaids, stats.totalBossKills, stats.avatar,
       req.user.userId);

    log.info(`Hall of Fame entry created for ${characterName} by user ${req.user.userId}`);

    return success(res, {
      id: result.lastInsertRowid,
      characterName,
      characterClass,
    }, 'Added to Hall of Fame', 201);
  } catch (err) {
    log.error('Create hall of fame entry error', err);
    return error(res, 'Failed to add to hall of fame', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Update Hall of Fame entry (admin/officer only)
router.put('/:id', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid entry ID', 400, ErrorCodes.VALIDATION_ERROR);

    const existing = await req.db.get('SELECT id FROM hall_of_fame WHERE id = ?', id);
    if (!existing) {
      return error(res, 'Entry not found', 404, ErrorCodes.NOT_FOUND);
    }

    const { tribute, joinDate, leaveDate, spec, raidRole } = req.body;

    const updates = [];
    const params = [];

    if (tribute !== undefined) { updates.push('tribute = ?'); params.push(tribute); }
    if (joinDate !== undefined) { updates.push('join_date = ?'); params.push(joinDate); }
    if (leaveDate !== undefined) { updates.push('leave_date = ?'); params.push(leaveDate); }
    if (spec !== undefined) { updates.push('spec = ?'); params.push(spec); }
    if (raidRole !== undefined) {
      if (!['Tank', 'Healer', 'DPS'].includes(raidRole)) {
        return error(res, 'Invalid raid role', 400, ErrorCodes.VALIDATION_ERROR);
      }
      updates.push('raid_role = ?');
      params.push(raidRole);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update', 400, ErrorCodes.VALIDATION_ERROR);
    }

    params.push(id);
    await req.db.run(`UPDATE hall_of_fame SET ${updates.join(', ')} WHERE id = ?`, ...params);

    return success(res, null, 'Hall of Fame entry updated');
  } catch (err) {
    log.error('Update hall of fame entry error', err);
    return error(res, 'Failed to update hall of fame entry', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Delete Hall of Fame entry (admin only)
router.delete('/:id', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid entry ID', 400, ErrorCodes.VALIDATION_ERROR);

    const existing = await req.db.get('SELECT id, character_name FROM hall_of_fame WHERE id = ?', id);
    if (!existing) {
      return error(res, 'Entry not found', 404, ErrorCodes.NOT_FOUND);
    }

    await req.db.run('DELETE FROM hall_of_fame WHERE id = ?', id);

    log.info(`Hall of Fame entry for ${existing.character_name} deleted by user ${req.user.userId}`);
    return success(res, null, 'Hall of Fame entry removed');
  } catch (err) {
    log.error('Delete hall of fame entry error', err);
    return error(res, 'Failed to delete hall of fame entry', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
