import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, db, setupTestDb, cleanupTestDb, createTestUser, setUserDkp, expectSuccess, expectError } from './helpers.js';

describe('Auctions — /api/auctions', () => {
  let adminToken, adminId;
  let officerToken, officerId;
  let userToken, userId;
  let otherToken, otherId;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    const officer = await createTestUser({ role: 'officer' });
    const user = await createTestUser({ role: 'raider' });
    const other = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    adminId = admin.userId;
    officerToken = officer.token;
    officerId = officer.userId;
    userToken = user.token;
    userId = user.userId;
    otherToken = other.token;
    otherId = other.userId;

    // Give users some DKP so they can bid
    await setUserDkp(userId, 100);
    await setUserDkp(otherId, 50);
    await setUserDkp(adminId, 200);
    await setUserDkp(officerId, 150);
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── POST /api/auctions (create) ─────────────────────────────────

  describe('POST /api/auctions', () => {
    it('admin can create an auction', async () => {
      const res = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemName: 'Fyr\'alath the Dreamrender',
          itemRarity: 'legendary',
          minBid: 10,
          durationMinutes: 5,
        });

      const data = expectSuccess(res, 201);
      expect(data).toHaveProperty('id');
      expect(data.item_name).toBe('Fyr\'alath the Dreamrender');
      expect(data.status).toBe('active');
    });

    it('officer can create an auction', async () => {
      const res = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          itemName: 'Voice of the Silent Star',
          itemRarity: 'epic',
          durationMinutes: 3,
        });

      const data = expectSuccess(res, 201);
      expect(data.status).toBe('active');
    });

    it('raider cannot create an auction (403)', async () => {
      const res = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ itemName: 'Nope' });

      expectError(res, 403);
    });

    it('requires item name', async () => {
      const res = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemRarity: 'epic' });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/item name is required/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/auctions')
        .send({ itemName: 'No Auth' });

      expectError(res, 401);
    });
  });

  // ── GET /api/auctions/active ─────────────────────────────────────

  describe('GET /api/auctions/active', () => {
    it('returns active auctions with auth', async () => {
      const res = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('auctions');
      expect(Array.isArray(data.auctions)).toBe(true);
      expect(data.auctions.length).toBeGreaterThanOrEqual(1);
      expect(data).toHaveProperty('availableDkp');
    });

    it('each auction has expected shape', async () => {
      const res = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      const auction = data.auctions[0];
      expect(auction).toHaveProperty('id');
      expect(auction).toHaveProperty('itemName');
      expect(auction).toHaveProperty('status', 'active');
      expect(auction).toHaveProperty('endsAt');
      expect(auction).toHaveProperty('bids');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/auctions/active');
      expectError(res, 401);
    });
  });

  // ── POST /api/auctions/:id/bid ──────────────────────────────────

  describe('POST /api/auctions/:id/bid', () => {
    let auctionId;

    beforeAll(async () => {
      // Create a fresh auction for bidding tests
      const auctionRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemName: 'Bid Test Item',
          itemRarity: 'epic',
          minBid: 5,
          durationMinutes: 10,
        });
      auctionId = auctionRes.body.data.id;
    });

    it('user can place a bid', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 20 });

      expectSuccess(res);
      expect(res.body.message).toMatch(/bid placed/i);
    });

    it('another user can outbid with higher amount', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 30 });

      expectSuccess(res);
      expect(res.body.message).toMatch(/bid placed/i);
    });

    it('rejects bid lower than current highest', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ amount: 10 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/higher than current highest/i);
    });

    it('rejects insufficient DKP', async () => {
      // otherId only has 50 DKP; bidding 999 should fail
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 999 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/insufficient dkp/i);
    });

    it('rejects bid of zero or less', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 0 });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/at least 1 dkp/i);
    });

    it('returns 404 for non-existent auction', async () => {
      const res = await request
        .post('/api/auctions/99999/bid')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 10 });

      const msg = expectError(res, 404);
      expect(msg).toMatch(/auction not found/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .send({ amount: 10 });

      expectError(res, 401);
    });
  });

  // ── POST /api/auctions/:id/end ──────────────────────────────────

  describe('POST /api/auctions/:id/end', () => {
    let endAuctionId;

    beforeAll(async () => {
      // Create auction and place a bid
      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'End Test Item', itemRarity: 'epic', durationMinutes: 10 });
      endAuctionId = aRes.body.data.id;

      await request
        .post(`/api/auctions/${endAuctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 15 });
    });

    it('officer can end an auction', async () => {
      const res = await request
        .post(`/api/auctions/${endAuctionId}/end`)
        .set('Authorization', `Bearer ${officerToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('winner');
      expect(data.winner).not.toBeNull();
      expect(data.winner.userId).toBe(userId);
      expect(data.winner.amount).toBe(15);
    });

    it('raider cannot end an auction (403)', async () => {
      // Create another auction
      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'No End For You', durationMinutes: 10 });

      const res = await request
        .post(`/api/auctions/${aRes.body.data.id}/end`)
        .set('Authorization', `Bearer ${userToken}`);

      expectError(res, 403);
    });

    it('returns 404 for already ended auction', async () => {
      const res = await request
        .post(`/api/auctions/${endAuctionId}/end`)
        .set('Authorization', `Bearer ${adminToken}`);

      const msg = expectError(res, 404);
      expect(msg).toMatch(/auction not found/i);
    });
  });

  // ── GET /api/auctions/history ────────────────────────────────────

  describe('GET /api/auctions/history', () => {
    it('returns completed/cancelled auctions', async () => {
      const res = await request
        .get('/api/auctions/history')
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);

      const completed = data.find((a) => a.status === 'completed');
      expect(completed).toBeDefined();
      expect(completed.winning_bid).toBeGreaterThan(0);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/auctions/history');
      expectError(res, 401);
    });
  });

  // ── POST /api/auctions/:id/cancel ───────────────────────────────

  describe('POST /api/auctions/:id/cancel', () => {
    let cancelAuctionId;

    beforeAll(async () => {
      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'Cancel Me', durationMinutes: 10 });
      cancelAuctionId = aRes.body.data.id;
    });

    it('officer can cancel an auction', async () => {
      const res = await request
        .post(`/api/auctions/${cancelAuctionId}/cancel`)
        .set('Authorization', `Bearer ${officerToken}`);

      expectSuccess(res);
      expect(res.body.message).toMatch(/cancelled/i);
    });

    it('raider cannot cancel an auction (403)', async () => {
      // Create another to try
      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'No Cancel', durationMinutes: 10 });

      const res = await request
        .post(`/api/auctions/${aRes.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expectError(res, 403);
    });
  });

  // ── POST /api/auctions/cancel-all ────────────────────────────────
  describe('POST /api/auctions/cancel-all', () => {
    beforeAll(async () => {
      // Create a couple of active auctions
      await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'Cancel All Item 1', durationMinutes: 10 });
      await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'Cancel All Item 2', durationMinutes: 10 });
    });

    it('admin can cancel all active auctions', async () => {
      const res = await request
        .post('/api/auctions/cancel-all')
        .set('Authorization', `Bearer ${adminToken}`);

      expectSuccess(res);
      expect(res.body.message).toMatch(/cancelled/i);

      // Verify no active auctions remain
      const activeRes = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);
      const activeData = expectSuccess(activeRes);
      expect(activeData.auctions.length).toBe(0);
    });

    it('officer cannot cancel all (403)', async () => {
      const res = await request
        .post('/api/auctions/cancel-all')
        .set('Authorization', `Bearer ${officerToken}`);

      expectError(res, 403);
    });

    it('raider cannot cancel all (403)', async () => {
      const res = await request
        .post('/api/auctions/cancel-all')
        .set('Authorization', `Bearer ${userToken}`);

      expectError(res, 403);
    });
  });

  // ── GET /api/auctions/:auctionId/rolls ────────────────────────────
  describe('GET /api/auctions/:auctionId/rolls', () => {
    let tieAuctionId;

    beforeAll(async () => {
      // Create an auction with a tie to generate rolls
      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'Tie Roll Item', durationMinutes: 10 });
      tieAuctionId = aRes.body.data.id;

      // Reset DKP for consistent bidding
      await setUserDkp(userId, 100);
      await setUserDkp(otherId, 100);

      // Insert tied bids directly via DB (API rejects equal bids)
      await db.run(
        'INSERT INTO auction_bids (auction_id, user_id, amount) VALUES (?, ?, ?)',
        tieAuctionId, userId, 30
      );
      await db.run(
        'INSERT INTO auction_bids (auction_id, user_id, amount) VALUES (?, ?, ?)',
        tieAuctionId, otherId, 30
      );

      // End auction — should trigger tie-breaking rolls
      await request
        .post(`/api/auctions/${tieAuctionId}/end`)
        .set('Authorization', `Bearer ${adminToken}`);
    });

    it('returns rolls for a completed auction', async () => {
      const res = await request
        .get(`/api/auctions/${tieAuctionId}/rolls`)
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      // Rolls exist because of the tie
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('roll');
      expect(data[0]).toHaveProperty('isWinner');
    });

    it('returns empty for auction without rolls', async () => {
      // Find the 'End Test Item' auction from earlier (no tie)
      const histRes = await request
        .get('/api/auctions/history?limit=10')
        .set('Authorization', `Bearer ${userToken}`);
      const histData = expectSuccess(histRes);
      const noTie = histData.find(a => a.item_name === 'End Test Item');

      if (noTie) {
        const res = await request
          .get(`/api/auctions/${noTie.id}/rolls`)
          .set('Authorization', `Bearer ${userToken}`);

        const data = expectSuccess(res);
        expect(data).toEqual([]);
      }
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`/api/auctions/${tieAuctionId}/rolls`);
      expectError(res, 401);
    });
  });

  // ── GET /api/auctions/:auctionId/bids ─────────────────────────────
  describe('GET /api/auctions/:auctionId/bids', () => {
    let bidHistoryAuctionId;

    beforeAll(async () => {
      await setUserDkp(userId, 200);
      await setUserDkp(otherId, 200);

      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'Bid History Item', durationMinutes: 10 });
      bidHistoryAuctionId = aRes.body.data.id;

      await request
        .post(`/api/auctions/${bidHistoryAuctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 10 });
      await request
        .post(`/api/auctions/${bidHistoryAuctionId}/bid`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 20 });
    });

    it('returns bids for an auction', async () => {
      const res = await request
        .get(`/api/auctions/${bidHistoryAuctionId}/bids`)
        .set('Authorization', `Bearer ${userToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);
      // Sorted by amount DESC
      expect(data[0].amount).toBeGreaterThanOrEqual(data[1].amount);
      expect(data[0]).toHaveProperty('characterName');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`/api/auctions/${bidHistoryAuctionId}/bids`);
      expectError(res, 401);
    });
  });

  // ── Race conditions ──────────────────────────────────────────────
  describe('Race conditions', () => {
    it('handles concurrent bids on the same auction', async () => {
      await setUserDkp(userId, 200);
      await setUserDkp(otherId, 200);

      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'Race Condition Item', durationMinutes: 10 });
      const raceAuctionId = aRes.body.data.id;

      // Place initial bid
      await request
        .post(`/api/auctions/${raceAuctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 10 });

      // Two concurrent bids — one should succeed and one should fail
      const [bid1, bid2] = await Promise.all([
        request
          .post(`/api/auctions/${raceAuctionId}/bid`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ amount: 20 }),
        request
          .post(`/api/auctions/${raceAuctionId}/bid`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ amount: 20 }),
      ]);

      // At least one should succeed
      const statuses = [bid1.status, bid2.status];
      expect(statuses).toContain(200);
    });
  });
});
