#!/usr/bin/env node
/**
 * copy-prod-to-local.mjs
 * Copies all data from the production Turso DB to a local SQLite file.
 * Run ONCE before testing — does not overwrite existing local data by default.
 *
 * Usage:
 *   node --env-file=.env scripts/copy-prod-to-local.mjs
 *   node --env-file=.env scripts/copy-prod-to-local.mjs --force   (wipes local first)
 */

import { createClient } from '@libsql/client';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { createDbInterface, runMigrations } from '../database.js';

const LOCAL_DB_PATH = './data/dkp_local.db';
const LOCAL_DB_URL = `file:${LOCAL_DB_PATH}`;
const FORCE = process.argv.includes('--force');

// Tables to copy in FK-safe order (parents before children)
const TABLES = [
  'dkp_config',
  'wcl_zones',
  'wcl_bosses',
  'raid_days',
  'raids',
  'users',
  'characters',
  'member_dkp',
  'raid_attendance',
  'member_availability',
  'calendar_dkp_rewards',
  'boss_statistics',
  'boss_stats_processed',
  'boss_kill_log',
  'boss_records',
  'player_boss_deaths',
  'warcraft_logs_processed',
  'dkp_transactions',
  'player_fight_performance',
  'player_boss_performance',
  'wcl_percentiles',
  'item_popularity',
  'raid_items',
  'auctions',
  'auction_bids',
  'refresh_tokens',
];

async function main() {
  // Verify prod env vars are present
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN — run with --env-file=.env');
    process.exit(1);
  }
  if (process.env.TURSO_DATABASE_URL.startsWith('file:')) {
    console.error('TURSO_DATABASE_URL points to a local file — nothing to copy from prod');
    process.exit(1);
  }

  // Handle --force: delete existing local DB
  if (FORCE && existsSync(LOCAL_DB_PATH)) {
    unlinkSync(LOCAL_DB_PATH);
    console.log('Deleted existing local DB (--force)');
  } else if (!FORCE && existsSync(LOCAL_DB_PATH)) {
    console.log(`Local DB already exists at ${LOCAL_DB_PATH}. Use --force to overwrite.`);
    process.exit(0);
  }

  mkdirSync('./data', { recursive: true });

  console.log(`Connecting to prod: ${process.env.TURSO_DATABASE_URL}`);
  const prodClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const prodDb = createDbInterface(prodClient, 'prod');

  console.log(`Creating local DB: ${LOCAL_DB_URL}`);
  const localClient = createClient({ url: LOCAL_DB_URL });
  const localDb = createDbInterface(localClient, 'local');

  // Initialize schema on local DB
  console.log('Running migrations on local DB...');
  await runMigrations(localDb, LOCAL_DB_URL);
  console.log('Schema initialized.');

  // Copy each table
  let totalRows = 0;
  for (const table of TABLES) {
    try {
      const rows = await prodDb.all(`SELECT * FROM ${table}`);
      if (rows.length === 0) {
        console.log(`  ${table}: (empty)`);
        continue;
      }

      // Build INSERT from first row's keys
      const keys = Object.keys(rows[0]);
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

      let inserted = 0;
      for (const row of rows) {
        try {
          const values = keys.map(k => row[k]);
          await localDb.run(sql, ...values);
          inserted++;
        } catch (err) {
          // Log but continue — some rows may violate UNIQUE constraints if table had partial data
          if (!err.message.includes('UNIQUE')) console.warn(`  Row skip in ${table}: ${err.message}`);
        }
      }
      console.log(`  ${table}: ${inserted}/${rows.length} rows`);
      totalRows += inserted;
    } catch (err) {
      console.warn(`  ${table}: SKIPPED — ${err.message}`);
    }
  }

  console.log(`\nDone. Copied ${totalRows} total rows to ${LOCAL_DB_PATH}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Copy failed:', err);
  process.exit(1);
});
