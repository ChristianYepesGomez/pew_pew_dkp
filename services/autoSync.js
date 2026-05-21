/**
 * autoSync.js — Guild report auto-sync service
 *
 * For each raid day, fetches ALL WCL guild reports and:
 * 1. Deduplicates fights at the physical-encounter level (encounterID + difficulty + absolute startTime),
 *    so split-log raids are fully captured without double-counting boss statistics.
 * 2. Imports boss stats (kills, wipes, deaths, performance) for every unique fight.
 * 3. Optionally auto-assigns raid-attendance DKP to everyone who appeared in any log, plus
 *    confirmed/tentative/late calendar signups NOT in any log (bench players).
 *
 * Called from:
 *   - POST /api/warcraftlogs/sync-guild-reports (manual admin trigger, lookbackDays)
 *   - Cron scheduler in server.js (23:15 Europe/Madrid on raid nights, raidDate + autoDkp)
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
  getVanguardMechanicHits,
} from './warcraftlogs.js';

const VANGUARD_ENCOUNTER_ID = 3180;
import { seedRaidData, processFightStats, recordPlayerDeaths, recordPlayerPerformance } from './raids.js';
import { processExtendedFightData } from './performanceAnalysis.js';
import { processReportPopularity } from './itemPopularity.js';
import { getLootSystem } from '../lib/lootSystems/index.js';

const log = createLogger('Service:AutoSync');

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMadridDate(ts) {
  return new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

async function buildParticipantMap(db) {
  const allUsers = await db.all('SELECT id, character_name FROM users WHERE is_active = 1');
  const allCharacters = await db.all('SELECT user_id, character_name FROM characters');
  const map = {};
  for (const u of allUsers) { if (u.character_name) map[u.character_name.toLowerCase()] = u.id; }
  for (const c of allCharacters) { if (c.character_name) map[c.character_name.toLowerCase()] = c.user_id; }
  return map;
}

async function isReportProcessed(db, reportCode) {
  const row = await db.get('SELECT 1 FROM boss_stats_processed WHERE report_code = ? LIMIT 1', reportCode);
  return !!row;
}

/**
 * Compute a content-based signature for a fight, identical across all loggers.
 *
 * For wipes: fightPercentage (boss HP% at wipe) is a pure game-state value — identical
 *   in every combat log for the same pull and virtually unique per pull.
 * For kills: fightPercentage is always 0/null, so we use duration rounded to the nearest
 *   second. Kill durations within the same night are always 10+ seconds apart, and CLEU
 *   timestamp drift between loggers is at most ~200ms, safely within a 1s window.
 */
function fightSignature(fight) {
  const difficulty = fight.difficulty ?? 'Unknown';
  if (fight.kill) {
    const durSec = Math.round((fight.endTime - fight.startTime) / 1000);
    return `${fight.encounterID}:${difficulty}:kill:${durSec}`;
  }
  // fightPercentage is identical across loggers and unique per wipe pull
  const pct = fight.fightPercentage != null ? fight.fightPercentage.toFixed(4) : 'null';
  return `${fight.encounterID}:${difficulty}:wipe:${pct}`;
}

/**
 * Build fight ownership map across multiple reports for the same raid day.
 *
 * Uses content-based signatures (boss HP% for wipes, duration for kills) instead of
 * timestamps — completely immune to logger clock drift.
 *
 * Reports processed in descending fight-count order so the most complete log wins ownership.
 *
 * Returns Map<signature, { reportData, fight }>
 */
function buildFightOwnershipMap(allReportData) {
  const sorted = [...allReportData].sort((a, b) => b.fights.length - a.fights.length);
  const map = new Map();

  for (const reportData of sorted) {
    for (const fight of reportData.fights) {
      const sig = fightSignature(fight);
      if (!map.has(sig)) {
        map.set(sig, { reportData, fight });
      }
    }
  }

  return map;
}

/**
 * From the ownership map, group owned fight IDs by their source report.
 * Returns [{ reportData, allowedFightIds: Set<number> }]
 * A fight ID in this set is the WCL fight.id within that specific report.
 */
function groupOwnershipByReport(ownershipMap) {
  const byReport = new Map();

  for (const { reportData, fight } of ownershipMap.values()) {
    if (!byReport.has(reportData.code)) {
      byReport.set(reportData.code, { reportData, allowedFightIds: new Set() });
    }
    byReport.get(reportData.code).allowedFightIds.add(fight.id);
  }

  return [...byReport.values()];
}

// ── Import a single report ────────────────────────────────────────────────────

/**
 * Import boss stats + extended data for one WCL report.
 * Only processes fights whose IDs are in allowedFightIds (deduplicated subset).
 * Returns { code, title, processed, skipped, error, participantNames }
 */
async function importReport(db, reportData, allowedFightIds, participantUserMap, io) {
  const entry = {
    code: reportData.code,
    title: reportData.title || reportData.code,
    processed: 0,
    skipped: 0,
    error: null,
    // Participant names from this report's master data (WCL actors list)
    participantNames: new Set(
      (reportData.participants || []).map(p => p.name?.toLowerCase()).filter(Boolean)
    ),
  };

  try {
    const fightsToProcess = allowedFightIds
      ? reportData.fights.filter(f => allowedFightIds.has(f.id))
      : reportData.fights;

    if (fightsToProcess.length === 0) {
      log.info(`Sync: ${reportData.code} — all fights owned by other reports, skipping boss stats`);
      return entry;
    }

    const limit = pLimit(3);

    const fightResults = await Promise.all(
      fightsToProcess.map(fight => limit(async () => {
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
          encounterID: fight.encounterID,
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

    log.info(`Sync: ${reportData.code} — ${entry.processed} new fights, ${entry.skipped} already processed`);

    // Extended stats (deaths, performance, consumables, rankings) run in background
    if (processedBosses.length > 0 && Object.keys(participantUserMap).length > 0) {
      (async () => {
        try {
          const reportDate = new Date(reportData.startTime).toISOString().split('T')[0];
          const extLimit = pLimit(3);

          // Deaths + basic performance per fight
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
                await recordPlayerPerformance(
                  db, bossInfo.bossId, bossInfo.difficulty, fightStats,
                  participantUserMap, reportData.code, bossInfo.fightId
                );
              }
            } catch (err) {
              log.warn(`Sync deaths/perf failed for fight ${bossInfo.fightId} in ${reportData.code}: ${err.message}`);
            }
          })));

          // Extended fight data: consumables, interrupts, DPS/HPS rankings, boss mechanics
          await Promise.all(processedBosses.map(bossInfo => extLimit(async () => {
            try {
              const isVanguard = bossInfo.encounterID === VANGUARD_ENCOUNTER_ID;
              const fetches = [
                getExtendedFightStats(reportData.code, [bossInfo.fightId]),
                getFightStats(reportData.code, [bossInfo.fightId]),
                getConsumableCasts(reportData.code, [bossInfo.fightId]),
                bossInfo.kill ? getFightRankings(reportData.code, [bossInfo.fightId]) : Promise.resolve(null),
                isVanguard ? getVanguardMechanicHits(reportData.code, [bossInfo.fightId]) : Promise.resolve(null),
              ];
              const [extStats, basicStats, consumableCasts, rankingsData, mechanicHits] = await Promise.all(fetches);
              await processExtendedFightData(
                db, reportData.code, bossInfo, basicStats, extStats, participantUserMap, reportDate,
                rankingsData || { dps: {}, hps: {} }, consumableCasts, mechanicHits
              );
            } catch (err) {
              log.warn(`Sync extended stats failed for fight ${bossInfo.fightId} in ${reportData.code}: ${err.message}`);
            }
          })));

          try { await syncPercentilesForReport(db, reportData.code); } catch (err) {
            log.warn(`Sync percentiles failed for ${reportData.code}: ${err.message}`);
          }

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
          io?.emit('stats_processing_complete', {
            reportCode: reportData.code,
            status: 'error',
            message: bgErr.message,
          });
        }
      })();
    }
  } catch (err) {
    log.error(`Sync failed for report ${reportData.code}: ${err.message}`);
    entry.error = err.message;
  }
  return entry;
}

// ── Auto DKP Assignment ───────────────────────────────────────────────────────

/**
 * After all reports for a raid day are imported, assign raid-attendance DKP:
 * - Raiders: all players who appeared in any log and matched to a guild user
 * - Bench: confirmed/tentative/late calendar signups not found in any log
 *
 * Creates a single warcraft_logs_processed row (using the primary report code) so
 * the assignment is visible in the DKP history and can be reverted if needed.
 *
 * Skips silently if DKP was already assigned for this raid_date (prevents double-award
 * if the cron fires twice or the admin also ran a manual assignment).
 */
async function autoAssignDkp(db, raidDate, primaryReportCode, primaryReportTitle, allParticipantNames, participantUserMap, io) {
  // Guard: check by raid_date (not just report_code) to catch manual assignments too
  const alreadyAssigned = await db.get(
    "SELECT id FROM warcraft_logs_processed WHERE raid_date = ? AND is_reverted = 0",
    raidDate
  );
  if (alreadyAssigned) {
    log.info(`AutoSync DKP: already assigned for ${raidDate}, skipping`);
    return { skipped: true, reason: 'already_assigned' };
  }

  const dkpConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'raid_attendance_dkp'");
  const raidDKP = parseInt(dkpConfig?.config_value || '5', 10);

  // Map WCL participant names → user IDs
  const raidUserIds = new Set();
  for (const name of allParticipantNames) {
    const userId = participantUserMap[typeof name === 'string' ? name.toLowerCase() : name];
    if (userId) raidUserIds.add(userId);
  }

  // Bench = confirmed/tentative/late signups NOT found in any log
  const signups = await db.all(
    "SELECT user_id FROM member_availability WHERE raid_date = ? AND status IN ('confirmed', 'tentative', 'late')",
    raidDate
  );
  const benchUserIds = signups.filter(s => !raidUserIds.has(s.user_id)).map(s => s.user_id);

  const allUserIds = [...raidUserIds, ...benchUserIds];
  if (allUserIds.length === 0) {
    log.info(`AutoSync DKP: no recipients found for ${raidDate}`);
    return { skipped: true, reason: 'no_recipients' };
  }

  log.info(`AutoSync DKP: assigning ${raidDKP} DKP to ${raidUserIds.size} raiders + ${benchUserIds.length} bench for ${raidDate}`);

  const lootSystem = await getLootSystem(db);
  let totalAssigned = 0;

  await db.transaction(async (tx) => {
    const ins = await tx.run(`
      INSERT INTO warcraft_logs_processed
        (report_code, report_title, start_time, end_time, region, guild_name,
         participants_count, dkp_assigned, processed_by, raid_date)
      VALUES (?, ?, ?, ?, 'Unknown', NULL, ?, 0, NULL, ?)
    `,
      primaryReportCode,
      primaryReportTitle || `Auto-sync: ${raidDate}`,
      Date.now(), Date.now(),
      allUserIds.length,
      raidDate
    );

    const wclReportId = ins.lastInsertRowid;

    for (const userId of raidUserIds) {
      const awarded = await lootSystem.awardFromRaid(tx, userId, raidDKP);
      if (awarded.actualGain > 0) {
        const reason = awarded.wasCapped
          ? `Warcraft Logs: Raid ${raidDate} (capped)`
          : `Warcraft Logs: Raid ${raidDate}`;
        await tx.run(
          'INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, wcl_report_id) VALUES (?, ?, ?, NULL, ?)',
          userId, awarded.actualGain, reason, wclReportId
        );
        totalAssigned += awarded.actualGain;
        io?.emit('dkp_updated', { userId, newDkp: awarded.newDkp });
      }
    }

    for (const userId of benchUserIds) {
      const awarded = await lootSystem.awardFromRaid(tx, userId, raidDKP);
      if (awarded.actualGain > 0) {
        const reason = awarded.wasCapped
          ? `Warcraft Logs: Banquillo ${raidDate} (capped)`
          : `Warcraft Logs: Banquillo ${raidDate}`;
        await tx.run(
          'INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, wcl_report_id) VALUES (?, ?, ?, NULL, ?)',
          userId, awarded.actualGain, reason, wclReportId
        );
        totalAssigned += awarded.actualGain;
        io?.emit('dkp_updated', { userId, newDkp: awarded.newDkp });
      }
    }

    await tx.run(
      'UPDATE warcraft_logs_processed SET dkp_assigned = ? WHERE id = ?',
      totalAssigned, wclReportId
    );
  });

  log.info(`AutoSync DKP: assigned ${totalAssigned} total DKP for ${raidDate}`);
  io?.emit('auto_dkp_complete', {
    raidDate,
    raiders: raidUserIds.size,
    bench: benchUserIds.length,
    totalAssigned,
  });

  return { raiders: raidUserIds.size, bench: benchUserIds.length, totalAssigned, raidDKP };
}

// ── Sync logic for a single date ──────────────────────────────────────────────

async function syncDateReports(db, raidDate, reportsForDate, participantUserMap, autoDkp, io) {
  // Filter to unprocessed reports
  const unprocessed = [];
  for (const r of reportsForDate) {
    if (!(await isReportProcessed(db, r.code))) unprocessed.push(r);
  }

  if (unprocessed.length === 0) {
    log.info(`Guild sync ${raidDate}: all ${reportsForDate.length} report(s) already processed`);

    // Stats are imported but DKP might not have been assigned yet (e.g., previous DKP failure).
    // Fetch report data just to get participant names, then attempt DKP if requested.
    if (autoDkp) {
      const fetchLimit = pLimit(3);
      const allReportData = (await Promise.all(
        reportsForDate.map(r => fetchLimit(async () => {
          try { return await processWarcraftLog(r.code); }
          catch (err) { log.warn(`DKP retry: failed to fetch ${r.code}: ${err.message}`); return null; }
        }))
      )).filter(Boolean);

      const allParticipantNames = new Set();
      for (const rd of allReportData) {
        for (const p of rd.participants || []) {
          if (p.name) allParticipantNames.add(p.name.toLowerCase());
        }
      }

      const primaryReport = allReportData.sort((a, b) => b.fights.length - a.fights.length)[0];
      let dkpResult = null;
      if (primaryReport && allParticipantNames.size > 0) {
        dkpResult = await autoAssignDkp(
          db, raidDate, primaryReport.code, primaryReport.title,
          allParticipantNames, participantUserMap, io
        );
      }
      return { date: raidDate, found: reportsForDate.length, toImport: 0, results: [], dkp: dkpResult };
    }

    return { date: raidDate, found: reportsForDate.length, toImport: 0, results: [], dkp: null };
  }

  log.info(`Guild sync ${raidDate}: fetching fight data for ${unprocessed.length} unprocessed report(s)`);

  // Fetch fight lists for all unprocessed reports in parallel
  const fetchLimit = pLimit(3);
  const allReportData = (await Promise.all(
    unprocessed.map(r => fetchLimit(async () => {
      try { return await processWarcraftLog(r.code); }
      catch (err) {
        log.warn(`Guild sync: failed to fetch report ${r.code}: ${err.message}`);
        return null;
      }
    }))
  )).filter(Boolean);

  if (allReportData.length === 0) {
    return { date: raidDate, found: reportsForDate.length, toImport: 0, results: [], dkp: null };
  }

  // Deduplicate fights: each physical encounter assigned to exactly one report
  const ownershipMap = buildFightOwnershipMap(allReportData);
  const importBatches = groupOwnershipByReport(ownershipMap);

  const uniqueFights = ownershipMap.size;
  const totalFightsAcrossReports = allReportData.reduce((s, r) => s + r.fights.length, 0);
  log.info(
    `Guild sync ${raidDate}: ${uniqueFights} unique fights (of ${totalFightsAcrossReports} total) ` +
    `across ${allReportData.length} reports → importing from ${importBatches.length} report(s)`
  );

  const importLimit = pLimit(2);
  const results = await Promise.all(
    importBatches.map(({ reportData, allowedFightIds }) =>
      importLimit(() => importReport(db, reportData, allowedFightIds, participantUserMap, io))
    )
  );

  let dkpResult = null;
  if (autoDkp) {
    // Primary report = the one with the most fights (used as the DKP batch anchor)
    const primaryReport = [...allReportData].sort((a, b) => b.fights.length - a.fights.length)[0];

    // Collect all unique participant names across all reports
    const allParticipantNames = new Set();
    for (const result of results) {
      for (const name of result.participantNames) allParticipantNames.add(name);
    }

    dkpResult = await autoAssignDkp(
      db, raidDate,
      primaryReport.code, primaryReport.title,
      allParticipantNames, participantUserMap, io
    );
  }

  return {
    date: raidDate,
    found: reportsForDate.length,
    toImport: importBatches.length,
    results,
    dkp: dkpResult,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Sync WCL guild reports for one or more raid dates.
 *
 * @param {object} db - DB connection
 * @param {object} [options]
 * @param {number} [options.lookbackDays=7] - Days to look back (for manual admin sync via API).
 * @param {string} [options.raidDate] - Specific date YYYY-MM-DD. When set, only that date is
 *   processed and lookbackDays is ignored. Used by the cron.
 * @param {boolean} [options.autoDkp=false] - Auto-assign DKP after importing stats.
 * @param {object} [options.io] - Socket.IO instance for real-time notifications.
 * @returns {{ found, toImport, results, dkp?, byDate? }}
 */
export async function syncGuildReports(db, { lookbackDays = 7, raidDate = null, autoDkp = false, io = null } = {}) {
  const guildConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'wcl_guild_id'");
  if (!guildConfig?.config_value) {
    throw new Error('WCL guild ID not configured. Set wcl_guild_id in admin config.');
  }
  const guildId = parseInt(guildConfig.config_value, 10);

  const endTime = Date.now();
  let lookback;
  if (raidDate) {
    // Calculate exact days from the target date to today, plus 1-day buffer so
    // we always cover the full day even when called for historical dates.
    const daysDiff = Math.ceil((endTime - new Date(raidDate + 'T00:00:00').getTime()) / (24 * 60 * 60 * 1000));
    lookback = Math.min(daysDiff + 1, 90);
  } else {
    lookback = Math.min(lookbackDays, 90);
  }
  const startTime = endTime - lookback * 24 * 60 * 60 * 1000;

  const rawReports = await getGuildReports(guildId, startTime, endTime);
  log.info(`Guild sync: found ${rawReports.length} reports from WCL`);

  // If a specific date was requested, filter to only that date's reports
  const filteredReports = raidDate
    ? rawReports.filter(r => toMadridDate(r.startTime) === raidDate)
    : rawReports;

  if (filteredReports.length === 0) {
    const msg = raidDate ? `no reports found for ${raidDate}` : 'no reports found';
    log.info(`Guild sync: ${msg}`);
    return { found: rawReports.length, toImport: 0, results: [] };
  }

  await seedRaidData(db);
  const participantUserMap = await buildParticipantMap(db);

  // Single-date mode (cron)
  if (raidDate) {
    const dateResult = await syncDateReports(db, raidDate, filteredReports, participantUserMap, autoDkp, io);
    return {
      found: rawReports.length,
      toImport: dateResult.toImport,
      results: dateResult.results,
      dkp: dateResult.dkp,
    };
  }

  // Multi-date mode (admin API): group by Madrid date and process each independently
  const byDate = {};
  for (const r of filteredReports) {
    const date = toMadridDate(r.startTime);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(r);
  }

  const dateResults = [];
  for (const [date, reports] of Object.entries(byDate)) {
    const dateResult = await syncDateReports(db, date, reports, participantUserMap, autoDkp, io);
    dateResults.push(dateResult);
  }

  return {
    found: rawReports.length,
    toImport: dateResults.reduce((s, d) => s + d.toImport, 0),
    results: dateResults.flatMap(d => d.results),
    byDate: dateResults,
  };
}
