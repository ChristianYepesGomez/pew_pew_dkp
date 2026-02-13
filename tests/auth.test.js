import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb } from './helpers.js';

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

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Account created successfully');
      expect(res.body.userId).toBeDefined();
    });

    it('rejects missing fields', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'nopass' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('rejects short username', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'ab', password: 'pass123', email: 'short@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 3');
    });

    it('rejects short password', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'validuser', password: '123', email: 'pw@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 6');
    });

    it('rejects invalid email', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'emailtest', password: 'pass123', email: 'notanemail' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('rejects duplicate username', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'pass123', email: 'dupe@test.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already taken');
    });

    it('rejects duplicate email', async () => {
      const res = await request
        .post('/api/auth/register')
        .send({ username: 'dupemail', password: 'pass123', email: 'new@test.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already in use');
    });
  });

  // ── Login ─────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns token and user data with valid credentials', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'pass123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toMatchObject({
        username: 'newuser',
        role: 'raider',
      });
    });

    it('is case-insensitive for username', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'NEWUSER', password: 'pass123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid credentials');
    });

    it('rejects non-existent user', async () => {
      const res = await request
        .post('/api/auth/login')
        .send({ username: 'ghost', password: 'pass123' });

      expect(res.status).toBe(401);
    });
  });

  // ── Get current user ──────────────────────────

  describe('GET /api/auth/me', () => {
    let token;

    beforeAll(async () => {
      const loginRes = await request
        .post('/api/auth/login')
        .send({ username: 'newuser', password: 'pass123' });
      token = loginRes.body.token;
    });

    it('returns user data with valid token', async () => {
      const res = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('newuser');
      expect(res.body.email).toBe('new@test.com');
      expect(res.body.role).toBe('raider');
      expect(res.body.currentDkp).toBeDefined();
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
      token = loginRes.body.token;
    });

    it('updates email', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'updated@test.com' });

      expect(res.status).toBe(200);

      // Verify the change
      const me = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(me.body.email).toBe('updated@test.com');
    });

    it('rejects invalid email format', async () => {
      const res = await request
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('returns 401 without token', async () => {
      const res = await request
        .put('/api/auth/profile')
        .send({ email: 'hacker@evil.com' });

      expect(res.status).toBe(401);
    });
  });
});
