import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, expectSuccess, expectError } from './helpers.js';

// Mock email service so forgot-password doesn't actually send emails
vi.mock('../services/email.js', () => ({
  sendPasswordResetEmail: vi.fn(() => false), // returns false = email not sent (dev mode)
}));

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

      expectSuccess(res);
      expect(res.body.message).toContain('Profile updated');

      // Verify the change persisted
      const me = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.token}`);
      const meData = expectSuccess(me);
      expect(meData.email).toBe('newemail@example.com');
    });

    it('rejects invalid email format', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ email: 'not-a-valid-email' });

      const msg = expectError(res, 400);
      expect(msg).toContain('email');
    });

    it('can remove email by sending null', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ email: null });

      expectSuccess(res);

      const me = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user.token}`);
      const meData = expectSuccess(me);
      expect(meData.email).toBeNull();
    });

    it('changes password with correct current password', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: user.password, newPassword: 'updatedpass1' });

      expectSuccess(res);
      expect(res.body.message).toContain('Profile updated');

      // Restore original password for subsequent tests (via profile, not login)
      const restore = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: 'updatedpass1', newPassword: user.password });
      expectSuccess(restore);
    });

    it('rejects wrong current password', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpass123' });

      const msg = expectError(res, 400);
      expect(msg).toContain('Current password');
    });

    it('rejects short new password', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: user.password, newPassword: '12345' });

      const msg = expectError(res, 400);
      expect(msg).toContain('at least 6');
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

      expectSuccess(res);
      expect(res.body.message).toContain('Password updated');

      // Update local reference for subsequent tests
      user.password = 'changedpass1';
    });

    it('rejects wrong current password', async () => {
      const res = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: 'totallyWrong', newPassword: 'newpass999' });

      const msg = expectError(res, 401);
      expect(msg).toContain('Current password is incorrect');
    });

    it('rejects short new password', async () => {
      const res = await request
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ currentPassword: user.password, newPassword: 'abc' });

      const msg = expectError(res, 400);
      expect(msg).toContain('at least 6');
    });

    it('can login with new password after change', async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: user.username, password: user.password });

      const data = expectSuccess(loginRes);
      expect(data.token).toBeDefined();
      expect(data.user.username).toBe(user.username);
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

      expectSuccess(res);
      expect(res.body.message).toContain('Password reset successfully');

      // Verify target user can login with new password
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: targetUser.username, password: 'adminreset1' });
      expectSuccess(loginRes);
    });

    it('raider gets 403', async () => {
      const res = await request
        .post('/api/auth/admin-reset-password')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ userId: targetUser.userId, newPassword: 'sneaky123' });

      const msg = expectError(res, 403);
      expect(msg).toContain('Insufficient permissions');
    });

    it('validates required fields', async () => {
      const noUserId = await request
        .post('/api/auth/admin-reset-password')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ newPassword: 'newpass123' });

      const noUserIdMsg = expectError(noUserId, 400);
      expect(noUserIdMsg).toContain('required');

      const noPassword = await request
        .post('/api/auth/admin-reset-password')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ userId: targetUser.userId });

      const noPasswordMsg = expectError(noPassword, 400);
      expect(noPasswordMsg).toContain('required');
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

      const regData = expectSuccess(regRes, 201);
      const { refreshToken } = regData;
      expect(refreshToken).toBeDefined();

      const res = await request
        .post('/api/auth/refresh')
        .send({ refreshToken });

      const data = expectSuccess(res);
      expect(data.token).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      // The new refresh token must differ (has unique jti)
      expect(data.refreshToken).not.toBe(refreshToken);
    });

    it('rejects missing refresh token', async () => {
      const res = await request
        .post('/api/auth/refresh')
        .send({});

      const msg = expectError(res, 400);
      expect(msg).toContain('Refresh token required');
    });

    it('rejects invalid refresh token', async () => {
      const res = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: 'totally.invalid.token' });

      const msg = expectError(res, 401);
      expect(msg).toContain('Invalid refresh token');
    });

    it('replay detection - second use of same token revokes family', async () => {
      // Register directly to get refreshToken
      const username = `refresh_replay_${Date.now()}`;
      const regRes = await request
        .post('/api/auth/register')
        .send({ username, password: 'testpass123', email: `${username}@test.com` });

      const regData = expectSuccess(regRes, 201);
      const originalRefreshToken = regData.refreshToken;

      // First use - should succeed and mark original as used
      const first = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: originalRefreshToken });
      const firstData = expectSuccess(first);

      // Second use of the SAME token - replay detection triggers
      const second = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: originalRefreshToken });
      const secondMsg = expectError(second, 401);
      expect(secondMsg).toContain('compromised');

      // Even the legitimately issued new token should be revoked (entire family deleted)
      const third = await request
        .post('/api/auth/refresh')
        .send({ refreshToken: firstData.refreshToken });
      expectError(third, 401);
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

      const regData = expectSuccess(regRes, 201);

      const res = await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${regData.token}`)
        .send({ refreshToken: regData.refreshToken });

      expectSuccess(res);
      expect(res.body.message).toContain('Logged out');
    });

    it('refresh token no longer works after logout', async () => {
      // Register directly to get both token and refreshToken
      const username = `logout_revoke_${Date.now()}`;
      const regRes = await request
        .post('/api/auth/register')
        .send({ username, password: 'testpass123', email: `${username}@test.com` });

      const regData = expectSuccess(regRes, 201);
      const { token, refreshToken } = regData;

      // Logout, sending the refresh token to revoke its family
      await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken });

      // Attempt to use the revoked refresh token
      const refreshRes = await request
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expectError(refreshRes, 401);
    });
  });

  // ── POST /forgot-password ────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    let forgotUser;

    beforeAll(async () => {
      forgotUser = await createTestUser();
    });

    it('returns reset token when user found by username', async () => {
      const res = await request
        .post('/api/auth/forgot-password')
        .send({ usernameOrEmail: forgotUser.username });

      const data = expectSuccess(res);
      expect(res.body.message).toBeDefined();
      // In test/dev mode, resetToken is returned
      expect(data.resetToken).toBeDefined();
    });

    it('returns reset token when user found by email', async () => {
      const res = await request
        .post('/api/auth/forgot-password')
        .send({ usernameOrEmail: forgotUser.email });

      const data = expectSuccess(res);
      expect(data.resetToken).toBeDefined();
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request
        .post('/api/auth/forgot-password')
        .send({ usernameOrEmail: 'nonexistent_user_xyz' });

      const msg = expectError(res, 404);
      expect(msg).toMatch(/not found/i);
    });

    it('rejects missing field (400)', async () => {
      const res = await request
        .post('/api/auth/forgot-password')
        .send({});

      const msg = expectError(res, 400);
      expect(msg).toMatch(/required/i);
    });
  });

  // ── POST /reset-password ─────────────────────────
  describe('POST /api/auth/reset-password', () => {
    let resetToken;
    let resetUser;

    beforeAll(async () => {
      resetUser = await createTestUser();

      // Get a valid reset token
      const forgotRes = await request
        .post('/api/auth/forgot-password')
        .send({ usernameOrEmail: resetUser.username });
      const forgotData = expectSuccess(forgotRes);
      resetToken = forgotData.resetToken;
    });

    it('resets password with valid token', async () => {
      const res = await request
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'newresetpass1' });

      expectSuccess(res);
      expect(res.body.message).toMatch(/reset successfully/i);

      // Verify login works with new password
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: resetUser.username, password: 'newresetpass1' });
      expectSuccess(loginRes);
    });

    it('rejects already-used token (400)', async () => {
      const res = await request
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'anotherpass1' });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid or expired/i);
    });

    it('rejects invalid token (400)', async () => {
      const res = await request
        .post('/api/auth/reset-password')
        .send({ token: 'totally.invalid.jwt', password: 'newpass123' });

      const msg = expectError(res, 400);
      expect(msg).toMatch(/invalid/i);
    });

    it('rejects missing fields (400)', async () => {
      const res = await request
        .post('/api/auth/reset-password')
        .send({});

      const msg = expectError(res, 400);
      expect(msg).toMatch(/required/i);
    });
  });
});
