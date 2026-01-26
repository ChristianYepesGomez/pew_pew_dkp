
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'dkp.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
try {
  mkdirSync(join(__dirname, 'data'), { recursive: true });
} catch (e) {}

const db = new Database(dbPath);

// Enable foreign keys and UTF-8
db.pragma('foreign_keys = ON');
db.pragma('encoding = "UTF-8"');

function initDatabase() {
  console.log('🗄️  Initializing database...');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      character_name TEXT NOT NULL,
      character_class TEXT NOT NULL,
      raid_role TEXT DEFAULT 'DPS' CHECK(raid_role IN ('Tank', 'Healer', 'DPS')),
      role TEXT DEFAULT 'raider' CHECK(role IN ('admin', 'officer', 'raider')),
      server TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add server column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN server TEXT`);
    console.log('✅ Added server column to users table');
  } catch (e) {
    // Column already exists
  }

  // Add spec column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN spec TEXT`);
    console.log('✅ Added spec column to users table');
  } catch (e) {
    // Column already exists
  }

  // Add email column for password reset (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
    console.log('✅ Added email column to users table');
  } catch (e) {
    // Column already exists
  }

  // Add reset_token columns for password reset (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT`);
    console.log('✅ Added reset_token column to users table');
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token_expires DATETIME`);
    console.log('✅ Added reset_token_expires column to users table');
  } catch (e) {
    // Column already exists
  }

  // Add item_name_en column to auctions if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE auctions ADD COLUMN item_name_en TEXT`);
    console.log('✅ Added item_name_en column to auctions table');
  } catch (e) {
    // Column already exists
  }

  // Add duration_minutes and ends_at columns for auction timer (migration)
  try {
    db.exec(`ALTER TABLE auctions ADD COLUMN duration_minutes INTEGER DEFAULT 5`);
    console.log('✅ Added duration_minutes column to auctions table');
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE auctions ADD COLUMN ends_at DATETIME`);
    console.log('✅ Added ends_at column to auctions table');
  } catch (e) {
    // Column already exists
  }

  // Member DKP table (separate for easier updates)
  db.exec(`
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

  // DKP Transactions log (audit trail)
  db.exec(`
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

  // Auctions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_image TEXT DEFAULT '🎁',
      item_rarity TEXT DEFAULT 'epic' CHECK(item_rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
      min_bid INTEGER DEFAULT 10,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      winner_id INTEGER,
      winning_bid INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Auction bids table
  db.exec(`
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

  // Raids table
  db.exec(`
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

  // Raid attendance table
  db.exec(`
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

  // Warcraft Logs processed reports (tracking)
  db.exec(`
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

  // DKP Configuration table
  db.exec(`
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

  // Raid Calendar - Define raid days for the week
  db.exec(`
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

  // Member availability for raid days
  db.exec(`
    CREATE TABLE IF NOT EXISTS member_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
      status TEXT DEFAULT 'tentative' CHECK(status IN ('confirmed', 'declined', 'tentative')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, week_start, day_of_week)
    )
  `);

  // Weekly DKP rewards tracking for calendar completion
  db.exec(`
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

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dkp_transactions_user ON dkp_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_dkp_transactions_date ON dkp_transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
    CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id);
    CREATE INDEX IF NOT EXISTS idx_raid_attendance_raid ON raid_attendance(raid_id);
    CREATE INDEX IF NOT EXISTS idx_raid_attendance_user ON raid_attendance(user_id);
    CREATE INDEX IF NOT EXISTS idx_warcraftlogs_report_code ON warcraft_logs_processed(report_code);
    CREATE INDEX IF NOT EXISTS idx_member_availability_user ON member_availability(user_id);
    CREATE INDEX IF NOT EXISTS idx_member_availability_week ON member_availability(week_start);
    CREATE INDEX IF NOT EXISTS idx_calendar_rewards_user ON calendar_dkp_rewards(user_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_rewards_week ON calendar_dkp_rewards(week_start);
  `);

  // Create default admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('📝 Creating default admin user...');
    
    // Default password is 'admin123' - CHANGE THIS IN PRODUCTION
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    
    const result = db.prepare(`
      INSERT INTO users (username, password, character_name, character_class, raid_role, spec, role)
      VALUES ('admin', ?, 'GuildMaster', 'Warrior', 'DPS', 'Arms', 'admin')
    `).run(hashedPassword);

    db.prepare(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained)
      VALUES (?, 50, 50)
    `).run(result.lastInsertRowid);

    console.log('✅ Default admin created (username: admin, password: admin123)');
  }

  // Create default DKP configuration if not exists
  const configCount = db.prepare('SELECT COUNT(*) as count FROM dkp_config').get();
  if (configCount.count === 0) {
    console.log('📝 Creating default DKP configuration...');

    const configs = [
      { key: 'raid_attendance_dkp', value: '50', description: 'DKP base por asistencia a raid' },
      { key: 'boss_kill_bonus', value: '10', description: 'DKP bonus adicional por cada boss derrotado' },
      { key: 'default_server', value: 'Ragnaros', description: 'Servidor por defecto de la guild' },
      { key: 'auto_assign_enabled', value: 'false', description: 'Asignar DKP automáticamente (sin confirmación)' },
      { key: 'calendar_dkp_per_day', value: '1', description: 'DKP otorgado por cada día de calendario completado' }
    ];

    const insertConfig = db.prepare(`
      INSERT INTO dkp_config (config_key, config_value, description)
      VALUES (?, ?, ?)
    `);

    for (const config of configs) {
      insertConfig.run(config.key, config.value, config.description);
    }

    console.log('✅ Default DKP configuration created');
  }

  // Create default raid days if not exists (Monday, Tuesday, Wednesday)
  const raidDaysCount = db.prepare('SELECT COUNT(*) as count FROM raid_days').get();
  if (raidDaysCount.count === 0) {
    console.log('📝 Creating default raid days...');

    const raidDays = [
      { day_of_week: 1, day_name: 'Lunes', is_active: 1, raid_time: '20:00' },
      { day_of_week: 2, day_name: 'Martes', is_active: 1, raid_time: '20:00' },
      { day_of_week: 3, day_name: 'Miércoles', is_active: 1, raid_time: '20:00' }
    ];

    const insertRaidDay = db.prepare(`
      INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time)
      VALUES (?, ?, ?, ?)
    `);

    for (const day of raidDays) {
      insertRaidDay.run(day.day_of_week, day.day_name, day.is_active, day.raid_time);
    }

    console.log('✅ Default raid days created (Lunes, Martes, Miércoles)');
  }

  console.log('✅ Database initialized successfully');
}

// Helper function for decay calculations
function calculateDecay(currentDkp, decayPercentage, minDkp = 0) {
  const decayAmount = Math.floor(currentDkp * (decayPercentage / 100));
  return Math.max(minDkp, currentDkp - decayAmount);
}

// Export database instance and functions
export { db, initDatabase, calculateDecay };
