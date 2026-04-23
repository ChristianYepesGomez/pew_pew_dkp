import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Roster');
const router = Router();

// ── GET /api/roster?date=YYYY-MM-DD ─────────────────────────────────────────
// Returns all published rosters for a date (members) or all (admin/officer).
router.get('/', authenticateToken, async (req, res) => {
  const { db, user } = req;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json(error('Invalid or missing date'));
  }

  const isPrivileged = user.role === 'admin' || user.role === 'officer';

  const rosters = await db.all(`
    SELECT r.id, r.raid_date, r.name, r.published, r.created_at, r.updated_at,
           u.character_name as created_by_name
    FROM raid_rosters r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.raid_date = ?
    ${isPrivileged ? '' : 'AND r.published = 1'}
    ORDER BY r.created_at ASC
  `, date);

  // Attach players and bosses to each roster
  for (const roster of rosters) {
    roster.players = await db.all(`
      SELECT rp.slot, u.id as user_id, u.character_name, u.character_class, u.raid_role, u.spec
      FROM roster_players rp
      JOIN users u ON u.id = rp.user_id
      WHERE rp.roster_id = ?
      ORDER BY u.raid_role, u.character_name
    `, roster.id);

    roster.bosses = await db.all(`
      SELECT wb.id as boss_id, wb.name as boss_name, wb.slug, wb.boss_order, wb.image_url,
             wz.name as zone_name
      FROM roster_bosses rb
      JOIN wcl_bosses wb ON wb.id = rb.boss_id
      JOIN wcl_zones wz ON wz.id = wb.zone_id
      WHERE rb.roster_id = ?
      ORDER BY wb.boss_order
    `, roster.id);
  }

  return res.json(success(rosters));
});

// ── GET /api/roster/available?date=YYYY-MM-DD ────────────────────────────────
// Admin/officer: list players available for a given date (confirmed + late signups).
router.get('/available', authenticateToken, authorizeRole('admin', 'officer'), async (req, res) => {
  const { db } = req;
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json(error('Invalid or missing date'));
  }

  const players = await db.all(`
    SELECT u.id as user_id, u.character_name, u.character_class, u.raid_role, u.spec,
           ma.status as signup_status, ma.notes
    FROM users u
    LEFT JOIN member_availability ma ON ma.user_id = u.id AND ma.raid_date = ?
    WHERE u.is_active = 1
      AND u.character_name IS NOT NULL
      AND (ma.status IN ('confirmed', 'late') OR ma.status IS NOT NULL)
    ORDER BY u.raid_role, u.character_name
  `, date);

  return res.json(success(players));
});

// ── GET /api/roster/bosses ────────────────────────────────────────────────────
// Returns current-tier bosses for boss picker.
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

  return res.json(success(bosses));
});

// ── POST /api/roster ──────────────────────────────────────────────────────────
// Admin/officer: create a new roster for a date.
router.post('/', authenticateToken, authorizeRole('admin', 'officer'), async (req, res) => {
  const { db, user } = req;
  const { raid_date, name, player_ids, bench_ids, boss_ids, published } = req.body;

  if (!raid_date || !/^\d{4}-\d{2}-\d{2}$/.test(raid_date)) {
    return res.status(400).json(error('Invalid or missing raid_date'));
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json(error('Invalid roster name'));
  }

  const safePlayerIds = Array.isArray(player_ids) ? player_ids.filter(Number.isInteger) : [];
  const safeBenchIds  = Array.isArray(bench_ids)  ? bench_ids.filter(Number.isInteger)  : [];
  const safeBossIds   = Array.isArray(boss_ids)   ? boss_ids.filter(Number.isInteger)   : [];

  const result = await db.transaction(async (tx) => {
    const ins = await tx.run(
      'INSERT INTO raid_rosters (raid_date, name, published, created_by) VALUES (?, ?, ?, ?)',
      raid_date, name.trim(), published ? 1 : 0, user.id
    );
    const rosterId = ins.lastInsertRowid;

    for (const uid of safePlayerIds) {
      await tx.run(
        'INSERT OR IGNORE INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)',
        rosterId, uid, 'in_roster'
      );
    }
    for (const uid of safeBenchIds) {
      await tx.run(
        'INSERT OR IGNORE INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)',
        rosterId, uid, 'bench'
      );
    }
    for (const bid of safeBossIds) {
      await tx.run(
        'INSERT OR IGNORE INTO roster_bosses (roster_id, boss_id) VALUES (?, ?)',
        rosterId, bid
      );
    }
    return rosterId;
  });

  log.info(`Roster ${result} created for ${raid_date} by ${user.character_name}`);
  return res.status(201).json(success({ id: result }));
});

// ── PUT /api/roster/:id ───────────────────────────────────────────────────────
// Admin/officer: update roster name, players, bosses, or published state.
router.put('/:id', authenticateToken, authorizeRole('admin', 'officer'), async (req, res) => {
  const { db, user } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return res.status(400).json(error('Invalid roster id'));

  const roster = await db.get('SELECT id FROM raid_rosters WHERE id = ?', rosterId);
  if (!roster) return res.status(404).json(error('Roster not found'));

  const { name, player_ids, bench_ids, boss_ids, published } = req.body;

  await db.transaction(async (tx) => {
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) throw new Error('Invalid name');
      await tx.run(
        'UPDATE raid_rosters SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        name.trim(), rosterId
      );
    }
    if (published !== undefined) {
      await tx.run(
        'UPDATE raid_rosters SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        published ? 1 : 0, rosterId
      );
    }
    if (Array.isArray(player_ids) || Array.isArray(bench_ids)) {
      await tx.run('DELETE FROM roster_players WHERE roster_id = ?', rosterId);
      for (const uid of (player_ids || []).filter(Number.isInteger)) {
        await tx.run(
          'INSERT OR IGNORE INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)',
          rosterId, uid, 'in_roster'
        );
      }
      for (const uid of (bench_ids || []).filter(Number.isInteger)) {
        await tx.run(
          'INSERT OR IGNORE INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)',
          rosterId, uid, 'bench'
        );
      }
    }
    if (Array.isArray(boss_ids)) {
      await tx.run('DELETE FROM roster_bosses WHERE roster_id = ?', rosterId);
      for (const bid of boss_ids.filter(Number.isInteger)) {
        await tx.run(
          'INSERT OR IGNORE INTO roster_bosses (roster_id, boss_id) VALUES (?, ?)',
          rosterId, bid
        );
      }
    }
  });

  log.info(`Roster ${rosterId} updated by ${user.character_name}`);
  return res.json(success({ id: rosterId }));
});

// ── POST /api/roster/:id/copy ─────────────────────────────────────────────────
// Admin/officer: duplicate a roster (optionally to a different date).
router.post('/:id/copy', authenticateToken, authorizeRole('admin', 'officer'), async (req, res) => {
  const { db, user } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return res.status(400).json(error('Invalid roster id'));

  const source = await db.get('SELECT * FROM raid_rosters WHERE id = ?', rosterId);
  if (!source) return res.status(404).json(error('Roster not found'));

  const { target_date, name } = req.body;
  const newDate = target_date || source.raid_date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return res.status(400).json(error('Invalid target_date'));
  }

  const newName = name || `${source.name} (copia)`;

  const [players, bosses] = await Promise.all([
    db.all('SELECT user_id, slot FROM roster_players WHERE roster_id = ?', rosterId),
    db.all('SELECT boss_id FROM roster_bosses WHERE roster_id = ?', rosterId),
  ]);

  const newId = await db.transaction(async (tx) => {
    const ins = await tx.run(
      'INSERT INTO raid_rosters (raid_date, name, published, created_by) VALUES (?, ?, 0, ?)',
      newDate, newName, user.id
    );
    const id = ins.lastInsertRowid;
    for (const p of players) {
      await tx.run(
        'INSERT INTO roster_players (roster_id, user_id, slot) VALUES (?, ?, ?)',
        id, p.user_id, p.slot
      );
    }
    for (const b of bosses) {
      await tx.run('INSERT INTO roster_bosses (roster_id, boss_id) VALUES (?, ?)', id, b.boss_id);
    }
    return id;
  });

  log.info(`Roster ${rosterId} copied to new roster ${newId} by ${user.character_name}`);
  return res.status(201).json(success({ id: newId }));
});

// ── DELETE /api/roster/:id ───────────────────────────────────────────────────
router.delete('/:id', authenticateToken, authorizeRole('admin', 'officer'), async (req, res) => {
  const { db, user } = req;
  const rosterId = parseInt(req.params.id);
  if (isNaN(rosterId)) return res.status(400).json(error('Invalid roster id'));

  const roster = await db.get('SELECT id, name FROM raid_rosters WHERE id = ?', rosterId);
  if (!roster) return res.status(404).json(error('Roster not found'));

  // CASCADE handles roster_players and roster_bosses
  await db.run('DELETE FROM raid_rosters WHERE id = ?', rosterId);

  log.info(`Roster ${rosterId} (${roster.name}) deleted by ${user.character_name}`);
  return res.json(success({ deleted: rosterId }));
});

export default router;
