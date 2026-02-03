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
  ];

  for (const sql of indexes) {
    await db.exec(sql);
  }

  // ── Seed default data ────────────────────────────────────────────

  const configCount = await db.get('SELECT COUNT(*) as count FROM dkp_config');
  if (configCount.count === 0) {
    console.log('📝 Creating default DKP configuration...');
    const configs = [
      ['raid_attendance_dkp', '50', 'DKP base por asistencia a raid'],
      ['boss_kill_bonus', '10', 'DKP bonus adicional por cada boss derrotado'],
      ['default_server', 'Ragnaros', 'Servidor por defecto de la guild'],
      ['auto_assign_enabled', 'false', 'Asignar DKP automáticamente (sin confirmación)'],
      ['calendar_dkp_per_day', '1', 'DKP otorgado por cada día de calendario completado'],
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

  // Ensure calendar DKP reward is +1
  const calDkp = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'");
  if (calDkp && calDkp.config_value !== '1') {
    await db.run("UPDATE dkp_config SET config_value = '1' WHERE config_key = 'calendar_dkp_per_day'");
    console.log('✅ Calendar DKP reward updated to +1');
  }

  console.log('✅ Database initialized successfully');
}

// Helper function for decay calculations
function calculateDecay(currentDkp, decayPercentage, minDkp = 0) {
  const decayAmount = Math.floor(currentDkp * (decayPercentage / 100));
  return Math.max(minDkp, currentDkp - decayAmount);
}

export { db, initDatabase, calculateDecay };
