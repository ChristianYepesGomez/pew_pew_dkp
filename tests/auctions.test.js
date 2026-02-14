import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp } from './helpers.js';

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

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.item_name).toBe('Fyr\'alath the Dreamrender');
      expect(res.body.status).toBe('active');
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

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('active');
    });

    it('raider cannot create an auction (403)', async () => {
      const res = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ itemName: 'Nope' });

      expect(res.status).toBe(403);
    });

    it('requires item name', async () => {
      const res = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemRarity: 'epic' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/item name is required/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/auctions')
        .send({ itemName: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/auctions/active ─────────────────────────────────────

  describe('GET /api/auctions/active', () => {
    it('returns active auctions with auth', async () => {
      const res = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('auctions');
      expect(Array.isArray(res.body.auctions)).toBe(true);
      expect(res.body.auctions.length).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('availableDkp');
    });

    it('each auction has expected shape', async () => {
      const res = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);

      const auction = res.body.auctions[0];
      expect(auction).toHaveProperty('id');
      expect(auction).toHaveProperty('itemName');
      expect(auction).toHaveProperty('status', 'active');
      expect(auction).toHaveProperty('endsAt');
      expect(auction).toHaveProperty('bids');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/auctions/active');
      expect(res.status).toBe(401);
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
      auctionId = auctionRes.body.id;
    });

    it('user can place a bid', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 20 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/bid placed/i);
    });

    it('another user can outbid with higher amount', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 30 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/bid placed/i);
    });

    it('rejects bid lower than current highest', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ amount: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/higher than current highest/i);
    });

    it('rejects insufficient DKP', async () => {
      // otherId only has 50 DKP; bidding 999 should fail
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 999 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient dkp/i);
    });

    it('rejects bid of zero or less', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 1 dkp/i);
    });

    it('returns 404 for non-existent auction', async () => {
      const res = await request
        .post('/api/auctions/99999/bid')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 10 });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/auction not found/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post(`/api/auctions/${auctionId}/bid`)
        .send({ amount: 10 });

      expect(res.status).toBe(401);
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
      endAuctionId = aRes.body.id;

      await request
        .post(`/api/auctions/${endAuctionId}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 15 });
    });

    it('officer can end an auction', async () => {
      const res = await request
        .post(`/api/auctions/${endAuctionId}/end`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('winner');
      expect(res.body.winner).not.toBeNull();
      expect(res.body.winner.userId).toBe(userId);
      expect(res.body.winner.amount).toBe(15);
    });

    it('raider cannot end an auction (403)', async () => {
      // Create another auction
      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'No End For You', durationMinutes: 10 });

      const res = await request
        .post(`/api/auctions/${aRes.body.id}/end`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 for already ended auction', async () => {
      const res = await request
        .post(`/api/auctions/${endAuctionId}/end`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/auction not found/i);
    });
  });

  // ── GET /api/auctions/history ────────────────────────────────────

  describe('GET /api/auctions/history', () => {
    it('returns completed/cancelled auctions', async () => {
      const res = await request
        .get('/api/auctions/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const completed = res.body.find((a) => a.status === 'completed');
      expect(completed).toBeDefined();
      expect(completed.winning_bid).toBeGreaterThan(0);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/auctions/history');
      expect(res.status).toBe(401);
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
      cancelAuctionId = aRes.body.id;
    });

    it('officer can cancel an auction', async () => {
      const res = await request
        .post(`/api/auctions/${cancelAuctionId}/cancel`)
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/cancelled/i);
    });

    it('raider cannot cancel an auction (403)', async () => {
      // Create another to try
      const aRes = await request
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemName: 'No Cancel', durationMinutes: 10 });

      const res = await request
        .post(`/api/auctions/${aRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });
});
