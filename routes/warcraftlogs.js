import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { invalidateConfigCache, addDkpWithCap } from '../lib/helpers.js';
import { processWarcraftLog, isConfigured as isWCLConfigured, getGuildReports, getFightStats, getFightStatsWithDeathEvents, getExtendedFightStats } from '../services/warcraftlogs.js';
import { processExtendedFightData } from '../services/performanceAnalysis.js';
import { seedRaidData, processFightStats, recordPlayerDeaths, recordPlayerPerformance } from '../services/raids.js';
import { processReportPopularity } from '../services/itemPopularity.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:WarcraftLogs');
const router = Router();

// Get DKP configuration
router.get('/config', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const configs = await db.all('SELECT * FROM dkp_config');

    const configObj = {};
    for (const config of configs) {
      configObj[config.config_key] = {
        value: config.config_value,
        description: config.description,
        updatedAt: config.updated_at
      };
    }

    res.json({
      configured: isWCLConfigured(),
      config: configObj
    });
  } catch (error) {
    log.error('Get WCL config error', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// Update DKP configuration
router.put('/config', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { config_key, config_value } = req.body;

    if (!config_key || config_value === undefined) {
      return res.status(400).json({ error: 'config_key and config_value required' });
    }

    await db.run(`
      UPDATE dkp_config
      SET config_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE config_key = ?
    `, config_value, req.user.userId, config_key);

    // Invalidate config cache so new values take effect immediately
    invalidateConfigCache();

    res.json({ message: 'Configuration updated', config_key, config_value });
  } catch (error) {
    log.error('Update WCL config error', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Preview Warcraft Logs report (before confirming DKP assignment)
router.post('/preview', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }

    if (!isWCLConfigured()) {
      return res.status(503).json({
        error: 'Warcraft Logs API not configured. Please set credentials in .env'
      });
    }

    const reportData = await processWarcraftLog(url);

    const raidDKP = 10;

    const matchResults = [];
    const anomalies = [];

    for (const participant of reportData.participants) {
      // Check ALL characters (main + alts) for matching
      // First check characters table, then fallback to users.character_name (main)
      const user = await db.get(`
        SELECT DISTINCT u.id, u.username, u.character_name, u.character_class, u.server, md.current_dkp,
               COALESCE(c.character_name, u.character_name) as matched_character
        FROM users u
        LEFT JOIN member_dkp md ON u.id = md.user_id
        LEFT JOIN characters c ON u.id = c.user_id AND LOWER(c.character_name) = LOWER(?)
        WHERE u.is_active = 1 AND (
          LOWER(u.character_name) = LOWER(?) OR
          c.id IS NOT NULL
        )
        LIMIT 1
      `, participant.name, participant.name);

      if (user) {
        const serverMatch = !user.server ||
                           user.server.toLowerCase() === participant.server.toLowerCase() ||
                           participant.server === 'Unknown';

        const isAltMatch = user.matched_character &&
                           user.matched_character.toLowerCase() !== user.character_name.toLowerCase();

        matchResults.push({
          wcl_name: participant.name,
          wcl_server: participant.server,
          wcl_class: participant.class,
          matched: true,
          user_id: user.id,
          username: user.username,
          character_name: user.character_name,
          character_class: user.character_class,
          matched_character: user.matched_character || user.character_name,
          is_alt_match: isAltMatch,
          current_dkp: user.current_dkp,
          server_match: serverMatch,
          dkp_to_assign: raidDKP
        });

        if (!serverMatch) {
          anomalies.push({
            type: 'server_mismatch',
            message: `${participant.name}: Servidor en WCL (${participant.server}) no coincide con BD (${user.server})`,
            participant: participant.name
          });
        }
      } else {
        matchResults.push({
          wcl_name: participant.name,
          wcl_server: participant.server,
          wcl_class: participant.class,
          matched: false,
          user_id: null,
          username: null,
          character_name: null,
          current_dkp: null,
          server_match: false,
          dkp_to_assign: 0
        });

        anomalies.push({
          type: 'not_found',
          message: `${participant.name} (${participant.server}) no encontrado en la base de datos`,
          participant: participant.name
        });
      }
    }

    const matchedCount = matchResults.filter(r => r.matched).length;
    const totalDKP = matchResults.reduce((sum, r) => sum + r.dkp_to_assign, 0);

    res.json({
      report: {
        code: reportData.code,
        title: reportData.title,
        startTime: reportData.startTime,
        endTime: reportData.endTime,
        duration: Math.floor(reportData.duration / 60000),
        region: reportData.region,
        guildName: reportData.guildName,
        participantCount: reportData.participantCount,
        bossesKilled: reportData.bossesKilled,
        totalBosses: reportData.totalBosses,
        totalAttempts: reportData.totalAttempts,
        bosses: reportData.bosses,
        fights: reportData.fights
      },
      dkp_calculation: {
        base_dkp: raidDKP,
        dkp_per_player: raidDKP,
        total_dkp_to_assign: totalDKP
      },
      participants: matchResults,
      summary: {
        total_participants: reportData.participantCount,
        matched: matchedCount,
        not_matched: reportData.participantCount - matchedCount,
        anomalies_count: anomalies.length
      },
      anomalies,
      can_proceed: true
    });

  } catch (error) {
    log.error('Error previewing Warcraft Log', error);
    res.status(500).json({
      error: 'Failed to process Warcraft Log'
    });
  }
});

// Confirm and assign DKP from Warcraft Logs report
router.post('/confirm', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { reportCode, participants } = req.body;

    if (!reportCode || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ error: 'reportCode and participants array required' });
    }

    const matchedParticipants = participants.filter(p => p.matched && p.user_id);

    if (matchedParticipants.length === 0) {
      return res.status(400).json({ error: 'No matched participants to assign DKP' });
    }

    const reportTitle = req.body.reportTitle || `Raid ${reportCode}`;
    const startTime = req.body.startTime || Date.now();
    const endTime = req.body.endTime || Date.now();

    // Auto-derive raid date from startTime if not explicitly provided
    let raidDate = req.body.raidDate || null;
    if (!raidDate && startTime) {
      const date = new Date(startTime);
      raidDate = date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    }

    const io = req.app.get('io');

    // Atomic: duplicate check + DKP assignment in one transaction to prevent double processing
    const totalDKP = await db.transaction(async (tx) => {
      // Duplicate check INSIDE transaction to prevent race condition
      const alreadyProcessed = await tx.get(
        'SELECT * FROM warcraft_logs_processed WHERE report_code = ? AND is_reverted = 0', reportCode
      );

      if (alreadyProcessed) {
        throw new Error('ALREADY_PROCESSED');
      }

      const capConfig = await tx.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
      const dkpCap = parseInt(capConfig?.config_value || '250', 10);

      const reportResult = await tx.run(`
        INSERT INTO warcraft_logs_processed
        (report_code, report_title, start_time, end_time, region, guild_name, participants_count, dkp_assigned, processed_by, raid_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, reportCode, reportTitle, startTime, endTime, req.body.region || 'Unknown', req.body.guildName || null, matchedParticipants.length, req.user.userId, raidDate);

      const wclReportId = reportResult.lastInsertRowid;
      let totalAssigned = 0;

      for (const participant of matchedParticipants) {
        const dkpAmount = participant.dkp_to_assign;

        // Use cap-aware DKP addition
        const result = await addDkpWithCap(tx, participant.user_id, dkpAmount, dkpCap);

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, wcl_report_id)
          VALUES (?, ?, ?, ?, ?)
        `, participant.user_id, result.actualGain, `Warcraft Logs: ${reportTitle}${result.wasCapped ? ' (capped)' : ''}`, req.user.userId, wclReportId);

        totalAssigned += result.actualGain;

        const newDkpRow = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', participant.user_id);

        io.emit('dkp_updated', {
          userId: participant.user_id,
          newDkp: newDkpRow?.current_dkp || 0,
          amount: dkpAmount
        });
      }

      // Update the total DKP assigned
      await tx.run('UPDATE warcraft_logs_processed SET dkp_assigned = ? WHERE id = ?', totalAssigned, wclReportId);

      return totalAssigned;
    });

    // Process fight statistics for boss tracking (non-blocking)
    const fights = req.body.fights || [];
    if (fights.length > 0) {
      // Build participant map: lowercase character name -> user_id
      const participantUserMap = {};
      for (const p of matchedParticipants) {
        const wclName = p.wcl_name?.toLowerCase();
        const matchedName = p.matched_character?.toLowerCase();
        if (wclName) participantUserMap[wclName] = p.user_id;
        if (matchedName) participantUserMap[matchedName] = p.user_id;
      }

      // Process in background to not delay response
      (async () => {
        try {
          let statsProcessed = 0;
          const processedBosses = [];

          for (const fight of fights) {
            const result = await processFightStats(reportCode, fight, fight.difficulty);
            if (!result.skipped) {
              statsProcessed++;
              // Include fight timing info for death filtering (15-second wipe threshold)
              processedBosses.push({
                bossId: result.bossId,
                fightId: fight.id,
                difficulty: fight.difficulty,
                kill: fight.kill,
                startTime: fight.startTime,
                endTime: fight.endTime,
              });
            }
          }

          // Fetch and record deaths + performance stats for each boss fight
          if (processedBosses.length > 0) {
            let totalDeathsRecorded = 0;
            let wipeDeathsFiltered = 0;
            let performanceRecorded = 0;

            for (const bossInfo of processedBosses) {
              // Get comprehensive fight stats with death filtering for wipes
              // Uses 15-second threshold: deaths within 15s of wipe end are not counted
              const fightStats = await getFightStatsWithDeathEvents(reportCode, {
                id: bossInfo.fightId,
                startTime: bossInfo.startTime,
                endTime: bossInfo.endTime,
                kill: bossInfo.kill,
              });

              // Track filtered wipe deaths
              if (fightStats.wipeDeathsFiltered) {
                wipeDeathsFiltered += fightStats.wipeDeathsFiltered;
              }

              // Record deaths (already filtered if it was a wipe)
              if (fightStats.deaths.length > 0) {
                const deathsFormatted = fightStats.deaths.map(d => ({ name: d.name, deaths: d.total }));
                await recordPlayerDeaths(bossInfo.bossId, bossInfo.difficulty, deathsFormatted, participantUserMap);
                totalDeathsRecorded += fightStats.deaths.reduce((sum, d) => sum + d.total, 0);
              }

              // Record performance (damage, healing, damage taken) and update records
              if (fightStats.damage.length > 0 || fightStats.healing.length > 0) {
                await recordPlayerPerformance(
                  bossInfo.bossId,
                  bossInfo.difficulty,
                  fightStats,
                  participantUserMap,
                  reportCode,
                  bossInfo.fightId
                );
                performanceRecorded++;
              }
            }

            if (totalDeathsRecorded > 0 || wipeDeathsFiltered > 0) {
              log.info(`Recorded ${totalDeathsRecorded} deaths from ${reportCode}${wipeDeathsFiltered > 0 ? ` (${wipeDeathsFiltered} wipe deaths filtered out)` : ''}`);
            }
            if (performanceRecorded > 0) {
              log.info(`Recorded performance for ${performanceRecorded} fights from ${reportCode}`);
            }
          }

          if (statsProcessed > 0) {
            log.info(`Boss stats updated: ${statsProcessed} fights from ${reportCode}`);
          }
        } catch (err) {
          log.error('Error processing fight stats', err);
        }
      })();
    }

    res.json({
      message: 'DKP assigned successfully from Warcraft Logs',
      report_code: reportCode,
      participants_count: matchedParticipants.length,
      total_dkp_assigned: totalDKP
    });

  } catch (error) {
    if (error.message === 'ALREADY_PROCESSED') {
      return res.status(409).json({ error: 'This report has already been processed' });
    }
    log.error('Error confirming Warcraft Log', error);
    res.status(500).json({
      error: 'Failed to assign DKP'
    });
  }
});

// Get history of processed Warcraft Logs reports
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const history = await db.all(`
      SELECT wlp.*, u.character_name as processed_by_name,
             u2.character_name as reverted_by_name
      FROM warcraft_logs_processed wlp
      LEFT JOIN users u ON wlp.processed_by = u.id
      LEFT JOIN users u2 ON wlp.reverted_by = u2.id
      ORDER BY wlp.processed_at DESC
      LIMIT ?
    `, limit);

    res.json(history);
  } catch (error) {
    log.error('WCL history error', error);
    res.status(500).json({ error: 'Failed to get WCL history' });
  }
});

// Get all DKP transactions for a specific WCL report
router.get('/report/:code/transactions', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const report = await db.get('SELECT id, report_code, report_title, is_reverted FROM warcraft_logs_processed WHERE report_code = ?', code);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Try by wcl_report_id first, fall back to reason LIKE match
    let transactions = await db.all(`
      SELECT dt.*, u.character_name, u.character_class
      FROM dkp_transactions dt
      LEFT JOIN users u ON dt.user_id = u.id
      WHERE dt.wcl_report_id = ?
      ORDER BY dt.created_at DESC
    `, report.id);

    if (transactions.length === 0) {
      transactions = await db.all(`
        SELECT dt.*, u.character_name, u.character_class
        FROM dkp_transactions dt
        LEFT JOIN users u ON dt.user_id = u.id
        WHERE dt.reason LIKE ?
        ORDER BY dt.created_at DESC
      `, `Warcraft Logs: ${report.report_title}%`);
    }

    res.json({ report, transactions });
  } catch (error) {
    log.error('WCL report transactions error', error);
    res.status(500).json({ error: 'Failed to get report transactions' });
  }
});

// Revert all DKP from a WCL report (atomic)
router.post('/revert/:reportCode', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { reportCode } = req.params;

    const report = await db.get(
      'SELECT * FROM warcraft_logs_processed WHERE report_code = ? AND is_reverted = 0',
      reportCode
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found or already reverted' });
    }

    const io = req.app.get('io');

    await db.transaction(async (tx) => {
      // Find all transactions linked to this report
      let transactions = await tx.all(
        'SELECT * FROM dkp_transactions WHERE wcl_report_id = ?', report.id
      );

      // Fallback to reason match for legacy records
      if (transactions.length === 0) {
        transactions = await tx.all(
          'SELECT * FROM dkp_transactions WHERE reason LIKE ?',
          `Warcraft Logs: ${report.report_title}%`
        );
      }

      // Create reversal transactions and subtract DKP
      for (const txn of transactions) {
        if (txn.amount <= 0) continue;

        await tx.run(`
          UPDATE member_dkp
          SET current_dkp = current_dkp - ?,
              lifetime_gained = lifetime_gained - ?
          WHERE user_id = ?
        `, txn.amount, txn.amount, txn.user_id);

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, wcl_report_id)
          VALUES (?, ?, ?, ?, ?)
        `, txn.user_id, -txn.amount, `Revert: ${report.report_title}`, req.user.userId, report.id);

        const newDkpRow = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', txn.user_id);
        io.emit('dkp_updated', {
          userId: txn.user_id,
          newDkp: newDkpRow?.current_dkp || 0,
          amount: -txn.amount
        });
      }

      // Mark report as reverted
      await tx.run(`
        UPDATE warcraft_logs_processed
        SET is_reverted = 1, reverted_by = ?, reverted_at = datetime('now')
        WHERE id = ?
      `, req.user.userId, report.id);
    });

    res.json({ message: 'DKP reverted successfully', report_code: reportCode });
  } catch (error) {
    log.error('WCL revert error', error);
    res.status(500).json({ error: 'Failed to revert DKP' });
  }
});

// Auto-detect guild reports for a specific raid date
router.get('/guild-reports', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date parameter required (YYYY-MM-DD)' });
    }

    // Get guild ID from config
    const guildConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'wcl_guild_id'");
    if (!guildConfig) {
      return res.status(400).json({ error: 'WCL guild ID not configured. Set wcl_guild_id in DKP config.' });
    }

    const guildId = parseInt(guildConfig.config_value);

    // Search window: raid date 18:00 to next day 06:00 (Europe/Madrid)
    const raidDate = new Date(date + 'T18:00:00+01:00');
    const raidEnd = new Date(date + 'T06:00:00+01:00');
    raidEnd.setDate(raidEnd.getDate() + 1);

    const startTime = raidDate.getTime();
    const endTime = raidEnd.getTime();

    const reports = await getGuildReports(guildId, startTime, endTime);

    // Check which reports are already processed
    for (const report of reports) {
      const processed = await db.get(
        'SELECT id, is_reverted FROM warcraft_logs_processed WHERE report_code = ?',
        report.code
      );
      report.alreadyProcessed = !!processed && !processed.is_reverted;
      report.wasReverted = !!processed && !!processed.is_reverted;
    }

    res.json(reports);
  } catch (error) {
    log.error('Guild reports error', error);
    res.status(500).json({ error: 'Failed to fetch guild reports' });
  }
});

// Import boss statistics from a WCL report (without DKP/member matching)
// Also records player performance (damage, healing, deaths) by matching WCL names to known users
router.post('/import-boss-stats', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'WCL URL required' });
    }

    // Process the WCL log to get report data
    const reportData = await processWarcraftLog(url);

    // Ensure raid data is seeded
    await seedRaidData();

    // Build participant map from known users/characters in database
    const allUsers = await db.all('SELECT id, character_name FROM users WHERE is_active = 1');
    const allCharacters = await db.all('SELECT user_id, character_name FROM characters');
    const participantUserMap = {};
    for (const u of allUsers) {
      if (u.character_name) participantUserMap[u.character_name.toLowerCase()] = u.id;
    }
    for (const c of allCharacters) {
      if (c.character_name) participantUserMap[c.character_name.toLowerCase()] = c.user_id;
    }

    let statsProcessed = 0;
    let statsSkipped = 0;
    const processedBosses = [];

    // Process each fight for boss statistics (kills, wipes, times)
    for (const fight of reportData.fights) {
      const result = await processFightStats(reportData.code, fight, fight.difficulty);

      if (result.skipped) {
        statsSkipped++;
      } else {
        statsProcessed++;
        processedBosses.push({
          bossId: result.bossId,
          fightId: fight.id,
          name: fight.name,
          difficulty: fight.difficulty,
          kill: result.kill,
          duration: fight.duration,
          startTime: fight.startTime,
          endTime: fight.endTime,
        });
      }
    }

    log.info(`Boss stats imported from ${reportData.code}: ${statsProcessed} processed, ${statsSkipped} skipped`);

    // Record player performance (damage, healing, deaths) in background
    if (processedBosses.length > 0 && Object.keys(participantUserMap).length > 0) {
      (async () => {
        try {
          let performanceRecorded = 0;
          let deathsRecorded = 0;

          for (const bossInfo of processedBosses) {
            const fightStats = await getFightStatsWithDeathEvents(reportData.code, {
              id: bossInfo.fightId,
              startTime: bossInfo.startTime,
              endTime: bossInfo.endTime,
              kill: bossInfo.kill,
            });

            // Record deaths
            if (fightStats.deaths && fightStats.deaths.length > 0) {
              const deathsFormatted = fightStats.deaths.map(d => ({ name: d.name, deaths: d.total }));
              await recordPlayerDeaths(bossInfo.bossId, bossInfo.difficulty, deathsFormatted, participantUserMap);
              deathsRecorded += fightStats.deaths.reduce((sum, d) => sum + d.total, 0);
            }

            // Record performance (damage, healing, damage taken)
            if (fightStats.damage.length > 0 || fightStats.healing.length > 0) {
              await recordPlayerPerformance(
                bossInfo.bossId,
                bossInfo.difficulty,
                fightStats,
                participantUserMap,
                reportData.code,
                bossInfo.fightId
              );
              performanceRecorded++;
            }
          }

          if (performanceRecorded > 0 || deathsRecorded > 0) {
            log.info(`Import performance: ${performanceRecorded} fights, ${deathsRecorded} deaths from ${reportData.code}`);
          }

          // Process extended fight data for deep performance analysis
          const reportDate = new Date(reportData.startTime).toISOString().split('T')[0];
          let extendedRecorded = 0;
          for (const bossInfo of processedBosses) {
            try {
              const extStats = await getExtendedFightStats(reportData.code, [bossInfo.fightId]);
              const fightStats = await getFightStats(reportData.code, [bossInfo.fightId]);
              const count = await processExtendedFightData(
                reportData.code, bossInfo, fightStats, extStats, participantUserMap, reportDate
              );
              extendedRecorded += count;
            } catch (extErr) {
              console.warn(`Extended stats failed for fight ${bossInfo.fightId}:`, extErr.message);
            }
          }
          if (extendedRecorded > 0) {
            log.info(`Extended performance: ${extendedRecorded} player-fight records from ${reportData.code}`);
          }

          // Process item popularity from kill fights
          const killFights = processedBosses.filter(b => b.kill);
          if (killFights.length > 0) {
            try {
              await processReportPopularity(reportData.code, killFights);
            } catch (popErr) {
              console.warn('Item popularity processing failed:', popErr.message);
            }
          }
        } catch (err) {
          log.error('Error recording import performance', err);
        }
      })();
    }

    res.json({
      message: 'Boss statistics imported successfully',
      report: {
        code: reportData.code,
        title: reportData.title,
        totalFights: reportData.fights.length,
        bossesKilled: reportData.bossesKilled,
        totalBosses: reportData.totalBosses
      },
      stats: {
        processed: statsProcessed,
        skipped: statsSkipped,
        matchedUsers: Object.keys(participantUserMap).length
      },
      bosses: processedBosses.map(b => ({
        bossId: b.bossId,
        fightId: b.fightId,
        name: b.name,
        difficulty: b.difficulty,
        kill: b.kill,
        duration: b.duration
      }))
    });
  } catch (error) {
    log.error('Import boss stats error', error);
    res.status(500).json({ error: error.message || 'Failed to import boss statistics' });
  }
});

// Get pending WCL reports from configured uploader (for auto-detection)
router.get('/pending-reports', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    // Get the configured uploader user ID
    const uploaderConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'wcl_uploader_id'");
    if (!uploaderConfig?.config_value) {
      return res.status(400).json({ error: 'WCL uploader ID not configured' });
    }

    const uploaderId = parseInt(uploaderConfig.config_value);

    // Import the getUserReports function
    const { getUserReports } = await import('../services/warcraftlogs.js');
    const { userName, reports } = await getUserReports(uploaderId, 20);

    // Get already processed report codes
    const processedReports = await db.all('SELECT report_code FROM warcraft_logs_processed');
    const processedCodes = new Set(processedReports.map(r => r.report_code));

    // Get raid days to match dates
    const raidDays = await db.all('SELECT day_of_week FROM raid_days WHERE is_active = 1');
    const raidDaysSet = new Set(raidDays.map(r => r.day_of_week));

    // Filter to unprocessed reports that match raid days
    const pendingReports = reports
      .filter(r => !processedCodes.has(r.code))
      .map(r => {
        // Convert WCL timestamp to date in Europe/Madrid timezone
        const date = new Date(r.startTime);
        const dateStr = date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
        const jsDay = date.getDay();
        const dbDay = jsDay === 0 ? 7 : jsDay; // Convert Sunday from 0 to 7

        return {
          ...r,
          raidDate: dateStr,
          dayOfWeek: dbDay,
          isRaidDay: raidDaysSet.has(dbDay),
        };
      })
      .filter(r => r.isRaidDay); // Only show reports from raid days

    res.json({
      uploaderName: userName,
      uploaderId,
      pending: pendingReports,
      processed: processedCodes.size,
    });
  } catch (error) {
    log.error('Get pending reports error', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pending reports' });
  }
});

// Auto-process a pending WCL report
router.post('/auto-process/:code', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { code } = req.params;

    // Check if already processed
    const existing = await db.get('SELECT id FROM warcraft_logs_processed WHERE report_code = ?', code);
    if (existing) {
      return res.status(400).json({ error: 'Report already processed' });
    }

    // Process the report (same as /api/warcraftlogs/preview)
    const reportData = await processWarcraftLog(code);

    // Get DKP config
    const dkpConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'raid_attendance_dkp'");
    const dkpPerPlayer = parseInt(dkpConfig?.config_value) || 5;

    // Get all members to match participants
    const members = await db.all(`
      SELECT m.user_id, m.current_dkp, u.character_name, u.username, u.server
      FROM member_dkp m
      JOIN users u ON m.user_id = u.id
      WHERE u.role != 'inactive'
    `);

    // Get alternative character names (alts)
    const alts = await db.all(`
      SELECT c.user_id, c.character_name, c.realm
      FROM characters c
      JOIN users u ON c.user_id = u.id
      WHERE u.role != 'inactive'
    `);

    // Build lookup maps
    const memberByName = {};
    const memberByCharName = {};
    for (const m of members) {
      if (m.username) memberByName[m.username.toLowerCase()] = m;
      if (m.character_name) memberByCharName[m.character_name.toLowerCase()] = m;
    }
    for (const alt of alts) {
      if (alt.character_name) {
        memberByCharName[alt.character_name.toLowerCase()] = members.find(m => m.user_id === alt.user_id);
      }
    }

    // Match participants to members
    const matched = [];
    const unmatched = [];

    for (const p of reportData.participants) {
      const nameKey = p.name.toLowerCase();
      const member = memberByCharName[nameKey] || memberByName[nameKey];

      if (member) {
        matched.push({
          userId: member.user_id,
          characterName: member.character_name || member.username,
          wclName: p.name,
          wclServer: p.server,
          currentDkp: member.current_dkp,
        });
      } else {
        unmatched.push(p);
      }
    }

    // Auto-derive raid date from report timestamp
    const raidDate = new Date(reportData.startTime).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

    res.json({
      report: reportData,
      matching: {
        matched,
        unmatched,
        matchRate: `${Math.round((matched.length / reportData.participantCount) * 100)}%`,
      },
      dkpPerPlayer,
      raidDate,
      message: 'Report previewed. Call confirm endpoint to apply DKP.',
    });
  } catch (error) {
    log.error('Auto-process report error', error);
    res.status(500).json({ error: error.message || 'Failed to process report' });
  }
});

export default router;
