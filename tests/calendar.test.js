import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp } from './helpers.js';
import { db } from '../database.js';

// Next Monday from 2026-02-14 (Saturday) is 2026-02-16
const NEXT_MONDAY = '2026-02-16';
// A Tuesday — not a default raid day
const NON_RAID_DAY = '2026-02-17';

describe('Calendar endpoints', () => {
  let admin, raider;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    admin = await createTestUser({ role: 'admin' });
    raider = await createTestUser({ role: 'raider' });
  });

  afterAll(async () => {
    // Clean calendar-specific tables the helper doesn't cover
    await db.run('DELETE FROM member_availability').catch(() => {});
    await cleanupTestDb();
  });

  // ── GET /raid-days ───────────────────────────────

  describe('GET /api/calendar/raid-days', () => {
    it('returns default raid days (3 days)', async () => {
      const res = await request
        .get('/api/calendar/raid-days')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);

      const daysOfWeek = res.body.map(d => d.day_of_week);
      expect(daysOfWeek).toEqual([1, 3, 4]); // Lunes, Miercoles, Jueves

      // Verify each day has the expected properties
      for (const day of res.body) {
        expect(day).toHaveProperty('day_of_week');
        expect(day).toHaveProperty('day_name');
        expect(day).toHaveProperty('is_active', 1);
        expect(day).toHaveProperty('raid_time');
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get('/api/calendar/raid-days');

      expect(res.status).toBe(401);
    });
  });

  // ── PUT /raid-days ───────────────────────────────

  describe('PUT /api/calendar/raid-days', () => {
    afterEach(async () => {
      // Restore default raid days after each mutation test
      await db.exec('DELETE FROM raid_days');
      await db.run('INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (1, \'Lunes\', 1, \'21:00\')');
      await db.run('INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (3, \'Miércoles\', 1, \'21:00\')');
      await db.run('INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time) VALUES (4, \'Jueves\', 1, \'21:00\')');
    });

    it('admin can update raid days', async () => {
      const newDays = [
        { dayOfWeek: 2, dayName: 'Martes', raidTime: '20:00' },
        { dayOfWeek: 5, dayName: 'Viernes', raidTime: '21:30' },
      ];

      const res = await request
        .put('/api/calendar/raid-days')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ days: newDays });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Raid days updated');

      // Verify the change took effect
      const verify = await request
        .get('/api/calendar/raid-days')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(verify.body).toHaveLength(2);
      expect(verify.body.map(d => d.day_of_week)).toEqual([2, 5]);
    });

    it('raider gets 403 trying to update raid days', async () => {
      const res = await request
        .put('/api/calendar/raid-days')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ days: [{ dayOfWeek: 1 }] });

      expect(res.status).toBe(403);
    });

    it('validates days array is required', async () => {
      const res = await request
        .put('/api/calendar/raid-days')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('days array required');
    });

    it('rejects non-array days', async () => {
      const res = await request
        .put('/api/calendar/raid-days')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ days: 'monday' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('days array required');
    });
  });

  // ── GET /dates ───────────────────────────────────

  describe('GET /api/calendar/dates', () => {
    it('returns upcoming raid dates', async () => {
      const res = await request
        .get('/api/calendar/dates')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Verify shape of each date entry
      const first = res.body[0];
      expect(first).toHaveProperty('date');
      expect(first).toHaveProperty('dayOfWeek');
      expect(first).toHaveProperty('dayName');
      expect(first).toHaveProperty('raidTime');
      expect(first).toHaveProperty('cutoffTime');
      expect(first).toHaveProperty('isLocked');

      // All dates should be raid days (Mon=1, Wed=3, Thu=4)
      for (const d of res.body) {
        expect([1, 3, 4]).toContain(d.dayOfWeek);
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get('/api/calendar/dates');

      expect(res.status).toBe(401);
    });
  });

  // ── GET /my-signups ──────────────────────────────

  describe('GET /api/calendar/my-signups', () => {
    it('returns signups structure with dates (initially no status)', async () => {
      const res = await request
        .get('/api/calendar/my-signups')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dates');
      expect(Array.isArray(res.body.dates)).toBe(true);

      // Each date should have signup fields even if no signup exists yet
      if (res.body.dates.length > 0) {
        const first = res.body.dates[0];
        expect(first).toHaveProperty('date');
        expect(first).toHaveProperty('dayOfWeek');
        expect(first).toHaveProperty('status');
        expect(first).toHaveProperty('dkpAwarded');
        // Before any signup, status should be null
        expect(first.status).toBeNull();
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get('/api/calendar/my-signups');

      expect(res.status).toBe(401);
    });
  });

  // ── POST /signup ─────────────────────────────────

  describe('POST /api/calendar/signup', () => {
    // Clean member_availability before signup tests to avoid conflicts
    beforeEach(async () => {
      await db.run('DELETE FROM member_availability');
    });

    it('creates a signup and awards DKP bonus on first signup', async () => {
      // Get DKP before signup
      const meBefore = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${raider.token}`);
      const dkpBefore = meBefore.body.currentDkp;

      const res = await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ date: NEXT_MONDAY, status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Signup created');
      expect(res.body.date).toBe(NEXT_MONDAY);
      expect(res.body.status).toBe('confirmed');
      expect(res.body.isFirstSignup).toBe(true);
      expect(res.body.dkpAwarded).toBe(1); // calendar_dkp_per_day default = 1

      // Verify DKP was actually added
      const meAfter = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${raider.token}`);
      expect(meAfter.body.currentDkp).toBe(dkpBefore + 1);
    });

    it('second signup to the same date updates but does not give extra DKP', async () => {
      // First signup
      await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ date: NEXT_MONDAY, status: 'confirmed' });

      // Get DKP after first signup
      const meBetween = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${raider.token}`);
      const dkpAfterFirst = meBetween.body.currentDkp;

      // Second signup (change status)
      const res = await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ date: NEXT_MONDAY, status: 'tentative', notes: 'Might be late' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Signup updated');
      expect(res.body.isFirstSignup).toBe(false);
      expect(res.body.status).toBe('tentative');

      // DKP should not change on the second signup
      const meAfter = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${raider.token}`);
      expect(meAfter.body.currentDkp).toBe(dkpAfterFirst);
    });

    it('validates required fields (date and status)', async () => {
      // Missing both
      const res1 = await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({});

      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('date and status are required');

      // Missing status
      const res2 = await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ date: NEXT_MONDAY });

      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('date and status are required');

      // Missing date
      const res3 = await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ status: 'confirmed' });

      expect(res3.status).toBe(400);
      expect(res3.body.error).toContain('date and status are required');
    });

    it('validates status enum (confirmed, declined, tentative)', async () => {
      const res = await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ date: NEXT_MONDAY, status: 'maybe' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    it('rejects signup for a non-raid-day date', async () => {
      const res = await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ date: NON_RAID_DAY, status: 'confirmed' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not a raid day');
    });

    it('returns 401 without auth token', async () => {
      const res = await request
        .post('/api/calendar/signup')
        .send({ date: NEXT_MONDAY, status: 'confirmed' });

      expect(res.status).toBe(401);
    });

    it('supports all three valid statuses', async () => {
      for (const status of ['confirmed', 'declined', 'tentative']) {
        // Clean between each to ensure first signup
        await db.run('DELETE FROM member_availability');

        const res = await request
          .post('/api/calendar/signup')
          .set('Authorization', `Bearer ${raider.token}`)
          .send({ date: NEXT_MONDAY, status });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe(status);
      }
    });
  });

  // ── GET /summary/:date ───────────────────────────

  describe('GET /api/calendar/summary/:date', () => {
    beforeAll(async () => {
      // Clean and create a known signup for the summary test
      await db.run('DELETE FROM member_availability');
      await request
        .post('/api/calendar/signup')
        .set('Authorization', `Bearer ${raider.token}`)
        .send({ date: NEXT_MONDAY, status: 'confirmed' });
    });

    it('returns categorized users for a date', async () => {
      const res = await request
        .get(`/api/calendar/summary/${NEXT_MONDAY}`)
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(200);
      expect(res.body.date).toBe(NEXT_MONDAY);
      expect(res.body).toHaveProperty('confirmed');
      expect(res.body).toHaveProperty('declined');
      expect(res.body).toHaveProperty('tentative');
      expect(res.body).toHaveProperty('noResponse');
      expect(res.body).toHaveProperty('counts');

      // Arrays
      expect(Array.isArray(res.body.confirmed)).toBe(true);
      expect(Array.isArray(res.body.declined)).toBe(true);
      expect(Array.isArray(res.body.tentative)).toBe(true);
      expect(Array.isArray(res.body.noResponse)).toBe(true);

      // Counts object
      expect(res.body.counts).toHaveProperty('confirmed');
      expect(res.body.counts).toHaveProperty('declined');
      expect(res.body.counts).toHaveProperty('tentative');
      expect(res.body.counts).toHaveProperty('noResponse');
      expect(res.body.counts).toHaveProperty('total');

      // The raider signed up as confirmed
      expect(res.body.counts.confirmed).toBeGreaterThanOrEqual(1);
    });

    it('confirmed member has expected shape', async () => {
      const res = await request
        .get(`/api/calendar/summary/${NEXT_MONDAY}`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);

      if (res.body.confirmed.length > 0) {
        const member = res.body.confirmed[0];
        expect(member).toHaveProperty('id');
        expect(member).toHaveProperty('characterName');
        expect(member).toHaveProperty('characterClass');
        expect(member).toHaveProperty('raidRole');
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get(`/api/calendar/summary/${NEXT_MONDAY}`);

      expect(res.status).toBe(401);
    });
  });

  // ── GET /overview ────────────────────────────────

  describe('GET /api/calendar/overview', () => {
    it('returns dates and members for upcoming raid dates', async () => {
      const res = await request
        .get('/api/calendar/overview')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dates');
      expect(res.body).toHaveProperty('members');
      expect(Array.isArray(res.body.dates)).toBe(true);
      expect(Array.isArray(res.body.members)).toBe(true);

      // Each date should have counts
      if (res.body.dates.length > 0) {
        const firstDate = res.body.dates[0];
        expect(firstDate).toHaveProperty('date');
        expect(firstDate).toHaveProperty('dayOfWeek');
        expect(firstDate).toHaveProperty('counts');
        expect(firstDate.counts).toHaveProperty('confirmed');
        expect(firstDate.counts).toHaveProperty('declined');
        expect(firstDate.counts).toHaveProperty('tentative');
        expect(firstDate.counts).toHaveProperty('noResponse');
      }

      // Each member should have signups keyed by date
      if (res.body.members.length > 0) {
        const member = res.body.members[0];
        expect(member).toHaveProperty('id');
        expect(member).toHaveProperty('characterName');
        expect(member).toHaveProperty('signups');
        expect(typeof member.signups).toBe('object');
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get('/api/calendar/overview');

      expect(res.status).toBe(401);
    });
  });

  // ── GET /history ─────────────────────────────────

  describe('GET /api/calendar/history', () => {
    it('returns past raid data as array', async () => {
      const res = await request
        .get('/api/calendar/history')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Each entry should have date info and optional WCL/attendance data
      if (res.body.length > 0) {
        const entry = res.body[0];
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('dayName');
        expect(entry).toHaveProperty('raidTime');
        // wclReport and attendance may be null when no data
        expect(entry).toHaveProperty('wclReport');
        expect(entry).toHaveProperty('attendance');
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get('/api/calendar/history');

      expect(res.status).toBe(401);
    });
  });

  // ── GET /dates-with-logs ─────────────────────────

  describe('GET /api/calendar/dates-with-logs', () => {
    it('returns dates enriched with WCL info', async () => {
      const res = await request
        .get('/api/calendar/dates-with-logs')
        .set('Authorization', `Bearer ${raider.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      if (res.body.length > 0) {
        const entry = res.body[0];
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('dayName');
        expect(entry).toHaveProperty('raidTime');
        expect(entry).toHaveProperty('wclReport');
        // isPast should be present for past dates or absent for future ones
        expect(entry).toHaveProperty('isPast');
      }
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get('/api/calendar/dates-with-logs');

      expect(res.status).toBe(401);
    });
  });
});
