import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess } from './helpers.js';

// Mock buffManager to avoid starting timers
vi.mock('../services/buffManager.js', () => ({
  registerClient: vi.fn(),
  unregisterClient: vi.fn(),
  getActiveBuffs: vi.fn(() => ({})),
  startBuffManager: vi.fn(),
  stopBuffManager: vi.fn(),
}));

describe('Buffs — /api/buffs', () => {
  let raiderToken;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    const raider = await createTestUser({ role: 'raider' });
    raiderToken = raider.token;
  });

  afterAll(async () => {
    await cleanupTestDb();
    vi.restoreAllMocks();
  });

  // ── GET /active ──
  describe('GET /api/buffs/active', () => {
    it('returns active buffs for authenticated user', async () => {
      const res = await request
        .get('/api/buffs/active')
        .set('Authorization', `Bearer ${raiderToken}`);

      const data = expectSuccess(res);
      expect(typeof data).toBe('object');
    });

    it('rejects unauthenticated (401)', async () => {
      const res = await request.get('/api/buffs/active');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /stream (SSE) ──
  describe('GET /api/buffs/stream', () => {
    it('returns SSE headers with valid token via query param', async () => {
      const res = await request
        .get(`/api/buffs/stream?token=${raiderToken}`)
        .buffer(false)
        .parse((res, callback) => {
          // Read just enough to verify SSE setup, then abort
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
            if (data.includes('connected')) {
              res.destroy();
              callback(null, data);
            }
          });
          res.on('error', () => callback(null, data));
          // Timeout safety
          setTimeout(() => {
            res.destroy();
            callback(null, data);
          }, 2000);
        });

      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      expect(res.headers['cache-control']).toBe('no-cache');
    });

    it('returns SSE headers with Bearer token in header', async () => {
      const res = await request
        .get('/api/buffs/stream')
        .set('Authorization', `Bearer ${raiderToken}`)
        .buffer(false)
        .parse((res, callback) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
            if (data.includes('connected')) {
              res.destroy();
              callback(null, data);
            }
          });
          res.on('error', () => callback(null, data));
          setTimeout(() => { res.destroy(); callback(null, data); }, 2000);
        });

      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    });

    it('rejects without token (401)', async () => {
      const res = await request.get('/api/buffs/stream');

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/no token/i);
    });

    it('rejects with invalid token (401)', async () => {
      const res = await request.get('/api/buffs/stream?token=invalid.jwt.token');

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid token/i);
    });
  });
});
