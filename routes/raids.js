import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Raids');
const router = Router();

// Create raid event (officer+)
router.post('/', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { name, scheduledAt, dkpReward } = req.body;

    const result = await db.run(`
      INSERT INTO raids (name, scheduled_at, dkp_reward, created_by)
      VALUES (?, ?, ?, ?)
    `, name, scheduledAt, dkpReward || 10, req.user.userId);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Raid created' });
  } catch (error) {
    log.error('Create raid error', error);
    res.status(500).json({ error: 'Failed to create raid' });
  }
});

// Record attendance
router.post('/:raidId/attendance', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const raidId = parseInt(req.params.raidId, 10);
    if (isNaN(raidId)) return res.status(400).json({ error: 'Invalid raid ID' });

    const { attendees } = req.body;

    const raid = await db.get('SELECT * FROM raids WHERE id = ?', raidId);
    if (!raid) {
      return res.status(404).json({ error: 'Raid not found' });
    }

    await db.transaction(async (tx) => {
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
    res.json({ message: `Attendance recorded for ${attendees.length} members` });
  } catch (error) {
    log.error('Record attendance error', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

export default router;
