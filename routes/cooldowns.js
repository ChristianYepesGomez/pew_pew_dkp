import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { userLimiter as apiLimiter } from '../lib/rateLimiters.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { createLogger } from '../lib/logger.js';
import { generateMrtNote } from '../lib/mrtFormatter.js';

const log = createLogger('Route:Cooldowns');
const router = Router();

// ── GET /api/cooldowns/definitions ───────────────────────────────
// All CD definitions. Optionally filtered to only CDs usable by the current roster.
router.get('/definitions', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM cooldown_definitions ORDER BY category, class_required, name';
    const args = [];
    if (category) {
      const allowed = ['healing', 'defensive', 'interrupt'];
      if (!allowed.includes(category)) {
        return error(res, 'Invalid category', 400, ErrorCodes.VALIDATION_ERROR);
      }
      sql = 'SELECT * FROM cooldown_definitions WHERE category = ? ORDER BY class_required, name';
      args.push(category);
    }
    const definitions = await req.db.all(sql, ...args);
    return success(res, definitions);
  } catch (err) {
    log.error('Get definitions error', err);
    return error(res, 'Failed to get cooldown definitions', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── GET /api/cooldowns/roster-cds ────────────────────────────────
// Returns CDs available based on active roster classes/specs.
// Used to populate the assignment dropdown with only valid options.
router.get('/roster-cds', authenticateToken, apiLimiter, async (req, res) => {
  try {
    // Get all active members' classes
    const members = await req.db.all(
      `SELECT u.id, u.character_name, u.character_class, u.spec, u.raid_role
       FROM users u WHERE u.is_active = 1 AND u.character_class IS NOT NULL
       ORDER BY u.raid_role, u.character_name`
    );

    // Get all definitions
    const definitions = await req.db.all('SELECT * FROM cooldown_definitions ORDER BY category, name');

    // Match definitions to roster members
    const result = [];
    for (const member of members) {
      const available = definitions.filter(cd => {
        if (cd.class_required !== member.character_class) return false;
        // If spec_required is set, member must match it
        if (cd.spec_required && member.spec) {
          return member.spec.toLowerCase().includes(cd.spec_required.toLowerCase());
        }
        return true;
      });
      if (available.length > 0) {
        result.push({
          user: {
            id: member.id,
            characterName: member.character_name,
            characterClass: member.character_class,
            spec: member.spec,
            raidRole: member.raid_role,
          },
          cooldowns: available,
        });
      }
    }

    return success(res, result);
  } catch (err) {
    log.error('Get roster CDs error', err);
    return error(res, 'Failed to get roster cooldowns', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── GET /api/cooldowns/my-assignments ────────────────────────────
// Assignments for the authenticated user across all bosses.
router.get('/my-assignments', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const userId = req.user.userId;
    const rows = await req.db.all(
      `SELECT
         ca.id,
         ca.notes,
         bce.event_label,
         bce.timestamp_seconds,
         bce.difficulty,
         wb.id   AS boss_id,
         wb.name AS boss_name,
         wb.slug AS boss_slug,
         cd.spell_id,
         cd.name  AS cooldown_name,
         cd.icon_slug,
         cd.category
       FROM cd_assignments ca
       JOIN boss_cd_events bce ON bce.id = ca.boss_cd_event_id
       JOIN wcl_bosses wb ON wb.id = bce.boss_id
       JOIN cooldown_definitions cd ON cd.id = ca.cooldown_id
       WHERE ca.assigned_user_id = ?
       ORDER BY wb.boss_order, bce.timestamp_seconds`,
      userId
    );

    return success(res, rows);
  } catch (err) {
    log.error('Get my assignments error', err);
    return error(res, 'Failed to get your assignments', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── GET /api/cooldowns/events/:bossId ────────────────────────────
// All boss CD events (timeline) for a boss + difficulty, with their assignments.
router.get('/events/:bossId', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const bossId = parseInt(req.params.bossId, 10);
    if (isNaN(bossId)) return error(res, 'Invalid boss ID', 400, ErrorCodes.VALIDATION_ERROR);

    const difficulty = req.query.difficulty ? String(req.query.difficulty) : 'Mythic';
    const validDifficulties = ['Mythic', 'Heroic', 'Normal', 'LFR'];
    if (!validDifficulties.includes(difficulty)) {
      return error(res, 'Invalid difficulty', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify boss exists
    const boss = await req.db.get('SELECT id, name FROM wcl_bosses WHERE id = ?', bossId);
    if (!boss) return error(res, 'Boss not found', 404, ErrorCodes.NOT_FOUND);

    // Get events with their assignments
    const events = await req.db.all(
      `SELECT bce.id, bce.event_label, bce.timestamp_seconds, bce.created_at
       FROM boss_cd_events bce
       WHERE bce.boss_id = ? AND bce.difficulty = ?
       ORDER BY bce.timestamp_seconds`,
      bossId, difficulty
    );

    // Get all assignments for these events in one query
    const eventIds = events.map(e => e.id);
    let assignments = [];
    if (eventIds.length > 0) {
      const placeholders = eventIds.map(() => '?').join(',');
      assignments = await req.db.all(
        `SELECT
           ca.id,
           ca.boss_cd_event_id,
           ca.notes,
           ca.assigned_user_id,
           u.character_name,
           u.character_class,
           cd.id      AS cooldown_id,
           cd.spell_id,
           cd.name    AS cooldown_name,
           cd.icon_slug,
           cd.category
         FROM cd_assignments ca
         JOIN users u ON u.id = ca.assigned_user_id
         JOIN cooldown_definitions cd ON cd.id = ca.cooldown_id
         WHERE ca.boss_cd_event_id IN (${placeholders})
         ORDER BY cd.category, u.character_name`,
        ...eventIds
      );
    }

    // Attach assignments to their events
    const assignmentsByEvent = {};
    for (const a of assignments) {
      if (!assignmentsByEvent[a.boss_cd_event_id]) {
        assignmentsByEvent[a.boss_cd_event_id] = [];
      }
      assignmentsByEvent[a.boss_cd_event_id].push(a);
    }

    const result = events.map(e => ({
      ...e,
      assignments: assignmentsByEvent[e.id] || [],
    }));

    return success(res, { boss, difficulty, events: result });
  } catch (err) {
    log.error('Get boss events error', err);
    return error(res, 'Failed to get boss events', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── POST /api/cooldowns/events ────────────────────────────────────
// Create a new boss CD event (admin/officer only).
router.post('/events', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { bossId, difficulty, eventLabel, timestampSeconds } = req.body;

    const bossIdInt = parseInt(bossId, 10);
    if (isNaN(bossIdInt)) return error(res, 'Invalid boss ID', 400, ErrorCodes.VALIDATION_ERROR);
    if (!eventLabel || typeof eventLabel !== 'string' || eventLabel.trim().length === 0) {
      return error(res, 'Event label is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const ts = parseInt(timestampSeconds, 10);
    if (isNaN(ts) || ts < 0) {
      return error(res, 'Valid timestamp (seconds >= 0) is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const validDifficulties = ['Mythic', 'Heroic', 'Normal', 'LFR'];
    if (!validDifficulties.includes(difficulty)) {
      return error(res, 'Invalid difficulty', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const boss = await req.db.get('SELECT id FROM wcl_bosses WHERE id = ?', bossIdInt);
    if (!boss) return error(res, 'Boss not found', 404, ErrorCodes.NOT_FOUND);

    const result = await req.db.run(
      'INSERT INTO boss_cd_events (boss_id, difficulty, event_label, timestamp_seconds, created_by) VALUES (?, ?, ?, ?, ?)',
      bossIdInt, difficulty, eventLabel.trim(), ts, req.user.userId
    );

    const created = await req.db.get('SELECT * FROM boss_cd_events WHERE id = ?', result.lastInsertRowid);
    return success(res, created, 'Event created', 201);
  } catch (err) {
    log.error('Create boss event error', err);
    return error(res, 'Failed to create event', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── DELETE /api/cooldowns/events/:eventId ────────────────────────
// Delete a boss event (cascades to assignments).
router.delete('/events/:eventId', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    if (isNaN(eventId)) return error(res, 'Invalid event ID', 400, ErrorCodes.VALIDATION_ERROR);

    const existing = await req.db.get('SELECT id FROM boss_cd_events WHERE id = ?', eventId);
    if (!existing) return error(res, 'Event not found', 404, ErrorCodes.NOT_FOUND);

    await req.db.run('DELETE FROM boss_cd_events WHERE id = ?', eventId);
    return success(res, null, 'Event deleted');
  } catch (err) {
    log.error('Delete boss event error', err);
    return error(res, 'Failed to delete event', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── POST /api/cooldowns/assignments ──────────────────────────────
// Assign a CD to a user on a specific boss event (admin/officer only).
router.post('/assignments', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { bossEventId, cooldownId, assignedUserId, notes } = req.body;

    const eventId = parseInt(bossEventId, 10);
    const cdId    = parseInt(cooldownId, 10);
    const userId  = parseInt(assignedUserId, 10);

    if (isNaN(eventId) || isNaN(cdId) || isNaN(userId)) {
      return error(res, 'Invalid IDs provided', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify event exists
    const event = await req.db.get('SELECT id FROM boss_cd_events WHERE id = ?', eventId);
    if (!event) return error(res, 'Event not found', 404, ErrorCodes.NOT_FOUND);

    // Verify CD exists
    const cd = await req.db.get('SELECT id FROM cooldown_definitions WHERE id = ?', cdId);
    if (!cd) return error(res, 'Cooldown not found', 404, ErrorCodes.NOT_FOUND);

    // Verify user exists and is active
    const user = await req.db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', userId);
    if (!user) return error(res, 'User not found', 404, ErrorCodes.NOT_FOUND);

    try {
      const result = await req.db.run(
        'INSERT INTO cd_assignments (boss_cd_event_id, cooldown_id, assigned_user_id, notes, created_by) VALUES (?, ?, ?, ?, ?)',
        eventId, cdId, userId, notes || null, req.user.userId
      );

      const created = await req.db.get(
        `SELECT ca.*, u.character_name, cd.name AS cooldown_name, cd.spell_id, cd.icon_slug, cd.category
         FROM cd_assignments ca
         JOIN users u ON u.id = ca.assigned_user_id
         JOIN cooldown_definitions cd ON cd.id = ca.cooldown_id
         WHERE ca.id = ?`,
        result.lastInsertRowid
      );

      // Notify via Socket.IO
      const io = req.app.get('io');
      if (io) io.emit('cooldowns_updated', { bossEventId: eventId });

      return success(res, created, 'Assignment created', 201);
    } catch (dbErr) {
      if (dbErr.message?.includes('UNIQUE')) {
        return error(res, 'This CD is already assigned to this player for this event', 409, ErrorCodes.CONFLICT);
      }
      throw dbErr;
    }
  } catch (err) {
    log.error('Create assignment error', err);
    return error(res, 'Failed to create assignment', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── DELETE /api/cooldowns/assignments/:assignmentId ───────────────
// Remove an assignment (admin/officer only).
router.delete('/assignments/:assignmentId', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId, 10);
    if (isNaN(assignmentId)) return error(res, 'Invalid assignment ID', 400, ErrorCodes.VALIDATION_ERROR);

    const existing = await req.db.get('SELECT id, boss_cd_event_id FROM cd_assignments WHERE id = ?', assignmentId);
    if (!existing) return error(res, 'Assignment not found', 404, ErrorCodes.NOT_FOUND);

    await req.db.run('DELETE FROM cd_assignments WHERE id = ?', assignmentId);

    const io = req.app.get('io');
    if (io) io.emit('cooldowns_updated', { bossEventId: existing.boss_cd_event_id });

    return success(res, null, 'Assignment removed');
  } catch (err) {
    log.error('Delete assignment error', err);
    return error(res, 'Failed to delete assignment', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── GET /api/cooldowns/mrt-note/:bossId ──────────────────────────
// Generate MRT note text for a boss + difficulty.
router.get('/mrt-note/:bossId', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const bossId = parseInt(req.params.bossId, 10);
    if (isNaN(bossId)) return error(res, 'Invalid boss ID', 400, ErrorCodes.VALIDATION_ERROR);

    const difficulty = req.query.difficulty ? String(req.query.difficulty) : 'Mythic';
    const validDifficulties = ['Mythic', 'Heroic', 'Normal', 'LFR'];
    if (!validDifficulties.includes(difficulty)) {
      return error(res, 'Invalid difficulty', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const boss = await req.db.get('SELECT id, name FROM wcl_bosses WHERE id = ?', bossId);
    if (!boss) return error(res, 'Boss not found', 404, ErrorCodes.NOT_FOUND);

    const events = await req.db.all(
      `SELECT bce.id, bce.event_label, bce.timestamp_seconds
       FROM boss_cd_events bce
       WHERE bce.boss_id = ? AND bce.difficulty = ?
       ORDER BY bce.timestamp_seconds`,
      bossId, difficulty
    );

    if (events.length === 0) {
      return success(res, { note: '', message: 'No events configured for this boss/difficulty' });
    }

    const eventIds = events.map(e => e.id);
    const placeholders = eventIds.map(() => '?').join(',');
    const assignments = await req.db.all(
      `SELECT ca.boss_cd_event_id, u.character_name, cd.spell_id, cd.name AS cd_name, cd.category
       FROM cd_assignments ca
       JOIN users u ON u.id = ca.assigned_user_id
       JOIN cooldown_definitions cd ON cd.id = ca.cooldown_id
       WHERE ca.boss_cd_event_id IN (${placeholders})
       ORDER BY cd.category`,
      ...eventIds
    );

    // Build events-with-assignments structure for the formatter
    const assignmentMap = {};
    for (const a of assignments) {
      if (!assignmentMap[a.boss_cd_event_id]) assignmentMap[a.boss_cd_event_id] = [];
      assignmentMap[a.boss_cd_event_id].push(a);
    }

    const eventsWithAssignments = events.map(e => ({
      event_label: e.event_label,
      timestamp_seconds: e.timestamp_seconds,
      assignments: assignmentMap[e.id] || [],
    }));

    const note = generateMrtNote(eventsWithAssignments, boss.name, difficulty);
    return success(res, { note });
  } catch (err) {
    log.error('Generate MRT note error', err);
    return error(res, 'Failed to generate MRT note', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
