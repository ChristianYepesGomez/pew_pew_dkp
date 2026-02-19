import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

describe('Loot Council — /api/loot-council', () => {
  let adminToken;
  let officerToken, officerId;
  let userToken, userId;

  // Shared decision data
  const sampleDecision = {
    itemId: 207160,
    itemName: "Fyrakk's Tainted Rageheart",
    bossName: 'Fyrakk',
  };

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

  // ── POST /api/loot-council/decisions ────────────────────────────

  describe('POST /api/loot-council/decisions', () => {
    it('officer can create a loot decision', async () => {
      const res = await request
        .post('/api/loot-council/decisions')
        .set('Authorization', `Bearer ${officerToken}`)
        .send(sampleDecision);

      const data = expectSuccess(res, 201);
      expect(data).toHaveProperty('id');
      expect(data.item_name).toBe(sampleDecision.itemName);
    });

    it('admin can create a loot decision', async () => {
      const res = await request
        .post('/api/loot-council/decisions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...sampleDecision, itemName: 'Blossom of Amirdrassil' });

      expectSuccess(res, 201);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/loot-council/decisions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(sampleDecision);

      expect(res.status).toBe(403);
    });

    it('missing itemName gets 400', async () => {
      const res = await request
        .post('/api/loot-council/decisions')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ itemId: 207161 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/itemname/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/loot-council/decisions')
        .send(sampleDecision);

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/loot-council/decisions/active ───────────────────────

  describe('GET /api/loot-council/decisions/active', () => {
    it('returns array of active decisions with auth', async () => {
      const res = await request
        .get('/api/loot-council/decisions/active')
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/loot-council/decisions/active');
      expect(res.status).toBe(401);
    });
  });

  // ── Full lifecycle: respond, vote, award ─────────────────────────

  describe('Decision lifecycle', () => {
    let decisionId;

    beforeAll(async () => {
      // Create a fresh decision for lifecycle tests
      const res = await request
        .post('/api/loot-council/decisions')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ itemName: 'Lifecycle Test Item', itemId: 999999 });

      decisionId = res.body.data.id;
    });

    // ── POST /api/loot-council/decisions/:id/respond ────────────

    describe('POST /api/loot-council/decisions/:id/respond', () => {
      it('raider can respond with "bis"', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/respond`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ response: 'bis', note: 'This is my BIS' });

        const data = expectSuccess(res);
        expect(data).toHaveProperty('response');
        expect(data.response).toBe('bis');
      });

      it('can respond with "upgrade"', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/respond`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ response: 'upgrade' });

        expectSuccess(res);
      });

      it('can respond with "minor"', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/respond`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ response: 'minor' });

        expectSuccess(res);
      });

      it('can respond with "offspec"', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/respond`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ response: 'offspec' });

        expectSuccess(res);
      });

      it('can respond with "pass"', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/respond`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ response: 'pass' });

        expectSuccess(res);
      });

      it('invalid response type gets 400', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/respond`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ response: 'yolo' });

        const msg = expectError(res, 400);
        expect(msg).toMatch(/invalid response/i);
      });

      it('invalid id (NaN) gets 400', async () => {
        const res = await request
          .post('/api/loot-council/decisions/abc/respond')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ response: 'bis' });

        const msg = expectError(res, 400);
        expect(msg).toMatch(/invalid decision id/i);
      });

      it('returns 401 without auth', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/respond`)
          .send({ response: 'bis' });

        expect(res.status).toBe(401);
      });
    });

    // ── POST /api/loot-council/decisions/:id/vote ────────────────

    describe('POST /api/loot-council/decisions/:id/vote', () => {
      it('officer can vote on a candidate', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/vote`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ candidateId: userId, vote: 'approve' });

        expectSuccess(res);
      });

      it('raider gets 403', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/vote`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ candidateId: userId, vote: 'approve' });

        expect(res.status).toBe(403);
      });

      it('invalid id (NaN) gets 400', async () => {
        const res = await request
          .post('/api/loot-council/decisions/abc/vote')
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ candidateId: userId, vote: 'approve' });

        const msg = expectError(res, 400);
        expect(msg).toMatch(/invalid decision id/i);
      });

      it('missing candidateId gets 400', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/vote`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ vote: 'approve' });

        const msg = expectError(res, 400);
        expect(msg).toMatch(/candidateid/i);
      });

      it('returns 401 without auth', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/vote`)
          .send({ candidateId: userId, vote: 'approve' });

        expect(res.status).toBe(401);
      });
    });

    // ── POST /api/loot-council/decisions/:id/award ───────────────

    describe('POST /api/loot-council/decisions/:id/award', () => {
      it('officer can award item', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/award`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ winnerId: userId });

        const data = expectSuccess(res);
        expect(data).toHaveProperty('winnerId');
        expect(data.winnerId).toBe(userId);
      });

      it('raider gets 403', async () => {
        // Create a new decision since the previous one was awarded (closed)
        const newDecisionRes = await request
          .post('/api/loot-council/decisions')
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ itemName: 'Raider Forbidden Item', itemId: 888888 });

        const newDecisionId = newDecisionRes.body.data.id;

        const res = await request
          .post(`/api/loot-council/decisions/${newDecisionId}/award`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ winnerId: userId });

        expect(res.status).toBe(403);
      });

      it('invalid id (NaN) gets 400', async () => {
        const res = await request
          .post('/api/loot-council/decisions/abc/award')
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ winnerId: userId });

        const msg = expectError(res, 400);
        expect(msg).toMatch(/invalid decision id/i);
      });

      it('missing winnerId gets 400', async () => {
        // Create a new open decision
        const newDecisionRes = await request
          .post('/api/loot-council/decisions')
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ itemName: 'Missing Winner Item', itemId: 777777 });

        const newDecisionId = newDecisionRes.body.data.id;

        const res = await request
          .post(`/api/loot-council/decisions/${newDecisionId}/award`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send({});

        const msg = expectError(res, 400);
        expect(msg).toMatch(/winnerid/i);
      });

      it('returns 401 without auth', async () => {
        const res = await request
          .post(`/api/loot-council/decisions/${decisionId}/award`)
          .send({ winnerId: userId });

        expect(res.status).toBe(401);
      });
    });
  });

  // ── GET /api/loot-council/history ───────────────────────────────

  describe('GET /api/loot-council/history', () => {
    it('returns array of loot history with auth', async () => {
      const res = await request
        .get('/api/loot-council/history')
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/loot-council/history');
      expect(res.status).toBe(401);
    });
  });
});
