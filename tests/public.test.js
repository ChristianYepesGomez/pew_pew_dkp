import { describe, it, expect, beforeAll } from 'vitest';
import { request, setupTestDb, createTestUser } from './helpers.js';

describe('Public endpoints', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  // ── Health check ──────────────────────────────

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeGreaterThan(0);
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

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
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

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
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
