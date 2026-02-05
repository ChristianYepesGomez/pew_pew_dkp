import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// For local file mode, ensure data directory exists
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./data/dkp.db';
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '');
  const dir = dirname(filePath);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`📁 Created database directory: ${dir}`);
  }
}

// Create Turso / libSQL client
const client = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── Helper functions wrapping @libsql/client ───────────────────────
// These keep server.js changes minimal:
//   before: db.prepare('SELECT * FROM x WHERE id = ?').get(id)
//   after:  await db.get('SELECT * FROM x WHERE id = ?', id)

const db = {
  async get(sql, ...args) {
    const result = await client.execute({ sql, args });
    return result.rows[0] || null;
  },

  async all(sql, ...args) {
    const result = await client.execute({ sql, args });
    return result.rows;
  },

  async run(sql, ...args) {
    const result = await client.execute({ sql, args });
    return {
      changes: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : undefined,
    };
  },

  async exec(sql) {
    return await client.execute(sql);
  },

  async batch(stmts) {
    return await client.batch(stmts, 'write');
  },

  // Interactive transaction: await db.transaction(async (tx) => { ... })
  async transaction(fn) {
    const tx = await client.transaction('write');
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

// ── Schema initialisation (async) ──────────────────────────────────

async function initDatabase() {
  console.log('🗄️  Initializing database... [BUILD v3.0 - Turso]');

  await db.exec('PRAGMA foreign_keys = ON');

  // ── Tables ───────────────────────────────────────────────────────

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      character_name TEXT NOT NULL,
      character_class TEXT NOT NULL,
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  // Auction tie-breaking rolls
  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  await db.exec(`
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

  // ── Boss Statistics Feature Tables ──────────────────────────────────

  // WCL Zones (Raids) - persistent historical data
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wcl_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wcl_zone_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      expansion TEXT,
      tier INTEGER,
      is_current INTEGER DEFAULT 1,
      boss_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bosses per zone
  await db.exec(`
    CREATE TABLE IF NOT EXISTS wcl_bosses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id INTEGER NOT NULL,
      wcl_encounter_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      boss_order INTEGER DEFAULT 0,
      mythic_trap_url TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (zone_id) REFERENCES wcl_zones(id) ON DELETE CASCADE
    )
  `);

  // Boss statistics (aggregated per difficulty)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS boss_statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      boss_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      total_kills INTEGER DEFAULT 0,
      total_wipes INTEGER DEFAULT 0,
      fastest_kill_ms INTEGER,
      avg_kill_time_ms INTEGER,
      total_kill_time_ms INTEGER DEFAULT 0,
      last_kill_date DATE,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(boss_id, difficulty),
      FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
    )
  `);

  // Player deaths per boss (the "shame board")
  await db.exec(`
    CREATE TABLE IF NOT EXISTS player_boss_deaths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      boss_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      total_deaths INTEGER DEFAULT 0,
      total_fights INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, boss_id, difficulty),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
    )
  `);

  // Track processed fights for deduplication
  await db.exec(`
    CREATE TABLE IF NOT EXISTS boss_stats_processed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_code TEXT NOT NULL,
      encounter_id INTEGER NOT NULL,
      fight_id INTEGER NOT NULL,
      difficulty TEXT,
      kill INTEGER DEFAULT 0,
      fight_time_ms INTEGER,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(report_code, encounter_id, fight_id)
    )
  `);

  // Recent kills log for display
  await db.exec(`
    CREATE TABLE IF NOT EXISTS boss_kill_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      boss_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      report_code TEXT NOT NULL,
      fight_id INTEGER NOT NULL,
      kill_time_ms INTEGER,
      kill_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
    )
  `);

  // Player performance per boss (damage, healing, damage taken)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS player_boss_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      boss_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      total_damage INTEGER DEFAULT 0,
      total_healing INTEGER DEFAULT 0,
      total_damage_taken INTEGER DEFAULT 0,
      total_potions_used INTEGER DEFAULT 0,
      fights_participated INTEGER DEFAULT 0,
      best_dps REAL DEFAULT 0,
      best_hps REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, boss_id, difficulty),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE
    )
  `);

  // Boss all-time records (top performers)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS boss_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      boss_id INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      record_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      value REAL NOT NULL,
      character_name TEXT NOT NULL,
      character_class TEXT,
      report_code TEXT,
      fight_id INTEGER,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(boss_id, difficulty, record_type),
      FOREIGN KEY (boss_id) REFERENCES wcl_bosses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ── Column migrations (for databases created before these columns) ──

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
    // WCL + Calendar integration migrations
    'ALTER TABLE warcraft_logs_processed ADD COLUMN raid_date DATE',
    'ALTER TABLE warcraft_logs_processed ADD COLUMN is_reverted INTEGER DEFAULT 0',
    'ALTER TABLE warcraft_logs_processed ADD COLUMN reverted_by INTEGER',
    'ALTER TABLE warcraft_logs_processed ADD COLUMN reverted_at DATETIME',
    'ALTER TABLE dkp_transactions ADD COLUMN wcl_report_id INTEGER',
    'ALTER TABLE dkp_transactions ADD COLUMN auction_id INTEGER',
    // Profile pictures
    'ALTER TABLE users ADD COLUMN avatar TEXT',
    // Auction tie-breaking
    'ALTER TABLE auctions ADD COLUMN was_tie INTEGER DEFAULT 0',
    'ALTER TABLE auctions ADD COLUMN winning_roll INTEGER',
    // Weekly Vault badge system
    'ALTER TABLE member_dkp ADD COLUMN weekly_vault_completed INTEGER DEFAULT 0',
    'ALTER TABLE member_dkp ADD COLUMN vault_completed_at DATETIME',
    'ALTER TABLE member_dkp ADD COLUMN vault_week TEXT',
    // Boss images
    'ALTER TABLE wcl_bosses ADD COLUMN image_url TEXT',
  ];

  for (const sql of columnMigrations) {
    try { await db.exec(sql); } catch (e) { /* column already exists */ }
  }

  // Migration: Recreate member_availability if it has the old schema
  try {
    const columns = await db.all('PRAGMA table_info(member_availability)');
    const hasWeekStart = columns.some(c => c.name === 'week_start');
    if (hasWeekStart) {
      console.log('⬆️  Migrating member_availability to new schema (raid_date)...');
      await db.exec('DROP TABLE member_availability');
      await db.exec(`
        CREATE TABLE member_availability (
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
      console.log('✅ member_availability migrated successfully');
    }
  } catch (e) {
    console.warn('Migration warning:', e.message);
  }

  // ── Indexes ──────────────────────────────────────────────────────

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_dkp_transactions_user ON dkp_transactions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_dkp_transactions_date ON dkp_transactions(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status)',
    'CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id)',
    'CREATE INDEX IF NOT EXISTS idx_raid_attendance_raid ON raid_attendance(raid_id)',
    'CREATE INDEX IF NOT EXISTS idx_raid_attendance_user ON raid_attendance(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_warcraftlogs_report_code ON warcraft_logs_processed(report_code)',
    'CREATE INDEX IF NOT EXISTS idx_member_availability_user ON member_availability(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_member_availability_date ON member_availability(raid_date)',
    'CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_dkp_transactions_wcl_report ON dkp_transactions(wcl_report_id)',
    'CREATE INDEX IF NOT EXISTS idx_warcraftlogs_raid_date ON warcraft_logs_processed(raid_date)',
    // Boss Statistics indexes
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
  ];

  for (const sql of indexes) {
    await db.exec(sql);
  }

  // ── Seed default data ────────────────────────────────────────────

  const configCount = await db.get('SELECT COUNT(*) as count FROM dkp_config');
  if (configCount.count === 0) {
    console.log('📝 Creating default DKP configuration...');
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
      await db.run('INSERT INTO dkp_config (config_key, config_value, description) VALUES (?, ?, ?)', key, value, desc);
    }
    console.log('✅ Default DKP configuration created');
  }

  const raidDaysCount = await db.get('SELECT COUNT(*) as count FROM raid_days');
  if (raidDaysCount.count === 0) {
    console.log('📝 Creating default raid days...');
    const days = [
      [1, 'Lunes', 1, '21:00'],
      [3, 'Miércoles', 1, '21:00'],
      [4, 'Jueves', 1, '21:00'],
    ];
    for (const [dow, name, active, time] of days) {
      await db.run('INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (?, ?, ?, ?)', dow, name, active, time);
    }
    console.log('✅ Default raid days created (Lunes, Miércoles, Jueves)');
  }

  // ── Data migrations ──────────────────────────────────────────────

  // Ensure raid days are Mon/Wed/Thu at 21:00
  const currentRaidDays = await db.all('SELECT day_of_week FROM raid_days WHERE is_active = 1 ORDER BY day_of_week');
  const currentDaySet = currentRaidDays.map(r => r.day_of_week).join(',');
  if (currentDaySet !== '1,3,4') {
    console.log('📝 Migrating raid days to Lunes/Miércoles/Jueves at 21:00...');
    await db.exec('DELETE FROM raid_days');
    await db.run('INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (?, ?, 1, ?)', 1, 'Lunes', '21:00');
    await db.run('INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (?, ?, 1, ?)', 3, 'Miércoles', '21:00');
    await db.run('INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (?, ?, 1, ?)', 4, 'Jueves', '21:00');
    console.log('✅ Raid days migrated');
  }

  // Migrate existing users into characters table (one-time)
  const charCount = await db.get('SELECT COUNT(*) as count FROM characters');
  if (charCount.count === 0) {
    const existingUsers = await db.all('SELECT id, character_name, character_class, spec, raid_role FROM users WHERE is_active = 1');
    if (existingUsers.length > 0) {
      console.log(`📝 Migrating ${existingUsers.length} users to characters table...`);
      for (const u of existingUsers) {
        await db.run(
          'INSERT INTO characters (user_id, character_name, character_class, spec, raid_role, is_primary) VALUES (?, ?, ?, ?, ?, 1)',
          u.id, u.character_name, u.character_class, u.spec || null, u.raid_role || 'DPS'
        );
      }
      console.log('✅ Characters migration complete');
    }
  }

  // Ensure calendar DKP reward is +1
  const calDkp = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'");
  if (calDkp && calDkp.config_value !== '1') {
    await db.run("UPDATE dkp_config SET config_value = '1' WHERE config_key = 'calendar_dkp_per_day'");
    console.log('✅ Calendar DKP reward updated to +1');
  }

  // Ensure DKP economy configs exist
  const newConfigs = [
    ['weekly_vault_dkp', '10', 'DKP otorgado por completar el vault semanal'],
    ['dkp_cap', '250', 'Máximo de DKP que puede acumular un jugador'],
    ['raid_attendance_dkp', '5', 'DKP por asistencia a raid (por día)'],
  ];
  for (const [key, value, desc] of newConfigs) {
    const exists = await db.get('SELECT 1 FROM dkp_config WHERE config_key = ?', key);
    if (!exists) {
      await db.run('INSERT INTO dkp_config (config_key, config_value, description) VALUES (?, ?, ?)', key, value, desc);
      console.log(`✅ Added config: ${key} = ${value}`);
    }
  }

  // Update raid_attendance_dkp to new value if it's the old 50
  const raidDkp = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'raid_attendance_dkp'");
  if (raidDkp && raidDkp.config_value === '50') {
    await db.run("UPDATE dkp_config SET config_value = '5', description = 'DKP por asistencia a raid (por día)' WHERE config_key = 'raid_attendance_dkp'");
    console.log('✅ Raid attendance DKP updated to +5 per day');
  }

  console.log('✅ Database initialized successfully');
}

// Helper function for decay calculations
function calculateDecay(currentDkp, decayPercentage, minDkp = 0) {
  const decayAmount = Math.floor(currentDkp * (decayPercentage / 100));
  return Math.max(minDkp, currentDkp - decayAmount);
}

export { db, initDatabase, calculateDecay };
