import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser } from './helpers.js';

describe('Auth extended endpoints', () => {
  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── PUT /profile ───────────────────────────────

  describe('PUT /api/auth/profile', () => {
    let user;

    beforeAll(async () => {
      user = await createTestUser();
    });

    it('updates email', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ email: 'newemail@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Profile updated');

      // Verify the change persisted
      const me = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.token}`);
      expect(me.body.email).toBe('newemail@example.com');
    });

    it('rejects invalid email format', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ email: 'not-a-valid-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('can remove email by sending null', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ email: null });

      expect(res.status).toBe(200);

      const me = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.token}`);
      expect(me.body.email).toBeNull();
    });

    it('changes password with correct current password', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: user.password, newPassword: 'updatedpass1' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Profile updated');

      // Restore original password for subsequent tests (via profile, not login)
      const restore = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: 'updatedpass1', newPassword: user.password });
      expect(restore.status).toBe(200);
    });

    it('rejects wrong current password', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Current password');
    });

    it('rejects short new password', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: user.password, newPassword: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 6');
    });

    it('returns 401 without auth token', async () => {
      const res = await request
        .put('/api/auth/profile')
        .send({ email: 'hacker@evil.com' });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /change-password ──────────────────────

  describe('POST /api/auth/change-password', () => {
    let user;

    beforeAll(async () => {
      user = await createTestUser();
    });

    it('changes password successfully', async () => {
      const res = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: user.password, newPassword: 'changedpass1' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Password updated');

      // Update local reference for subsequent tests
      user.password = 'changedpass1';
    });

    it('rejects wrong current password', async () => {
      const res = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: 'totallyWrong', newPassword: 'newpass999' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Current password is incorrect');
    });

    it('rejects short new password', async () => {
      const res = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: user.password, newPassword: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 6');
    });

    it('can login with new password after change', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: user.username, password: user.password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.user.username).toBe(user.username);
    });
  });

  // ── POST /admin-reset-password ─────────────────

  describe('POST /api/auth/admin-reset-password', () => {
    let admin;
    let targetUser;
    let raider;

    beforeAll(async () => {
      admin = await createTestUser({ role: 'admin' });
      targetUser = await createTestUser();
      raider = await createTestUser();
    });

    it('admin can reset another user password', async () => {
      const res = await request
        .post('/api/auth/admin-reset-password')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ userId: targetUser.userId, newPassword: 'adminreset1' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Password reset successfully');

      // Verify target user can login with new password
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: targetUser.username, password: 'adminreset1' });
      expect(loginRes.status).toBe(200);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/auth/admin-reset-password')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ userId: targetUser.userId, newPassword: 'sneaky123' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Insufficient permissions');
    });

    it('validates required fields', async () => {
      const noUserId = await request
        .post('/api/auth/admin-reset-password')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ newPassword: 'newpass123' });

      expect(noUserId.status).toBe(400);
      expect(noUserId.body.error).toContain('required');

      const noPassword = await request
        .post('/api/auth/admin-reset-password')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ userId: targetUser.userId });

      expect(noPassword.status).toBe(400);
      expect(noPassword.body.error).toContain('required');
    });
  });

  // ── POST /refresh ──────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('returns new token pair with valid refresh token', async () => {
      // Register directly to get refreshToken without an extra login call
      const username = `refresh_valid_${Date.now()}`;
      const regRes = await request
        .post('/api/auth/register')
        .send({ username, password: 'testpass123', email: `${username}@test.com` });

      expect(regRes.status).toBe(201);
      const { refreshToken } = regRes.body;
      expect(refreshToken).toBeDefined();

      const res = await request
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      // The new refresh token must differ (has unique jti)
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });

    it('rejects missing refresh token', async () => {
      const res = await request
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Refresh token required');
    });

    it('rejects invalid refresh token', async () => {
      const res = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: 'totally.invalid.token' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid refresh token');
    });

    it('replay detection - second use of same token revokes family', async () => {
      // Register directly to get refreshToken
      const username = `refresh_replay_${Date.now()}`;
      const regRes = await request
        .post('/api/auth/register')
        .send({ username, password: 'testpass123', email: `${username}@test.com` });

      const originalRefreshToken = regRes.body.refreshToken;

      // First use - should succeed and mark original as used
      const first = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: originalRefreshToken });
      expect(first.status).toBe(200);

      // Second use of the SAME token - replay detection triggers
      const second = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: originalRefreshToken });
      expect(second.status).toBe(401);
      expect(second.body.error).toContain('compromised');

      // Even the legitimately issued new token should be revoked (entire family deleted)
      const third = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: first.body.refreshToken });
      expect(third.status).toBe(401);
    });
  });

  // ── POST /logout ───────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('successfully logs out', async () => {
      // Register directly to get both token and refreshToken
      const username = `logout_ok_${Date.now()}`;
      const regRes = await request
        .post('/api/auth/register')
        .send({ username, password: 'testpass123', email: `${username}@test.com` });

      const res = await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({ refreshToken: regRes.body.refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logged out');
    });

    it('refresh token no longer works after logout', async () => {
      // Register directly to get both token and refreshToken
      const username = `logout_revoke_${Date.now()}`;
      const regRes = await request
        .post('/api/auth/register')
        .send({ username, password: 'testpass123', email: `${username}@test.com` });

      const { token, refreshToken } = regRes.body;

      // Logout, sending the refresh token to revoke its family
      await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken });

      // Attempt to use the revoked refresh token
      const refreshRes = await request
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });
});
