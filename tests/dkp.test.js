import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp, expectSuccess, expectError } from './helpers.js';

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

      const data = expectSuccess(res);
      expect(res.body.message).toMatch(/dkp adjusted/i);
      expect(data.newDkp).toBe(50);
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

      const msg = expectError(res, 400);
      expect(msg).toMatch(/missing/i);
    });

    it('returns 404 for non-existent member', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 99999, amount: 10, reason: 'Ghost user' });

      const msg = expectError(res, 404);
      expect(msg).toMatch(/member not found/i);
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

      const data = expectSuccess(res);
      expect(data.newDkp).toBe(70);
    });

    it('DKP cannot go below zero', async () => {
      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: otherId, amount: -9999, reason: 'Big penalty' });

      const data = expectSuccess(res);
      expect(data.newDkp).toBe(0);
    });
  });

  // ── POST /api/dkp/bulk-adjust ────────────────────────────────────

  describe('POST /api/dkp/bulk-adjust', () => {
    it('admin can bulk adjust DKP for multiple users', async () => {
      const res = await request
        .post('/api/dkp/bulk-adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [userId, otherId], amount: 20, reason: 'Raid attendance' });

      expectSuccess(res);
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

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid request/i);
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

      const data = expectSuccess(res);
      expect(data).toHaveProperty('currentDkp');
      expect(data).toHaveProperty('lifetimeGained');
      expect(data).toHaveProperty('lifetimeSpent');
      expect(data).toHaveProperty('transactions');
      expect(Array.isArray(data.transactions)).toBe(true);
    });

    it('admin can view any user DKP history', async () => {
      const res = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const data = expectSuccess(res);
      expect(data.transactions.length).toBeGreaterThan(0);
    });

    it('raider cannot view another user DKP history', async () => {
      const res = await request
        .get(`/api/dkp/history/${adminId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      const msg = expectError(res, 403);
      expect(msg).toMatch(/unauthorized/i);
    });

    it('returns 400 for invalid userId', async () => {
      const res = await request
        .get('/api/dkp/history/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid user id/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`/api/dkp/history/${userId}`);
      expect(res.status).toBe(401);
    });

    it('transactions include expected fields', async () => {
      const res = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      if (data.transactions.length > 0) {
        const tx = data.transactions[0];
        expect(tx).toHaveProperty('id');
        expect(tx).toHaveProperty('amount');
        expect(tx).toHaveProperty('reason');
        expect(tx).toHaveProperty('createdAt');
      }
    });
  });

  // ── POST /api/dkp/decay ────────────────────────────────────────
  describe('POST /api/dkp/decay', () => {
    beforeAll(async () => {
      // Set known DKP values for decay testing
      await setUserDkp(userId, 100);
      await setUserDkp(otherId, 200);
    });

    it('admin can apply DKP decay', async () => {
      const res = await request
        .post('/api/dkp/decay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 25 });

      expectSuccess(res);
      expect(res.body.message).toMatch(/25% dkp decay applied/i);

      // Verify DKP was reduced
      const hist1 = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const data1 = expectSuccess(hist1);
      expect(data1.currentDkp).toBe(75); // 100 * 0.75 = 75

      const hist2 = await request
        .get(`/api/dkp/history/${otherId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const data2 = expectSuccess(hist2);
      expect(data2.currentDkp).toBe(150); // 200 * 0.75 = 150
    });

    it('creates transaction logs for each affected member', async () => {
      const hist = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const data = expectSuccess(hist);
      const decayTx = data.transactions.find(t => t.reason.includes('Decay'));
      expect(decayTx).toBeDefined();
      expect(decayTx.amount).toBeLessThan(0);
    });

    it('rejects invalid percentage (0)', async () => {
      const res = await request
        .post('/api/dkp/decay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 0 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid decay/i);
    });

    it('rejects percentage over 100', async () => {
      const res = await request
        .post('/api/dkp/decay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 101 });

      expect(res.status).toBe(400);
    });

    it('rejects missing percentage', async () => {
      const res = await request
        .post('/api/dkp/decay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('non-admin cannot apply decay (403)', async () => {
      const res = await request
        .post('/api/dkp/decay')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ percentage: 10 });

      expect(res.status).toBe(403);
    });
  });

  // ── Transaction integrity ──────────────────────────────────────
  describe('Transaction integrity', () => {
    it('DKP cap is enforced on positive adjustments', async () => {
      // Set DKP to 240 (cap is 250)
      await setUserDkp(userId, 240);

      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId, amount: 50, reason: 'Cap test' });

      const data = expectSuccess(res);
      // Should be capped at 250, not 290
      expect(data.newDkp).toBe(250);
    });

    it('DKP does not go below zero on negative adjustment', async () => {
      await setUserDkp(userId, 10);

      const res = await request
        .post('/api/dkp/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId, amount: -50, reason: 'Floor test' });

      const data = expectSuccess(res);
      expect(data.newDkp).toBe(0);
    });

    it('bulk adjust applies cap consistently', async () => {
      await setUserDkp(userId, 240);
      await setUserDkp(otherId, 100);

      await request
        .post('/api/dkp/bulk-adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [userId, otherId], amount: 50, reason: 'Bulk cap test' });

      // User should be capped at 250
      const hist1 = await request
        .get(`/api/dkp/history/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const data1 = expectSuccess(hist1);
      expect(data1.currentDkp).toBeLessThanOrEqual(250);

      // Other should get full 50 (100 + 50 = 150)
      const hist2 = await request
        .get(`/api/dkp/history/${otherId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const data2 = expectSuccess(hist2);
      expect(data2.currentDkp).toBe(150);
    });
  });
});
