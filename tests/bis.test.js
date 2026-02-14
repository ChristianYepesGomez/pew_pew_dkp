import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser } from './helpers.js';

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

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.item_id).toBe(sampleItem.item_id);
      expect(res.body.item_name).toBe(sampleItem.item_name);
      expect(res.body.user_id).toBe(userAId);
    });

    it('rejects duplicate item_id for the same user (409)', async () => {
      const res = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(sampleItem);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already in your bis/i);
    });

    it('different user can add the same item_id', async () => {
      const res = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userBToken}`)
        .send(sampleItem);

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(userBId);
    });

    it('requires item_id and item_name', async () => {
      const res = await request
        .post('/api/bis')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ notes: 'missing required fields' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/item_id and item_name are required/i);
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

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].user_id).toBe(userAId);
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
      bisItemId = addRes.body.id;
    });

    it('owner can update priority, notes, obtained', async () => {
      const res = await request
        .put(`/api/bis/${bisItemId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ priority: 5, notes: 'Updated note', obtained: 1 });

      expect(res.status).toBe(200);
      expect(res.body.priority).toBe(5);
      expect(res.body.notes).toBe('Updated note');
      expect(res.body.obtained).toBe(1);
    });

    it('another user cannot update someone else BIS item (403)', async () => {
      const res = await request
        .put(`/api/bis/${bisItemId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ priority: 99 });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not your bis item/i);
    });

    it('returns 404 for non-existent BIS item', async () => {
      const res = await request
        .put('/api/bis/99999')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ priority: 1 });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/bis item not found/i);
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
      deleteItemId = addRes.body.id;

      // Grab userB's existing item id for cross-user test
      const listRes = await request
        .get('/api/bis/my')
        .set('Authorization', `Bearer ${userBToken}`);
      userBItemId = listRes.body[0].id;
    });

    it('owner can delete their BIS item', async () => {
      const res = await request
        .delete(`/api/bis/${deleteItemId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removed/i);

      // Confirm it is gone
      const listRes = await request
        .get('/api/bis/my')
        .set('Authorization', `Bearer ${userAToken}`);
      const ids = listRes.body.map((i) => i.id);
      expect(ids).not.toContain(deleteItemId);
    });

    it('cannot delete another user BIS item (403)', async () => {
      const res = await request
        .delete(`/api/bis/${userBItemId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not your bis item/i);
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
});
