import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { getCachedConfig, getCurrentRaidWeek, addDkpWithCap } from '../lib/helpers.js';
import { createLogger } from '../lib/logger.js';
import { success, error, paginated } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { parsePagination } from '../lib/pagination.js';

const log = createLogger('Route:Members');
const router = Router();

// Get all members with DKP (sorted by DKP descending)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get current raid week (Thursday-based)
    const currentWeek = getCurrentRaidWeek();

    const { limit, offset } = parsePagination(req.query, { limit: 200, maxLimit: 500 });

    const { total } = await req.db.get('SELECT COUNT(*) as total FROM users WHERE is_active = 1');

    const members = await req.db.all(`
      SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.raid_role, u.spec, u.avatar,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent,
             md.weekly_vault_completed, md.vault_week
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.is_active = 1
      ORDER BY md.current_dkp DESC
      LIMIT ? OFFSET ?
    `, limit, offset);

    // Get DKP cap from config
    const capConfig = await req.db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    return paginated(res, members.map(m => ({
      id: m.id,
      username: m.username,
      characterName: m.character_name,
      characterClass: m.character_class,
      role: m.role,
      raidRole: m.raid_role,
      spec: m.spec,
      avatar: m.avatar || null,
      currentDkp: m.current_dkp || 0,
      lifetimeGained: m.lifetime_gained || 0,
      lifetimeSpent: m.lifetime_spent || 0,
      weeklyVaultCompleted: m.vault_week === currentWeek ? (m.weekly_vault_completed === 1) : false,
      dkpCap
    })), { limit, offset, total });
  } catch (err) {
    log.error('Get members error', err);
    return error(res, 'Failed to get members', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Update member role (admin only)
router.put('/:id/role', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid member ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { role } = req.body;

    if (!['admin', 'officer', 'raider'].includes(role)) {
      return error(res, 'Invalid role', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await req.db.run('UPDATE users SET role = ? WHERE id = ?', role, id);

    req.app.get('io').emit('member_updated', { memberId: id });
    return success(res, null, 'Role updated successfully');
  } catch (err) {
    log.error('Update role error', err);
    return error(res, 'Failed to update role', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Toggle weekly vault completion (admin/officer only)
// This only marks/unmarks the check - DKP is awarded when the week is processed
router.put('/:id/vault', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid member ID', 400, ErrorCodes.VALIDATION_ERROR);

    const currentWeek = getCurrentRaidWeek();

    // Get current state
    const member = await req.db.get(`
      SELECT md.weekly_vault_completed, md.vault_week, u.character_name
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.user_id = ?
    `, id);

    if (!member) {
      return error(res, 'Member not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Check if already completed this week
    const wasCompleted = member.vault_week === currentWeek && member.weekly_vault_completed === 1;

    if (wasCompleted) {
      // Remove vault mark (no DKP changes - DKP is processed at week end)
      await req.db.run(`
        UPDATE member_dkp
        SET weekly_vault_completed = 0
        WHERE user_id = ?
      `, id);

      req.app.get('io').emit('member_updated', { memberId: id });
      return success(res, { completed: false }, 'Vault unmarked');
    } else {
      // Mark as completed (no DKP yet - will be awarded when week is processed)
      await req.db.run(`
        UPDATE member_dkp
        SET weekly_vault_completed = 1,
            vault_completed_at = CURRENT_TIMESTAMP,
            vault_week = ?
        WHERE user_id = ?
      `, currentWeek, id);

      req.app.get('io').emit('member_updated', { memberId: id });
      return success(res, { completed: true }, 'Vault marked as completed');
    }
  } catch (err) {
    log.error('Toggle vault error', err);
    return error(res, 'Failed to toggle vault status', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ============================================
// VAULT ROUTES (mounted at /api separately)
// These have paths that don't match /api/members prefix
// ============================================
export const vaultRouter = Router();

// Cron endpoint for processing weekly vault (called by external scheduler like cron-job.org)
// Secured by CRON_SECRET header - no user auth needed
// Schedule: Wednesdays at 8:00 AM Madrid time
vaultRouter.post('/cron/process-vault', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = req.headers['x-cron-secret'] || req.query.secret;

    if (!cronSecret || providedSecret !== cronSecret) {
      log.info('Cron vault: Invalid or missing secret');
      return error(res, 'Unauthorized', 401, ErrorCodes.UNAUTHORIZED);
    }

    log.info('Cron: Processing weekly vault rewards...');

    const currentWeek = getCurrentRaidWeek();
    const vaultDkp = parseInt(await getCachedConfig(req.db, 'weekly_vault_dkp', '10'), 10);
    const dkpCap = parseInt(await getCachedConfig(req.db, 'dkp_cap', '250'), 10);

    // Get all members with vault completed for current week
    const completedMembers = await req.db.all(`
      SELECT md.user_id, u.character_name
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.weekly_vault_completed = 1 AND md.vault_week = ?
    `, currentWeek);

    if (completedMembers.length === 0) {
      log.info('Cron: No vault completions to process');
      return success(res, {
        message: 'No vault completions to process',
        processed: 0,
        totalDkpAwarded: 0
      });
    }

    let totalDkpAwarded = 0;
    const processedMembers = [];
    const io = req.app.get('io');

    await req.db.transaction(async (tx) => {
      for (const member of completedMembers) {
        // Award DKP with cap
        const result = await addDkpWithCap(tx, member.user_id, vaultDkp, dkpCap);
        totalDkpAwarded += result.actualGain;

        // Log transaction (performed_by = null for cron)
        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, member.user_id, result.actualGain, `Weekly Vault reward (+${vaultDkp} DKP${result.wasCapped ? ', capped' : ''})`, null);

        processedMembers.push({
          userId: member.user_id,
          characterName: member.character_name,
          dkpAwarded: result.actualGain,
          wasCapped: result.wasCapped
        });

        // Emit update for this member
        io.emit('member_updated', { memberId: member.user_id });
        io.emit('dkp_updated', { userId: member.user_id });
      }

      // Reset all vault completions for the current week
      await tx.run(`
        UPDATE member_dkp
        SET weekly_vault_completed = 0
        WHERE vault_week = ?
      `, currentWeek);
    });

    log.info(`Cron: Processed ${completedMembers.length} vault completions, awarded ${totalDkpAwarded} DKP`);

    return success(res, {
      message: `Processed ${completedMembers.length} vault completions`,
      processed: completedMembers.length,
      totalDkpAwarded,
      members: processedMembers
    });
  } catch (err) {
    log.error('Cron process vault error', err);
    return error(res, 'Failed to process weekly vault', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Process weekly vault rewards and reset (admin only) - DEPRECATED: Use cron endpoint instead
// This should be called on Wednesdays to award DKP to all marked members and reset the vault
vaultRouter.post('/admin/vault/process-weekly', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const currentWeek = getCurrentRaidWeek();
    const vaultDkp = parseInt(await getCachedConfig(req.db, 'weekly_vault_dkp', '10'), 10);
    const dkpCap = parseInt(await getCachedConfig(req.db, 'dkp_cap', '250'), 10);

    // Get all members with vault completed for current week
    const completedMembers = await req.db.all(`
      SELECT md.user_id, u.character_name
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.weekly_vault_completed = 1 AND md.vault_week = ?
    `, currentWeek);

    if (completedMembers.length === 0) {
      return success(res, {
        message: 'No vault completions to process',
        processed: 0,
        totalDkpAwarded: 0
      });
    }

    let totalDkpAwarded = 0;
    const processedMembers = [];
    const io = req.app.get('io');

    await req.db.transaction(async (tx) => {
      for (const member of completedMembers) {
        // Award DKP with cap
        const result = await addDkpWithCap(tx, member.user_id, vaultDkp, dkpCap);
        totalDkpAwarded += result.actualGain;

        // Log transaction
        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, member.user_id, result.actualGain, `Weekly Vault reward (+${vaultDkp} DKP${result.wasCapped ? ', capped' : ''})`, req.user.userId);

        processedMembers.push({
          userId: member.user_id,
          characterName: member.character_name,
          dkpAwarded: result.actualGain,
          wasCapped: result.wasCapped
        });

        // Emit update for this member
        io.emit('member_updated', { memberId: member.user_id });
        io.emit('dkp_updated', { userId: member.user_id });
      }

      // Reset all vault completions for the current week
      await tx.run(`
        UPDATE member_dkp
        SET weekly_vault_completed = 0
        WHERE vault_week = ?
      `, currentWeek);
    });

    return success(res, {
      message: `Processed ${completedMembers.length} vault completions`,
      processed: completedMembers.length,
      totalDkpAwarded,
      members: processedMembers
    });
  } catch (err) {
    log.error('Process weekly vault error', err);
    return error(res, 'Failed to process weekly vault', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get vault status summary (admin only)
vaultRouter.get('/admin/vault/status', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const currentWeek = getCurrentRaidWeek();
    const vaultDkp = parseInt(await getCachedConfig(req.db, 'weekly_vault_dkp', '10'), 10);

    // Get counts
    const stats = await req.db.get(`
      SELECT
        COUNT(*) as totalMembers,
        SUM(CASE WHEN md.weekly_vault_completed = 1 AND md.vault_week = ? THEN 1 ELSE 0 END) as completedCount
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE u.is_active = 1
    `, currentWeek);

    // Get list of completed members
    const completedMembers = await req.db.all(`
      SELECT u.id, u.character_name, u.character_class, md.vault_completed_at
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.weekly_vault_completed = 1 AND md.vault_week = ? AND u.is_active = 1
      ORDER BY md.vault_completed_at DESC
    `, currentWeek);

    return success(res, {
      currentWeek,
      vaultDkp,
      totalMembers: stats.totalMembers || 0,
      completedCount: stats.completedCount || 0,
      pendingDkp: (stats.completedCount || 0) * vaultDkp,
      completedMembers: completedMembers.map(m => ({
        id: m.id,
        characterName: m.character_name,
        characterClass: m.character_class,
        completedAt: m.vault_completed_at
      }))
    });
  } catch (err) {
    log.error('Get vault status error', err);
    return error(res, 'Failed to get vault status', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Deactivate member (admin only) - creates farewell record
router.delete('/:id', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid member ID', 400, ErrorCodes.VALIDATION_ERROR);

    const member = await req.db.get(`
      SELECT u.*, md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.id = ?
    `, id);

    if (!member) {
      return error(res, 'Member not found', 404, ErrorCodes.NOT_FOUND);
    }

    const itemsWon = await req.db.all(`
      SELECT a.item_name, a.item_image, a.item_rarity, a.item_id, a.winning_bid, a.ended_at
      FROM auctions a
      WHERE a.winner_id = ? AND a.status = 'completed' AND a.farewell_data IS NULL
      ORDER BY a.ended_at DESC
    `, id);

    const farewellData = JSON.stringify({
      type: 'farewell',
      member: {
        characterName: member.character_name,
        characterClass: member.character_class,
        spec: member.spec,
        raidRole: member.raid_role,
        currentDkp: member.current_dkp || 0,
        lifetimeGained: member.lifetime_gained || 0,
        lifetimeSpent: member.lifetime_spent || 0,
      },
      itemsWon,
      removedBy: req.user.userId,
    });

    await req.db.run(`
      INSERT INTO auctions (item_name, item_image, item_rarity, status, winning_bid, winner_id, created_by, ended_at, duration_minutes, farewell_data)
      VALUES (?, ?, 'legendary', 'completed', ?, ?, ?, datetime('now'), 0, ?)
    `, `${member.character_name}`, null, member.lifetime_spent || 0, id, req.user.userId, farewellData);

    await req.db.run('UPDATE users SET is_active = 0 WHERE id = ?', id);

    const io = req.app.get('io');
    io.emit('member_removed', { memberId: id });
    io.emit('auction_ended');
    return success(res, { member: member.character_name }, 'Member deactivated');
  } catch (err) {
    log.error('Deactivate member error', err);
    return error(res, 'Failed to deactivate member', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Create new member (admin or officer)
router.post('/', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { username, password, characterName, characterClass, spec, raidRole, role, initialDkp } = req.body;

    if (!username || !password || !characterName || !characterClass) {
      return error(res, 'Username, password, character name and class are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const existing = await req.db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', username);
    if (existing) {
      return error(res, 'Username already exists', 409, ErrorCodes.ALREADY_EXISTS);
    }

    const validRole = ['admin', 'officer', 'raider'].includes(role) ? role : 'raider';
    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : 'DPS';

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await req.db.run(`
      INSERT INTO users (username, password, character_name, character_class, spec, raid_role, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, username, hashedPassword, characterName, characterClass, spec || null, validRaidRole, validRole);

    const dkp = parseInt(initialDkp) || 0;
    await req.db.run(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained)
      VALUES (?, ?, ?)
    `, result.lastInsertRowid, dkp, dkp);

    req.app.get('io').emit('member_updated', { memberId: result.lastInsertRowid });

    return success(res, {
      member: {
        id: result.lastInsertRowid,
        username,
        characterName,
        characterClass,
        spec,
        raidRole: validRaidRole,
        role: validRole,
        currentDkp: dkp
      }
    }, 'Member created successfully', 201);
  } catch (err) {
    log.error('Create member error', err);
    return error(res, 'Failed to create member', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
