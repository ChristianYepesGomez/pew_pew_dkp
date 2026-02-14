import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser } from './helpers.js';

// Mock all item services
vi.mock('../services/raidItems.js', () => ({
  getAllRaidItems: vi.fn(() => [
    { id: 1, name: 'Test Sword', raidName: 'Nerub-ar Palace', sourceType: 'raid' },
    { id: 2, name: 'Test Shield', raidName: 'Nerub-ar Palace', sourceType: 'raid' },
  ]),
  searchItems: vi.fn((q) => [
    { id: 1, name: `Test ${q}`, raidName: 'Nerub-ar Palace' },
  ]),
  getItemsByRaid: vi.fn((raidName) => [
    { id: 1, name: 'Boss Drop', raidName },
  ]),
  getAvailableRaids: vi.fn(() => ['Nerub-ar Palace', 'Blackrock Foundry']),
  getDataSourceStatus: vi.fn(() => ({
    source: 'cache',
    itemCount: 50,
    lastRefresh: new Date().toISOString(),
  })),
  refreshFromAPI: vi.fn(() => ({ success: true, count: 50 })),
  isAPIConfigured: vi.fn(() => true),
}));

vi.mock('../services/dungeonItems.js', () => ({
  getAllDungeonItems: vi.fn(async () => [
    { id: 100, name: 'Dungeon Ring', sourceType: 'dungeon' },
  ]),
}));

vi.mock('../services/itemPopularity.js', () => ({
  getPopularItems: vi.fn(() => [
    { item_id: 1, item_name: 'Popular Sword', usage_count: 15 },
  ]),
}));

const { isAPIConfigured } = await import('../services/raidItems.js');

describe('Items — /api', () => {
  let adminToken;
  let officerToken;
  let raiderToken;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    const admin = await createTestUser({ role: 'admin' });
    const officer = await createTestUser({ role: 'officer' });
    const raider = await createTestUser({ role: 'raider' });

    adminToken = admin.token;
    officerToken = officer.token;
    raiderToken = raider.token;
  });

  afterAll(async () => {
    await cleanupTestDb();
    vi.restoreAllMocks();
  });

  // ── GET /raid-items ──
  describe('GET /api/raid-items', () => {
    it('returns raid items for authenticated user', async () => {
      const res = await request
        .get('/api/raid-items')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('rejects unauthenticated (401)', async () => {
      const res = await request.get('/api/raid-items');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /raid-items/search ──
  describe('GET /api/raid-items/search', () => {
    it('searches items with query', async () => {
      const res = await request
        .get('/api/raid-items/search?q=Sword')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('returns all items without query', async () => {
      const res = await request
        .get('/api/raid-items/search')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });
  });

  // ── GET /raid-items/:raidName ──
  describe('GET /api/raid-items/:raidName', () => {
    it('returns items by raid name', async () => {
      const res = await request
        .get('/api/raid-items/Nerub-ar%20Palace')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
    });
  });

  // ── GET /raids-list ──
  describe('GET /api/raids-list', () => {
    it('returns available raids', async () => {
      const res = await request
        .get('/api/raids-list')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('raids');
      expect(Array.isArray(res.body.data.raids)).toBe(true);
    });
  });

  // ── GET /raid-items/status ──
  describe('GET /api/raid-items/status', () => {
    it('returns data source status for officer', async () => {
      const res = await request
        .get('/api/raid-items/status')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('source');
      expect(res.body.data).toHaveProperty('itemCount');
    });

    it('rejects raider (403)', async () => {
      const res = await request
        .get('/api/raid-items/status')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /raid-items/refresh ──
  describe('POST /api/raid-items/refresh', () => {
    it('refreshes items as admin', async () => {
      const res = await request
        .post('/api/raid-items/refresh')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/refreshed/i);
    });

    it('returns 400 when API not configured', async () => {
      isAPIConfigured.mockReturnValueOnce(false);

      const res = await request
        .post('/api/raid-items/refresh')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not configured/i);
    });

    it('rejects officer (403)', async () => {
      const res = await request
        .post('/api/raid-items/refresh')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── GET /dungeon-items ──
  describe('GET /api/dungeon-items', () => {
    it('returns dungeon items', async () => {
      const res = await request
        .get('/api/dungeon-items')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('count');
    });
  });

  // ── GET /all-items ──
  describe('GET /api/all-items', () => {
    it('returns combined raid + dungeon items', async () => {
      const res = await request
        .get('/api/all-items')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('count');
      expect(res.body.data.count).toBeGreaterThan(0);

      // Check sourceType tagging
      const sources = new Set(res.body.data.items.map(i => i.sourceType));
      expect(sources.has('raid')).toBe(true);
    });
  });

  // ── GET /item-popularity ──
  describe('GET /api/item-popularity', () => {
    it('returns popular items for a class', async () => {
      const res = await request
        .get('/api/item-popularity?class=Warrior')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('rejects missing class parameter (400)', async () => {
      const res = await request
        .get('/api/item-popularity')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/class/i);
    });

    it('supports optional spec and slot', async () => {
      const res = await request
        .get('/api/item-popularity?class=Warrior&spec=Arms&slot=HEAD')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
    });
  });
});
