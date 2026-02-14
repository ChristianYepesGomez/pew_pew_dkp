import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:Raids');
const router = Router();

// Create raid event (officer+)
router.post('/', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { name, scheduledAt, dkpReward } = req.body;

    const result = await req.db.run(`
      INSERT INTO raids (name, scheduled_at, dkp_reward, created_by)
      VALUES (?, ?, ?, ?)
    `, name, scheduledAt, dkpReward || 10, req.user.userId);

    return success(res, { id: result.lastInsertRowid }, 'Raid created', 201);
  } catch (err) {
    log.error('Create raid error', err);
    return error(res, 'Failed to create raid', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Record attendance
router.post('/:raidId/attendance', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const raidId = parseInt(req.params.raidId, 10);
    if (isNaN(raidId)) return error(res, 'Invalid raid ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { attendees } = req.body;

    const raid = await req.db.get('SELECT id, name, dkp_reward FROM raids WHERE id = ?', raidId);
    if (!raid) {
      return error(res, 'Raid not found', 404, ErrorCodes.NOT_FOUND);
    }

    await req.db.transaction(async (tx) => {
      for (const userId of attendees) {
        await tx.run('INSERT OR IGNORE INTO raid_attendance (raid_id, user_id) VALUES (?, ?)', raidId, userId);

        await tx.run(`
          UPDATE member_dkp
          SET current_dkp = current_dkp + ?,
              lifetime_gained = lifetime_gained + ?
          WHERE user_id = ?
        `, raid.dkp_reward, raid.dkp_reward, userId);

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, userId, raid.dkp_reward, `Raid attendance: ${raid.name}`, req.user.userId);
      }
    });

    req.app.get('io').emit('attendance_recorded', { raidId, attendees, dkpReward: raid.dkp_reward });
    return success(res, null, `Attendance recorded for ${attendees.length} members`);
  } catch (err) {
    log.error('Record attendance error', err);
    return error(res, 'Failed to record attendance', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
