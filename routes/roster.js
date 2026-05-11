import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Roster');
const router = Router();

// ── Shared helper: load full roster for a date ───────────────────────────────
async function loadRosterForDate(db, date) {
  const roster = await db.get(`
    SELECT r.id, r.raid_date, r.published, r.created_at, r.updated_at,
           r.coach_user_id,
           u.character_name as coach_name,
           u.character_class as coach_class,
           u.spec as coach_spec
    FROM raid_rosters r
    LEFT JOIN users u ON u.id = r.coach_user_id
    WHERE r.raid_date = ?
    ORDER BY r.created_at ASC LIMIT 1
  `, date);

  if (!roster) return null;

  roster.players = await db.all(`
    SELECT rp.slot, u.id as user_id, u.character_name, u.character_class, u.raid_role, u.spec
    FROM roster_players rp
    JOIN users u ON u.id = rp.user_id
    WHERE rp.roster_id = ?
    ORDER BY u.raid_role, u.character_name
  `, roster.id);

  return roster;
}

// ── GET /api/roster?date=YYYY-MM-DD ─────────────────────────────────────────
// Returns the single roster for a date (or null).
router.get('/', authenticateToken, async (req, res) => {
  const { db, user } = req;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 'Invalid or missing date', 400);
  }

  const roster = await loadRosterForDate(db, date);
  return success(res, roster);
});

// ── GET /api/roster/available?date=YYYY-MM-DD ────────────────────────────────
// Admin/officer: confirmed + late + tentative players (no declined, no no-response).
router.get('/available', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db } = req;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 'Invalid or missing date', 400);
  }

  const players = await db.all(`
    SELECT u.id as user_id, u.character_name, u.character_class, u.raid_role, u.spec,
           ma.status as signup_status
    FROM users u
    JOIN member_availability ma ON ma.user_id = u.id AND ma.raid_date = ?
    WHERE u.is_active = 1
      AND u.character_name IS NOT NULL
      AND TRIM(u.character_name) != ''
      AND ma.status IN ('confirmed', 'late', 'tentative')
    ORDER BY
      CASE ma.status
        WHEN 'confirmed' THEN 1
        WHEN 'late'      THEN 2
        WHEN 'tentative' THEN 3
      END,
      u.raid_role, u.character_name
  `, date);

  return success(res, players);
});

// ── POST /api/roster/date/:date/toggle-player ────────────────────────────────
// Add or move a player in the roster (auto-creates roster if needed).
// Body: { user_id, slot: 'in_roster' | 'bench' | null (remove) }
router.post('/date/:date/toggle-player', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 'Invalid date', 400);
  }

  const userId = parseInt(req.body.user_id);
  const slot   = req.body.slot; // 'in_roster' | 'bench' | null (remove)

  if (isNaN(userId)) return error(res, 'Invalid user_id', 400);
  if (slot !== null && !['in_roster', 'bench'].includes(slot)) {
    return error(res, 'Invalid slot', 400);
  }

  const roster = await db.transaction(async (tx) => {
    // Get or create roster for this date
    let r = await tx.get('SELECT id FROM raid_rosters WHERE raid_date = ? LIMIT 1', date);
    if (!r) {
      const ins = await tx.run(
        'INSERT INTO raid_rosters (raid_date, published, created_by) VALUES (?, 0, ?)',
        date, user.id
      );
      r = { id: ins.lastInsertRowid };
      log.info(`Auto-created roster for ${date} by ${user.character_name}`);
    }

    if (slot === null) {
      await tx.run('DELETE FROM roster_players WHERE roster_id = ? AND user_id = ?', r.id, userId);
    } else {
      await tx.run(`
        INSERT INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)
        ON CONFLICT(roster_id, user_id) DO UPDATE SET slot = excluded.slot
      `, r.id, userId, slot);
    }

    await tx.run('UPDATE raid_rosters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', r.id);
    return r.id;
  });

  const updated = await loadRosterForDate(db, date, true);
  return success(res, updated);
});

// ── POST /api/roster/date/:date/publish ──────────────────────────────────────
// Toggle published state of the roster for a date.
router.post('/date/:date/publish', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 'Invalid date', 400);
  }

  const roster = await db.get('SELECT id, published FROM raid_rosters WHERE raid_date = ? LIMIT 1', date);
  if (!roster) return error(res, 'No roster for this date', 404);

  const newPublished = roster.published ? 0 : 1;
  await db.run(
    'UPDATE raid_rosters SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    newPublished, roster.id
  );

  log.info(`Roster for ${date} ${newPublished ? 'published' : 'unpublished'} by ${user.character_name}`);
  const updated = await loadRosterForDate(db, date, true);
  return success(res, updated);
});

// ── POST /api/roster/date/:date/copy-previous ─────────────────────────────────
// Copy the most recent past roster into this date (replaces existing players).
router.post('/date/:date/copy-previous', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 'Invalid date', 400);
  }

  // Find the most recent past roster
  const source = await db.get(
    'SELECT id FROM raid_rosters WHERE raid_date < ? ORDER BY raid_date DESC LIMIT 1',
    date
  );
  if (!source) return error(res, 'No previous roster found', 404);

  const sourcePlayers = await db.all(
    'SELECT user_id, slot FROM roster_players WHERE roster_id = ?',
    source.id
  );

  await db.transaction(async (tx) => {
    let r = await tx.get('SELECT id FROM raid_rosters WHERE raid_date = ? LIMIT 1', date);
    if (!r) {
      const ins = await tx.run(
        'INSERT INTO raid_rosters (raid_date, published, created_by) VALUES (?, 0, ?)',
        date, user.id
      );
      r = { id: ins.lastInsertRowid };
    }
    // Replace all players
    await tx.run('DELETE FROM roster_players WHERE roster_id = ?', r.id);
    for (const p of sourcePlayers) {
      await tx.run(
        'INSERT INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)',
        r.id, p.user_id, p.slot
      );
    }
    await tx.run('UPDATE raid_rosters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', r.id);
  });

  log.info(`Roster for ${date} copied from previous by ${user.character_name}`);
  const updated = await loadRosterForDate(db, date, true);
  return success(res, updated);
});

// ── GET /api/roster/coaches ───────────────────────────────────────────────────
// Returns all active admin/officer users as coach candidates.
router.get('/coaches', authenticateToken, async (req, res) => {
  const { db } = req;
  const coaches = await db.all(`
    SELECT id as user_id, character_name, character_class, spec
    FROM users
    WHERE is_active = 1 AND role IN ('admin', 'officer')
      AND character_name IS NOT NULL AND TRIM(character_name) != ''
    ORDER BY character_name
  `);
  return success(res, coaches);
});

// ── POST /api/roster/date/:date/coach ────────────────────────────────────────
// Set or unset the coach (raid leader) for a roster.
// Body: { user_id } or { user_id: null } to unset
router.post('/date/:date/coach', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  const { db, user } = req;
  const { date } = req.params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return error(res, 'Invalid date', 400);

  const coachId = req.body.user_id === null ? null : parseInt(req.body.user_id);
  if (coachId !== null && isNaN(coachId)) return error(res, 'Invalid user_id', 400);

  await db.transaction(async (tx) => {
    let r = await tx.get('SELECT id FROM raid_rosters WHERE raid_date = ? LIMIT 1', date);
    if (!r) {
      const ins = await tx.run(
        'INSERT INTO raid_rosters (raid_date, published, created_by) VALUES (?, 0, ?)',
        date, user.id
      );
      r = { id: ins.lastInsertRowid };
    }
    await tx.run(
      'UPDATE raid_rosters SET coach_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      coachId, r.id
    );
  });

  log.info(`Coach for ${date} set to user ${coachId} by ${user.character_name}`);
  return success(res, await loadRosterForDate(db, date));
});

export default router;
