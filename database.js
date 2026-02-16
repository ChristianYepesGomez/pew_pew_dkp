import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { createLogger } from './lib/logger.js';

const log = createLogger('Database');

// ── Reusable DB interface factory ────────────────────────────────
// Creates a db wrapper around any @libsql/client instance.
// Used for both the default guild DB and per-tenant connections.

export function createDbInterface(libsqlClient) {
  return {
    async get(sql, ...args) {
      const result = await libsqlClient.execute({ sql, args });
      return result.rows[0] || null;
    },

    async all(sql, ...args) {
      const result = await libsqlClient.execute({ sql, args });
      return result.rows;
    },

    async run(sql, ...args) {
      const result = await libsqlClient.execute({ sql, args });
      return {
        changes: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : undefined,
      };
    },

    async exec(sql) {
      return await libsqlClient.execute(sql);
    },

    async batch(stmts) {
      return await libsqlClient.batch(stmts, 'write');
    },

    async transaction(fn) {
      const tx = await libsqlClient.transaction('write');
      try {
        const txDb = {
          async get(sql, ...args) {
            const result = await tx.execute({ sql, args });
            return result.rows[0] || null;
          },
          async all(sql, ...args) {
            const result = await tx.execute({ sql, args });
            return result.rows;
          },
          async run(sql, ...args) {
            const result = await tx.execute({ sql, args });
            return {
              changes: result.rowsAffected,
              lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : undefined,
            };
          },
        };
        const result = await fn(txDb);
        await tx.commit();
        return result;
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    },
  };
}

// ── Default guild DB (backward compat) ──────────────────────────
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./data/dkp.db';
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '');
  const dir = dirname(filePath);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    log.info(`Created database directory: ${dir}`);
  }
}

const client = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = createDbInterface(client);

// ── Reusable migration runner ───────────────────────────────────
// Applies the full guild schema to any db instance.

function isRemoteUrl(url) {
  return url && (url.startsWith('http') || url.startsWith('libsql://'));
}

export async function runMigrations(targetDb, connectionUrl = dbUrl) {
  if (!isRemoteUrl(connectionUrl)) {
    await targetDb.exec('PRAGMA foreign_keys = ON');
    await targetDb.exec('PRAGMA busy_timeout = 5000');
    await targetDb.exec('PRAGMA journal_mode = WAL');
  }

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      character_name TEXT,
      character_class TEXT,
      raid_role TEXT DEFAULT 'DPS' CHECK(raid_role IN ('Tank', 'Healer', 'DPS')),
      role TEXT DEFAULT 'raider' CHECK(role IN ('admin', 'officer', 'raider')),
      server TEXT,
      spec TEXT,
      email TEXT,
      reset_token TEXT,
      reset_token_expires DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS member_dkp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      current_dkp INTEGER DEFAULT 0,
      lifetime_gained INTEGER DEFAULT 0,
      lifetime_spent INTEGER DEFAULT 0,
      last_decay_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS dkp_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT,
      performed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_name_en TEXT,
      item_image TEXT DEFAULT '🎁',
      item_rarity TEXT DEFAULT 'epic' CHECK(item_rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
      min_bid INTEGER DEFAULT 10,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      winner_id INTEGER,
      winning_bid INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      duration_minutes INTEGER DEFAULT 5,
      ends_at DATETIME,
      farewell_data TEXT,
      item_id INTEGER,
      FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS auction_bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(auction_id, user_id)
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS auction_rolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      bid_amount INTEGER NOT NULL,
      roll_result INTEGER NOT NULL,
      is_winner INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS raids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scheduled_at DATETIME,
      dkp_reward INTEGER DEFAULT 10,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS raid_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raid_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (raid_id) REFERENCES raids(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(raid_id, user_id)
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS warcraft_logs_processed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_code TEXT UNIQUE NOT NULL,
      report_title TEXT,
      start_time INTEGER,
      end_time INTEGER,
      region TEXT,
      guild_name TEXT,
      participants_count INTEGER DEFAULT 0,
      dkp_assigned INTEGER DEFAULT 0,
      processed_by INTEGER,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS dkp_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS raid_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
      day_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      raid_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(day_of_week)
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS member_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      raid_date DATE NOT NULL,
      status TEXT DEFAULT 'tentative' CHECK(status IN ('confirmed', 'declined', 'tentative')),
      notes TEXT,
      dkp_awarded INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, raid_date)
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS calendar_dkp_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      days_completed INTEGER DEFAULT 0,
      dkp_awarded INTEGER DEFAULT 0,
      awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, week_start)
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      character_name TEXT NOT NULL,
      character_class TEXT NOT NULL,
      spec TEXT,
      raid_role TEXT DEFAULT 'DPS' CHECK(raid_role IN ('Tank', 'Healer', 'DPS')),
      is_primary INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await targetDb.exec(`
    CREATE TABLE IF NOT EXISTS bis_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_name_en TEXT,
      item_image TEXT,
      item_rarity TEXT DEFAULT 'epic',
      item_slot TEXT,
      item_level INTEGER,
      boss_name TEXT,
      raid_name TEXT,
      priority INTEGER DEFAULT 0,
      obtained INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, item_id)
    )
  `);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS wcl_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT, wcl_zone_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL, slug TEXT NOT NULL, expansion TEXT, tier INTEGER,
    is_current INTEGER DEFAULT 1, boss_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS wcl_bosses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, zone_id INTEGER NOT NULL,
    wcl_encounter_id INTEGER NOT NULL UNIQUE, name TEXT NOT NULL, slug TEXT NOT NULL,
    boss_order INTEGER DEFAULT 0, mythic_trap_url TEXT, image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES wcl_zones(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS boss_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, boss_id INTEGER NOT NULL, difficulty TEXT NOT NULL,
    total_kills INTEGER DEFAULT 0, total_wipes INTEGER DEFAULT 0,
    fastest_kill_ms INTEGER, avg_kill_time_ms INTEGER, total_kill_time_ms INTEGER DEFAULT 0,
    last_kill_date DATE, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(boss_id, difficulty),
    FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS player_boss_deaths (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, boss_id INTEGER NOT NULL,
    difficulty TEXT NOT NULL, total_deaths INTEGER DEFAULT 0, total_fights INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, boss_id, difficulty),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS boss_stats_processed (
    id INTEGER PRIMARY KEY AUTOINCREMENT, report_code TEXT NOT NULL,
    encounter_id INTEGER NOT NULL, fight_id INTEGER NOT NULL, difficulty TEXT,
    kill INTEGER DEFAULT 0, fight_time_ms INTEGER,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_code, encounter_id, fight_id)
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS boss_kill_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, boss_id INTEGER NOT NULL, difficulty TEXT NOT NULL,
    report_code TEXT NOT NULL, fight_id INTEGER NOT NULL, kill_time_ms INTEGER,
    kill_date DATE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS player_boss_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, boss_id INTEGER NOT NULL,
    difficulty TEXT NOT NULL, total_damage INTEGER DEFAULT 0, total_healing INTEGER DEFAULT 0,
    total_damage_taken INTEGER DEFAULT 0, total_potions_used INTEGER DEFAULT 0,
    fights_participated INTEGER DEFAULT 0, best_dps REAL DEFAULT 0, best_hps REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, boss_id, difficulty),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS boss_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT, boss_id INTEGER NOT NULL, difficulty TEXT NOT NULL,
    record_type TEXT NOT NULL, user_id INTEGER NOT NULL, value REAL NOT NULL,
    character_name TEXT NOT NULL, character_class TEXT, report_code TEXT, fight_id INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(boss_id, difficulty, record_type),
    FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS item_popularity (
    id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, item_name TEXT,
    item_slot TEXT, class TEXT NOT NULL, spec TEXT,
    content_type TEXT NOT NULL DEFAULT 'raid', usage_count INTEGER DEFAULT 0,
    total_players INTEGER DEFAULT 0, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, class, spec, content_type)
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS player_fight_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    report_code TEXT NOT NULL, fight_id INTEGER NOT NULL, boss_id INTEGER NOT NULL,
    difficulty TEXT NOT NULL, damage_done INTEGER DEFAULT 0, healing_done INTEGER DEFAULT 0,
    damage_taken INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, fight_duration_ms INTEGER DEFAULT 0,
    dps REAL DEFAULT 0, hps REAL DEFAULT 0, dtps REAL DEFAULT 0,
    health_potions INTEGER DEFAULT 0, healthstones INTEGER DEFAULT 0, combat_potions INTEGER DEFAULT 0,
    flask_uptime_pct REAL DEFAULT 0, food_buff_active INTEGER DEFAULT 0,
    augment_rune_active INTEGER DEFAULT 0, interrupts INTEGER DEFAULT 0, dispels INTEGER DEFAULT 0,
    raid_median_dps REAL DEFAULT 0, raid_median_dtps REAL DEFAULT 0, fight_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, report_code, fight_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await targetDb.exec(`CREATE INDEX IF NOT EXISTS idx_pfp_user_date ON player_fight_performance(user_id, fight_date)`);
  await targetDb.exec(`CREATE INDEX IF NOT EXISTS idx_pfp_user_boss ON player_fight_performance(user_id, boss_id, difficulty)`);

  // ── Loot Council tables ────────────────────────────────────────────

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS loot_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, item_name TEXT,
    raid_id INTEGER, boss_name TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'decided', 'cancelled')),
    winner_id INTEGER, decided_by INTEGER, created_by INTEGER, reason TEXT,
    created_at TEXT DEFAULT (datetime('now')), decided_at TEXT,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS loot_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, decision_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    response TEXT NOT NULL CHECK(response IN ('bis', 'upgrade', 'minor', 'offspec', 'pass')),
    note TEXT, created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (decision_id) REFERENCES loot_decisions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS loot_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, decision_id INTEGER NOT NULL,
    voter_id INTEGER NOT NULL, candidate_id INTEGER NOT NULL,
    vote TEXT NOT NULL CHECK(vote IN ('approve', 'reject')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (decision_id) REFERENCES loot_decisions(id) ON DELETE CASCADE,
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // ── EPGP tables ──────────────────────────────────────────────────

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS member_epgp (
    user_id INTEGER PRIMARY KEY, effort_points REAL DEFAULT 0, gear_points REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS epgp_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('ep_gain', 'gp_spend', 'decay')),
    ep_change REAL DEFAULT 0, gp_change REAL DEFAULT 0, reason TEXT, item_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS epgp_item_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER,
    item_quality TEXT, slot_type TEXT, gp_value INTEGER NOT NULL
  )`);

  // ── Raid items catalog (Blizzard API cache stored in DB) ──
  await targetDb.exec(`CREATE TABLE IF NOT EXISTS raid_items (
    id INTEGER PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_es TEXT,
    rarity TEXT DEFAULT 'epic',
    icon TEXT,
    slot TEXT,
    raid_name TEXT,
    raid_name_en TEXT,
    boss_name TEXT,
    boss_name_en TEXT,
    item_level INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── Column migrations ──
  const columnMigrations = [
    'ALTER TABLE users ADD COLUMN server TEXT',
    'ALTER TABLE users ADD COLUMN spec TEXT',
    'ALTER TABLE users ADD COLUMN email TEXT',
    'ALTER TABLE users ADD COLUMN reset_token TEXT',
    'ALTER TABLE users ADD COLUMN reset_token_expires DATETIME',
    'ALTER TABLE auctions ADD COLUMN item_name_en TEXT',
    'ALTER TABLE auctions ADD COLUMN duration_minutes INTEGER DEFAULT 5',
    'ALTER TABLE auctions ADD COLUMN ends_at DATETIME',
    'ALTER TABLE auctions ADD COLUMN farewell_data TEXT',
    'ALTER TABLE auctions ADD COLUMN item_id INTEGER',
    "ALTER TABLE member_dkp ADD COLUMN role TEXT DEFAULT 'DPS'",
    'ALTER TABLE warcraft_logs_processed ADD COLUMN raid_date DATE',
    'ALTER TABLE warcraft_logs_processed ADD COLUMN is_reverted INTEGER DEFAULT 0',
    'ALTER TABLE warcraft_logs_processed ADD COLUMN reverted_by INTEGER',
    'ALTER TABLE warcraft_logs_processed ADD COLUMN reverted_at DATETIME',
    'ALTER TABLE dkp_transactions ADD COLUMN wcl_report_id INTEGER',
    'ALTER TABLE dkp_transactions ADD COLUMN auction_id INTEGER',
    'ALTER TABLE users ADD COLUMN avatar TEXT',
    'ALTER TABLE auctions ADD COLUMN was_tie INTEGER DEFAULT 0',
    'ALTER TABLE auctions ADD COLUMN winning_roll INTEGER',
    'ALTER TABLE member_dkp ADD COLUMN weekly_vault_completed INTEGER DEFAULT 0',
    'ALTER TABLE member_dkp ADD COLUMN vault_completed_at DATETIME',
    'ALTER TABLE member_dkp ADD COLUMN vault_week TEXT',
    'ALTER TABLE wcl_bosses ADD COLUMN image_url TEXT',
    'ALTER TABLE boss_statistics ADD COLUMN wipes_to_first_kill INTEGER',
    'ALTER TABLE boss_statistics ADD COLUMN first_kill_date DATE',
    'ALTER TABLE characters ADD COLUMN realm TEXT',
    'ALTER TABLE characters ADD COLUMN realm_slug TEXT',
    "ALTER TABLE bis_items ADD COLUMN source_type TEXT DEFAULT 'raid'",
    'ALTER TABLE bis_items ADD COLUMN slot_position TEXT',
    'ALTER TABLE users ADD COLUMN discord_id TEXT',
  ];
  for (const sql of columnMigrations) {
    try { await targetDb.exec(sql); } catch (_e) { /* column already exists */ }
  }

  try {
    const columns = await targetDb.all('PRAGMA table_info(member_availability)');
    const hasWeekStart = columns.some(c => c.name === 'week_start');
    if (hasWeekStart) {
      log.info('Migrating member_availability to new schema (raid_date)');
      await targetDb.exec('DROP TABLE member_availability');
      await targetDb.exec(`CREATE TABLE member_availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
        raid_date DATE NOT NULL, status TEXT DEFAULT 'tentative' CHECK(status IN ('confirmed', 'declined', 'tentative')),
        notes TEXT, dkp_awarded INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, UNIQUE(user_id, raid_date)
      )`);
      log.info('member_availability migrated successfully');
    }
  } catch (e) {
    log.warn('Migration warning: ' + e.message);
  }

  try { await targetDb.exec(`CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE, token_family TEXT NOT NULL, used INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`); } catch (_e) { /* table already exists */ }

  try { await targetDb.exec(`CREATE TABLE IF NOT EXISTS bot_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL,
    config_key TEXT NOT NULL, config_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(guild_id, config_key)
  )`); } catch (_e) { /* table already exists */ }

  try { await targetDb.exec(`CREATE TABLE IF NOT EXISTS discord_link_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT NOT NULL,
    discord_username TEXT NOT NULL, username TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`); } catch (_e) { /* table already exists */ }

  try { await targetDb.exec(`CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL, max_uses INTEGER DEFAULT 0, use_count INTEGER DEFAULT 0,
    expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  )`); } catch (_e) { /* table already exists */ }

  try { await targetDb.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL, keys_p256dh TEXT NOT NULL, keys_auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`); } catch (_e) { /* table already exists */ }

  try { await targetDb.exec(`CREATE TABLE IF NOT EXISTS notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE,
    outbid INTEGER DEFAULT 1, bis_auction INTEGER DEFAULT 1,
    raid_reminder INTEGER DEFAULT 1, dkp_adjusted INTEGER DEFAULT 0,
    loot_council INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`); } catch (_e) { /* table already exists */ }

  await targetDb.exec(`CREATE TABLE IF NOT EXISTS db_migrations (
    id INTEGER PRIMARY KEY, version TEXT NOT NULL UNIQUE,
    applied_at TEXT DEFAULT (datetime('now')), description TEXT
  )`);

  // ── Indexes ──
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_dkp_transactions_user ON dkp_transactions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_dkp_transactions_date ON dkp_transactions(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)',
    'CREATE INDEX IF NOT EXISTS idx_auctions_status_created ON auctions(status, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id)',
    'CREATE INDEX IF NOT EXISTS idx_raid_attendance_raid ON raid_attendance(raid_id)',
    'CREATE INDEX IF NOT EXISTS idx_raid_attendance_user ON raid_attendance(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_warcraftlogs_report_code ON warcraft_logs_processed(report_code)',
    'CREATE INDEX IF NOT EXISTS idx_member_availability_user ON member_availability(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_member_availability_date ON member_availability(raid_date)',
    'CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_dkp_transactions_auction ON dkp_transactions(auction_id)',
    'CREATE INDEX IF NOT EXISTS idx_dkp_transactions_wcl_report ON dkp_transactions(wcl_report_id)',
    'CREATE INDEX IF NOT EXISTS idx_warcraftlogs_raid_date ON warcraft_logs_processed(raid_date)',
    'CREATE INDEX IF NOT EXISTS idx_wcl_bosses_zone ON wcl_bosses(zone_id)',
    'CREATE INDEX IF NOT EXISTS idx_wcl_bosses_encounter ON wcl_bosses(wcl_encounter_id)',
    'CREATE INDEX IF NOT EXISTS idx_boss_statistics_boss ON boss_statistics(boss_id)',
    'CREATE INDEX IF NOT EXISTS idx_player_boss_deaths_user ON player_boss_deaths(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_player_boss_deaths_boss ON player_boss_deaths(boss_id)',
    'CREATE INDEX IF NOT EXISTS idx_boss_stats_processed_report ON boss_stats_processed(report_code)',
    'CREATE INDEX IF NOT EXISTS idx_boss_kill_log_boss ON boss_kill_log(boss_id)',
    'CREATE INDEX IF NOT EXISTS idx_boss_kill_log_date ON boss_kill_log(kill_date)',
    'CREATE INDEX IF NOT EXISTS idx_player_boss_performance_user ON player_boss_performance(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_player_boss_performance_boss ON player_boss_performance(boss_id)',
    'CREATE INDEX IF NOT EXISTS idx_boss_records_boss ON boss_records(boss_id)',
    'CREATE INDEX IF NOT EXISTS idx_boss_records_type ON boss_records(record_type)',
    'CREATE INDEX IF NOT EXISTS idx_bis_items_user ON bis_items(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_bis_items_item ON bis_items(item_id)',
    'CREATE INDEX IF NOT EXISTS idx_item_popularity_class ON item_popularity(class, spec, content_type)',
    'CREATE INDEX IF NOT EXISTS idx_item_popularity_slot ON item_popularity(item_slot, class)',
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(token_family)',
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id)',
    'CREATE INDEX IF NOT EXISTS idx_bot_config_guild ON bot_config(guild_id)',
    'CREATE INDEX IF NOT EXISTS idx_discord_link_codes_code ON discord_link_codes(code)',
    // Loot Council indexes
    'CREATE INDEX IF NOT EXISTS idx_loot_decisions_status ON loot_decisions(status)',
    'CREATE INDEX IF NOT EXISTS idx_loot_decisions_winner ON loot_decisions(winner_id)',
    'CREATE INDEX IF NOT EXISTS idx_loot_responses_decision ON loot_responses(decision_id)',
    'CREATE INDEX IF NOT EXISTS idx_loot_responses_user ON loot_responses(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_loot_votes_decision ON loot_votes(decision_id)',
    // Raid items catalog
    'CREATE INDEX IF NOT EXISTS idx_raid_items_boss ON raid_items(boss_name)',
    // EPGP indexes
    'CREATE INDEX IF NOT EXISTS idx_epgp_transactions_user ON epgp_transactions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_epgp_transactions_type ON epgp_transactions(type)',
    'CREATE INDEX IF NOT EXISTS idx_epgp_transactions_date ON epgp_transactions(created_at)',
    // Push notification indexes
    'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint)',
  ];
  for (const sql of indexes) {
    await targetDb.exec(sql);
  }

  // ── Seed default data ──
  const configCount = await targetDb.get('SELECT COUNT(*) as count FROM dkp_config');
  if (configCount.count === 0) {
    log.info('Creating default DKP configuration');
    const configs = [
      ['raid_attendance_dkp', '5', 'DKP por asistencia a raid (por día)'],
      ['boss_kill_bonus', '10', 'DKP bonus adicional por cada boss derrotado'],
      ['default_server', 'Ragnaros', 'Servidor por defecto de la guild'],
      ['auto_assign_enabled', 'false', 'Asignar DKP automáticamente (sin confirmación)'],
      ['calendar_dkp_per_day', '1', 'DKP otorgado por cada día de calendario completado'],
      ['weekly_vault_dkp', '10', 'DKP otorgado por completar el vault semanal'],
      ['dkp_cap', '250', 'Máximo de DKP que puede acumular un jugador'],
    ];
    for (const [key, value, desc] of configs) {
      await targetDb.run('INSERT INTO dkp_config (config_key, config_value, description) VALUES (?, ?, ?)', key, value, desc);
    }
    log.info('Default DKP configuration created');
  }

  const raidDaysCount = await targetDb.get('SELECT COUNT(*) as count FROM raid_days');
  if (raidDaysCount.count === 0) {
    log.info('Creating default raid days');
    for (const [dow, name, time] of [[1, 'Lunes', '21:00'], [3, 'Miércoles', '21:00'], [4, 'Jueves', '21:00']]) {
      await targetDb.run('INSERT OR IGNORE INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (?, ?, 1, ?)', dow, name, time);
    }
    log.info('Default raid days created (Lunes, Miercoles, Jueves)');
  }

  // ── Data migrations ──
  const currentRaidDays = await targetDb.all('SELECT day_of_week FROM raid_days WHERE is_active = 1 ORDER BY day_of_week');
  const currentDaySet = currentRaidDays.map(r => r.day_of_week).join(',');
  if (currentDaySet !== '1,3,4') {
    log.info('Migrating raid days to Lunes/Miercoles/Jueves at 21:00');
    await targetDb.exec('DELETE FROM raid_days');
    for (const [dow, name, time] of [[1, 'Lunes', '21:00'], [3, 'Miércoles', '21:00'], [4, 'Jueves', '21:00']]) {
      await targetDb.run('INSERT OR IGNORE INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (?, ?, 1, ?)', dow, name, time);
    }
    log.info('Raid days migrated');
  }

  const charCount = await targetDb.get('SELECT COUNT(*) as count FROM characters');
  if (charCount.count === 0) {
    const existingUsers = await targetDb.all('SELECT id, character_name, character_class, spec, raid_role FROM users WHERE is_active = 1 AND character_name IS NOT NULL');
    if (existingUsers.length > 0) {
      log.info(`Migrating ${existingUsers.length} users to characters table`);
      for (const u of existingUsers) {
        await targetDb.run(
          'INSERT INTO characters (user_id, character_name, character_class, spec, raid_role, is_primary) VALUES (?, ?, ?, ?, ?, 1)',
          u.id, u.character_name, u.character_class, u.spec || null, u.raid_role || 'DPS'
        );
      }
      log.info('Characters migration complete');
    }
  }

  const calDkp = await targetDb.get("SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'");
  if (calDkp && calDkp.config_value !== '1') {
    await targetDb.run("UPDATE dkp_config SET config_value = '1' WHERE config_key = 'calendar_dkp_per_day'");
    log.info('Calendar DKP reward updated to +1');
  }

  for (const [key, value, desc] of [
    ['weekly_vault_dkp', '10', 'DKP otorgado por completar el vault semanal'],
    ['dkp_cap', '250', 'Máximo de DKP que puede acumular un jugador'],
    ['raid_attendance_dkp', '5', 'DKP por asistencia a raid (por día)'],
    ['wcl_uploader_id', '565362', 'Warcraft Logs user ID for auto-detecting new reports'],
    ['loot_system', 'dkp', 'Loot system: dkp, loot_council, or epgp'],
    // Onboarding configs
    ['guild_name', '', 'Guild name'],
    ['guild_server', '', 'Guild server/realm'],
    ['guild_region', '', 'Guild region (EU/US/KR/TW)'],
    ['onboarding_completed', 'false', 'Whether the guild onboarding wizard has been completed'],
  ]) {
    const exists = await targetDb.get('SELECT 1 FROM dkp_config WHERE config_key = ?', key);
    if (!exists) {
      await targetDb.run('INSERT INTO dkp_config (config_key, config_value, description) VALUES (?, ?, ?)', key, value, desc);
      log.info(`Added config: ${key} = ${value}`);
    }
  }

  const raidDkp = await targetDb.get("SELECT config_value FROM dkp_config WHERE config_key = 'raid_attendance_dkp'");
  if (raidDkp && raidDkp.config_value === '50') {
    await targetDb.run("UPDATE dkp_config SET config_value = '5', description = 'DKP por asistencia a raid (por día)' WHERE config_key = 'raid_attendance_dkp'");
    log.info('Raid attendance DKP updated to +5 per day');
  }

  // Seed default EPGP item values (GP cost by quality + slot)
  const epgpCount = await targetDb.get('SELECT COUNT(*) as count FROM epgp_item_values');
  if (epgpCount.count === 0) {
    for (const [quality, slot, gp] of [
      ['legendary', 'weapon', 150], ['legendary', 'other', 120],
      ['epic', 'weapon', 100], ['epic', 'head', 80], ['epic', 'chest', 80],
      ['epic', 'legs', 80], ['epic', 'shoulder', 75], ['epic', 'hands', 75],
      ['epic', 'waist', 75], ['epic', 'feet', 75], ['epic', 'wrist', 70],
      ['epic', 'back', 70], ['epic', 'trinket', 75], ['epic', 'finger', 70],
      ['epic', 'neck', 70], ['epic', 'off_hand', 80],
      ['rare', 'weapon', 60], ['rare', 'other', 50],
    ]) {
      await targetDb.run('INSERT INTO epgp_item_values (item_quality, slot_type, gp_value) VALUES (?, ?, ?)', quality, slot, gp);
    }
    log.info('Default EPGP item values seeded');
  }

  // Migrate loot_system config from uppercase to lowercase
  const lootSysConfig = await targetDb.get("SELECT config_value FROM dkp_config WHERE config_key = 'loot_system'");
  if (lootSysConfig && lootSysConfig.config_value !== lootSysConfig.config_value.toLowerCase()) {
    await targetDb.run("UPDATE dkp_config SET config_value = ? WHERE config_key = 'loot_system'", lootSysConfig.config_value.toLowerCase());
  }

  log.info('Database initialized successfully');
}

// ── Backward-compatible wrappers ────────────────────────────────
async function initDatabase() {
  return runMigrations(db);
}

function calculateDecay(currentDkp, decayPercentage, minDkp = 0) {
  const decayAmount = Math.floor(currentDkp * (decayPercentage / 100));
  return Math.max(minDkp, currentDkp - decayAmount);
}

export { db, initDatabase, calculateDecay };
