import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, db } from './helpers.js';
import { MOCK_REPORT_DATA, MOCK_GUILD_REPORTS, MOCK_USER_REPORTS } from './mocks/warcraftlogs.mock.js';

// Mock WarcraftLogs service
vi.mock('../services/warcraftlogs.js', () => ({
  processWarcraftLog: vi.fn(),
  isConfigured: vi.fn(() => true),
  getGuildReports: vi.fn(),
  getFightStats: vi.fn(),
  getFightStatsWithDeathEvents: vi.fn(),
  getExtendedFightStats: vi.fn(),
  getUserReports: vi.fn(),
}));

// Mock raids service (background processing)
vi.mock('../services/raids.js', () => ({
  seedRaidData: vi.fn(),
  processFightStats: vi.fn(() => ({ skipped: true })),
  recordPlayerDeaths: vi.fn(),
  recordPlayerPerformance: vi.fn(),
}));

// Mock performance analysis
vi.mock('../services/performanceAnalysis.js', () => ({
  processExtendedFightData: vi.fn(() => 0),
}));

// Mock item popularity
vi.mock('../services/itemPopularity.js', () => ({
  processReportPopularity: vi.fn(),
}));

const { processWarcraftLog, isConfigured, getGuildReports, getUserReports } = await import('../services/warcraftlogs.js');

describe('WarcraftLogs — /api/warcraftlogs', () => {
  let adminToken, adminId;
  let officerToken, officerId;
  let raiderToken, _raiderId;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    const admin = await createTestUser({ role: 'admin' });
    const officer = await createTestUser({ role: 'officer' });
    const raider = await createTestUser({ role: 'raider' });

    adminToken = admin.token;
    adminId = admin.userId;
    officerToken = officer.token;
    officerId = officer.userId;
    raiderToken = raider.token;
    _raiderId = raider.userId;

    // Set character names for matching
    await db.run('UPDATE users SET character_name = ? WHERE id = ?', 'TestWarrior', adminId);
    await db.run('UPDATE users SET character_name = ?, server = ? WHERE id = ?', 'TestPriest', 'Sanguino', officerId);
  });

  afterAll(async () => {
    await cleanupTestDb();
    vi.restoreAllMocks();
  });

  // ── GET /config ──
  describe('GET /api/warcraftlogs/config', () => {
    it('returns config for admin', async () => {
      const res = await request
        .get('/api/warcraftlogs/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('configured');
      expect(res.body.data).toHaveProperty('config');
    });

    it('returns config for officer', async () => {
      const res = await request
        .get('/api/warcraftlogs/config')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(200);
    });

    it('rejects raider (403)', async () => {
      const res = await request
        .get('/api/warcraftlogs/config')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated (401)', async () => {
      const res = await request.get('/api/warcraftlogs/config');
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /config ──
  describe('PUT /api/warcraftlogs/config', () => {
    it('updates config as admin', async () => {
      const res = await request
        .put('/api/warcraftlogs/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ config_key: 'dkp_cap', config_value: '300' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
      expect(res.body.data.config_key).toBe('dkp_cap');

      // Restore original value
      await request
        .put('/api/warcraftlogs/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ config_key: 'dkp_cap', config_value: '250' });
    });

    it('rejects officer (403)', async () => {
      const res = await request
        .put('/api/warcraftlogs/config')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ config_key: 'dkp_cap', config_value: '300' });

      expect(res.status).toBe(403);
    });

    it('rejects missing fields (400)', async () => {
      const res = await request
        .put('/api/warcraftlogs/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ── POST /preview ──
  describe('POST /api/warcraftlogs/preview', () => {
    it('returns preview with matched participants', async () => {
      processWarcraftLog.mockResolvedValueOnce(MOCK_REPORT_DATA);

      const res = await request
        .post('/api/warcraftlogs/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ url: 'https://www.warcraftlogs.com/reports/abc123test' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('report');
      expect(res.body.data).toHaveProperty('participants');
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data).toHaveProperty('anomalies');
      expect(res.body.data.report.code).toBe('abc123test');
      expect(res.body.data.summary.total_participants).toBe(2);
    });

    it('rejects missing URL (400)', async () => {
      const res = await request
        .post('/api/warcraftlogs/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/url required/i);
    });

    it('returns 503 when WCL not configured', async () => {
      isConfigured.mockReturnValueOnce(false);

      const res = await request
        .post('/api/warcraftlogs/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ url: 'https://www.warcraftlogs.com/reports/abc123' });

      expect(res.status).toBe(503);
    });

    it('rejects raider (403)', async () => {
      const res = await request
        .post('/api/warcraftlogs/preview')
        .set('Authorization', `Bearer ${raiderToken}`)
        .send({ url: 'https://www.warcraftlogs.com/reports/abc123' });

      expect(res.status).toBe(403);
    });

    it('handles WCL API error (500)', async () => {
      processWarcraftLog.mockRejectedValueOnce(new Error('WCL API unreachable'));

      const res = await request
        .post('/api/warcraftlogs/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ url: 'https://www.warcraftlogs.com/reports/broken' });

      expect(res.status).toBe(500);
    });
  });

  // ── POST /confirm ──
  describe('POST /api/warcraftlogs/confirm', () => {
    it('confirms and assigns DKP', async () => {
      const res = await request
        .post('/api/warcraftlogs/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportCode: 'confirm_test_1',
          reportTitle: 'Test Raid',
          startTime: Date.now() - 3600000,
          endTime: Date.now(),
          region: 'EU',
          guildName: 'Test Guild',
          participants: [
            { matched: true, user_id: adminId, wcl_name: 'TestWarrior', dkp_to_assign: 10 },
            { matched: true, user_id: officerId, wcl_name: 'TestPriest', dkp_to_assign: 10 },
            { matched: false, user_id: null, wcl_name: 'Unknown', dkp_to_assign: 0 },
          ],
          fights: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/dkp assigned/i);
      expect(res.body.data.report_code).toBe('confirm_test_1');
      expect(res.body.data.participants_count).toBe(2);
      expect(res.body.data.total_dkp_assigned).toBeGreaterThan(0);
    });

    it('rejects duplicate report (409)', async () => {
      const res = await request
        .post('/api/warcraftlogs/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportCode: 'confirm_test_1',
          participants: [{ matched: true, user_id: adminId, dkp_to_assign: 10 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already been processed/i);
    });

    it('rejects missing fields (400)', async () => {
      const res = await request
        .post('/api/warcraftlogs/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects no matched participants (400)', async () => {
      const res = await request
        .post('/api/warcraftlogs/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportCode: 'confirm_empty',
          participants: [{ matched: false, user_id: null }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/no matched/i);
    });

    it('rejects raider (403)', async () => {
      const res = await request
        .post('/api/warcraftlogs/confirm')
        .set('Authorization', `Bearer ${raiderToken}`)
        .send({ reportCode: 'x', participants: [] });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /history ──
  describe('GET /api/warcraftlogs/history', () => {
    it('returns history for authenticated user', async () => {
      const res = await request
        .get('/api/warcraftlogs/history')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('supports limit parameter', async () => {
      const res = await request
        .get('/api/warcraftlogs/history?limit=1')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('rejects unauthenticated (401)', async () => {
      const res = await request.get('/api/warcraftlogs/history');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /report/:code/transactions ──
  describe('GET /api/warcraftlogs/report/:code/transactions', () => {
    it('returns transactions for a processed report', async () => {
      const res = await request
        .get('/api/warcraftlogs/report/confirm_test_1/transactions')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('report');
      expect(res.body.data).toHaveProperty('transactions');
      expect(res.body.data.report.report_code).toBe('confirm_test_1');
      expect(res.body.data.transactions.length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent report', async () => {
      const res = await request
        .get('/api/warcraftlogs/report/nonexistent/transactions')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /revert/:reportCode ──
  describe('POST /api/warcraftlogs/revert/:reportCode', () => {
    it('reverts DKP for a processed report', async () => {
      // First confirm a new report to revert
      await request
        .post('/api/warcraftlogs/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportCode: 'revert_test_1',
          reportTitle: 'Revert Test',
          participants: [
            { matched: true, user_id: adminId, wcl_name: 'TestWarrior', dkp_to_assign: 15 },
          ],
          fights: [],
        });

      const res = await request
        .post('/api/warcraftlogs/revert/revert_test_1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reverted/i);
      expect(res.body.data.report_code).toBe('revert_test_1');
    });

    it('returns 404 for already-reverted report', async () => {
      const res = await request
        .post('/api/warcraftlogs/revert/revert_test_1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent report', async () => {
      const res = await request
        .post('/api/warcraftlogs/revert/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('rejects officer (403)', async () => {
      const res = await request
        .post('/api/warcraftlogs/revert/confirm_test_1')
        .set('Authorization', `Bearer ${officerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── GET /guild-reports ──
  describe('GET /api/warcraftlogs/guild-reports', () => {
    it('returns guild reports for a date', async () => {
      // Set guild ID in config
      await db.run(
        "INSERT OR REPLACE INTO dkp_config (config_key, config_value) VALUES ('wcl_guild_id', '12345')"
      );

      getGuildReports.mockResolvedValueOnce(MOCK_GUILD_REPORTS);

      const res = await request
        .get('/api/warcraftlogs/guild-reports?date=2025-01-15')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('rejects missing date (400)', async () => {
      const res = await request
        .get('/api/warcraftlogs/guild-reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/date/i);
    });

    it('rejects raider (403)', async () => {
      const res = await request
        .get('/api/warcraftlogs/guild-reports?date=2025-01-15')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /import-boss-stats ──
  describe('POST /api/warcraftlogs/import-boss-stats', () => {
    it('imports boss stats from report', async () => {
      processWarcraftLog.mockResolvedValueOnce(MOCK_REPORT_DATA);

      const res = await request
        .post('/api/warcraftlogs/import-boss-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ url: 'https://www.warcraftlogs.com/reports/import123' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('report');
      expect(res.body.data).toHaveProperty('stats');
      expect(res.body.data.report.code).toBe('abc123test');
    });

    it('rejects missing URL (400)', async () => {
      const res = await request
        .post('/api/warcraftlogs/import-boss-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects officer (403)', async () => {
      const res = await request
        .post('/api/warcraftlogs/import-boss-stats')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ url: 'https://example.com/report' });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /pending-reports ──
  describe('GET /api/warcraftlogs/pending-reports', () => {
    it('returns 400 when uploader not configured', async () => {
      // Remove any existing wcl_uploader_id to test the unconfigured case
      await db.run("DELETE FROM dkp_config WHERE config_key = 'wcl_uploader_id'");

      const res = await request
        .get('/api/warcraftlogs/pending-reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/uploader/i);
    });

    it('returns pending reports when configured', async () => {
      await db.run(
        "INSERT OR REPLACE INTO dkp_config (config_key, config_value) VALUES ('wcl_uploader_id', '99999')"
      );

      getUserReports.mockResolvedValueOnce(MOCK_USER_REPORTS);

      const res = await request
        .get('/api/warcraftlogs/pending-reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('uploaderName');
      expect(res.body.data).toHaveProperty('pending');
      expect(res.body.data).toHaveProperty('processed');
    });

    it('rejects raider (403)', async () => {
      const res = await request
        .get('/api/warcraftlogs/pending-reports')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /auto-process/:code ──
  describe('POST /api/warcraftlogs/auto-process/:code', () => {
    it('previews auto-process for a report code', async () => {
      processWarcraftLog.mockResolvedValueOnce(MOCK_REPORT_DATA);

      const res = await request
        .post('/api/warcraftlogs/auto-process/new_report_code')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('report');
      expect(res.body.data).toHaveProperty('matching');
      expect(res.body.data.matching).toHaveProperty('matched');
      expect(res.body.data.matching).toHaveProperty('unmatched');
    });

    it('rejects already-processed report (400)', async () => {
      const res = await request
        .post('/api/warcraftlogs/auto-process/confirm_test_1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already processed/i);
    });

    it('rejects raider (403)', async () => {
      const res = await request
        .post('/api/warcraftlogs/auto-process/some_code')
        .set('Authorization', `Bearer ${raiderToken}`);

      expect(res.status).toBe(403);
    });
  });
});
