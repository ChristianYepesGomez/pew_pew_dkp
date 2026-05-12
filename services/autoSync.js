/**
 * autoSync.js — Guild report auto-sync service
 *
 * Groups WCL guild reports by raid date, picks the most complete one per date
 * (highest fight count = most kills + wipes), and imports boss stats for any
 * report that has not yet been processed.
 *
 * Called from:
 *   - POST /api/warcraftlogs/sync-guild-reports (manual admin trigger)
 *   - Cron scheduler in server.js (automatic, runs at 23:15 Europe/Madrid on raid nights)
 */

import pLimit from 'p-limit';
import { createLogger } from '../lib/logger.js';
import {
  processWarcraftLog,
  getGuildReports,
  getFightStatsWithDeathEvents,
  getExtendedFightStats,
  getFightStats,
  getFightRankings,
  getConsumableCasts,
  syncPercentilesForReport,
} from './warcraftlogs.js';
import { seedRaidData, processFightStats, recordPlayerDeaths, recordPlayerPerformance } from './raids.js';
import { processExtendedFightData } from './performanceAnalysis.js';
import { processReportPopularity } from './itemPopularity.js';

const log = createLogger('Service:AutoSync');

/**
 * Build the participant map from all active users and their alts.
 * Used by the import logic to match WCL character names → user IDs.
 */
async function buildParticipantMap(db) {
  const allUsers = await db.all('SELECT id, character_name FROM users WHERE is_active = 1');
  const allCharacters = await db.all('SELECT user_id, character_name FROM characters');
  const map = {};
  for (const u of allUsers) { if (u.character_name) map[u.character_name.toLowerCase()] = u.id; }
  for (const c of allCharacters) { if (c.character_name) map[c.character_name.toLowerCase()] = c.user_id; }
  return map;
}

/**
 * Check if a report has already been processed for boss stats.
 */
async function isReportProcessed(db, reportCode) {
  const row = await db.get('SELECT 1 FROM boss_stats_processed WHERE report_code = ? LIMIT 1', reportCode);
  return !!row;
}

/**
 * For a set of candidate reports for the same date, pick the one with the most fights.
 * Falls back to the first if all fail.
 */
async function pickBestReport(candidates) {
  if (candidates.length === 1) return candidates[0];

  const limit = pLimit(3);
  const withCounts = await Promise.all(
    candidates.map(r => limit(async () => {
      try {
        const data = await processWarcraftLog(r.code);
        return { ...r, fightCount: data.fights.length };
      } catch {
        return { ...r, fightCount: 0 };
      }
    }))
  );

  withCounts.sort((a, b) => b.fightCount - a.fightCount);
  const best = withCounts[0];
  if (withCounts.length > 1) {
    log.info(`Best report for date: ${best.code} (${best.fightCount} fights) over ${candidates.map(c => c.code).join(', ')}`);
  }
  return best;
}

/**
 * Import boss stats + extended data for a single WCL report.
 * Returns { code, title, processed, skipped, error }.
 */
async function importReport(db, reportCode, participantUserMap, io) {
  const entry = { code: reportCode, title: '', processed: 0, skipped: 0, error: null };
  try {
    const reportData = await processWarcraftLog(reportCode);
    entry.title = reportData.title || reportCode;

    const limit = pLimit(3);

    // Process each fight for boss stats (kills, wipes, times)
    const fightResults = await Promise.all(
      reportData.fights.map(fight => limit(async () => {
        const result = await processFightStats(db, reportData.code, fight, fight.difficulty);
        return { fight, result };
      }))
    );

    const processedBosses = [];
    for (const { fight, result } of fightResults) {
      if (result.skipped) entry.skipped++;
      else entry.processed++;

      const bossId = result.bossId
        || (await db.get('SELECT id FROM wcl_bosses WHERE wcl_encounter_id = ?', fight.encounterID))?.id;
      if (bossId) {
        processedBosses.push({
          bossId,
          fightId: fight.id,
          name: fight.name,
          difficulty: fight.difficulty,
          kill: result.skipped ? fight.kill : result.kill,
          duration: fight.duration,
          startTime: fight.startTime,
          endTime: fight.endTime,
        });
      }
    }

    log.info(`Sync: ${reportData.code} — ${entry.processed} new, ${entry.skipped} already processed`);

    // Extended stats (deaths, performance, consumables, rankings) run in background
    if (processedBosses.length > 0 && Object.keys(participantUserMap).length > 0) {
      (async () => {
        try {
          const reportDate = new Date(reportData.startTime).toISOString().split('T')[0];
          const extLimit = pLimit(3);

          // Deaths + basic performance
          await Promise.all(processedBosses.map(bossInfo => extLimit(async () => {
            try {
              const alreadyHasData = await db.get(
                'SELECT 1 FROM player_fight_performance WHERE report_code = ? AND fight_id = ? LIMIT 1',
                reportData.code, bossInfo.fightId
              );
              if (alreadyHasData) return;

              const fightStats = await getFightStatsWithDeathEvents(reportData.code, {
                id: bossInfo.fightId,
                startTime: bossInfo.startTime,
                endTime: bossInfo.endTime,
                kill: bossInfo.kill,
              });

              if (fightStats.deaths?.length > 0) {
                const deathsFormatted = fightStats.deaths.map(d => ({ name: d.name, deaths: d.total }));
                await recordPlayerDeaths(db, bossInfo.bossId, bossInfo.difficulty, deathsFormatted, participantUserMap);
              }
              if (fightStats.damage.length > 0 || fightStats.healing.length > 0) {
                await recordPlayerPerformance(db, bossInfo.bossId, bossInfo.difficulty, fightStats, participantUserMap, reportData.code, bossInfo.fightId);
              }
            } catch (err) {
              log.warn(`Sync deaths/perf failed for fight ${bossInfo.fightId} in ${reportData.code}: ${err.message}`);
            }
          })));

          // Extended fight data (consumables, interrupts, DPS/HPS, rankings)
          await Promise.all(processedBosses.map(bossInfo => extLimit(async () => {
            try {
              const fetches = [
                getExtendedFightStats(reportData.code, [bossInfo.fightId]),
                getFightStats(reportData.code, [bossInfo.fightId]),
                getConsumableCasts(reportData.code, [bossInfo.fightId]),
              ];
              if (bossInfo.kill) fetches.push(getFightRankings(reportData.code, [bossInfo.fightId]));
              const [extStats, basicStats, consumableCasts, rankingsData] = await Promise.all(fetches);
              await processExtendedFightData(
                db, reportData.code, bossInfo, basicStats, extStats, participantUserMap, reportDate,
                rankingsData || { dps: {}, hps: {} }, consumableCasts
              );
            } catch (err) {
              log.warn(`Sync extended stats failed for fight ${bossInfo.fightId} in ${reportData.code}: ${err.message}`);
            }
          })));

          // Percentile sync
          try { await syncPercentilesForReport(db, reportData.code); } catch (err) {
            log.warn(`Sync percentiles failed for ${reportData.code}: ${err.message}`);
          }

          // Item popularity
          const killFights = processedBosses.filter(b => b.kill);
          if (killFights.length > 0) {
            try { await processReportPopularity(db, reportData.code, killFights); } catch (err) {
              log.warn(`Sync item popularity failed for ${reportData.code}: ${err.message}`);
            }
          }

          io?.emit('stats_processing_complete', {
            reportCode: reportData.code,
            bossStatsProcessed: entry.processed,
            totalFights: processedBosses.length,
            status: 'success',
          });
        } catch (bgErr) {
          log.error(`Sync background processing failed for ${reportData.code}: ${bgErr.message}`);
          io?.emit('stats_processing_complete', { reportCode: reportData.code, status: 'error', message: bgErr.message });
        }
      })();
    }
  } catch (err) {
    log.error(`Sync failed for report ${reportCode}: ${err.message}`);
    entry.error = err.message;
  }
  return entry;
}

/**
 * Main sync function — fetches guild reports from WCL, picks the best per date,
 * and imports any that are not yet in boss_stats_processed.
 *
 * @param {object} db - DB connection
 * @param {object} [options]
 * @param {number} [options.lookbackDays=7] - How far back to look for reports
 * @param {object} [options.io] - Socket.IO instance for real-time notifications
 * @returns {{ found, toImport, results }}
 */
export async function syncGuildReports(db, { lookbackDays = 7, io = null } = {}) {
  const guildConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'wcl_guild_id'");
  if (!guildConfig?.config_value) {
    throw new Error('WCL guild ID not configured. Set wcl_guild_id in admin config.');
  }
  const guildId = parseInt(guildConfig.config_value, 10);

  const endTime = Date.now();
  const startTime = endTime - Math.min(lookbackDays, 90) * 24 * 60 * 60 * 1000;

  const rawReports = await getGuildReports(guildId, startTime, endTime);
  log.info(`Guild sync: found ${rawReports.length} reports in last ${lookbackDays} days`);

  // Filter to unprocessed reports
  const unprocessed = [];
  for (const r of rawReports) {
    if (!(await isReportProcessed(db, r.code))) unprocessed.push(r);
  }

  if (unprocessed.length === 0) {
    log.info('Guild sync: all reports already processed');
    return { found: rawReports.length, toImport: 0, results: [] };
  }

  // Group by raid date (Europe/Madrid timezone)
  const byDate = {};
  for (const r of unprocessed) {
    const date = new Date(r.startTime).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(r);
  }

  // Pick the best (most complete) report per date
  const toImport = await Promise.all(
    Object.entries(byDate).map(([, candidates]) => pickBestReport(candidates))
  );

  log.info(`Guild sync: importing ${toImport.length} reports (best per date)`);

  // Ensure boss data is seeded
  await seedRaidData(db);

  // Build participant map once
  const participantUserMap = await buildParticipantMap(db);

  // Import each selected report (concurrency 2)
  const importLimit = pLimit(2);
  const results = await Promise.all(
    toImport.map(r => importLimit(() => importReport(db, r.code, participantUserMap, io)))
  );

  return { found: rawReports.length, toImport: toImport.length, results };
}
