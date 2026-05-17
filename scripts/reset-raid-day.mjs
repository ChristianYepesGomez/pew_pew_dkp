#!/usr/bin/env node
/**
 * reset-raid-day.mjs
 * Removes all imported data for a specific raid date from the local DB so
 * the autoSync can be re-run cleanly against it.
 *
 * Usage (local DB):
 *   node --env-file=.env.local scripts/reset-raid-day.mjs 2026-05-13
 *
 * Usage (prod — CAREFUL):
 *   node --env-file=.env scripts/reset-raid-day.mjs 2026-05-13 --prod
 *
 * What gets deleted:
 *   - boss_stats_processed rows for any report imported that day
 *   - boss_statistics changes made that day (resets kills/wipes for affected bosses)
 *   - boss_kill_log entries for that day
 *   - player_fight_performance + player_boss_deaths for those reports
 *   - warcraft_logs_processed row (and its dkp_transactions) for that date
 *   - DKP awarded from those transactions (reversed in member_dkp)
 */

import { createClient } from '@libsql/client';
import { createDbInterface } from '../database.js';

const raidDate = process.argv[2];
const isProd = process.argv.includes('--prod');

if (!raidDate || !/^\d{4}-\d{2}-\d{2}$/.test(raidDate)) {
  console.error('Usage: node --env-file=.env.local scripts/reset-raid-day.mjs YYYY-MM-DD');
  process.exit(1);
}

if (isProd) {
  console.warn('\n⚠️  WARNING: Running against PRODUCTION database!');
  console.warn('Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise(r => setTimeout(r, 5000));
}

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./data/dkp_local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log(`Resetting raid day ${raidDate} on: ${dbUrl}`);

  const client = createClient({ url: dbUrl, authToken });
  const db = createDbInterface(client, 'reset');

  // 1. Find all report codes imported that day (from boss_stats_processed)
  const processedReports = await db.all(
    `SELECT DISTINCT report_code FROM boss_stats_processed WHERE DATE(processed_at) = ?`,
    raidDate
  );
  const reportCodes = processedReports.map(r => r.report_code);

  // Also check warcraft_logs_processed by raid_date
  const wclReports = await db.all(
    `SELECT id, report_code, dkp_assigned FROM warcraft_logs_processed WHERE raid_date = ?`,
    raidDate
  );

  console.log(`Found ${reportCodes.length} report(s) in boss_stats_processed for ${raidDate}`);
  console.log(`Found ${wclReports.length} DKP assignment record(s) for ${raidDate}`);

  if (reportCodes.length === 0 && wclReports.length === 0) {
    console.log('Nothing to reset.');
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    // ── Reverse DKP transactions ──────────────────────────────────────────────
    for (const wclReport of wclReports) {
      // Get all DKP transactions linked to this report
      const txns = await tx.all(
        'SELECT id, user_id, amount FROM dkp_transactions WHERE wcl_report_id = ? AND reverted = 0',
        wclReport.id
      );

      for (const t of txns) {
        // Reverse the DKP gain in member_dkp
        await tx.run(
          'UPDATE member_dkp SET current_dkp = current_dkp - ?, lifetime_gained = lifetime_gained - ? WHERE user_id = ?',
          t.amount, t.amount, t.user_id
        );
        // Mark the transaction as reverted
        await tx.run('UPDATE dkp_transactions SET reverted = 1 WHERE id = ?', t.id);
      }

      console.log(`  Reversed ${txns.length} DKP transaction(s) for report ${wclReport.report_code}`);
    }

    // ── Delete warcraft_logs_processed entries ────────────────────────────────
    if (wclReports.length > 0) {
      await tx.run('DELETE FROM warcraft_logs_processed WHERE raid_date = ?', raidDate);
      console.log(`  Deleted ${wclReports.length} warcraft_logs_processed row(s)`);
    }

    // ── Delete boss stats for these reports ───────────────────────────────────
    if (reportCodes.length > 0) {
      const placeholders = reportCodes.map(() => '?').join(',');

      // player_fight_performance
      await tx.run(`DELETE FROM player_fight_performance WHERE report_code IN (${placeholders})`, ...reportCodes);

      // player_boss_deaths (keyed by boss_id+difficulty, not report — use processed_at date)
      // Only delete stats entries that were inserted today to avoid corrupting older data
      await tx.run(
        `DELETE FROM player_boss_deaths WHERE id IN (
           SELECT pbd.id FROM player_boss_deaths pbd
           WHERE DATE(pbd.created_at) = ?
         )`, raidDate
      );

      // boss_kill_log
      await tx.run(`DELETE FROM boss_kill_log WHERE DATE(created_at) = ?`, raidDate);

      // boss_stats_processed
      const bspResult = await tx.run(
        `DELETE FROM boss_stats_processed WHERE report_code IN (${placeholders})`,
        ...reportCodes
      );
      console.log(`  Deleted ${bspResult.rowsAffected ?? '?'} boss_stats_processed row(s)`);

      // boss_statistics: re-derive from remaining boss_stats_processed
      // Simpler: find bosses affected and reset their kill/wipe counts from scratch
      const affectedBosses = await tx.all(
        `SELECT DISTINCT b.id as boss_id, bsp_remaining.difficulty
         FROM boss_stats_processed bsp_remaining
         JOIN wcl_bosses b ON b.wcl_encounter_id = bsp_remaining.encounter_id
         WHERE bsp_remaining.report_code NOT IN (${placeholders})
           AND b.id IN (
             SELECT DISTINCT b2.id FROM wcl_bosses b2
             JOIN boss_stats_processed bsp_deleted
               ON bsp_deleted.encounter_id = b2.wcl_encounter_id
             WHERE bsp_deleted.report_code IN (${placeholders})
           )`,
        ...reportCodes, ...reportCodes
      );

      // For each affected boss+difficulty, recalculate from remaining data
      for (const { boss_id, difficulty } of affectedBosses) {
        const remaining = await tx.all(
          `SELECT kill, fight_time_ms FROM boss_stats_processed bsp
           JOIN wcl_bosses b ON b.wcl_encounter_id = bsp.encounter_id
           WHERE b.id = ? AND bsp.difficulty = ?`,
          boss_id, difficulty
        );
        const kills = remaining.filter(r => r.kill);
        const wipes = remaining.filter(r => !r.kill);
        const totalKillTime = kills.reduce((s, r) => s + (r.fight_time_ms || 0), 0);
        const fastestKill = kills.length > 0 ? Math.min(...kills.map(r => r.fight_time_ms || 0)) : null;

        await tx.run(
          `UPDATE boss_statistics SET
             total_kills = ?, total_wipes = ?,
             total_kill_time_ms = ?,
             avg_kill_time_ms = ?,
             fastest_kill_ms = ?,
             updated_at = CURRENT_TIMESTAMP
           WHERE boss_id = ? AND difficulty = ?`,
          kills.length, wipes.length,
          totalKillTime,
          kills.length > 0 ? Math.round(totalKillTime / kills.length) : null,
          fastestKill,
          boss_id, difficulty
        );
      }

      // If a boss+difficulty has NO remaining data at all, delete it from boss_statistics
      await tx.run(
        `DELETE FROM boss_statistics WHERE (boss_id, difficulty) NOT IN (
           SELECT DISTINCT b.id, bsp.difficulty
           FROM boss_stats_processed bsp
           JOIN wcl_bosses b ON b.wcl_encounter_id = bsp.encounter_id
         )`
      );

      console.log(`  Recalculated boss_statistics for ${affectedBosses.length} boss/difficulty pair(s)`);
    }
  });

  console.log(`\nReset complete for ${raidDate}.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
