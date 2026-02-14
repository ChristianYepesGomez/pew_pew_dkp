import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp, db } from './helpers.js';
import { MOCK_CHARACTER_EQUIPMENT, MOCK_CHARACTER_MEDIA, MOCK_EQUIPMENT_ERROR } from './mocks/blizzard.mock.js';

// Mock Blizzard API service
vi.mock('../services/blizzardAPI.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCharacterEquipment: vi.fn(),
    getCharacterMedia: vi.fn(),
    isBlizzardOAuthConfigured: vi.fn(() => true),
  };
});

const { getCharacterEquipment, getCharacterMedia, isBlizzardOAuthConfigured } = await import('../services/blizzardAPI.js');

describe('Armory — /api/armory', () => {
  let adminToken, adminId;
  let raiderToken, raiderId;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    const admin = await createTestUser({ role: 'admin' });
    const raider = await createTestUser({ role: 'raider' });

    adminToken = admin.token;
    adminId = admin.userId;
    raiderToken = raider.token;
    raiderId = raider.userId;

    await setUserDkp(raiderId, 50);

    // Create a completed auction to test loot history
    const auctionRes = await request
      .post('/api/auctions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ itemName: 'Sword of Testing', itemRarity: 'epic', itemId: 99001, durationMinutes: 5 });

    const auctionId = auctionRes.body.data.id;

    // Place a bid and end the auction so raider wins
    await request
      .post(`/api/auctions/${auctionId}/bid`)
      .set('Authorization', `Bearer ${raiderToken}`)
      .send({ amount: 10 });

    await request
      .post(`/api/auctions/${auctionId}/end`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  afterAll(async () => {
    await cleanupTestDb();
    vi.restoreAllMocks();
  });

  // ── GET /:userId/loot ──
  describe('GET /api/armory/:userId/loot', () => {
    it('returns loot history for a user', async () => {
      const res = await request
        .get(`/api/armory/${raiderId}/loot`)
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('itemName');
      expect(res.body.data[0]).toHaveProperty('dkpSpent');
      expect(res.body.data[0]).toHaveProperty('wonAt');
    });

    it('returns empty array for user with no loot', async () => {
      const res = await request
        .get(`/api/armory/${adminId}/loot`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('rejects unauthenticated (401)', async () => {
      const res = await request.get(`/api/armory/${raiderId}/loot`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /equipment/:realm/:character ──
  describe('GET /api/armory/equipment/:realm/:character', () => {
    it('returns character equipment', async () => {
      getCharacterEquipment.mockResolvedValueOnce(MOCK_CHARACTER_EQUIPMENT);

      const res = await request
        .get('/api/armory/equipment/sanguino/testwarrior')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('equipped_items');
    });

    it('returns 404 when character not found', async () => {
      getCharacterEquipment.mockResolvedValueOnce(MOCK_EQUIPMENT_ERROR);

      const res = await request
        .get('/api/armory/equipment/sanguino/nonexistent')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 503 when Blizzard API not configured', async () => {
      isBlizzardOAuthConfigured.mockReturnValueOnce(false);

      const res = await request
        .get('/api/armory/equipment/sanguino/test')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(503);
    });

    it('rejects unauthenticated (401)', async () => {
      const res = await request.get('/api/armory/equipment/sanguino/test');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /media/:realm/:character ──
  describe('GET /api/armory/media/:realm/:character', () => {
    it('returns character media', async () => {
      getCharacterMedia.mockResolvedValueOnce(MOCK_CHARACTER_MEDIA);

      const res = await request
        .get('/api/armory/media/sanguino/testwarrior')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('avatar');
      expect(res.body.data).toHaveProperty('render');
    });

    it('returns 404 when media not found', async () => {
      getCharacterMedia.mockResolvedValueOnce(null);

      const res = await request
        .get('/api/armory/media/sanguino/nonexistent')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 503 when Blizzard API not configured', async () => {
      isBlizzardOAuthConfigured.mockReturnValueOnce(false);

      const res = await request
        .get('/api/armory/media/sanguino/test')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(503);
    });
  });

  // ── GET /:userId/profile ──
  describe('GET /api/armory/:userId/profile', () => {
    it('returns member profile', async () => {
      const res = await request
        .get(`/api/armory/${raiderId}/profile`)
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', raiderId);
      expect(res.body.data).toHaveProperty('currentDkp');
      expect(res.body.data).toHaveProperty('lifetimeGained');
      expect(res.body.data).toHaveProperty('lifetimeSpent');
      expect(res.body.data).toHaveProperty('itemsWon');
      expect(res.body.data.itemsWon).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request
        .get('/api/armory/99999/profile')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(404);
    });

    it('rejects unauthenticated (401)', async () => {
      const res = await request.get(`/api/armory/${raiderId}/profile`);
      expect(res.status).toBe(401);
    });
  });
});
