import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Calendar');
const router = Router();

// Helper: Get raid dates for the next N weeks
async function getRaidDates(db, weeks = 2) {
  const raidDays = await db.all(`
    SELECT day_of_week, day_name, raid_time
    FROM raid_days
    WHERE is_active = 1
    ORDER BY day_of_week
  `);

  const dates = [];
  // Use Spain timezone to get correct "today"
  const spainFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const spainDateStr = spainFormatter.format(new Date()); // "2024-02-06" format
  const [year, month, day] = spainDateStr.split('-').map(Number);
  const today = new Date(year, month - 1, day);
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const jsDay = date.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;

    const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
    if (raidDay) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const raidTimeStr = raidDay.raid_time || '21:00';
      const [raidH, raidM] = raidTimeStr.split(':').map(Number);
      const raidStart = new Date(date);
      raidStart.setHours(raidH, raidM, 0, 0);
      const cutoff = new Date(raidStart.getTime() - 8 * 60 * 60 * 1000);
      const cutoffH = String(cutoff.getHours()).padStart(2, '0');
      const cutoffM = String(cutoff.getMinutes()).padStart(2, '0');

      // Get current time in Spain for isLocked check
      const nowInSpain = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));

      dates.push({
        date: dateStr,
        dayOfWeek: dbDay,
        dayName: raidDay.day_name,
        raidTime: raidTimeStr,
        cutoffTime: `${cutoffH}:${cutoffM}`,
        isLocked: nowInSpain > cutoff
      });
    }
  }

  return dates;
}

// Export getRaidDates for use in warcraftlogs routes
export { getRaidDates };

// Get configured raid days
router.get('/raid-days', authenticateToken, async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    const raidDays = await req.db.all(`
      SELECT day_of_week, day_name, is_active, raid_time
      FROM raid_days
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY day_of_week
    `);

    return success(res, raidDays);
  } catch (err) {
    log.error('Get raid days error', err);
    return error(res, 'Failed to get raid days', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Update raid days configuration (admin only)
router.put('/raid-days', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { days } = req.body;

    if (!days || !Array.isArray(days)) {
      return error(res, 'days array required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const dayNames = {
      1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
      5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
    };

    // Atomic: deactivate all + activate new ones in one transaction
    await req.db.transaction(async (tx) => {
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

    return success(res, null, 'Raid days updated');
  } catch (err) {
    log.error('Update raid days error', err);
    return error(res, 'Failed to update raid days', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get upcoming raid dates for next 2 weeks
router.get('/dates', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 2;
    const dates = await getRaidDates(req.db, Math.min(weeks, 4));
    return success(res, dates);
  } catch (err) {
    log.error('Get calendar dates error', err);
    return error(res, 'Failed to get calendar dates', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get user's signups for upcoming dates
router.get('/my-signups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const weeks = parseInt(req.query.weeks) || 2;

    const raidDates = await getRaidDates(req.db, weeks);
    const dateStrings = raidDates.map(d => d.date);

    if (dateStrings.length === 0) {
      return success(res, { dates: [] });
    }

    const placeholders = dateStrings.map(() => '?').join(',');
    const signups = await req.db.all(`
      SELECT raid_date, status, notes, dkp_awarded, updated_at
      FROM member_availability
      WHERE user_id = ? AND raid_date IN (${placeholders})
    `, userId, ...dateStrings);

    const result = raidDates.map(date => {
      const signup = signups.find(s => s.raid_date === date.date);
      return {
        ...date,
        status: signup?.status || null,
        notes: signup?.notes || null,
        dkpAwarded: signup?.dkp_awarded || 0,
        updatedAt: signup?.updated_at || null
      };
    });

    return success(res, { dates: result });
  } catch (err) {
    log.error('Get my signups error', err);
    return error(res, 'Failed to get signups', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Create/update signup for a specific date
router.post('/signup', authenticateToken, async (req, res) => {
  try {
    const { date, status, notes } = req.body;
    const userId = req.user.userId;

    if (!date || !status) {
      return error(res, 'date and status are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!['confirmed', 'declined', 'tentative'].includes(status)) {
      return error(res, 'Invalid status. Must be: confirmed, declined, or tentative', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const dateObj = new Date(date + 'T12:00:00');
    const jsDay = dateObj.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;

    const raidDay = await req.db.get(
      'SELECT id, day_of_week, day_name, raid_time FROM raid_days WHERE day_of_week = ? AND is_active = 1', dbDay
    );
    if (!raidDay) {
      return error(res, 'Selected date is not a raid day', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const raidTimeStr = raidDay.raid_time || '21:00';
    const [raidH, raidM] = raidTimeStr.split(':').map(Number);
    const raidStart = new Date(dateObj);
    raidStart.setHours(raidH, raidM, 0, 0);
    const cutoff = new Date(raidStart.getTime() - 8 * 60 * 60 * 1000);

    if (new Date() > cutoff) {
      return error(res, 'Signup deadline has passed (8 hours before raid start)', 400, ErrorCodes.SIGNUP_LOCKED);
    }

    // Atomic signup: check + insert/update + DKP in one transaction to prevent duplicate DKP
    const signupResult = await req.db.transaction(async (tx) => {
      const existing = await tx.get(`
        SELECT id, dkp_awarded FROM member_availability WHERE user_id = ? AND raid_date = ?
      `, userId, date);

      let dkpAwarded;
      const isFirstSignup = !existing;

      if (isFirstSignup) {
        const dkpConfig = await tx.get("SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'");
        const capConfig = await tx.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
        const dkpPerDay = parseInt(dkpConfig?.config_value || '1', 10);
        const dkpCap = parseInt(capConfig?.config_value || '250', 10);

        const currentMember = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
        const currentDkp = currentMember?.current_dkp || 0;
        dkpAwarded = Math.min(dkpPerDay, dkpCap - currentDkp);
        dkpAwarded = Math.max(0, dkpAwarded);

        await tx.run(`
          INSERT INTO member_availability (user_id, raid_date, status, notes, dkp_awarded)
          VALUES (?, ?, ?, ?, ?)
        `, userId, date, status, notes || null, dkpAwarded);

        if (dkpAwarded > 0) {
          await tx.run(`
            UPDATE member_dkp
            SET current_dkp = current_dkp + ?,
                lifetime_gained = lifetime_gained + ?
            WHERE user_id = ?
          `, dkpAwarded, dkpAwarded, userId);

          await tx.run(`
            INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
            VALUES (?, ?, ?, ?)
          `, userId, dkpAwarded, `Calendario: registro para ${date}`, userId);
        }
      } else {
        await tx.run(`
          UPDATE member_availability
          SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND raid_date = ?
        `, status, notes || null, userId, date);

        dkpAwarded = existing.dkp_awarded;
      }

      return { isFirstSignup, dkpAwarded };
    });

    const { isFirstSignup, dkpAwarded } = signupResult;

    if (isFirstSignup && dkpAwarded > 0) {
      req.app.get('io').emit('dkp_updated', { userId, amount: dkpAwarded, reason: 'calendar_signup' });
    }

    return success(res, {
      date,
      status,
      dkpAwarded,
      isFirstSignup
    }, isFirstSignup ? 'Signup created' : 'Signup updated');
  } catch (err) {
    log.error('Calendar signup error', err);
    return error(res, 'Failed to save signup', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get summary for a specific date (all users)
router.get('/summary/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const isAdmin = ['admin', 'officer'].includes(req.user.role);

    const users = await req.db.all(`
      SELECT u.id, u.character_name, u.character_class, u.raid_role, u.spec
      FROM users u
      WHERE u.is_active = 1
      ORDER BY u.character_name
    `);

    const signups = await req.db.all(`
      SELECT user_id, status, notes
      FROM member_availability
      WHERE raid_date = ?
    `, date);

    const summary = {
      date,
      confirmed: [],
      declined: [],
      tentative: [],
      noResponse: []
    };

    for (const user of users) {
      const signup = signups.find(s => s.user_id === user.id);
      const memberInfo = {
        id: user.id,
        characterName: user.character_name,
        characterClass: user.character_class,
        raidRole: user.raid_role,
        spec: user.spec,
        ...(isAdmin && signup?.notes && { notes: signup.notes })
      };

      if (!signup) {
        summary.noResponse.push(memberInfo);
      } else if (signup.status === 'confirmed') {
        summary.confirmed.push(memberInfo);
      } else if (signup.status === 'declined') {
        summary.declined.push(memberInfo);
      } else {
        summary.tentative.push(memberInfo);
      }
    }

    summary.counts = {
      confirmed: summary.confirmed.length,
      declined: summary.declined.length,
      tentative: summary.tentative.length,
      noResponse: summary.noResponse.length,
      total: users.length
    };

    return success(res, summary);
  } catch (err) {
    log.error('Calendar summary error', err);
    return error(res, 'Failed to get calendar summary', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get all signups overview (all authenticated users)
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 2;
    const raidDates = await getRaidDates(req.db, weeks);

    const users = await req.db.all(`
      SELECT id, character_name, character_class, raid_role, spec
      FROM users
      WHERE is_active = 1
      ORDER BY character_name
    `);

    if (raidDates.length === 0) {
      return success(res, { dates: [], members: [] });
    }

    const dateStrings = raidDates.map(d => d.date);
    const placeholders = dateStrings.map(() => '?').join(',');
    const allSignups = await req.db.all(`
      SELECT user_id, raid_date, status, notes
      FROM member_availability
      WHERE raid_date IN (${placeholders})
    `, ...dateStrings);

    const datesOverview = raidDates.map(date => {
      const dateSignups = allSignups.filter(s => s.raid_date === date.date);
      return {
        ...date,
        counts: {
          confirmed: dateSignups.filter(s => s.status === 'confirmed').length,
          declined: dateSignups.filter(s => s.status === 'declined').length,
          tentative: dateSignups.filter(s => s.status === 'tentative').length,
          noResponse: users.length - dateSignups.length
        }
      };
    });

    const members = users.map(user => {
      const signups = {};
      for (const date of raidDates) {
        const signup = allSignups.find(s => s.user_id === user.id && s.raid_date === date.date);
        signups[date.date] = {
          status: signup?.status || null,
          notes: signup?.notes || null
        };
      }

      return {
        id: user.id,
        characterName: user.character_name,
        characterClass: user.character_class,
        raidRole: user.raid_role,
        spec: user.spec,
        signups
      };
    });

    return success(res, {
      dates: datesOverview,
      members
    });
  } catch (err) {
    log.error('Calendar overview error', err);
    return error(res, 'Failed to get calendar overview', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get past raid history with WCL logs
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 8, 12); // Max 12 weeks of history
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const raidDays = await req.db.all('SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1 ORDER BY day_of_week');

    // Collect past raid dates
    const pastDates = [];
    for (let i = 1; i <= weeks * 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const jsDay = d.getDay();
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
      if (raidDay) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        pastDates.push({ date: `${year}-${month}-${day}`, dayName: raidDay.day_name, raidTime: raidDay.raid_time || '21:00' });
      }
    }

    if (pastDates.length === 0) {
      return success(res, []);
    }

    // Get WCL reports linked to these dates
    const dateStrings = pastDates.map(d => d.date);
    const placeholders = dateStrings.map(() => '?').join(',');

    const linkedReports = await req.db.all(`
      SELECT report_code, report_title, raid_date, dkp_assigned, participants_count, is_reverted
      FROM warcraft_logs_processed
      WHERE raid_date IN (${placeholders})
    `, ...dateStrings);

    // Get attendance counts for each date
    const attendanceCounts = await req.db.all(`
      SELECT raid_date,
             SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
             SUM(CASE WHEN status = 'tentative' THEN 1 ELSE 0 END) as tentative,
             SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined
      FROM member_availability
      WHERE raid_date IN (${placeholders})
      GROUP BY raid_date
    `, ...dateStrings);

    const enriched = pastDates.map(d => {
      const report = linkedReports.find(r => r.raid_date === d.date && !r.is_reverted);
      const attendance = attendanceCounts.find(a => a.raid_date === d.date);
      return {
        ...d,
        wclReport: report ? {
          code: report.report_code,
          title: report.report_title,
          dkpAssigned: report.dkp_assigned,
          participantsCount: report.participants_count,
        } : null,
        attendance: attendance ? {
          confirmed: attendance.confirmed,
          tentative: attendance.tentative,
          declined: attendance.declined,
        } : null,
      };
    });

    return success(res, enriched);
  } catch (err) {
    log.error('Calendar history error', err);
    return error(res, 'Failed to get raid history', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get raid dates enriched with WCL report info
router.get('/dates-with-logs', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 4;
    const raidDates = await getRaidDates(req.db, weeks);

    if (raidDates.length === 0) {
      return success(res, []);
    }

    // Also look back 2 weeks for past raid dates
    const pastWeeks = 2;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const raidDays = await req.db.all('SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1 ORDER BY day_of_week');
    const pastDates = [];
    for (let i = pastWeeks * 7; i > 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const jsDay = d.getDay();
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
      if (raidDay) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        pastDates.push({ date: `${year}-${month}-${day}`, dayName: raidDay.day_name, raidTime: raidDay.raid_time, isPast: true });
      }
    }

    const allDates = [...pastDates, ...raidDates.map(d => ({ ...d, isPast: false }))];

    // Get all WCL reports linked to these dates
    const allDateStrings = allDates.map(d => d.date);
    const placeholders = allDateStrings.map(() => '?').join(',');

    const linkedReports = allDateStrings.length > 0 ? await req.db.all(`
      SELECT report_code, report_title, raid_date, dkp_assigned, participants_count, is_reverted
      FROM warcraft_logs_processed
      WHERE raid_date IN (${placeholders})
    `, ...allDateStrings) : [];

    const enriched = allDates.map(d => {
      const report = linkedReports.find(r => r.raid_date === d.date && !r.is_reverted);
      return {
        ...d,
        wclReport: report ? {
          code: report.report_code,
          title: report.report_title,
          dkpAssigned: report.dkp_assigned,
          participantsCount: report.participants_count,
        } : null,
      };
    });

    return success(res, enriched);
  } catch (err) {
    log.error('Dates with logs error', err);
    return error(res, 'Failed to get dates with logs', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
