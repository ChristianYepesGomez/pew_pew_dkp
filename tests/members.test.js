import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser } from './helpers.js';

describe('Member management — /api/members', () => {
  let adminToken, adminId;
  let userToken, userId;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    const user = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    adminId = admin.userId;
    userToken = user.token;
    userId = user.userId;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── GET /api/members ─────────────────────────────────────────────

  describe('GET /api/members', () => {
    it('returns 401 without auth token', async () => {
      const res = await request.get('/api/members');
      expect(res.status).toBe(401);
    });

    it('returns member list with auth', async () => {
      const res = await request
        .get('/api/members')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2); // admin + user
    });

    it('each member has expected fields', async () => {
      const res = await request
        .get('/api/members')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const member = res.body[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('username');
      expect(member).toHaveProperty('role');
      expect(member).toHaveProperty('currentDkp');
      expect(member).toHaveProperty('dkpCap');
    });
  });

  // ── PUT /api/members/:id/role ────────────────────────────────────

  describe('PUT /api/members/:id/role', () => {
    it('admin can change a member role', async () => {
      const res = await request
        .put(`/api/members/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'officer' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/role updated/i);
    });

    it('non-admin gets 403', async () => {
      const res = await request
        .put(`/api/members/${adminId}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });

    it('rejects invalid role value', async () => {
      const res = await request
        .put(`/api/members/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid role/i);
    });

    it('rejects invalid member ID', async () => {
      const res = await request
        .put('/api/members/abc/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'raider' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid member id/i);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .put(`/api/members/${userId}/role`)
        .send({ role: 'raider' });

      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/members/:id ──────────────────────────────────────

  describe('DELETE /api/members/:id', () => {
    it('non-admin gets 403', async () => {
      // Create a throwaway user so we don't break other tests
      const throwaway = await createTestUser({ role: 'raider' });

      const res = await request
        .delete(`/api/members/${throwaway.userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent member', async () => {
      const res = await request
        .delete('/api/members/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/member not found/i);
    });

    it('rejects invalid member ID', async () => {
      const res = await request
        .delete('/api/members/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid member id/i);
    });

    it('admin can deactivate a member', async () => {
      const victim = await createTestUser({ role: 'raider' });

      const res = await request
        .delete(`/api/members/${victim.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deactivated/i);

      // Verify the member no longer appears in active list
      const listRes = await request
        .get('/api/members')
        .set('Authorization', `Bearer ${adminToken}`);

      const ids = listRes.body.map((m) => m.id);
      expect(ids).not.toContain(victim.userId);
    });
  });
});
