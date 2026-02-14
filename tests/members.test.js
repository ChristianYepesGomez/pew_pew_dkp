import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

describe('Member management — /api/members', () => {
  let adminToken, adminId;
  let officerToken, officerId;
  let userToken, userId;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    const officer = await createTestUser({ role: 'officer' });
    const user = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    adminId = admin.userId;
    officerToken = officer.token;
    officerId = officer.userId;
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

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2); // admin + user
    });

    it('each member has expected fields', async () => {
      const res = await request
        .get('/api/members')
        .set('Authorization', `Bearer ${adminToken}`);

      const data = expectSuccess(res);
      const member = data[0];
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

      expectSuccess(res);
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

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid role/i);
    });

    it('rejects invalid member ID', async () => {
      const res = await request
        .put('/api/members/abc/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'raider' });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid member id/i);
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

      const msg = expectError(res, 404);
      expect(msg).toMatch(/member not found/i);
    });

    it('rejects invalid member ID', async () => {
      const res = await request
        .delete('/api/members/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid member id/i);
    });

    it('admin can deactivate a member', async () => {
      const victim = await createTestUser({ role: 'raider' });

      const res = await request
        .delete(`/api/members/${victim.userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expectSuccess(res);
      expect(res.body.message).toMatch(/deactivated/i);

      // Verify the member no longer appears in active list
      const listRes = await request
        .get('/api/members')
        .set('Authorization', `Bearer ${adminToken}`);

      const listData = expectSuccess(listRes);
      const ids = listData.map((m) => m.id);
      expect(ids).not.toContain(victim.userId);
    });
  });

  // ── PUT /api/members/:id/vault ──────────────────────────────────
  describe('PUT /api/members/:id/vault', () => {
    it('officer can mark vault as completed', async () => {
      const res = await request
        .put(`/api/members/${userId}/vault`)
        .set('Authorization', `Bearer ${officerToken}`);

      const data = expectSuccess(res);
      expect(data.completed).toBe(true);
      expect(res.body.message).toMatch(/marked/i);
    });

    it('toggling again unmarks vault', async () => {
      const res = await request
        .put(`/api/members/${userId}/vault`)
        .set('Authorization', `Bearer ${officerToken}`);

      const data = expectSuccess(res);
      expect(data.completed).toBe(false);
      expect(res.body.message).toMatch(/unmarked/i);
    });

    it('admin can mark vault', async () => {
      const res = await request
        .put(`/api/members/${userId}/vault`)
        .set('Authorization', `Bearer ${adminToken}`);

      const data = expectSuccess(res);
      expect(data.completed).toBe(true);
    });

    it('raider cannot toggle vault (403)', async () => {
      const res = await request
        .put(`/api/members/${adminId}/vault`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects invalid member ID (400)', async () => {
      const res = await request
        .put('/api/members/abc/vault')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent member', async () => {
      const res = await request
        .put('/api/members/99999/vault')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/members ──────────────────────────────────────────
  describe('POST /api/members', () => {
    it('admin can create a member', async () => {
      const res = await request
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `newmember_${Date.now()}`,
          password: 'testpass123',
          characterName: 'NewWarrior',
          characterClass: 'Warrior',
          spec: 'Arms',
          raidRole: 'DPS',
          initialDkp: 50,
        });

      const data = expectSuccess(res, 201);
      expect(data).toHaveProperty('member');
      expect(data.member.characterName).toBe('NewWarrior');
      expect(data.member.characterClass).toBe('Warrior');
      expect(data.member.currentDkp).toBe(50);
      expect(data.member.role).toBe('raider');
    });

    it('officer can create a member', async () => {
      const res = await request
        .post('/api/members')
        .set('Authorization', `Bearer ${officerToken}`)
        .send({
          username: `offmember_${Date.now()}`,
          password: 'testpass123',
          characterName: 'OfficerCreated',
          characterClass: 'Priest',
        });

      expectSuccess(res, 201);
    });

    it('raider cannot create a member (403)', async () => {
      const res = await request
        .post('/api/members')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'nopeuser',
          password: 'testpass123',
          characterName: 'Nope',
          characterClass: 'Mage',
        });

      expect(res.status).toBe(403);
    });

    it('rejects missing required fields (400)', async () => {
      const res = await request
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'incomplete' });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/required/i);
    });

    it('rejects duplicate username (409)', async () => {
      const username = `dupmember_${Date.now()}`;
      await request
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username, password: 'test123', characterName: 'Dup1', characterClass: 'Rogue' });

      const res = await request
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username, password: 'test123', characterName: 'Dup2', characterClass: 'Rogue' });

      const msg = expectError(res, 409);
      expect(msg).toMatch(/already exists/i);
    });

    it('defaults to raider role and DPS raid role', async () => {
      const res = await request
        .post('/api/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `defaultrole_${Date.now()}`,
          password: 'testpass123',
          characterName: 'DefaultRole',
          characterClass: 'Mage',
        });

      const data = expectSuccess(res, 201);
      expect(data.member.role).toBe('raider');
      expect(data.member.raidRole).toBe('DPS');
    });
  });
});
