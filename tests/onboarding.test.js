import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, db, expectSuccess, expectError } from './helpers.js';

describe('Onboarding endpoints', () => {
  let admin, officer, raider;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    admin = await createTestUser({ role: 'admin' });
    officer = await createTestUser({ role: 'officer' });
    raider = await createTestUser({ role: 'raider' });
  });

  afterAll(async () => {
    await db.run('DELETE FROM invite_codes').catch(() => {});
    await cleanupTestDb();
  });

  // Reset onboarding state between tests
  beforeEach(async () => {
    await db.run('DELETE FROM invite_codes').catch(() => {});
    await db.run("UPDATE dkp_config SET config_value = 'false' WHERE config_key = 'onboarding_completed'").catch(() => {});
    await db.run("UPDATE dkp_config SET config_value = '' WHERE config_key = 'guild_name'").catch(() => {});
    await db.run("UPDATE dkp_config SET config_value = '' WHERE config_key = 'guild_server'").catch(() => {});
    await db.run("UPDATE dkp_config SET config_value = '' WHERE config_key = 'guild_region'").catch(() => {});
  });

  // ── GET /api/onboarding/status ─────────────────────────

  describe('GET /api/onboarding/status', () => {
    it('returns onboarding status for authenticated user', async () => {
      const res = await request
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${admin.token}`);

      const data = expectSuccess(res);
      expect(data).toHaveProperty('completed', false);
      expect(data).toHaveProperty('steps');
      expect(data.steps).toHaveProperty('guild');
      expect(data.steps).toHaveProperty('roster');
      expect(data.steps).toHaveProperty('schedule');
      expect(data.steps).toHaveProperty('invite');
      expect(data).toHaveProperty('guild');
      expect(data).toHaveProperty('memberCount');
      expect(data).toHaveProperty('raidDays');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request.get('/api/onboarding/status');
      expect(res.status).toBe(401);
    });

    it('shows roster step as true when multiple users exist', async () => {
      const res = await request
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${admin.token}`);

      const data = expectSuccess(res);
      // We have admin + officer + raider = 3 users, > 1
      expect(data.steps.roster).toBe(true);
    });

    it('reflects completed status after completing onboarding', async () => {
      await db.run("UPDATE dkp_config SET config_value = 'true' WHERE config_key = 'onboarding_completed'");

      const res = await request
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${admin.token}`);

      const data = expectSuccess(res);
      expect(data.completed).toBe(true);
    });
  });

  // ── PUT /api/onboarding/guild ──────────────────────────

  describe('PUT /api/onboarding/guild', () => {
    it('saves guild info (admin)', async () => {
      const res = await request
        .put('/api/onboarding/guild')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Pew Pew Kittens', server: 'Sanguino', region: 'EU', lootSystem: 'DKP' });

      const data = expectSuccess(res);
      expect(data.guild.name).toBe('Pew Pew Kittens');
      expect(data.guild.server).toBe('Sanguino');
      expect(data.guild.region).toBe('EU');
      expect(data.guild.lootSystem).toBe('dkp'); // normalized to lowercase
    });

    it('reflects saved guild info in status', async () => {
      await request
        .put('/api/onboarding/guild')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Test Guild', server: 'Ragnaros', region: 'US' });

      const res = await request
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${admin.token}`);

      const data = expectSuccess(res);
      expect(data.steps.guild).toBe(true);
      expect(data.guild.name).toBe('Test Guild');
      expect(data.guild.server).toBe('Ragnaros');
      expect(data.guild.region).toBe('US');
    });

    it('rejects non-admin users', async () => {
      const res = await request
        .put('/api/onboarding/guild')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ name: 'Test', server: 'Test', region: 'EU' });

      expect(res.status).toBe(403);
    });

    it('rejects missing required fields', async () => {
      const res = await request
        .put('/api/onboarding/guild')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Test' });

      expectError(res, 400);
    });

    it('rejects invalid region', async () => {
      const res = await request
        .put('/api/onboarding/guild')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Test', server: 'Test', region: 'INVALID' });

      const errMsg = expectError(res, 400);
      expect(errMsg).toMatch(/Invalid region/);
    });

    it('rejects invalid loot system', async () => {
      const res = await request
        .put('/api/onboarding/guild')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: 'Test', server: 'Test', region: 'EU', lootSystem: 'INVALID' });

      const errMsg = expectError(res, 400);
      expect(errMsg).toMatch(/Invalid loot system/);
    });

    it('trims name and server', async () => {
      const res = await request
        .put('/api/onboarding/guild')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ name: '  Trimmed Guild  ', server: '  Sanguino  ', region: 'EU' });

      const data = expectSuccess(res);
      expect(data.guild.name).toBe('Trimmed Guild');
      expect(data.guild.server).toBe('Sanguino');
    });
  });

  // ── PUT /api/onboarding/schedule ───────────────────────

  describe('PUT /api/onboarding/schedule', () => {
    it('saves raid schedule (admin)', async () => {
      const res = await request
        .put('/api/onboarding/schedule')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ days: [
          { dayOfWeek: 3, dayName: 'Miércoles', raidTime: '20:00' },
          { dayOfWeek: 4, dayName: 'Jueves', raidTime: '20:00' },
        ]});

      const data = expectSuccess(res);
      expect(data.raidDays).toHaveLength(2);
      expect(data.raidDays[0].day_of_week).toBe(3);
      expect(data.raidDays[1].day_of_week).toBe(4);
    });

    it('rejects empty days array', async () => {
      const res = await request
        .put('/api/onboarding/schedule')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ days: [] });

      expectError(res, 400);
    });

    it('rejects invalid dayOfWeek', async () => {
      const res = await request
        .put('/api/onboarding/schedule')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ days: [{ dayOfWeek: 9 }] });

      expectError(res, 400);
    });

    it('rejects non-admin users', async () => {
      const res = await request
        .put('/api/onboarding/schedule')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ days: [{ dayOfWeek: 1 }] });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/onboarding/invite ────────────────────────

  describe('POST /api/onboarding/invite', () => {
    it('creates invite code (admin)', async () => {
      const res = await request
        .post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({});

      const data = expectSuccess(res, 201);
      expect(data).toHaveProperty('code');
      expect(data.code).toHaveLength(12); // 6 random bytes = 12 hex chars
      expect(data).toHaveProperty('inviteUrl');
      expect(data.maxUses).toBe(0);
      expect(data.expiresAt).toBeNull();
    });

    it('creates invite code with max uses and expiry', async () => {
      const res = await request
        .post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ maxUses: 10, expiresInDays: 7 });

      const data = expectSuccess(res, 201);
      expect(data.maxUses).toBe(10);
      expect(data.expiresAt).not.toBeNull();
    });

    it('allows officer to create invite codes', async () => {
      const res = await request
        .post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${officer.token}`)
        .send({});

      expectSuccess(res, 201);
    });

    it('rejects raider creating invite codes', async () => {
      const res = await request
        .post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/onboarding/invite (list) ──────────────────

  describe('GET /api/onboarding/invite', () => {
    it('lists all invite codes (admin)', async () => {
      // Create two codes first
      await request.post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`).send({});
      await request.post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`).send({});

      const res = await request
        .get('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`);

      const data = expectSuccess(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects raider listing invite codes', async () => {
      const res = await request
        .get('/api/onboarding/invite')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/onboarding/invite/:code (validate) ────────

  describe('GET /api/onboarding/invite/:code', () => {
    it('validates a valid invite code (public)', async () => {
      const createRes = await request
        .post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({});

      const createData = expectSuccess(createRes, 201);

      const res = await request
        .get(`/api/onboarding/invite/${createData.code}`);

      const data = expectSuccess(res);
      expect(data.valid).toBe(true);
    });

    it('returns 404 for non-existent code', async () => {
      const res = await request.get('/api/onboarding/invite/nonexistent123');

      expectError(res, 404);
    });

    it('returns 410 for expired code', async () => {
      // Insert expired code directly
      await db.run(
        'INSERT INTO invite_codes (code, created_by, expires_at) VALUES (?, ?, ?)',
        'expired123', admin.userId, '2020-01-01T00:00:00.000Z'
      );

      const res = await request.get('/api/onboarding/invite/expired123');

      expectError(res, 410);
    });

    it('returns 410 for code at usage limit', async () => {
      await db.run(
        'INSERT INTO invite_codes (code, created_by, max_uses, use_count) VALUES (?, ?, ?, ?)',
        'maxed123', admin.userId, 5, 5
      );

      const res = await request.get('/api/onboarding/invite/maxed123');

      expectError(res, 410);
    });

    it('includes guild name when set', async () => {
      await db.run("UPDATE dkp_config SET config_value = 'Test Guild' WHERE config_key = 'guild_name'");

      const createRes = await request
        .post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({});

      const createData = expectSuccess(createRes, 201);

      const res = await request
        .get(`/api/onboarding/invite/${createData.code}`);

      const data = expectSuccess(res);
      expect(data.guildName).toBe('Test Guild');
    });
  });

  // ── DELETE /api/onboarding/invite/:id ──────────────────

  describe('DELETE /api/onboarding/invite/:id', () => {
    it('revokes an invite code (admin)', async () => {
      const createRes = await request
        .post('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({});

      const createData = expectSuccess(createRes, 201);

      // Get the ID from the list
      const listRes = await request
        .get('/api/onboarding/invite')
        .set('Authorization', `Bearer ${admin.token}`);

      const listData = expectSuccess(listRes);
      const invite = listData.find(i => i.code === createData.code);

      const res = await request
        .delete(`/api/onboarding/invite/${invite.id}`)
        .set('Authorization', `Bearer ${admin.token}`);

      expectSuccess(res);

      // Verify it's gone
      const validateRes = await request.get(`/api/onboarding/invite/${createData.code}`);
      expect(validateRes.status).toBe(404);
    });

    it('returns 404 for non-existent invite', async () => {
      const res = await request
        .delete('/api/onboarding/invite/99999')
        .set('Authorization', `Bearer ${admin.token}`);

      expectError(res, 404);
    });

    it('rejects invalid ID', async () => {
      const res = await request
        .delete('/api/onboarding/invite/abc')
        .set('Authorization', `Bearer ${admin.token}`);

      expectError(res, 400);
    });

    it('rejects raider revoking invite codes', async () => {
      const res = await request
        .delete('/api/onboarding/invite/1')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/onboarding/complete ──────────────────────

  describe('POST /api/onboarding/complete', () => {
    it('marks onboarding as completed (admin)', async () => {
      const res = await request
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${admin.token}`);

      const data = expectSuccess(res);
      expect(data.completed).toBe(true);

      // Verify in status
      const statusRes = await request
        .get('/api/onboarding/status')
        .set('Authorization', `Bearer ${admin.token}`);

      const statusData = expectSuccess(statusRes);
      expect(statusData.completed).toBe(true);
    });

    it('rejects non-admin users', async () => {
      const res = await request
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/onboarding/skip ──────────────────────────

  describe('POST /api/onboarding/skip', () => {
    it('skips onboarding (admin)', async () => {
      const res = await request
        .post('/api/onboarding/skip')
        .set('Authorization', `Bearer ${admin.token}`);

      const data = expectSuccess(res);
      expect(data.completed).toBe(true);
    });

    it('rejects non-admin users', async () => {
      const res = await request
        .post('/api/onboarding/skip')
        .set('Authorization', `Bearer ${officer.token}`);

      expect(res.status).toBe(403);
    });
  });
});
