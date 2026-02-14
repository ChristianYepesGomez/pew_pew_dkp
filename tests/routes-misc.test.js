import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser } from './helpers.js';

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

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeGreaterThan(0);
    });

    it('GET /health does NOT require auth', async () => {
      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });

    it('GET /health has correct response shape', async () => {
      const res = await request.get('/health');

      expect(res.body).toEqual({
        status: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        uptime: expect.any(Number),
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

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('current');
      expect(res.body).toHaveProperty('legacy');
      expect(Array.isArray(res.body.current)).toBe(true);
      expect(Array.isArray(res.body.legacy)).toBe(true);
    });

    it('GET /api/bosses/:bossId validates ID (NaN -> 400)', async () => {
      const res = await request
        .get('/api/bosses/notanumber')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid boss ID');
    });

    it('GET /api/bosses/99999 returns 404 for non-existent boss', async () => {
      const res = await request
        .get('/api/bosses/99999')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
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

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('boss_statistics');
      expect(res.body).toHaveProperty('wcl_bosses');
      expect(res.body).toHaveProperty('recent_processed');
      expect(res.body).toHaveProperty('counts');
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

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('members');
      expect(res.body).toHaveProperty('totalRaidDays');
      expect(res.body).toHaveProperty('weeks');
      expect(Array.isArray(res.body.members)).toBe(true);
    });

    it('GET /api/analytics/attendance accepts weeks param', async () => {
      const res = await request
        .get('/api/analytics/attendance?weeks=4')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.weeks).toBe(4);
    });

    // -- DKP Trends --

    it('GET /api/analytics/dkp-trends returns array of week objects', async () => {
      const res = await request
        .get('/api/analytics/dkp-trends')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Empty DB -> empty array is fine
    });

    // -- Economy --

    it('GET /api/analytics/economy returns correct shape with topMembers', async () => {
      const res = await request
        .get('/api/analytics/economy')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('topMembers');
      expect(Array.isArray(res.body.topMembers)).toBe(true);
      expect(res.body).toHaveProperty('total_circulation');
      expect(res.body).toHaveProperty('avg_dkp');
      expect(res.body).toHaveProperty('gained_this_week');
      expect(res.body).toHaveProperty('spent_this_week');
    });

    it('GET /api/analytics/economy returns zero values on empty DB', async () => {
      const res = await request
        .get('/api/analytics/economy')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.gained_this_week).toBe(0);
      expect(res.body.spent_this_week).toBe(0);
    });

    // -- Auctions --

    it('GET /api/analytics/auctions returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/auctions')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total_auctions');
      expect(res.body).toHaveProperty('avg_price');
      expect(res.body).toHaveProperty('byRarity');
      expect(res.body).toHaveProperty('weeklyTrend');
      expect(res.body).toHaveProperty('topItems');
      expect(res.body).toHaveProperty('weeks');
      expect(Array.isArray(res.body.byRarity)).toBe(true);
      expect(Array.isArray(res.body.weeklyTrend)).toBe(true);
      expect(Array.isArray(res.body.topItems)).toBe(true);
    });

    // -- Progression --

    it('GET /api/analytics/progression returns array', async () => {
      const res = await request
        .get('/api/analytics/progression')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    // -- Superlatives --

    it('GET /api/analytics/superlatives returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/superlatives')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('topDps');
      expect(res.body).toHaveProperty('topHps');
      expect(res.body).toHaveProperty('mostDeaths');
      expect(res.body).toHaveProperty('mostFights');
      expect(res.body).toHaveProperty('mostDamageTaken');
    });

    // -- My Performance --

    it('GET /api/analytics/my-performance returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/my-performance')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalFights');
      expect(res.body).toHaveProperty('totalDeaths');
      expect(res.body).toHaveProperty('deathsPerFight');
      expect(res.body).toHaveProperty('bossBreakdown');
      expect(res.body).toHaveProperty('recentReports');
      expect(Array.isArray(res.body.bossBreakdown)).toBe(true);
      expect(Array.isArray(res.body.recentReports)).toBe(true);
    });

    it('GET /api/analytics/my-performance returns zeros with no raid data', async () => {
      const res = await request
        .get('/api/analytics/my-performance')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalFights).toBe(0);
      expect(res.body.totalDeaths).toBe(0);
      expect(res.body.deathsPerFight).toBe(0);
      expect(res.body.bossBreakdown).toHaveLength(0);
    });

    // -- My Performance Detail --

    it('GET /api/analytics/my-performance-detail returns correct shape', async () => {
      const res = await request
        .get('/api/analytics/my-performance-detail')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('bossBreakdown');
      expect(res.body).toHaveProperty('weeklyTrends');
      expect(res.body).toHaveProperty('recentFights');
      expect(res.body).toHaveProperty('recommendations');
      expect(res.body.summary).toHaveProperty('totalFights');
      expect(res.body.summary).toHaveProperty('avgDps');
      expect(res.body.summary).toHaveProperty('consumableScore');
    });

    // -- Guild Insights --

    it('GET /api/analytics/guild-insights returns raidHealth object', async () => {
      const res = await request
        .get('/api/analytics/guild-insights')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('raidHealth');
      expect(res.body.raidHealth).toHaveProperty('totalKills');
      expect(res.body.raidHealth).toHaveProperty('totalWipes');
      expect(res.body.raidHealth).toHaveProperty('killRate');
      expect(res.body.raidHealth).toHaveProperty('avgFightTime');
      expect(res.body).toHaveProperty('topPerformers');
      expect(res.body).toHaveProperty('deathLeaders');
      expect(res.body).toHaveProperty('progressionBlockers');
      expect(res.body).toHaveProperty('recentReports');
      expect(Array.isArray(res.body.topPerformers)).toBe(true);
      expect(Array.isArray(res.body.deathLeaders)).toBe(true);
    });
  });
});
