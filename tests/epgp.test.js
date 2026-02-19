import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

describe('EPGP — /api/epgp', () => {
  let adminToken, adminId;
  let officerToken, officerId;
  let userToken, userId;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    const officer = await createTestUser({ role: 'officer' });
    const user = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    adminId = admin.userId;
    officerToken = officer.token;
    officerId = officer.userId;
    userToken = user.token;
    userId = user.userId;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── GET /api/epgp/standings ─────────────────────────────────────

  describe('GET /api/epgp/standings', () => {
    it('returns array of standings with auth', async () => {
      const res = await request
        .get('/api/epgp/standings')
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/epgp/standings');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/epgp/item-values ────────────────────────────────────

  describe('GET /api/epgp/item-values', () => {
    it('returns array of item values with auth', async () => {
      const res = await request
        .get('/api/epgp/item-values')
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/epgp/item-values');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/epgp/ep/award ──────────────────────────────────────

  describe('POST /api/epgp/ep/award', () => {
    it('officer can award EP to a user', async () => {
      const res = await request
        .post('/api/epgp/ep/award')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ userId, amount: 100, reason: 'Raid attendance' });

      expectSuccess(res);
      expect(res.body.message).toMatch(/100 ep awarded/i);
    });

    it('admin can award EP to multiple users', async () => {
      const res = await request
        .post('/api/epgp/ep/award')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [userId, officerId], amount: 50, reason: 'Bonus EP' });

      expectSuccess(res);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/epgp/ep/award')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId: adminId, amount: 100 });

      expect(res.status).toBe(403);
    });

    it('amount=0 gets 400', async () => {
      const res = await request
        .post('/api/epgp/ep/award')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ userId, amount: 0 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/positive amount/i);
    });

    it('negative amount gets 400', async () => {
      const res = await request
        .post('/api/epgp/ep/award')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ userId, amount: -10 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/positive amount/i);
    });

    it('missing userId gets 400', async () => {
      const res = await request
        .post('/api/epgp/ep/award')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ amount: 100 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/userid/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/epgp/ep/award')
        .send({ userId, amount: 100 });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/epgp/gp/charge ─────────────────────────────────────

  describe('POST /api/epgp/gp/charge', () => {
    it('officer can charge GP', async () => {
      const res = await request
        .post('/api/epgp/gp/charge')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ userId, amount: 50, reason: 'Item received' });

      const data = expectSuccess(res);
      expect(data).toHaveProperty('effortPoints');
      expect(data).toHaveProperty('gearPoints');
      expect(data).toHaveProperty('priority');
      expect(res.body.message).toMatch(/50 gp charged/i);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/epgp/gp/charge')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userId: adminId, amount: 50 });

      expect(res.status).toBe(403);
    });

    it('missing userId gets 400', async () => {
      const res = await request
        .post('/api/epgp/gp/charge')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ amount: 50 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/userid/i);
    });

    it('missing amount gets 400', async () => {
      const res = await request
        .post('/api/epgp/gp/charge')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ userId });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/positive amount/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/epgp/gp/charge')
        .send({ userId, amount: 50 });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/epgp/decay ─────────────────────────────────────────

  describe('POST /api/epgp/decay', () => {
    it('admin can apply EPGP decay', async () => {
      // First award some EP so decay has something to work with
      await request
        .post('/api/epgp/ep/award')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId, amount: 200, reason: 'Setup for decay test' });

      const res = await request
        .post('/api/epgp/decay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 10 });

      expectSuccess(res);
      expect(res.body.message).toMatch(/10% epgp decay/i);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/epgp/decay')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ percentage: 10 });

      expect(res.status).toBe(403);
    });

    it('officer gets 403 (admin only)', async () => {
      const res = await request
        .post('/api/epgp/decay')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ percentage: 10 });

      expect(res.status).toBe(403);
    });

    it('percentage=0 gets 400', async () => {
      const res = await request
        .post('/api/epgp/decay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 0 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid decay/i);
    });

    it('percentage=101 gets 400', async () => {
      const res = await request
        .post('/api/epgp/decay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 101 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid decay/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/epgp/decay')
        .send({ percentage: 10 });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/epgp/history/:userId ───────────────────────────────

  describe('GET /api/epgp/history/:userId', () => {
    it('user can view own EPGP history', async () => {
      const res = await request
        .get(`/api/epgp/history/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('effortPoints');
      expect(data).toHaveProperty('gearPoints');
      expect(data).toHaveProperty('priority');
      expect(data).toHaveProperty('transactions');
      expect(Array.isArray(data.transactions)).toBe(true);
    });

    it('officer can view another user EPGP history', async () => {
      const res = await request
        .get(`/api/epgp/history/${userId}`)
        .set('Authorization', `Bearer ${officerToken}`);

      const data = expectSuccess(res);
      expect(data.transactions.length).toBeGreaterThan(0);
    });

    it('raider cannot view another user EPGP history (403)', async () => {
      const res = await request
        .get(`/api/epgp/history/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const msg = expectError(res, 403);
      expect(msg).toMatch(/unauthorized/i);
    });

    it('invalid userId (NaN) gets 400', async () => {
      const res = await request
        .get('/api/epgp/history/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid user id/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`/api/epgp/history/${userId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/epgp/item-values/:id ────────────────────────────────

  describe('PUT /api/epgp/item-values/:id', () => {
    it('raider gets 403', async () => {
      const res = await request
        .put('/api/epgp/item-values/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ gpValue: 100 });

      expect(res.status).toBe(403);
    });

    it('invalid id (NaN) gets 400', async () => {
      const res = await request
        .put('/api/epgp/item-values/abc')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ gpValue: 100 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid item value id/i);
    });

    it('missing gpValue gets 400', async () => {
      const res = await request
        .put('/api/epgp/item-values/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      const msg = expectError(res, 400);
      expect(msg).toMatch(/gpvalue/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .put('/api/epgp/item-values/1')
        .send({ gpValue: 100 });

      expect(res.status).toBe(401);
    });

    it('admin can update item value when it exists (or get 404 if table is empty)', async () => {
      // Try to update item value id=1; it may or may not exist in test DB
      const res = await request
        .put('/api/epgp/item-values/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ gpValue: 150 });

      // Either 200 (updated) or 404 (not found) is valid — 500 is not
      expect([200, 404]).toContain(res.status);
    });
  });
});
