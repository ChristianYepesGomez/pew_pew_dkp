import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, db, setupTestDb, cleanupTestDb, createTestUser, createTestAuction, setUserDkp, expectSuccess, expectError } from './helpers.js';

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
      expect(msg).toMatch(/at least equal to the current highest bid/i);
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
      expect(msg).toMatch(/at least 5 dkp/i);
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
      // Sorted by created_at DESC (most recent first)
      expect(data[0]).toHaveProperty('characterName');
      expect(data[0]).toHaveProperty('amount');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`/api/auctions/${bidHistoryAuctionId}/bids`);
      expectError(res, 401);
    });
  });

  // ── Committed DKP across multiple auctions (Ryomancer bug) ─────
  describe('Committed DKP — multi-auction scenarios', () => {
    let auctionA, auctionB, auctionC;

    beforeAll(async () => {
      // Cancel all active auctions to isolate this test group
      await request.post('/api/auctions/cancel-all').set('Authorization', `Bearer ${adminToken}`);

      // Fresh DKP for all users
      await setUserDkp(userId, 50);
      await setUserDkp(otherId, 50);
      await setUserDkp(officerId, 100);

      // Create 3 auctions
      const [a, b, c] = await Promise.all([
        createTestAuction(adminToken, { itemName: 'Multi-DKP Item A', durationMinutes: 10 }),
        createTestAuction(adminToken, { itemName: 'Multi-DKP Item B', durationMinutes: 10 }),
        createTestAuction(adminToken, { itemName: 'Multi-DKP Item C', durationMinutes: 10 }),
      ]);
      auctionA = a;
      auctionB = b;
      auctionC = c;
    });

    it('user with 50 DKP can bid 30 on auction A', async () => {
      const res = await request
        .post(`/api/auctions/${auctionA.id}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 30 });
      expectSuccess(res);
    });

    it('same user can bid 20 on auction B (50 - 30 committed = 20 available)', async () => {
      const res = await request
        .post(`/api/auctions/${auctionB.id}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 20 });
      expectSuccess(res);
    });

    it('same user CANNOT bid 5 on auction C (50 - 30 - 20 = 0 available)', async () => {
      const res = await request
        .post(`/api/auctions/${auctionC.id}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 5 });
      expectError(res, 400);
    });

    it('availableDkp on /active reflects committed bids', async () => {
      const res = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);
      const data = expectSuccess(res);
      // 50 total - 30 (A) - 20 (B) = 0
      expect(data.availableDkp).toBe(0);
    });

    it('user can RAISE bid on auction A from 30 to 40 (excludes own bid from committed)', async () => {
      await setUserDkp(userId, 60);

      // Now: 60 total, 30 on A, 20 on B. For auction A: committed = 20 (B only), available = 40.
      // Raising from 30 to 40 should succeed.
      const res = await request
        .post(`/api/auctions/${auctionA.id}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 40 });
      expectSuccess(res);
    });

    it('after raising bid A to 40, committed is now 40+20=60, availableDkp = 0', async () => {
      const res = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);
      const data = expectSuccess(res);
      expect(data.availableDkp).toBe(0);
    });

    it('committed DKP only counts highest bid per auction (not outbid amounts)', async () => {
      // Other user outbids on auction A with 45
      await setUserDkp(otherId, 100);
      await request
        .post(`/api/auctions/${auctionA.id}/bid`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 45 });

      // User's bid of 40 on A is no longer the highest → should NOT be committed
      // getCommittedBids only counts bids that equal the MAX for their auction
      // User should have: 60 total - 20 (B, still highest) = 40 available
      const res = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);
      const data = expectSuccess(res);
      expect(data.availableDkp).toBe(40);
    });
  });

  // ── Bid raise scenario (exact Ryomancer bug) ─────────────────
  describe('Bid raise — Ryomancer scenario', () => {
    beforeAll(async () => {
      // Clean slate: cancel all active auctions
      await request.post('/api/auctions/cancel-all').set('Authorization', `Bearer ${adminToken}`);
    });

    it('user with active bid can raise it even when availableDkp appears low', async () => {
      await setUserDkp(userId, 28);
      await setUserDkp(otherId, 100);

      // Create auction, user bids 15
      const auction = await createTestAuction(adminToken, { itemName: 'Alnwoven Riftbloom', durationMinutes: 10 });
      await request
        .post(`/api/auctions/${auction.id}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 15 });

      // Other bids 15 (tie)
      await request
        .post(`/api/auctions/${auction.id}/bid`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 15 });

      // User raises to 16 — backend excludes own auction from committed
      // Available = 28 - 0 (no other auctions) = 28 ≥ 16 ✓
      const res = await request
        .post(`/api/auctions/${auction.id}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 16 });

      expectSuccess(res);

      // Cleanup
      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('user with bid on 2 auctions cannot raise beyond available DKP', async () => {
      await setUserDkp(userId, 30);

      const auc1 = await createTestAuction(adminToken, { itemName: 'Raise Test 1', durationMinutes: 10 });
      const auc2 = await createTestAuction(adminToken, { itemName: 'Raise Test 2', durationMinutes: 10 });

      // Bid 15 on each
      await request.post(`/api/auctions/${auc1.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 15 });
      await request.post(`/api/auctions/${auc2.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 15 });

      // Total committed = 30, availableDkp = 0
      // Raising auc1 from 15 to 16: committed (excluding auc1) = 15, available = 30-15 = 15 < 16 → fail
      const fail = await request.post(`/api/auctions/${auc1.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 16 });
      expectError(fail, 400);

      // Cleanup
      await request.post('/api/auctions/cancel-all').set('Authorization', `Bearer ${adminToken}`);
    });
  });

  // ── Error message verification (400 not 500) ─────────────────
  describe('Error messages return 400, not 500', () => {
    beforeAll(async () => {
      await request.post('/api/auctions/cancel-all').set('Authorization', `Bearer ${adminToken}`);
    });

    it('bid below highest returns 400 with proper message', async () => {
      await setUserDkp(userId, 200);
      await setUserDkp(otherId, 200);

      const auction = await createTestAuction(adminToken, { itemName: 'Error Msg Test', durationMinutes: 10 });
      await request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 50 });

      // Other tries to bid less — has plenty of DKP so it should hit the bid-too-low error
      const res = await request
        .post(`/api/auctions/${auction.id}/bid`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 30 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least equal to the current highest bid/i);

      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('raising own bid to same amount returns 400 with proper message', async () => {
      await setUserDkp(userId, 200);

      const auction = await createTestAuction(adminToken, { itemName: 'Error Same Bid Test', durationMinutes: 10 });
      await request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 20 });

      const res = await request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 20 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/higher than your previous bid/i);

      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('insufficient DKP returns 400', async () => {
      await setUserDkp(otherId, 5);

      const auction = await createTestAuction(adminToken, { itemName: 'Insufficient DKP Test', durationMinutes: 10 });
      const res = await request
        .post(`/api/auctions/${auction.id}/bid`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ amount: 100 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient dkp/i);

      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });
  });

  // ── Reset auction endpoint ────────────────────────────────────
  describe('POST /api/auctions/:id/reset', () => {
    beforeAll(async () => {
      await request.post('/api/auctions/cancel-all').set('Authorization', `Bearer ${adminToken}`);
    });

    it('resets an active auction with bids — clears bids and restarts timer', async () => {
      await setUserDkp(userId, 100);
      await setUserDkp(otherId, 100);

      const auction = await createTestAuction(adminToken, { itemName: 'Reset Active Test', durationMinutes: 5 });
      await request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 30 });
      await request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${otherToken}`).send({ amount: 40 });

      // Reset
      const res = await request
        .post(`/api/auctions/${auction.id}/reset`)
        .set('Authorization', `Bearer ${adminToken}`);
      expectSuccess(res);

      // Verify active bids are gone (auction_bids table)
      const activeBids = await db.all('SELECT * FROM auction_bids WHERE auction_id = ?', auction.id);
      expect(activeBids).toEqual([]);

      // Verify auction is still active
      const activeRes = await request
        .get('/api/auctions/active')
        .set('Authorization', `Bearer ${userToken}`);
      const activeData = expectSuccess(activeRes);
      const resetAuction = activeData.auctions.find(a => a.id === auction.id);
      expect(resetAuction).toBeDefined();
      expect(resetAuction.status).toBe('active');

      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('resets a completed auction — refunds DKP to winner', async () => {
      // Cancel all to ensure no committed bids interfere
      await request.post('/api/auctions/cancel-all').set('Authorization', `Bearer ${adminToken}`);
      await setUserDkp(userId, 100);

      const auction = await createTestAuction(adminToken, { itemName: 'Reset Completed Test', durationMinutes: 5 });
      await request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 25 });

      // End the auction so user wins — DKP deducted
      await request.post(`/api/auctions/${auction.id}/end`).set('Authorization', `Bearer ${adminToken}`);

      // User DKP should have decreased by 25
      const dkpBefore = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
      expect(dkpBefore.current_dkp).toBe(75);

      // Reset — should refund
      const res = await request.post(`/api/auctions/${auction.id}/reset`).set('Authorization', `Bearer ${adminToken}`);
      expectSuccess(res);

      // DKP should be refunded
      const dkpAfter = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
      expect(dkpAfter.current_dkp).toBe(100);

      // Cleanup the now-active auction
      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('raider cannot reset (403)', async () => {
      const auction = await createTestAuction(adminToken, { itemName: 'No Reset For You', durationMinutes: 5 });
      const res = await request
        .post(`/api/auctions/${auction.id}/reset`)
        .set('Authorization', `Bearer ${userToken}`);
      expectError(res, 403);
      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('returns 404 for non-existent auction', async () => {
      const res = await request
        .post('/api/auctions/99999/reset')
        .set('Authorization', `Bearer ${adminToken}`);
      expectError(res, 404);
    });
  });

  // ── Race conditions ──────────────────────────────────────────────
  describe('Race conditions', () => {
    beforeAll(async () => {
      await request.post('/api/auctions/cancel-all').set('Authorization', `Bearer ${adminToken}`);
    });

    it('handles concurrent bids on the same auction', async () => {
      await setUserDkp(userId, 200);
      await setUserDkp(otherId, 200);

      const auction = await createTestAuction(adminToken, { itemName: 'Race Condition Item', durationMinutes: 10 });

      // Place initial bid
      await request
        .post(`/api/auctions/${auction.id}/bid`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 10 });

      // Two concurrent bids — both may succeed (ties allowed)
      const [bid1, bid2] = await Promise.all([
        request
          .post(`/api/auctions/${auction.id}/bid`)
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ amount: 20 }),
        request
          .post(`/api/auctions/${auction.id}/bid`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ amount: 20 }),
      ]);

      // At least one should succeed
      const statuses = [bid1.status, bid2.status];
      expect(statuses).toContain(200);

      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('concurrent bids from 4 users — all get valid bids', async () => {
      await setUserDkp(userId, 200);
      await setUserDkp(otherId, 200);
      await setUserDkp(adminId, 200);
      await setUserDkp(officerId, 200);

      const auction = await createTestAuction(adminToken, { itemName: 'Race 4 Users', durationMinutes: 10 });

      const results = await Promise.all([
        request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 50 }),
        request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${otherToken}`).send({ amount: 50 }),
        request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${adminToken}`).send({ amount: 50 }),
        request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${officerToken}`).send({ amount: 50 }),
      ]);

      // At least one should succeed
      const successes = results.filter(r => r.status === 200);
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // Verify each user has at most one bid
      const bidsRes = await request.get(`/api/auctions/${auction.id}/bids`).set('Authorization', `Bearer ${userToken}`);
      const bids = expectSuccess(bidsRes);
      const userIds = bids.map(b => b.userId);
      expect(new Set(userIds).size).toBe(userIds.length);

      await request.post(`/api/auctions/${auction.id}/cancel`).set('Authorization', `Bearer ${adminToken}`);
    });

    it('concurrent bid and end — auction ends up completed', async () => {
      await setUserDkp(userId, 200);
      await setUserDkp(otherId, 200);

      const auction = await createTestAuction(adminToken, { itemName: 'Race Bid+End', durationMinutes: 10 });
      await request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${userToken}`).send({ amount: 30 });

      // Concurrent: other bids while admin ends
      const [bidRes, endRes] = await Promise.all([
        request.post(`/api/auctions/${auction.id}/bid`).set('Authorization', `Bearer ${otherToken}`).send({ amount: 40 }),
        request.post(`/api/auctions/${auction.id}/end`).set('Authorization', `Bearer ${adminToken}`),
      ]);

      // The auction should end up completed (either end succeeded or bid+end both ran)
      const auctionRow = await db.get('SELECT status, winning_bid FROM auctions WHERE id = ?', auction.id);
      expect(auctionRow.status).toBe('completed');
      expect(auctionRow.winning_bid).toBeGreaterThan(0);
    });
  });
});
