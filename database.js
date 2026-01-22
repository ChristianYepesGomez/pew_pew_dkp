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

// Enable foreign keys
db.pragma('foreign_keys = ON');

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
      discord_id TEXT UNIQUE,
      discord_username TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add Discord columns if they don't exist (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN discord_id TEXT UNIQUE`);
    db.exec(`ALTER TABLE users ADD COLUMN discord_username TEXT`);
  } catch (e) {
    // Columns already exist, ignore error
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

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dkp_transactions_user ON dkp_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_dkp_transactions_date ON dkp_transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
    CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id);
    CREATE INDEX IF NOT EXISTS idx_raid_attendance_raid ON raid_attendance(raid_id);
    CREATE INDEX IF NOT EXISTS idx_raid_attendance_user ON raid_attendance(user_id);
  `);

  // Create default admin user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    console.log('📝 Creating default admin user...');
    
    // Default password is 'admin123' - CHANGE THIS IN PRODUCTION
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    
    const result = db.prepare(`
      INSERT INTO users (username, password, character_name, character_class, role)
      VALUES ('admin', ?, 'GuildMaster', 'Warrior', 'admin')
    `).run(hashedPassword);

    db.prepare(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained)
      VALUES (?, 0, 0)
    `).run(result.lastInsertRowid);

    console.log('✅ Default admin created (username: admin, password: admin123)');
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
