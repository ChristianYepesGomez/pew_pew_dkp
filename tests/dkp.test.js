import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp } from './helpers.js';

describe('DKP adjustments — /api/dkp', () => {
  let adminToken, adminId;
  let userToken, userId;
  let otherToken, otherId;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    const user = await createTestUser({ role: 'raider' });
    const other = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    adminId = admin.userId;
    userToken = user.token;
    userId = user.userId;
    otherToken = other.token;
    otherId = other.userId;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── POST /api/dkp/adjust ─────────────────────────────────────────

  describe('POST /api/dkp/adjust', () => {
    it('admin can adjust DKP for a single user', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId, amount: 50, reason: 'Test reward' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/dkp adjusted/i);
      expect(res.body.newDkp).toBe(50);
    });

    it('non-admin/officer gets 403', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId: otherId, amount: 10, reason: 'Should fail' });

      expect(res.status).toBe(403);
    });

    it('requires userId and amount', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Missing fields' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing/i);
    });

    it('returns 404 for non-existent member', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 99999, amount: 10, reason: 'Ghost user' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/member not found/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .send({ userId, amount: 10 });

      expect(res.status).toBe(401);
    });

    it('can subtract DKP (negative amount)', async () => {
      // First give DKP
      await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: otherId, amount: 100, reason: 'Setup' });

      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: otherId, amount: -30, reason: 'Penalty' });

      expect(res.status).toBe(200);
      expect(res.body.newDkp).toBe(70);
    });

    it('DKP cannot go below zero', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: otherId, amount: -9999, reason: 'Big penalty' });

      expect(res.status).toBe(200);
      expect(res.body.newDkp).toBe(0);
    });
  });

  // ── POST /api/dkp/bulk-adjust ────────────────────────────────────

  describe('POST /api/dkp/bulk-adjust', () => {
    it('admin can bulk adjust DKP for multiple users', async () => {
      const res = await request
        .post('/api/dkp/bulk-adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [userId, otherId], amount: 20, reason: 'Raid attendance' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/dkp adjusted for 2 members/i);
    });

    it('non-admin/officer gets 403', async () => {
      const res = await request
        .post('/api/dkp/bulk-adjust')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userIds: [userId], amount: 10, reason: 'Should fail' });

      expect(res.status).toBe(403);
    });

    it('rejects missing userIds array', async () => {
      const res = await request
        .post('/api/dkp/bulk-adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid request/i);
    });

    it('rejects missing amount', async () => {
      const res = await request
        .post('/api/dkp/bulk-adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [userId] });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/dkp/history/:userId ─────────────────────────────────

  describe('GET /api/dkp/history/:userId', () => {
    it('user can view their own DKP history', async () => {
      const res = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currentDkp');
      expect(res.body).toHaveProperty('lifetimeGained');
      expect(res.body).toHaveProperty('lifetimeSpent');
      expect(res.body).toHaveProperty('transactions');
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });

    it('admin can view any user DKP history', async () => {
      const res = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.transactions.length).toBeGreaterThan(0);
    });

    it('raider cannot view another user DKP history', async () => {
      const res = await request
        .get(`/api/dkp/history/${adminId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it('returns 400 for invalid userId', async () => {
      const res = await request
        .get('/api/dkp/history/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid user id/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`/api/dkp/history/${userId}`);
      expect(res.status).toBe(401);
    });

    it('transactions include expected fields', async () => {
      const res = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      if (res.body.transactions.length > 0) {
        const tx = res.body.transactions[0];
        expect(tx).toHaveProperty('id');
        expect(tx).toHaveProperty('amount');
        expect(tx).toHaveProperty('reason');
        expect(tx).toHaveProperty('createdAt');
      }
    });
  });
});
