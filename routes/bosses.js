import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { getAllZonesWithBosses, getBossDetails } from '../services/raids.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Bosses');
const router = Router();

// Get all zones with bosses (current + legacy)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const data = await getAllZonesWithBosses(req.db);
    return success(res, data);
  } catch (err) {
    log.error('Get bosses error', err);
    return error(res, 'Failed to get boss data', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// DEBUG: Check raw boss_statistics data
router.get('/debug/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const stats = await req.db.all(`
      SELECT id, boss_id, difficulty, total_kills, total_wipes, fastest_kill_ms,
             avg_kill_time_ms, total_kill_time_ms, last_kill_date, updated_at,
             wipes_to_first_kill, first_kill_date
      FROM boss_statistics ORDER BY boss_id
    `);
    const bosses = await req.db.all('SELECT id, wcl_encounter_id, name FROM wcl_bosses ORDER BY id');
    const processed = await req.db.all(`
      SELECT id, report_code, encounter_id, fight_id, difficulty, kill, fight_time_ms, processed_at
      FROM boss_stats_processed ORDER BY id DESC LIMIT 20
    `);
    return success(res, {
      boss_statistics: stats,
      wcl_bosses: bosses,
      recent_processed: processed,
      counts: {
        stats: stats.length,
        bosses: bosses.length,
        processed: processed.length
      }
    });
  } catch (err) {
    log.error('Debug stats error', err);
    return error(res, err.message, 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get detailed stats for a specific boss
router.get('/:bossId', authenticateToken, async (req, res) => {
  try {
    const bossId = parseInt(req.params.bossId, 10);
    if (isNaN(bossId)) return error(res, 'Invalid boss ID', 400, ErrorCodes.VALIDATION_ERROR);

    const difficulty = req.query.difficulty ? String(req.query.difficulty) : null;
    const data = await getBossDetails(req.db, bossId, difficulty);

    if (!data) {
      return error(res, 'Boss not found', 404, ErrorCodes.NOT_FOUND);
    }

    return success(res, data);
  } catch (err) {
    log.error('Get boss details error', err);
    return error(res, 'Failed to get boss details', 500, ErrorCodes.INTERNAL_ERROR);
  }
});


// ── GET /api/bosses/:bossId/mrt ──────────────────────────────────
// Returns the saved MRT note for a boss. Accessible to all authenticated users.
router.get('/:bossId/mrt', authenticateToken, async (req, res) => {
  try {
    const bossId = parseInt(req.params.bossId, 10);
    if (isNaN(bossId)) return error(res, 'Invalid boss ID', 400, ErrorCodes.VALIDATION_ERROR);

    const note = await req.db.get(
      `SELECT n.note_text, n.updated_at, u.character_name AS updated_by
       FROM mrt_notes n
       LEFT JOIN users u ON u.id = n.updated_by
       WHERE n.boss_id = ?`,
      bossId
    );
    return success(res, {
      note_text: note?.note_text || '',
      updated_at: note?.updated_at || null,
      updated_by: note?.updated_by || null,
    });
  } catch (err) {
    log.error('Get MRT note error', err);
    return error(res, 'Failed to get MRT note', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── POST /api/bosses/:bossId/mrt ─────────────────────────────────
// Save or update MRT note for a boss. Admin/Officer only.
router.post('/:bossId/mrt', authenticateToken, authorizeRole(['admin', 'officer']), adminLimiter, async (req, res) => {
  try {
    const bossId = parseInt(req.params.bossId, 10);
    if (isNaN(bossId)) return error(res, 'Invalid boss ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { note_text } = req.body;
    if (typeof note_text !== 'string') {
      return error(res, 'note_text is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const boss = await req.db.get('SELECT id FROM wcl_bosses WHERE id = ?', bossId);
    if (!boss) return error(res, 'Boss not found', 404, ErrorCodes.NOT_FOUND);

    await req.db.run(
      `INSERT INTO mrt_notes (boss_id, note_text, updated_by, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(boss_id) DO UPDATE SET
         note_text = excluded.note_text,
         updated_by = excluded.updated_by,
         updated_at = datetime('now')`,
      bossId, note_text.trim(), req.user.userId
    );

    const io = req.app.get('io');
    if (io) io.emit('mrt_note_updated', { bossId });

    return success(res, { ok: true });
  } catch (err) {
    log.error('Save MRT note error', err);
    return error(res, 'Failed to save MRT note', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
