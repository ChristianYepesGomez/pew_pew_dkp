import crypto from 'crypto';
import { platformDb } from '../platformDb.js';
import { getTenantDb } from './tenantDb.js';
import { runMigrations } from '../database.js';
import { createLogger } from './logger.js';

const log = createLogger('Provisioning');

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Provision a new guild:
 * 1. Create guild record in platform DB
 * 2. Create tenant database (file-based in dev, Turso API in prod)
 * 3. Run migrations on the new guild DB
 * 4. Return the guild record
 */
export async function provisionGuild({ name, realm, region = 'eu', ownerId, discordGuildId = null, settings = {} }) {
  const id = crypto.randomUUID();
  const slug = generateSlug(name);
  const databaseName = `guild-${slug}-${id.slice(0, 8)}`;

  // Check slug uniqueness
  const existing = await platformDb.get('SELECT id FROM guilds WHERE slug = ?', slug);
  if (existing) {
    throw new Error('GUILD_SLUG_TAKEN');
  }

  // Create guild record in platform DB
  await platformDb.run(
    `INSERT INTO guilds (id, name, slug, realm, region, database_name, owner_id, discord_guild_id, settings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, name, slug, realm, region, databaseName, ownerId, discordGuildId, JSON.stringify(settings)
  );

  // Create and migrate tenant database
  const guildDb = getTenantDb(databaseName);
  await runMigrations(guildDb);

  log.info(`Provisioned guild "${name}" (${id}) with database ${databaseName}`);

  return {
    id,
    name,
    slug,
    realm,
    region,
    database_name: databaseName,
    plan: 'free',
    owner_id: ownerId,
    settings,
  };
}

/**
 * Delete a guild and its data.
 * In production, would also delete the Turso database via API.
 */
export async function deleteGuild(guildId) {
  const guild = await platformDb.get('SELECT * FROM guilds WHERE id = ?', guildId);
  if (!guild) throw new Error('GUILD_NOT_FOUND');

  // Remove memberships and guild record
  await platformDb.run('DELETE FROM guild_memberships WHERE guild_id = ?', guildId);
  await platformDb.run('DELETE FROM guilds WHERE id = ?', guildId);

  log.info(`Deleted guild ${guildId} (${guild.name})`);
  return guild;
}

/**
 * Get all guilds for startup iteration (seed data, schedule auctions, etc.)
 */
export async function getAllGuilds() {
  return platformDb.all('SELECT * FROM guilds ORDER BY created_at');
}
