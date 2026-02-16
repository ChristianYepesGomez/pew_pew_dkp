import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser } from './helpers.js';
import { authLimiter, forgotPasswordLimiter, adminLimiter, userLimiter } from '../lib/rateLimiters.js';

describe('Rate limiting', () => {
  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── Rate limiter exports are valid middleware ──
  describe('Rate limiter configuration', () => {
    it('exports authLimiter as a function', () => {
      expect(typeof authLimiter).toBe('function');
    });

    it('exports forgotPasswordLimiter as a function', () => {
      expect(typeof forgotPasswordLimiter).toBe('function');
    });

    it('exports adminLimiter as a function', () => {
      expect(typeof adminLimiter).toBe('function');
    });

    it('exports userLimiter as a function', () => {
      expect(typeof userLimiter).toBe('function');
    });
  });

  // ── In test mode, rate limiters are bypassed (noop) ──
  describe('Test mode bypass', () => {
    it('auth endpoints are not rate-limited in test mode', async () => {
      // Make several requests — none should get 429
      for (let i = 0; i < 5; i++) {
        const res = await request
          .post('/api/auth/login')
          .send({ username: `ratetest_${i}`, password: 'wrong' });

        // Should get 401 (invalid creds), NOT 429 (rate limited)
        expect(res.status).not.toBe(429);
      }
    });

    it('admin endpoints are not rate-limited in test mode', async () => {
      const admin = await createTestUser({ role: 'admin' });

      for (let i = 0; i < 3; i++) {
        const res = await request
          .post('/api/dkp/adjust')
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ userId: 99999, amount: 0 });

        // Should get 404 (member not found), NOT 429
        expect(res.status).not.toBe(429);
      }
    });

    it('user endpoints are not rate-limited in test mode', async () => {
      const user = await createTestUser({ role: 'raider' });

      for (let i = 0; i < 3; i++) {
        const res = await request
          .post('/api/auctions/99999/bid')
          .set('Authorization', `Bearer ${user.token}`)
          .send({ amount: 10 });

        expect(res.status).not.toBe(429);
      }
    });

    it('forgot-password endpoint is not rate-limited in test mode', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request
          .post('/api/auth/forgot-password')
          .send({ usernameOrEmail: 'nobody' });

        expect(res.status).not.toBe(429);
      }
    });
  });
});
