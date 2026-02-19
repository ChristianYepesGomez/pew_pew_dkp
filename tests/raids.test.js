import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

describe('Raids — /api/raids', () => {
  let adminToken;
  let officerToken, officerId;
  let userToken, userId;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    const officer = await createTestUser({ role: 'officer' });
    const user = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    officerToken = officer.token;
    officerId = officer.userId;
    userToken = user.token;
    userId = user.userId;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── POST /api/raids ──────────────────────────────────────────────

  describe('POST /api/raids', () => {
    it('officer can create a raid', async () => {
      const res = await request
        .post('/api/raids')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ name: 'Amirdrassil Heroic', scheduledAt: '2025-01-10T20:00:00Z', dkpReward: 15 });

      const data = expectSuccess(res, 201);
      expect(data).toHaveProperty('id');
      expect(res.body.message).toMatch(/raid created/i);
    });

    it('admin can create a raid', async () => {
      const res = await request
        .post('/api/raids')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Vault of the Incarnates', scheduledAt: '2025-01-11T20:00:00Z' });

      const data = expectSuccess(res, 201);
      expect(data).toHaveProperty('id');
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/raids')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Unauthorized Raid', scheduledAt: '2025-01-12T20:00:00Z' });

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/raids')
        .send({ name: 'No Auth Raid', scheduledAt: '2025-01-13T20:00:00Z' });

      expect(res.status).toBe(401);
    });

    it('uses default dkpReward of 10 when not specified', async () => {
      const res = await request
        .post('/api/raids')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ name: 'Default Reward Raid', scheduledAt: '2025-01-14T20:00:00Z' });

      expectSuccess(res, 201);
    });
  });

  // ── POST /api/raids/:raidId/attendance ───────────────────────────

  describe('POST /api/raids/:raidId/attendance', () => {
    let raidId;

    beforeAll(async () => {
      // Create a raid to record attendance for
      const res = await request
        .post('/api/raids')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ name: 'Attendance Test Raid', scheduledAt: '2025-01-15T20:00:00Z', dkpReward: 20 });

      raidId = res.body.data.id;
    });

    it('officer can record attendance', async () => {
      const res = await request
        .post(`/api/raids/${raidId}/attendance`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ attendees: [userId, officerId] });

      expectSuccess(res);
      expect(res.body.message).toMatch(/attendance recorded for 2 members/i);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post(`/api/raids/${raidId}/attendance`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ attendees: [userId] });

      expect(res.status).toBe(403);
    });

    it('invalid raidId (NaN) gets 400', async () => {
      const res = await request
        .post('/api/raids/abc/attendance')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ attendees: [userId] });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid raid id/i);
    });

    it('non-existent raidId gets 404', async () => {
      const res = await request
        .post('/api/raids/99999/attendance')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ attendees: [userId] });

      const msg = expectError(res, 404);
      expect(msg).toMatch(/raid not found/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post(`/api/raids/${raidId}/attendance`)
        .send({ attendees: [userId] });

      expect(res.status).toBe(401);
    });
  });
});
