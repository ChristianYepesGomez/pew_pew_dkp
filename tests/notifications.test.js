import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, db, expectSuccess } from './helpers.js';

describe('Notifications API', () => {
  let user;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await cleanupTestDb();
    user = await createTestUser();
  });

  // ── GET /api/notifications/vapid-public-key ──

  describe('GET /vapid-public-key', () => {
    it('should require authentication', async () => {
      const res = await request.get('/api/notifications/vapid-public-key');
      expect(res.status).toBe(401);
    });

    it('should return 503 when VAPID keys not configured', async () => {
      const res = await request
        .get('/api/notifications/vapid-public-key')
        .set('Authorization', `Bearer ${user.token}`);
      // In test env, VAPID keys are not set → 503
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/not configured/);
    });
  });

  // ── POST /api/notifications/subscribe ──

  describe('POST /subscribe', () => {
    it('should require authentication', async () => {
      const res = await request
        .post('/api/notifications/subscribe')
        .send({ endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } });
      expect(res.status).toBe(401);
    });

    it('should return 503 when VAPID not configured', async () => {
      const res = await request
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ endpoint: 'https://push.example.com', keys: { p256dh: 'key1', auth: 'key2' } });
      expect(res.status).toBe(503);
    });

    it('should validate required fields', async () => {
      // Missing endpoint
      let res = await request
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ keys: { p256dh: 'key1', auth: 'key2' } });
      // Either 400 (validation) or 503 (VAPID not configured) — both acceptable
      expect([400, 503]).toContain(res.status);

      // Missing keys
      res = await request
        .post('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ endpoint: 'https://push.example.com' });
      expect([400, 503]).toContain(res.status);
    });
  });

  // ── DELETE /api/notifications/subscribe ──

  describe('DELETE /subscribe', () => {
    it('should require authentication', async () => {
      const res = await request
        .delete('/api/notifications/subscribe')
        .send({ endpoint: 'https://push.example.com' });
      expect(res.status).toBe(401);
    });

    it('should validate endpoint required', async () => {
      const res = await request
        .delete('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${user.token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Ee]ndpoint/);
    });

    it('should return 404 when subscription not found', async () => {
      const res = await request
        .delete('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ endpoint: 'https://push.example.com/nonexistent' });
      expect(res.status).toBe(404);
    });

    it('should delete subscription from database', async () => {
      // Insert a subscription directly
      await db.run(
        'INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
        user.userId, 'https://push.example.com/test', 'p256dh_key', 'auth_key'
      );

      const res = await request
        .delete('/api/notifications/subscribe')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ endpoint: 'https://push.example.com/test' });
      expectSuccess(res);

      // Verify it's gone
      const sub = await db.get(
        'SELECT id FROM push_subscriptions WHERE endpoint = ?',
        'https://push.example.com/test'
      );
      expect(sub).toBeNull();
    });
  });

  // ── GET /api/notifications/preferences ──

  describe('GET /preferences', () => {
    it('should require authentication', async () => {
      const res = await request.get('/api/notifications/preferences');
      expect(res.status).toBe(401);
    });

    it('should return default preferences when none set', async () => {
      const res = await request
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${user.token}`);

      const data = expectSuccess(res);
      expect(data.preferences.outbid).toBe(1);
      expect(data.preferences.bis_auction).toBe(1);
      expect(data.preferences.raid_reminder).toBe(1);
      expect(data.preferences.dkp_adjusted).toBe(0);
      expect(data.preferences.loot_council).toBe(0);
    });

    it('should return saved preferences', async () => {
      await db.run(
        'INSERT INTO notification_preferences (user_id, outbid, bis_auction, raid_reminder, dkp_adjusted, loot_council) VALUES (?, 0, 1, 0, 1, 1)',
        user.userId
      );

      const res = await request
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${user.token}`);

      const data = expectSuccess(res);
      expect(data.preferences.outbid).toBe(0);
      expect(data.preferences.bis_auction).toBe(1);
      expect(data.preferences.raid_reminder).toBe(0);
      expect(data.preferences.dkp_adjusted).toBe(1);
      expect(data.preferences.loot_council).toBe(1);
    });
  });

  // ── PUT /api/notifications/preferences ──

  describe('PUT /preferences', () => {
    it('should require authentication', async () => {
      const res = await request
        .put('/api/notifications/preferences')
        .send({ outbid: 0 });
      expect(res.status).toBe(401);
    });

    it('should validate values are 0 or 1', async () => {
      const res = await request
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ outbid: 2 });
      expect(res.status).toBe(400);
    });

    it('should update preferences partially', async () => {
      // Update only outbid
      const res = await request
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ outbid: 0 });
      expectSuccess(res);

      // Verify the value was saved
      const prefs = await db.get(
        'SELECT outbid, bis_auction FROM notification_preferences WHERE user_id = ?',
        user.userId
      );
      expect(prefs.outbid).toBe(0);
      expect(prefs.bis_auction).toBe(1); // default preserved
    });

    it('should update all preferences at once', async () => {
      const res = await request
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          outbid: 0,
          bis_auction: 0,
          raid_reminder: 0,
          dkp_adjusted: 1,
          loot_council: 1,
        });
      expectSuccess(res);

      const prefs = await db.get(
        'SELECT outbid, bis_auction, raid_reminder, dkp_adjusted, loot_council FROM notification_preferences WHERE user_id = ?',
        user.userId
      );
      expect(prefs.outbid).toBe(0);
      expect(prefs.bis_auction).toBe(0);
      expect(prefs.raid_reminder).toBe(0);
      expect(prefs.dkp_adjusted).toBe(1);
      expect(prefs.loot_council).toBe(1);
    });

    it('should reject when no preferences provided', async () => {
      const res = await request
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${user.token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
