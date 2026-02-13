import supertest from 'supertest';
import { app } from '../server.js';
import { db, initDatabase } from '../database.js';

export const request = supertest(app);

let dbInitialized = false;

export async function setupTestDb() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

export async function cleanupTestDb() {
  const tables = [
    'auction_bids', 'auction_rolls', 'auctions',
    'dkp_transactions', 'member_availability',
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

  // Login to get token
  const loginRes = await request
    .post('/api/auth/login')
    .send({ username, password });

  return {
    userId: res.body.userId,
    username,
    password,
    email,
    token: loginRes.body.token,
    user: loginRes.body.user,
  };
}
