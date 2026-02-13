import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { getCachedConfig, getCurrentRaidWeek, addDkpWithCap } from '../lib/helpers.js';

const router = Router();

// Get all members with DKP (sorted by DKP descending)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get current raid week (Thursday-based)
    const currentWeek = getCurrentRaidWeek();

    const members = await db.all(`
      SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.raid_role, u.spec, u.avatar,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent,
             md.weekly_vault_completed, md.vault_week
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.is_active = 1
      ORDER BY md.current_dkp DESC
    `);

    // Get DKP cap from config
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    res.json(members.map(m => ({
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
    })));
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// Update member role (admin only)
router.put('/:id/role', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid member ID' });

    const { role } = req.body;

    if (!['admin', 'officer', 'raider'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await db.run('UPDATE users SET role = ? WHERE id = ?', role, id);

    req.app.get('io').emit('member_updated', { memberId: id });
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Toggle weekly vault completion (admin/officer only)
// This only marks/unmarks the check - DKP is awarded when the week is processed
router.put('/:id/vault', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid member ID' });

    const currentWeek = getCurrentRaidWeek();

    // Get current state
    const member = await db.get(`
      SELECT md.weekly_vault_completed, md.vault_week, u.character_name
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.user_id = ?
    `, id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Check if already completed this week
    const wasCompleted = member.vault_week === currentWeek && member.weekly_vault_completed === 1;

    if (wasCompleted) {
      // Remove vault mark (no DKP changes - DKP is processed at week end)
      await db.run(`
        UPDATE member_dkp
        SET weekly_vault_completed = 0
        WHERE user_id = ?
      `, id);

      req.app.get('io').emit('member_updated', { memberId: id });
      res.json({ message: 'Vault unmarked', completed: false });
    } else {
      // Mark as completed (no DKP yet - will be awarded when week is processed)
      await db.run(`
        UPDATE member_dkp
        SET weekly_vault_completed = 1,
            vault_completed_at = CURRENT_TIMESTAMP,
            vault_week = ?
        WHERE user_id = ?
      `, currentWeek, id);

      req.app.get('io').emit('member_updated', { memberId: id });
      res.json({ message: 'Vault marked as completed', completed: true });
    }
  } catch (error) {
    console.error('Toggle vault error:', error);
    res.status(500).json({ error: 'Failed to toggle vault status' });
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
      console.log('⚠️ Cron vault: Invalid or missing secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('⏰ Cron: Processing weekly vault rewards...');

    const currentWeek = getCurrentRaidWeek();
    const vaultDkp = parseInt(await getCachedConfig('weekly_vault_dkp', '10'), 10);
    const dkpCap = parseInt(await getCachedConfig('dkp_cap', '250'), 10);

    // Get all members with vault completed for current week
    const completedMembers = await db.all(`
      SELECT md.user_id, u.character_name
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.weekly_vault_completed = 1 AND md.vault_week = ?
    `, currentWeek);

    if (completedMembers.length === 0) {
      console.log('⏰ Cron: No vault completions to process');
      return res.json({
        message: 'No vault completions to process',
        processed: 0,
        totalDkpAwarded: 0
      });
    }

    let totalDkpAwarded = 0;
    const processedMembers = [];
    const io = req.app.get('io');

    await db.transaction(async (tx) => {
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

    console.log(`✅ Cron: Processed ${completedMembers.length} vault completions, awarded ${totalDkpAwarded} DKP`);

    res.json({
      message: `Processed ${completedMembers.length} vault completions`,
      processed: completedMembers.length,
      totalDkpAwarded,
      members: processedMembers
    });
  } catch (error) {
    console.error('Cron process vault error:', error);
    res.status(500).json({ error: 'Failed to process weekly vault' });
  }
});

// Process weekly vault rewards and reset (admin only) - DEPRECATED: Use cron endpoint instead
// This should be called on Wednesdays to award DKP to all marked members and reset the vault
vaultRouter.post('/admin/vault/process-weekly', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const currentWeek = getCurrentRaidWeek();
    const vaultDkp = parseInt(await getCachedConfig('weekly_vault_dkp', '10'), 10);
    const dkpCap = parseInt(await getCachedConfig('dkp_cap', '250'), 10);

    // Get all members with vault completed for current week
    const completedMembers = await db.all(`
      SELECT md.user_id, u.character_name
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.weekly_vault_completed = 1 AND md.vault_week = ?
    `, currentWeek);

    if (completedMembers.length === 0) {
      return res.json({
        message: 'No vault completions to process',
        processed: 0,
        totalDkpAwarded: 0
      });
    }

    let totalDkpAwarded = 0;
    const processedMembers = [];
    const io = req.app.get('io');

    await db.transaction(async (tx) => {
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

    res.json({
      message: `Processed ${completedMembers.length} vault completions`,
      processed: completedMembers.length,
      totalDkpAwarded,
      members: processedMembers
    });
  } catch (error) {
    console.error('Process weekly vault error:', error);
    res.status(500).json({ error: 'Failed to process weekly vault' });
  }
});

// Get vault status summary (admin only)
vaultRouter.get('/admin/vault/status', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const currentWeek = getCurrentRaidWeek();
    const vaultDkp = parseInt(await getCachedConfig('weekly_vault_dkp', '10'), 10);

    // Get counts
    const stats = await db.get(`
      SELECT
        COUNT(*) as totalMembers,
        SUM(CASE WHEN md.weekly_vault_completed = 1 AND md.vault_week = ? THEN 1 ELSE 0 END) as completedCount
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE u.is_active = 1
    `, currentWeek);

    // Get list of completed members
    const completedMembers = await db.all(`
      SELECT u.id, u.character_name, u.character_class, md.vault_completed_at
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.weekly_vault_completed = 1 AND md.vault_week = ? AND u.is_active = 1
      ORDER BY md.vault_completed_at DESC
    `, currentWeek);

    res.json({
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
  } catch (error) {
    console.error('Get vault status error:', error);
    res.status(500).json({ error: 'Failed to get vault status' });
  }
});

// Deactivate member (admin only) - creates farewell record
router.delete('/:id', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid member ID' });

    const member = await db.get(`
      SELECT u.*, md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.id = ?
    `, id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const itemsWon = await db.all(`
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

    await db.run(`
      INSERT INTO auctions (item_name, item_image, item_rarity, status, winning_bid, winner_id, created_by, ended_at, duration_minutes, farewell_data)
      VALUES (?, ?, 'legendary', 'completed', ?, ?, ?, datetime('now'), 0, ?)
    `, `${member.character_name}`, null, member.lifetime_spent || 0, id, req.user.userId, farewellData);

    await db.run('UPDATE users SET is_active = 0 WHERE id = ?', id);

    const io = req.app.get('io');
    io.emit('member_removed', { memberId: id });
    io.emit('auction_ended');
    res.json({ message: 'Member deactivated', member: member.character_name });
  } catch (error) {
    console.error('Deactivate member error:', error);
    res.status(500).json({ error: 'Failed to deactivate member' });
  }
});

// Create new member (admin or officer)
router.post('/', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { username, password, characterName, characterClass, spec, raidRole, role, initialDkp } = req.body;

    if (!username || !password || !characterName || !characterClass) {
      return res.status(400).json({ error: 'Username, password, character name and class are required' });
    }

    const existing = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const validRole = ['admin', 'officer', 'raider'].includes(role) ? role : 'raider';
    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : 'DPS';

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run(`
      INSERT INTO users (username, password, character_name, character_class, spec, raid_role, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, username, hashedPassword, characterName, characterClass, spec || null, validRaidRole, validRole);

    const dkp = parseInt(initialDkp) || 0;
    await db.run(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained)
      VALUES (?, ?, ?)
    `, result.lastInsertRowid, dkp, dkp);

    req.app.get('io').emit('member_updated', { memberId: result.lastInsertRowid });

    res.status(201).json({
      message: 'Member created successfully',
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
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

export default router;
