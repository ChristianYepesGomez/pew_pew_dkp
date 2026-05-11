import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Roster');
const router = Router();

// ── Helper: build full roster object from DB ─────────────────────────────────
async function buildRoster(db, rosterId) {
  const roster = await db.get(`
    SELECT r.id, r.raid_date, r.boss_id, r.published, r.created_at, r.updated_at,
           r.coach_user_id,
           uc.character_name as coach_name, uc.character_class as coach_class, uc.spec as coach_spec,
           wb.name as boss_name, wb.slug as boss_slug, wb.image_url as boss_image,
           wz.name as zone_name
    FROM raid_rosters r
    LEFT JOIN users uc ON uc.id = r.coach_user_id
    LEFT JOIN wcl_bosses wb ON wb.id = r.boss_id
    LEFT JOIN wcl_zones wz ON wz.id = wb.zone_id
    WHERE r.id = ?
  `, rosterId);
  if (!roster) return null;

  roster.players = await db.all(`
    SELECT rp.slot, u.id as user_id, u.character_name, u.character_class,
           u.raid_role, u.spec, u.avatar
    FROM roster_players rp
    JOIN users u ON u.id = rp.user_id
    WHERE rp.roster_id = ?
    ORDER BY u.raid_role, u.character_name
  `, rosterId);

  return roster;
}

// ── GET /api/roster?date=YYYY-MM-DD ─────────────────────────────────────────
// Returns all rosters for a date (one per boss + optional general).
router.get('/', authenticateToken, async (req, res) => {
  const { db } = req;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 'Invalid or missing date', 400);
  }

  const rows = await db.all(`
    SELECT r.id, r.raid_date, r.boss_id, r.published, r.created_at, r.updated_at,
           r.coach_user_id,
           uc.character_name as coach_name, uc.character_class as coach_class, uc.spec as coach_spec,
           wb.name as boss_name, wb.slug as boss_slug, wb.image_url as boss_image,
           wz.name as zone_name
    FROM raid_rosters r
    LEFT JOIN users uc ON uc.id = r.coach_user_id
    LEFT JOIN wcl_bosses wb ON wb.id = r.boss_id
    LEFT JOIN wcl_zones wz ON wz.id = wb.zone_id
    WHERE r.raid_date = ?
    ORDER BY CASE WHEN r.boss_id IS NULL THEN 0 ELSE 1 END, r.boss_id ASC, r.created_at ASC
  `, date);

  for (const r of rows) {
    r.players = await db.all(`
      SELECT rp.slot, u.id as user_id, u.character_name, u.character_class,
             u.raid_role, u.spec, u.avatar
      FROM roster_players rp
      JOIN users u ON u.id = rp.user_id
      WHERE rp.roster_id = ?
      ORDER BY u.raid_role, u.character_name
    `, r.id);
  }

  return success(res, rows);
});

// ── GET /api/roster/available?date=YYYY-MM-DD ────────────────────────────────
router.get('/available', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db } = req;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 'Invalid or missing date', 400);
  }

  const players = await db.all(`
    SELECT u.id as user_id, u.character_name, u.character_class, u.raid_role, u.spec, u.avatar,
           ma.status as signup_status
    FROM users u
    JOIN member_availability ma ON ma.user_id = u.id AND ma.raid_date = ?
    WHERE u.is_active = 1
      AND u.character_name IS NOT NULL AND TRIM(u.character_name) != ''
      AND ma.status IN ('confirmed', 'late', 'tentative')
    ORDER BY
      CASE ma.status WHEN 'confirmed' THEN 1 WHEN 'late' THEN 2 WHEN 'tentative' THEN 3 END,
      u.raid_role, u.character_name
  `, date);

  return success(res, players);
});

// ── GET /api/roster/bosses ────────────────────────────────────────────────────
router.get('/bosses', authenticateToken, async (req, res) => {
  const { db } = req;
  const bosses = await db.all(`
    SELECT wb.id, wb.name, wb.slug, wb.boss_order, wb.image_url,
           wz.id as zone_id, wz.name as zone_name, wz.expansion
    FROM wcl_bosses wb
    JOIN wcl_zones wz ON wz.id = wb.zone_id
    WHERE wz.is_current = 1
    ORDER BY wz.tier ASC, wb.boss_order ASC
  `);
  return success(res, bosses);
});

// ── GET /api/roster/coaches ───────────────────────────────────────────────────
router.get('/coaches', authenticateToken, async (req, res) => {
  const { db } = req;
  const coaches = await db.all(`
    SELECT id as user_id, character_name, character_class, spec
    FROM users WHERE is_active = 1 AND role IN ('admin','officer')
      AND character_name IS NOT NULL AND TRIM(character_name) != ''
    ORDER BY character_name
  `);
  return success(res, coaches);
});

// ── POST /api/roster/date/:date/create-boss-roster ───────────────────────────
// Creates a new roster for a specific boss on a given date.
// If boss_id is null, creates a general day roster.
router.post('/date/:date/create-boss-roster', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const { date } = req.params;
  const boss_id = req.body.boss_id ? parseInt(req.body.boss_id) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error(res, 'Invalid date', 400);
  if (boss_id !== null && isNaN(boss_id)) return error(res, 'Invalid boss_id', 400);

  // Prevent duplicate (date + boss) — avoid null bind params
  const existing = boss_id !== null
    ? await db.get('SELECT id FROM raid_rosters WHERE raid_date = ? AND boss_id = ? LIMIT 1', date, boss_id)
    : await db.get('SELECT id FROM raid_rosters WHERE raid_date = ? AND boss_id IS NULL LIMIT 1', date);
  if (existing) return success(res, await buildRoster(db, existing.id));

  const ins = boss_id !== null
    ? await db.run('INSERT INTO raid_rosters (raid_date, boss_id, published, created_by) VALUES (?, ?, 0, ?)', date, boss_id, user.id)
    : await db.run('INSERT INTO raid_rosters (raid_date, published, created_by) VALUES (?, 0, ?)', date, user.id);
  log.info(`Created roster for ${date} boss=${boss_id} by ${user.character_name}`);
  return success(res, await buildRoster(db, ins.lastInsertRowid));
});

// ── POST /api/roster/:id/toggle-player ───────────────────────────────────────
router.post('/:id/toggle-player', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return error(res, 'Invalid roster id', 400);

  const roster = await db.get('SELECT id, raid_date FROM raid_rosters WHERE id = ?', rosterId);
  if (!roster) return error(res, 'Roster not found', 404);

  const userId = parseInt(req.body.user_id);
  const slot   = req.body.slot; // 'in_roster' | 'bench' | null

  if (isNaN(userId)) return error(res, 'Invalid user_id', 400);
  if (slot !== null && !['in_roster', 'bench'].includes(slot)) return error(res, 'Invalid slot', 400);

  await db.transaction(async (tx) => {
    if (slot === null) {
      await tx.run('DELETE FROM roster_players WHERE roster_id = ? AND user_id = ?', rosterId, userId);
    } else {
      await tx.run(`
        INSERT INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)
        ON CONFLICT(roster_id, user_id) DO UPDATE SET slot = excluded.slot
      `, rosterId, userId, slot);
    }
    await tx.run('UPDATE raid_rosters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', rosterId);
  });

  return success(res, await buildRoster(db, rosterId));
});

// ── POST /api/roster/:id/coach ────────────────────────────────────────────────
router.post('/:id/coach', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return error(res, 'Invalid roster id', 400);

  const coachId = req.body.user_id === null ? null : parseInt(req.body.user_id);
  if (coachId !== null && isNaN(coachId)) return error(res, 'Invalid user_id', 400);

  await db.run('UPDATE raid_rosters SET coach_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', coachId, rosterId);
  return success(res, await buildRoster(db, rosterId));
});

// ── POST /api/roster/:id/publish ──────────────────────────────────────────────
router.post('/:id/publish', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return error(res, 'Invalid roster id', 400);

  const r = await db.get('SELECT id, published FROM raid_rosters WHERE id = ?', rosterId);
  if (!r) return error(res, 'Roster not found', 404);

  await db.run('UPDATE raid_rosters SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', r.published ? 0 : 1, rosterId);
  return success(res, await buildRoster(db, rosterId));
});

// ── POST /api/roster/:id/copy-previous ───────────────────────────────────────
// Copies the most recent roster for the same boss (or any if no boss) to this roster.
router.post('/:id/copy-previous', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return error(res, 'Invalid roster id', 400);

  const target = await db.get('SELECT id, raid_date, boss_id FROM raid_rosters WHERE id = ?', rosterId);
  if (!target) return error(res, 'Roster not found', 404);

  // Find most recent roster with same boss — conditional to avoid null bind params
  const source = target.boss_id !== null
    ? await db.get(`
        SELECT r.id FROM raid_rosters r
        JOIN roster_players rp ON rp.roster_id = r.id
        WHERE r.id != ? AND r.boss_id = ?
        GROUP BY r.id ORDER BY r.raid_date DESC LIMIT 1
      `, rosterId, target.boss_id)
    : await db.get(`
        SELECT r.id FROM raid_rosters r
        JOIN roster_players rp ON rp.roster_id = r.id
        WHERE r.id != ? AND r.boss_id IS NULL
        GROUP BY r.id ORDER BY r.raid_date DESC LIMIT 1
      `, rosterId);

  // Fallback: any roster with players if no same-boss match
  const fallback = source || await db.get(`
    SELECT r.id FROM raid_rosters r
    JOIN roster_players rp ON rp.roster_id = r.id
    WHERE r.id != ?
    GROUP BY r.id ORDER BY r.raid_date DESC LIMIT 1
  `, rosterId);

  if (!fallback) return error(res, 'No hay ningún roster anterior con jugadores', 404);

  const sourcePlayers = await db.all('SELECT user_id, slot FROM roster_players WHERE roster_id = ?', fallback.id);

  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM roster_players WHERE roster_id = ?', rosterId);
    for (const p of sourcePlayers) {
      await tx.run('INSERT INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)', rosterId, p.user_id, p.slot);
    }
    await tx.run('UPDATE raid_rosters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', rosterId);
  });

  log.info(`Roster ${rosterId} copied from ${fallback.id} by ${user.character_name}`);
  return success(res, await buildRoster(db, rosterId));
});

// ── DELETE /api/roster/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return error(res, 'Invalid roster id', 400);

  const r = await db.get('SELECT id, boss_id FROM raid_rosters WHERE id = ?', rosterId);
  if (!r) return error(res, 'Roster not found', 404);

  await db.run('DELETE FROM raid_rosters WHERE id = ?', rosterId);
  log.info(`Roster ${rosterId} deleted by ${user.character_name}`);
  return success(res, { deleted: rosterId });
});

// ── Backward-compat: date-based toggle (still used during migration) ──────────
router.post('/date/:date/toggle-player', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error(res, 'Invalid date', 400);

  const userId = parseInt(req.body.user_id);
  const slot   = req.body.slot;
  if (isNaN(userId)) return error(res, 'Invalid user_id', 400);

  let r = await db.get('SELECT id FROM raid_rosters WHERE raid_date = ? AND boss_id IS NULL LIMIT 1', date);
  if (!r) {
    const ins = await db.run('INSERT INTO raid_rosters (raid_date, published, created_by) VALUES (?, 0, ?)', date, user.id);
    r = { id: ins.lastInsertRowid };
  }

  if (slot === null) {
    await db.run('DELETE FROM roster_players WHERE roster_id = ? AND user_id = ?', r.id, userId);
  } else {
    await db.run(`INSERT INTO roster_players (roster_id, user_id, slot) VALUES (?,?,?)
      ON CONFLICT(roster_id, user_id) DO UPDATE SET slot=excluded.slot`, r.id, userId, slot);
  }
  await db.run('UPDATE raid_rosters SET updated_at=CURRENT_TIMESTAMP WHERE id=?', r.id);

  return success(res, await buildRoster(db, r.id));
});

router.post('/date/:date/publish', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db } = req;
  const { date } = req.params;
  const r = await db.get('SELECT id, published FROM raid_rosters WHERE raid_date = ? AND boss_id IS NULL LIMIT 1', date);
  if (!r) return error(res, 'No roster for this date', 404);
  await db.run('UPDATE raid_rosters SET published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', r.published ? 0 : 1, r.id);
  return success(res, await buildRoster(db, r.id));
});

router.post('/date/:date/coach', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const { date } = req.params;
  const coachId = req.body.user_id === null ? null : parseInt(req.body.user_id);
  let r = await db.get('SELECT id FROM raid_rosters WHERE raid_date = ? AND boss_id IS NULL LIMIT 1', date);
  if (!r) {
    const ins = await db.run('INSERT INTO raid_rosters (raid_date, published, created_by) VALUES (?,0,?)', date, user.id);
    r = { id: ins.lastInsertRowid };
  }
  await db.run('UPDATE raid_rosters SET coach_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', coachId, r.id);
  return success(res, await buildRoster(db, r.id));
});

export default router;
