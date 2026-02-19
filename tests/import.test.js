import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

describe('Import — /api/import', () => {
  let adminToken;
  let userToken;

  const sampleMembers = [
    {
      characterName: 'ImportedWarrior',
      characterClass: 'Warrior',
      raidRole: 'DPS',
      dkp: 100,
    },
    {
      characterName: 'ImportedPriest',
      characterClass: 'Priest',
      raidRole: 'Healer',
      dkp: 80,
    },
  ];

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    const user = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    userToken = user.token;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── POST /api/import/roster ──────────────────────────────────────

  describe('POST /api/import/roster', () => {
    it('admin can import members array', async () => {
      const res = await request
        .post('/api/import/roster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ members: sampleMembers });

      expectSuccess(res);
      expect(res.body.message).toMatch(/imported \d+ members/i);
    });

    it('second import of same members does not re-import (idempotent)', async () => {
      const res = await request
        .post('/api/import/roster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ members: sampleMembers });

      expectSuccess(res);
      // Should import 0 since all already exist
      expect(res.body.message).toMatch(/imported 0 members/i);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/import/roster')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ members: sampleMembers });

      expect(res.status).toBe(403);
    });

    it('non-array members gets 400', async () => {
      const res = await request
        .post('/api/import/roster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ members: 'not-an-array' });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid data format/i);
    });

    it('missing members field gets 400', async () => {
      const res = await request
        .post('/api/import/roster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid data format/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/import/roster')
        .send({ members: sampleMembers });

      expect(res.status).toBe(401);
    });

    it('empty array imports 0 members', async () => {
      const res = await request
        .post('/api/import/roster')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ members: [] });

      expectSuccess(res);
      expect(res.body.message).toMatch(/imported 0 members/i);
    });
  });
});
