import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

describe('Routes: Health, Bosses, Analytics', () => {
  let adminToken;
  let raiderToken;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    const admin = await createTestUser({ role: 'admin' });
    adminToken = admin.token;

    const raider = await createTestUser({ role: 'raider' });
    raiderToken = raider.token;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── Health ────────────────────────────────────────

  describe('Health', () => {
    it('GET /health returns 200 with status, timestamp, and uptime', async () => {
      const res = await request.get('/health');

      const data = expectSuccess(res);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);
    });

    it('GET /health does NOT require auth', async () => {
      const res = await request.get('/health');

      const data = expectSuccess(res);
      expect(data.status).toBe('healthy');
    });

    it('GET /health has correct response shape', async () => {
      const res = await request.get('/health');

      const data = expectSuccess(res);
      expect(data).toEqual({
        status: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        uptime: expect.any(Number),
        checks: { database: expect.any(String) },
      });
    });
  });

  // ── Bosses ────────────────────────────────────────

  describe('Bosses', () => {
    it('GET /api/bosses requires auth (401 without token)', async () => {
      const res = await request.get('/api/bosses');

      expect(res.status).toBe(401);
    });

    it('GET /api/bosses returns zones object for authenticated user', async () => {
      const res = await request
        .get('/api/bosses')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('current');
      expect(data).toHaveProperty('legacy');
      expect(Array.isArray(data.current)).toBe(true);
      expect(Array.isArray(data.legacy)).toBe(true);
    });

    it('GET /api/bosses/:bossId validates ID (NaN -> 400)', async () => {
      const res = await request
        .get('/api/bosses/notanumber')
        .set('Authorization', `Bearer ${raiderToken}`);

      const msg = expectError(res, 400);
      expect(msg).toContain('Invalid boss ID');
    });

    it('GET /api/bosses/99999 returns 404 for non-existent boss', async () => {
      const res = await request
        .get('/api/bosses/99999')
        .set('Authorization', `Bearer ${raiderToken}`);

      const msg = expectError(res, 404);
      expect(msg).toContain('not found');
    });

    it('GET /api/bosses/debug/stats requires admin (403 for raider)', async () => {
      const res = await request
        .get('/api/bosses/debug/stats')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/bosses/debug/stats works for admin', async () => {
      const res = await request
        .get('/api/bosses/debug/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('boss_statistics');
      expect(data).toHaveProperty('wcl_bosses');
      expect(data).toHaveProperty('recent_processed');
      expect(data).toHaveProperty('counts');
    });

    it('POST /api/bosses/sync requires admin (403 for raider)', async () => {
      const res = await request
        .post('/api/bosses/sync')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(403);
    });

    it('PUT /api/bosses/zones/1/legacy requires admin (403 for raider)', async () => {
      const res = await request
        .put('/api/bosses/zones/1/legacy')
        .set('Authorization', `Bearer ${raiderToken}`)
        .send({ isLegacy: true });

      expect(res.status).toBe(403);
    });
  });

  // ── Analytics ─────────────────────────────────────

  describe('Analytics', () => {
    // -- Auth gates --

    it('GET /api/analytics/attendance returns 401 without auth', async () => {
      const res = await request.get('/api/analytics/attendance');

      expect(res.status).toBe(401);
    });

    it('GET /api/analytics/guild-insights returns 401 without auth', async () => {
      const res = await request.get('/api/analytics/guild-insights');

      expect(res.status).toBe(401);
    });

    // -- Attendance --

    it('GET /api/analytics/attendance returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/attendance')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('members');
      expect(data).toHaveProperty('totalRaidDays');
      expect(data).toHaveProperty('weeks');
      expect(Array.isArray(data.members)).toBe(true);
    });

    it('GET /api/analytics/attendance accepts weeks param', async () => {
      const res = await request
        .get('/api/analytics/attendance?weeks=4')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data.weeks).toBe(4);
    });

    // -- DKP Trends --

    it('GET /api/analytics/dkp-trends returns array of week objects', async () => {
      const res = await request
        .get('/api/analytics/dkp-trends')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      // Empty DB -> empty array is fine
    });

    // -- Economy --

    it('GET /api/analytics/economy returns correct shape with topMembers', async () => {
      const res = await request
        .get('/api/analytics/economy')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('topMembers');
      expect(Array.isArray(data.topMembers)).toBe(true);
      expect(data).toHaveProperty('total_circulation');
      expect(data).toHaveProperty('avg_dkp');
      expect(data).toHaveProperty('gained_this_week');
      expect(data).toHaveProperty('spent_this_week');
    });

    it('GET /api/analytics/economy returns zero values on empty DB', async () => {
      const res = await request
        .get('/api/analytics/economy')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data.gained_this_week).toBe(0);
      expect(data.spent_this_week).toBe(0);
    });

    // -- Auctions --

    it('GET /api/analytics/auctions returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/auctions')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('total_auctions');
      expect(data).toHaveProperty('avg_price');
      expect(data).toHaveProperty('byRarity');
      expect(data).toHaveProperty('weeklyTrend');
      expect(data).toHaveProperty('topItems');
      expect(data).toHaveProperty('weeks');
      expect(Array.isArray(data.byRarity)).toBe(true);
      expect(Array.isArray(data.weeklyTrend)).toBe(true);
      expect(Array.isArray(data.topItems)).toBe(true);
    });

    // -- Progression --

    it('GET /api/analytics/progression returns array', async () => {
      const res = await request
        .get('/api/analytics/progression')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
    });

    // -- Superlatives --

    it('GET /api/analytics/superlatives returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/superlatives')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('topDps');
      expect(data).toHaveProperty('topHps');
      expect(data).toHaveProperty('mostDeaths');
      expect(data).toHaveProperty('mostFights');
      expect(data).toHaveProperty('mostDamageTaken');
    });

    // -- My Performance --

    it('GET /api/analytics/my-performance returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/my-performance')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('totalFights');
      expect(data).toHaveProperty('totalDeaths');
      expect(data).toHaveProperty('deathsPerFight');
      expect(data).toHaveProperty('bossBreakdown');
      expect(data).toHaveProperty('recentReports');
      expect(Array.isArray(data.bossBreakdown)).toBe(true);
      expect(Array.isArray(data.recentReports)).toBe(true);
    });

    it('GET /api/analytics/my-performance returns zeros with no raid data', async () => {
      const res = await request
        .get('/api/analytics/my-performance')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data.totalFights).toBe(0);
      expect(data.totalDeaths).toBe(0);
      expect(data.deathsPerFight).toBe(0);
      expect(data.bossBreakdown).toHaveLength(0);
    });

    // -- My Performance Detail --

    it('GET /api/analytics/my-performance-detail returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/my-performance-detail')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('bossBreakdown');
      expect(data).toHaveProperty('weeklyTrends');
      expect(data).toHaveProperty('recentFights');
      expect(data).toHaveProperty('recommendations');
      expect(data.summary).toHaveProperty('totalFights');
      expect(data.summary).toHaveProperty('avgDps');
      expect(data.summary).toHaveProperty('consumableScore');
    });

    // -- Guild Insights --

    it('GET /api/analytics/guild-insights returns raidHealth object', async () => {
      const res = await request
        .get('/api/analytics/guild-insights')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('raidHealth');
      expect(data.raidHealth).toHaveProperty('totalKills');
      expect(data.raidHealth).toHaveProperty('totalWipes');
      expect(data.raidHealth).toHaveProperty('killRate');
      expect(data.raidHealth).toHaveProperty('avgFightTime');
      expect(data).toHaveProperty('topPerformers');
      expect(data).toHaveProperty('deathLeaders');
      expect(data).toHaveProperty('progressionBlockers');
      expect(data).toHaveProperty('recentReports');
      expect(Array.isArray(data.topPerformers)).toBe(true);
      expect(Array.isArray(data.deathLeaders)).toBe(true);
    });
  });
});
