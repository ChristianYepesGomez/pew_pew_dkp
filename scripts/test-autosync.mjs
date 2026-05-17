#!/usr/bin/env node
/**
 * test-autosync.mjs
 * Runs syncGuildReports for a specific raid date against the LOCAL DB.
 * Use this to test the new multi-report + auto-DKP logic before deploying.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-autosync.mjs 2026-05-13
 *   node --env-file=.env.local scripts/test-autosync.mjs 2026-05-13 --no-dkp   (stats only)
 */

import { createClient } from '@libsql/client';
import { createDbInterface } from '../database.js';
import { syncGuildReports } from '../services/autoSync.js';

const raidDate = process.argv[2];
const autoDkp = !process.argv.includes('--no-dkp');

if (!raidDate || !/^\d{4}-\d{2}-\d{2}$/.test(raidDate)) {
  console.error('Usage: node --env-file=.env.local scripts/test-autosync.mjs YYYY-MM-DD [--no-dkp]');
  process.exit(1);
}

async function main() {
  const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./data/dkp_local.db';
  console.log(`\nTest autoSync — date: ${raidDate}, autoDkp: ${autoDkp}`);
  console.log(`DB: ${dbUrl}\n`);

  const client = createClient({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  const db = createDbInterface(client, 'test');

  // Show pre-sync state
  const preBsp = await db.all(
    "SELECT DISTINCT report_code FROM boss_stats_processed WHERE DATE(processed_at) = ?", raidDate
  );
  const preWlp = await db.all(
    "SELECT id, report_code, dkp_assigned FROM warcraft_logs_processed WHERE raid_date = ?", raidDate
  );
  console.log(`PRE-SYNC: ${preBsp.length} report(s) in boss_stats_processed, ${preWlp.length} DKP assignment(s) for ${raidDate}`);

  // Run the sync
  console.log('\nRunning syncGuildReports...\n');
  const startMs = Date.now();
  const result = await syncGuildReports(db, { raidDate, autoDkp, io: null });
  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log(`\n=== SYNC RESULT (${elapsedSec}s) ===`);
  console.log(`WCL reports found: ${result.found}`);
  console.log(`Reports imported:  ${result.toImport}`);
  console.log('\nPer-report results:');
  for (const r of result.results || []) {
    console.log(`  [${r.code}] "${r.title}" — ${r.processed} new fights, ${r.skipped} skipped, ${r.participantNames?.size ?? 0} participants${r.error ? ` ERROR: ${r.error}` : ''}`);
  }

  if (result.dkp) {
    const dkp = result.dkp;
    if (dkp.skipped) {
      console.log(`\nDKP: SKIPPED (${dkp.reason})`);
    } else {
      console.log(`\nDKP assigned:`);
      console.log(`  Raiders: ${dkp.raiders} players × ${dkp.raidDKP} DKP`);
      console.log(`  Bench:   ${dkp.bench} players × ${dkp.raidDKP} DKP`);
      console.log(`  Total:   ${dkp.totalAssigned} DKP`);
    }
  }

  // Show post-sync state
  const postBsp = await db.all(
    "SELECT DISTINCT report_code, COUNT(*) as fights FROM boss_stats_processed WHERE DATE(processed_at) = ? GROUP BY report_code", raidDate
  );
  const postBoss = await db.all(`
    SELECT b.name, bs.difficulty, bs.total_kills, bs.total_wipes
    FROM boss_statistics bs JOIN wcl_bosses b ON b.id = bs.boss_id
    WHERE bs.updated_at >= datetime('now', '-1 hour')
    ORDER BY b.name
  `);
  const postWlp = await db.all(
    "SELECT id, report_code, dkp_assigned, participants_count FROM warcraft_logs_processed WHERE raid_date = ?", raidDate
  );

  console.log(`\n=== POST-SYNC STATE ===`);
  console.log(`boss_stats_processed for ${raidDate}:`);
  for (const r of postBsp) console.log(`  [${r.report_code}] ${r.fights} fights`);

  if (postBoss.length > 0) {
    console.log('\nRecently updated boss_statistics:');
    for (const b of postBoss) {
      console.log(`  ${b.name} (${b.difficulty}): ${b.total_kills} kills, ${b.total_wipes} wipes`);
    }
  }

  if (postWlp.length > 0) {
    console.log('\nwarcraft_logs_processed:');
    for (const w of postWlp) {
      console.log(`  [${w.report_code}] ${w.participants_count} participants, ${w.dkp_assigned} DKP assigned`);
    }
  }

  // Spot-check: show DKP recipients if DKP was assigned
  if (autoDkp && !result.dkp?.skipped && result.dkp?.totalAssigned > 0) {
    const wlpRow = postWlp[0];
    if (wlpRow) {
      const recipients = await db.all(`
        SELECT u.character_name, dt.amount, dt.reason
        FROM dkp_transactions dt
        JOIN users u ON u.id = dt.user_id
        WHERE dt.wcl_report_id = ?
        ORDER BY dt.reason, u.character_name
      `, wlpRow.id);
      console.log(`\nDKP recipients (${recipients.length}):`);
      for (const r of recipients) {
        console.log(`  ${r.character_name.padEnd(20)} +${r.amount} — ${r.reason}`);
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
