import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, expectSuccess, expectError } from './helpers.js';

describe('Auth endpoints', () => {
  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── Register ──────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('creates a new user', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'pass123', email: 'new@test.com' });

      const data = expectSuccess(res, 201);
      expect(res.body.message).toBe('Account created successfully');
      expect(data.userId).toBeDefined();
    });

    it('rejects missing fields', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'nopass' });

      const msg = expectError(res, 400);
      expect(msg).toContain('required');
    });

    it('rejects short username', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'ab', password: 'pass123', email: 'short@test.com' });

      const msg = expectError(res, 400);
      expect(msg).toContain('at least 3');
    });

    it('rejects short password', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'validuser', password: '123', email: 'pw@test.com' });

      const msg = expectError(res, 400);
      expect(msg).toContain('at least 6');
    });

    it('rejects invalid email', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'emailtest', password: 'pass123', email: 'notanemail' });

      const msg = expectError(res, 400);
      expect(msg).toContain('email');
    });

    it('rejects duplicate username', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'pass123', email: 'dupe@test.com' });

      const msg = expectError(res, 409);
      expect(msg).toContain('already taken');
    });

    it('rejects duplicate email', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'dupemail', password: 'pass123', email: 'new@test.com' });

      const msg = expectError(res, 409);
      expect(msg).toContain('already in use');
    });
  });

  // ── Login ─────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns token and user data with valid credentials', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'pass123' });

      const data = expectSuccess(res);
      expect(data.token).toBeDefined();
      expect(data.user).toMatchObject({
        username: 'newuser',
        role: 'raider',
      });
    });

    it('is case-insensitive for username', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'NEWUSER', password: 'pass123' });

      const data = expectSuccess(res);
      expect(data.token).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'wrongpass' });

      const msg = expectError(res, 401);
      expect(msg).toContain('Invalid credentials');
    });

    it('rejects non-existent user', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'ghost', password: 'pass123' });

      expectError(res, 401);
    });
  });

  // ── Get current user ──────────────────────────

  describe('GET /api/auth/me', () => {
    let token;

    beforeAll(async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'pass123' });
      token = loginRes.body.data.token;
    });

    it('returns user data with valid token', async () => {
      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      const data = expectSuccess(res);
      expect(data.username).toBe('newuser');
      expect(data.email).toBe('new@test.com');
      expect(data.role).toBe('raider');
      expect(data.currentDkp).toBeDefined();
    });

    it('returns 401 without token', async () => {
      const res = await request.get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(403);
    });
  });

  // ── Profile update ────────────────────────────

  describe('PUT /api/auth/profile', () => {
    let token;

    beforeAll(async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'pass123' });
      token = loginRes.body.data.token;
    });

    it('updates email', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'updated@test.com' });

      expectSuccess(res);

      // Verify the change
      const me = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      const meData = expectSuccess(me);
      expect(meData.email).toBe('updated@test.com');
    });

    it('rejects invalid email format', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email' });

      expectError(res, 400);
    });

    it('returns 401 without token', async () => {
      const res = await request
        .put('/api/auth/profile')
        .send({ email: 'hacker@evil.com' });

      expect(res.status).toBe(401);
    });
  });
});
