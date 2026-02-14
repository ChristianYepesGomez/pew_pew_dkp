import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

describe('BIS wishlist — /api/bis', () => {
  let userAToken, userAId;
  let userBToken, userBId;

  // Shared item data
  const sampleItem = {
    item_id: 207160,
    item_name: 'Fyrakk\'s Tainted Rageheart',
    item_image: 'https://wow.example/item.jpg',
    item_rarity: 'legendary',
    item_slot: 'TRINKET_1',
    item_level: 496,
    boss_name: 'Fyrakk',
    raid_name: 'Amirdrassil',
    priority: 1,
    notes: 'BIS trinket for me',
  };

  beforeAll(async () => {
    await setupTestDb();
    const userA = await createTestUser({ role: 'raider' });
    const userB = await createTestUser({ role: 'raider' });
    userAToken = userA.token;
    userAId = userA.userId;
    userBToken = userB.token;
    userBId = userB.userId;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── POST /api/bis ────────────────────────────────────────────────

  describe('POST /api/bis', () => {
    it('adds an item to the user BIS list', async () => {
      const res = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(sampleItem);

      const data = expectSuccess(res, 201);
      expect(data).toHaveProperty('id');
      expect(data.item_id).toBe(sampleItem.item_id);
      expect(data.item_name).toBe(sampleItem.item_name);
      expect(data.user_id).toBe(userAId);
    });

    it('rejects duplicate item_id for the same user (409)', async () => {
      const res = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(sampleItem);

      const msg = expectError(res, 409);
      expect(msg).toMatch(/already in your bis/i);
    });

    it('different user can add the same item_id', async () => {
      const res = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userBToken}`)
        .send(sampleItem);

      const data = expectSuccess(res, 201);
      expect(data.user_id).toBe(userBId);
    });

    it('requires item_id and item_name', async () => {
      const res = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ notes: 'missing required fields' });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/item_id and item_name are required/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post('/api/bis').send(sampleItem);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/bis/my ──────────────────────────────────────────────

  describe('GET /api/bis/my', () => {
    it('returns the authenticated user BIS list', async () => {
      const res = await request
        .get('/api/bis/my')
        .set('Authorization', `Bearer ${userAToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].user_id).toBe(userAId);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/bis/my');
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/bis/:id ─────────────────────────────────────────────

  describe('PUT /api/bis/:id', () => {
    let bisItemId;

    beforeAll(async () => {
      // Add a second item for update tests
      const addRes = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          item_id: 207174,
          item_name: 'Blossom of Amirdrassil',
          item_rarity: 'epic',
          item_slot: 'TRINKET_2',
          priority: 2,
        });
      bisItemId = addRes.body.data.id;
    });

    it('owner can update priority, notes, obtained', async () => {
      const res = await request
        .put(`/api/bis/${bisItemId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ priority: 5, notes: 'Updated note', obtained: 1 });

      const data = expectSuccess(res);
      expect(data.priority).toBe(5);
      expect(data.notes).toBe('Updated note');
      expect(data.obtained).toBe(1);
    });

    it('another user cannot update someone else BIS item (403)', async () => {
      const res = await request
        .put(`/api/bis/${bisItemId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ priority: 99 });

      const msg = expectError(res, 403);
      expect(msg).toMatch(/not your bis item/i);
    });

    it('returns 404 for non-existent BIS item', async () => {
      const res = await request
        .put('/api/bis/99999')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ priority: 1 });

      const msg = expectError(res, 404);
      expect(msg).toMatch(/bis item not found/i);
    });

    it('returns 400 for invalid ID', async () => {
      const res = await request
        .put('/api/bis/abc')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ priority: 1 });

      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /api/bis/:id ──────────────────────────────────────────

  describe('DELETE /api/bis/:id', () => {
    let deleteItemId;
    let userBItemId;

    beforeAll(async () => {
      // Item for userA to delete
      const addRes = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          item_id: 207170,
          item_name: 'Dreambinder',
          item_rarity: 'epic',
          item_slot: 'MAIN_HAND',
        });
      deleteItemId = addRes.body.data.id;

      // Grab userB's existing item id for cross-user test
      const listRes = await request
        .get('/api/bis/my')
        .set('Authorization', `Bearer ${userBToken}`);
      userBItemId = listRes.body.data[0].id;
    });

    it('owner can delete their BIS item', async () => {
      const res = await request
        .delete(`/api/bis/${deleteItemId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expectSuccess(res);
      expect(res.body.message).toMatch(/removed/i);

      // Confirm it is gone
      const listRes = await request
        .get('/api/bis/my')
        .set('Authorization', `Bearer ${userAToken}`);
      const data = expectSuccess(listRes);
      const ids = data.map((i) => i.id);
      expect(ids).not.toContain(deleteItemId);
    });

    it('cannot delete another user BIS item (403)', async () => {
      const res = await request
        .delete(`/api/bis/${userBItemId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      const msg = expectError(res, 403);
      expect(msg).toMatch(/not your bis item/i);
    });

    it('returns 404 for non-existent BIS item', async () => {
      const res = await request
        .delete('/api/bis/99999')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid ID', async () => {
      const res = await request
        .delete('/api/bis/abc')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/bis/user/:userId ──────────────────────────────────
  describe('GET /api/bis/user/:userId', () => {
    it('returns another user BIS list', async () => {
      const res = await request
        .get(`/api/bis/user/${userBId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].user_id).toBe(userBId);
    });

    it('returns empty array for user with no BIS items', async () => {
      const newUser = await createTestUser();
      const res = await request
        .get(`/api/bis/user/${newUser.userId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      const data = expectSuccess(res);
      expect(data).toEqual([]);
    });

    it('rejects invalid userId (400)', async () => {
      const res = await request
        .get('/api/bis/user/abc')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`/api/bis/user/${userBId}`);
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /api/bis/reorder ───────────────────────────────────────
  describe('PUT /api/bis/reorder', () => {
    let itemIds;

    beforeAll(async () => {
      // Add more items for userA to reorder
      const item1 = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ item_id: 300001, item_name: 'Reorder Item 1', priority: 1 });
      const item2 = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ item_id: 300002, item_name: 'Reorder Item 2', priority: 2 });
      const item3 = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ item_id: 300003, item_name: 'Reorder Item 3', priority: 3 });

      itemIds = [item1.body.data.id, item2.body.data.id, item3.body.data.id];
    });

    it('reorders BIS items', async () => {
      const res = await request
        .put('/api/bis/reorder')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          items: [
            { id: itemIds[0], priority: 3 },
            { id: itemIds[1], priority: 1 },
            { id: itemIds[2], priority: 2 },
          ],
        });

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      // Verify the new order
      const reordered = data.filter(i => itemIds.includes(i.id));
      const item1 = reordered.find(i => i.id === itemIds[0]);
      const item2 = reordered.find(i => i.id === itemIds[1]);
      expect(item1.priority).toBe(3);
      expect(item2.priority).toBe(1);
    });

    it('rejects reordering another user items (403)', async () => {
      const res = await request
        .put('/api/bis/reorder')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          items: [{ id: itemIds[0], priority: 99 }],
        });

      const msg = expectError(res, 403);
      expect(msg).toMatch(/not yours/i);
    });

    it('rejects non-array input (400)', async () => {
      const res = await request
        .put('/api/bis/reorder')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ items: 'notanarray' });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .put('/api/bis/reorder')
        .send({ items: [{ id: itemIds[0], priority: 1 }] });

      expect(res.status).toBe(401);
    });
  });
});
