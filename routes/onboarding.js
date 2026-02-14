import { Router } from 'express';
import crypto from 'crypto';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';
import { FRONTEND_URL } from '../lib/config.js';
import { success, error as errorResponse } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:Onboarding');
const router = Router();

const VALID_REGIONS = ['EU', 'US', 'KR', 'TW'];
const VALID_LOOT_SYSTEMS = ['dkp', 'loot_council', 'epgp'];

// Helper: get a config value
async function getConfig(db, key) {
  const row = await db.get('SELECT config_value FROM dkp_config WHERE config_key = ?', key);
  return row?.config_value ?? null;
}

// Helper: set a config value (upsert)
async function setConfig(db, key, value, description) {
  const exists = await db.get('SELECT 1 FROM dkp_config WHERE config_key = ?', key);
  if (exists) {
    await db.run(
      'UPDATE dkp_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?',
      value, key
    );
  } else {
    await db.run(
      'INSERT INTO dkp_config (config_key, config_value, description) VALUES (?, ?, ?)',
      key, value, description || key
    );
  }
}

// GET /api/onboarding/status — check onboarding progress
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const db = req.db;

    const [guildName, guildServer, guildRegion, lootSystem, onboardingCompleted] = await Promise.all([
      getConfig(db, 'guild_name'),
      getConfig(db, 'guild_server'),
      getConfig(db, 'guild_region'),
      getConfig(db, 'loot_system'),
      getConfig(db, 'onboarding_completed'),
    ]);

    const memberCount = await db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const raidDays = await db.all('SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1');
    const hasInviteCode = await db.get('SELECT 1 FROM invite_codes LIMIT 1');

    const steps = {
      guild: !!(guildName && guildServer && guildRegion),
      roster: memberCount.count > 1,
      schedule: raidDays.length > 0,
      invite: !!hasInviteCode,
    };

    return success(res, {
      completed: onboardingCompleted === 'true',
      steps,
      guild: {
        name: guildName || null,
        server: guildServer || null,
        region: guildRegion || null,
        lootSystem: lootSystem || null,
      },
      memberCount: memberCount.count,
      raidDays,
    });
  } catch (err) {
    log.error('Get onboarding status error', err);
    return errorResponse(res, 'Failed to get onboarding status', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// PUT /api/onboarding/guild — save guild info (admin only)
router.put('/guild', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const db = req.db;
    const { name, server, region } = req.body;
    const lootSystem = req.body.lootSystem ? req.body.lootSystem.toLowerCase().replace(/\s+/g, '_') : undefined;

    if (!name || !server || !region) {
      return errorResponse(res, 'name, server, and region are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (typeof name !== 'string' || name.trim().length < 2) {
      return errorResponse(res, 'Guild name must be at least 2 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (typeof server !== 'string' || server.trim().length < 2) {
      return errorResponse(res, 'Server name must be at least 2 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!VALID_REGIONS.includes(region)) {
      return errorResponse(res, `Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (lootSystem && !VALID_LOOT_SYSTEMS.includes(lootSystem)) {
      return errorResponse(res, `Invalid loot system. Must be one of: ${VALID_LOOT_SYSTEMS.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    await setConfig(db, 'guild_name', name.trim(), 'Guild name');
    await setConfig(db, 'guild_server', server.trim(), 'Guild server/realm');
    await setConfig(db, 'guild_region', region, 'Guild region (EU/US/KR/TW)');
    if (lootSystem) {
      await setConfig(db, 'loot_system', lootSystem, 'Loot system: dkp, loot_council, or epgp');
    }

    log.info(`Guild info updated: ${name.trim()} on ${server.trim()}-${region}`);

    return success(res, {
      guild: { name: name.trim(), server: server.trim(), region, lootSystem: lootSystem || 'dkp' },
    });
  } catch (err) {
    log.error('Save guild info error', err);
    return errorResponse(res, 'Failed to save guild info', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// PUT /api/onboarding/schedule — save raid schedule (admin only)
router.put('/schedule', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const db = req.db;
    const { days } = req.body;

    if (!days || !Array.isArray(days) || days.length === 0) {
      return errorResponse(res, 'days array is required and must not be empty', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const dayNames = {
      1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
      5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
    };

    for (const day of days) {
      if (!day.dayOfWeek || day.dayOfWeek < 1 || day.dayOfWeek > 7) {
        return errorResponse(res, 'Each day must have dayOfWeek between 1 and 7', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    await db.transaction(async (tx) => {
      await tx.run('UPDATE raid_days SET is_active = 0');

      for (const day of days) {
        await tx.run(`
          INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(day_of_week) DO UPDATE SET
            day_name = excluded.day_name,
            is_active = 1,
            raid_time = excluded.raid_time
        `, day.dayOfWeek, day.dayName || dayNames[day.dayOfWeek], day.raidTime || '20:00');
      }
    });

    const updatedDays = await db.all('SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1 ORDER BY day_of_week');

    log.info(`Raid schedule updated: ${updatedDays.map(d => d.day_name).join(', ')}`);

    return success(res, { raidDays: updatedDays });
  } catch (err) {
    log.error('Save schedule error', err);
    return errorResponse(res, 'Failed to save raid schedule', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// POST /api/onboarding/invite — generate invite code (admin/officer)
router.post('/invite', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const db = req.db;
    const { maxUses, expiresInDays } = req.body;
    const code = crypto.randomBytes(6).toString('hex');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await db.run(
      'INSERT INTO invite_codes (code, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?)',
      code, req.user.userId, maxUses || 0, expiresAt
    );

    const baseUrl = FRONTEND_URL.split(',')[0].trim().replace(/\/+$/, '');
    const inviteUrl = `${baseUrl}/join/${code}`;

    log.info(`Invite code created: ${code} by user ${req.user.userId}`);

    return success(res, { code, inviteUrl, maxUses: maxUses || 0, expiresAt }, null, 201);
  } catch (err) {
    log.error('Create invite code error', err);
    return errorResponse(res, 'Failed to create invite code', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// GET /api/onboarding/invite — list all invite codes (admin/officer)
router.get('/invite', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const db = req.db;
    const codes = await db.all(`
      SELECT ic.id, ic.code, ic.max_uses, ic.use_count, ic.expires_at, ic.created_at,
             u.character_name as created_by_name
      FROM invite_codes ic
      LEFT JOIN users u ON ic.created_by = u.id
      ORDER BY ic.created_at DESC
    `);

    return success(res, codes);
  } catch (err) {
    log.error('List invite codes error', err);
    return errorResponse(res, 'Failed to list invite codes', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// GET /api/onboarding/invite/:code — validate invite code (public)
router.get('/invite/:code', async (req, res) => {
  try {
    const db = req.db;
    const { code } = req.params;

    if (!code || typeof code !== 'string') {
      return errorResponse(res, 'Invalid invite code', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const invite = await db.get(
      'SELECT id, code, max_uses, use_count, expires_at FROM invite_codes WHERE code = ?',
      code
    );

    if (!invite) {
      return errorResponse(res, 'Invite code not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return errorResponse(res, 'Invite code has expired', 410, ErrorCodes.NOT_FOUND);
    }

    if (invite.max_uses > 0 && invite.use_count >= invite.max_uses) {
      return errorResponse(res, 'Invite code has reached its usage limit', 410, ErrorCodes.NOT_FOUND);
    }

    const guildName = await getConfig(db, 'guild_name');

    return success(res, { valid: true, guildName: guildName || null });
  } catch (err) {
    log.error('Validate invite code error', err);
    return errorResponse(res, 'Failed to validate invite code', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// DELETE /api/onboarding/invite/:id — revoke an invite code (admin/officer)
router.delete('/invite/:id', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const db = req.db;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid invite ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await db.run('DELETE FROM invite_codes WHERE id = ?', id);

    if (result.changes === 0) {
      return errorResponse(res, 'Invite code not found', 404, ErrorCodes.NOT_FOUND);
    }

    return success(res, null, 'Invite code revoked');
  } catch (err) {
    log.error('Delete invite code error', err);
    return errorResponse(res, 'Failed to revoke invite code', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// POST /api/onboarding/complete — mark onboarding as done (admin)
router.post('/complete', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const db = req.db;
    await setConfig(db, 'onboarding_completed', 'true', 'Whether the guild onboarding wizard has been completed');

    log.info(`Onboarding marked complete by user ${req.user.userId}`);

    return success(res, { completed: true });
  } catch (err) {
    log.error('Complete onboarding error', err);
    return errorResponse(res, 'Failed to complete onboarding', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// POST /api/onboarding/skip — skip onboarding (admin)
router.post('/skip', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const db = req.db;
    await setConfig(db, 'onboarding_completed', 'true', 'Whether the guild onboarding wizard has been completed');

    log.info(`Onboarding skipped by user ${req.user.userId}`);

    return success(res, { completed: true });
  } catch (err) {
    log.error('Skip onboarding error', err);
    return errorResponse(res, 'Failed to skip onboarding', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// POST /api/onboarding/provision-guild — create a new guild with its own database (admin)
router.post('/provision-guild', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, server, region } = req.body;

    if (!name || !server) {
      return errorResponse(res, 'name and server are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { provisionGuild } = await import('../lib/provisioning.js');
    const { generateAccessToken, generateRefreshToken } = await import('../middleware/auth.js');

    const guild = await provisionGuild({
      name: name.trim(),
      realm: server.trim(),
      region: region || 'eu',
      ownerId: String(req.user.userId),
    });

    // Issue tokens scoped to the new guild
    const user = await req.db.get('SELECT id, username, role FROM users WHERE id = ?', req.user.userId);
    const accessToken = generateAccessToken(user, guild.id);
    const refreshToken = generateRefreshToken(user, guild.id);

    log.info(`Guild provisioned: ${guild.name} (${guild.id}) by user ${req.user.userId}`);

    return success(res, {
      guild: { id: guild.id, name: guild.name, slug: guild.slug, realm: guild.realm, region: guild.region },
      token: accessToken,
      refreshToken,
    }, 'Guild created successfully', 201);
  } catch (err) {
    if (err.message === 'GUILD_SLUG_TAKEN') {
      return errorResponse(res, 'A guild with this name already exists', 409, ErrorCodes.ALREADY_EXISTS);
    }
    log.error('Provision guild error', err);
    return errorResponse(res, 'Failed to create guild', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
