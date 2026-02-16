import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { createDbInterface } from './database.js';
import { createLogger } from './lib/logger.js';

const log = createLogger('PlatformDB');

// ── Platform database connection ────────────────────────────────
const platformUrl = process.env.PLATFORM_DATABASE_URL || 'file:./data/platform.db';
if (platformUrl.startsWith('file:')) {
  const filePath = platformUrl.replace('file:', '');
  const dir = dirname(filePath);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

const platformClient = createClient({
  url: platformUrl,
  authToken: process.env.PLATFORM_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
});

export const platformDb = createDbInterface(platformClient);

// ── Platform schema ─────────────────────────────────────────────

export async function initPlatformDatabase() {
  log.info('Initializing platform database');

  await platformDb.exec('PRAGMA foreign_keys = ON');

  await platformDb.exec(`
    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      realm TEXT,
      region TEXT DEFAULT 'eu',
      database_name TEXT NOT NULL,
      plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'premium')),
      created_at TEXT DEFAULT (datetime('now')),
      owner_id TEXT NOT NULL,
      discord_guild_id TEXT,
      settings TEXT DEFAULT '{}'
    )
  `);

  await platformDb.exec(`
    CREATE TABLE IF NOT EXISTS platform_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await platformDb.exec(`
    CREATE TABLE IF NOT EXISTS guild_memberships (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      role TEXT DEFAULT 'raider' CHECK(role IN ('admin', 'officer', 'raider')),
      character_name TEXT,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, guild_id),
      FOREIGN KEY (user_id) REFERENCES platform_users(id) ON DELETE CASCADE,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  await platformDb.exec('CREATE INDEX IF NOT EXISTS idx_guilds_slug ON guilds(slug)');
  await platformDb.exec('CREATE INDEX IF NOT EXISTS idx_guilds_owner ON guilds(owner_id)');
  await platformDb.exec('CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email)');
  await platformDb.exec('CREATE INDEX IF NOT EXISTS idx_guild_memberships_user ON guild_memberships(user_id)');
  await platformDb.exec('CREATE INDEX IF NOT EXISTS idx_guild_memberships_guild ON guild_memberships(guild_id)');

  log.info('Platform database initialized');
}
