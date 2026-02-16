import { describe, it, expect, beforeAll } from 'vitest';
import { request, setupTestDb, createTestUser, expectSuccess } from './helpers.js';

describe('Public endpoints', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  // ── Health check ──────────────────────────────

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await request.get('/health');

      const data = expectSuccess(res);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);
    });
  });

  // ── Members (requires auth) ───────────────────

  describe('GET /api/members', () => {
    it('returns 401 without auth', async () => {
      const res = await request.get('/api/members');

      expect(res.status).toBe(401);
    });

    it('returns member list with auth', async () => {
      const { token } = await createTestUser();

      const res = await request
        .get('/api/members')
        .set('Authorization', `Bearer ${token}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // ── Characters (requires auth) ────────────────

  describe('GET /api/characters', () => {
    it('returns 401 without auth', async () => {
      const res = await request.get('/api/characters');

      expect(res.status).toBe(401);
    });

    it('returns characters list with auth', async () => {
      const { token } = await createTestUser();

      const res = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${token}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  // ── 404 handling ──────────────────────────────

  describe('Unknown routes', () => {
    it('returns 404 for non-existent API routes', async () => {
      const res = await request.get('/api/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
