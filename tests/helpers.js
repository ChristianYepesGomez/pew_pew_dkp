import { expect } from 'vitest';
import supertest from 'supertest';
import { app } from '../server.js';
import { db, initDatabase } from '../database.js';
import { initPlatformDatabase } from '../platformDb.js';

export const request = supertest(app);
export { db };

let dbInitialized = false;

export async function setupTestDb() {
  if (!dbInitialized) {
    await initPlatformDatabase();
    await initDatabase();
    dbInitialized = true;
  }
}

export async function cleanupTestDb() {
  const tables = [
    'auction_bids', 'auction_rolls', 'auctions',
    'bis_items',
    'dkp_transactions', 'member_availability',
    'refresh_tokens',
    'warcraft_logs_processed',
    'player_fight_performance', 'player_boss_performance', 'player_boss_deaths',
    'boss_records', 'boss_kill_log', 'boss_stats_processed', 'boss_statistics',
    'item_popularity',
    'calendar_dkp_rewards',
    'invite_codes',
    'push_subscriptions', 'notification_preferences',
    'loot_votes', 'loot_responses', 'loot_decisions',
    'epgp_transactions', 'member_epgp',
    'bot_config', 'discord_link_codes',
    'member_dkp', 'characters', 'users',
  ];
  for (const table of tables) {
    try {
      await db.run(`DELETE FROM ${table}`);
    } catch (_e) {
      // table might not exist yet
    }
  }
}

let userCounter = 0;

export async function createTestUser(overrides = {}) {
  userCounter++;
  const username = overrides.username || `testuser${userCounter}_${Date.now()}`;
  const password = overrides.password || 'testpass123';
  const email = overrides.email || `${username}@test.com`;

  const res = await request
    .post('/api/auth/register')
    .send({ username, password, email });

  if (res.status !== 201) {
    throw new Error(`Failed to create test user: ${res.body.error}`);
  }

  const userId = res.body.data.userId;

  // If a role override is specified, promote the user in the DB before login
  if (overrides.role && overrides.role !== 'raider') {
    await db.run('UPDATE users SET role = ? WHERE id = ?', overrides.role, userId);
  }

  // Login to get token (token will reflect the updated role)
  const loginRes = await request
    .post('/api/auth/login')
    .send({ username, password });

  return {
    userId,
    username,
    password,
    email,
    token: loginRes.body.data.token,
    user: loginRes.body.data.user,
  };
}

/**
 * Directly set a user's DKP in the database (useful for auction/bid tests).
 */
export async function setUserDkp(userId, amount) {
  await db.run(
    'UPDATE member_dkp SET current_dkp = ?, lifetime_gained = ? WHERE user_id = ?',
    amount, amount, userId
  );
}

/**
 * Create a test auction and return its ID.
 */
export async function createTestAuction(adminToken, itemData = {}) {
  const res = await request
    .post('/api/auctions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      itemName: itemData.itemName || 'Test Item',
      itemImage: itemData.itemImage || 'https://example.com/item.png',
      itemRarity: itemData.itemRarity || 'epic',
      itemId: itemData.itemId || 12345,
      minBid: itemData.minBid || 0,
      durationMinutes: itemData.durationMinutes || 5,
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test auction: ${res.body.error}`);
  }
  return res.body.data;
}

/**
 * Create a test character for a user.
 */
export async function createTestCharacter(userId, data = {}) {
  const charName = data.characterName || `TestChar_${Date.now()}`;
  const result = await db.run(`
    INSERT INTO characters (user_id, character_name, character_class, spec, raid_role, is_primary, realm, realm_slug)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, userId, charName, data.characterClass || 'Warrior', data.spec || 'Arms',
    data.raidRole || 'DPS', data.isPrimary ? 1 : 0, data.realm || 'Sanguino', data.realmSlug || 'sanguino');

  return { id: result.lastInsertRowid, characterName: charName };
}

/**
 * Assert a successful API response and return the data payload.
 */
export function expectSuccess(res, statusCode = 200) {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(true);
  return res.body.data;
}

/**
 * Assert an error API response and return the error message.
 */
export function expectError(res, statusCode) {
  expect(res.status).toBe(statusCode);
  expect(res.body.success).toBe(false);
  return res.body.error;
}
