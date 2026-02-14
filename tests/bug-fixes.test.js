import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp, db, createTestAuction, expectSuccess } from './helpers.js';
import { median } from '../services/performanceAnalysis.js';
import { normalizeDifficulty } from '../services/raids.js';
import { MAX_SNIPE_EXTENSION_MS } from '../lib/auctionScheduler.js';

// ── Fix 5: Median calculation ──────────────────────────────────────────
describe('Bug Fix — Median calculation', () => {
  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0);
  });

  it('returns the single element for length-1 array', () => {
    expect(median([42])).toBe(42);
  });

  it('returns middle value for odd-length array', () => {
    expect(median([1, 3, 5])).toBe(3);
    expect(median([10, 20, 30, 40, 50])).toBe(30);
  });

  it('averages two middle values for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('handles unsorted input', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('does not mutate original array', () => {
    const arr = [3, 1, 2];
    median(arr);
    expect(arr).toEqual([3, 1, 2]);
  });
});

// ── Fix 7: Difficulty normalization ────────────────────────────────────
describe('Bug Fix — Difficulty normalization', () => {
  it('maps numeric WCL difficulty IDs', () => {
    expect(normalizeDifficulty(1)).toBe('LFR');
    expect(normalizeDifficulty(3)).toBe('Normal');
    expect(normalizeDifficulty(4)).toBe('Heroic');
    expect(normalizeDifficulty(5)).toBe('Mythic');
  });

  it('maps string difficulty IDs', () => {
    expect(normalizeDifficulty('1')).toBe('LFR');
    expect(normalizeDifficulty('3')).toBe('Normal');
    expect(normalizeDifficulty('4')).toBe('Heroic');
    expect(normalizeDifficulty('5')).toBe('Mythic');
  });

  it('maps string names (case-insensitive)', () => {
    expect(normalizeDifficulty('Mythic')).toBe('Mythic');
    expect(normalizeDifficulty('heroic')).toBe('Heroic');
    expect(normalizeDifficulty('NORMAL')).toBe('Normal');
    expect(normalizeDifficulty('lfr')).toBe('LFR');
  });

  it('defaults null/undefined to Normal', () => {
    expect(normalizeDifficulty(null)).toBe('Normal');
    expect(normalizeDifficulty(undefined)).toBe('Normal');
  });

  it('defaults unknown values to Normal', () => {
    expect(normalizeDifficulty(99)).toBe('Normal');
    expect(normalizeDifficulty('timewalking')).toBe('Normal');
  });
});

// ── Fix 2: Consumable score formula ────────────────────────────────────
describe('Bug Fix — Consumable score formula', () => {
  let adminToken, userId, userToken;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    adminToken = admin.token;
    const user = await createTestUser({ role: 'raider' });
    userId = user.userId;
    userToken = user.token;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  it('returns score 0-100 with all metrics at 0', async () => {
    // Insert fight data with zero consumable usage
    await db.run(`
      INSERT INTO player_fight_performance
      (user_id, report_code, fight_id, boss_id, difficulty, damage_done, healing_done,
       damage_taken, deaths, fight_duration_ms, dps, hps, dtps, health_potions,
       healthstones, combat_potions, flask_uptime_pct, food_buff_active,
       augment_rune_active, interrupts, dispels, raid_median_dps, raid_median_dtps, fight_date)
      VALUES (?, 'TEST001', 1, 1, 'Heroic', 1000000, 0, 50000, 0, 300000,
              3333, 0, 166, 0, 0, 0, 0, 0, 0, 0, 0, 3000, 150, '2026-01-01')
    `, userId);

    const res = await request
      .get(`/api/analytics/my-performance-detail`)
      .set('Authorization', `Bearer ${userToken}`);

    const data = expectSuccess(res);
    expect(data.summary.consumableScore).toBe(0);
  });

  it('returns score 100 with all metrics at max', async () => {
    // Clean previous data
    await db.run('DELETE FROM player_fight_performance WHERE user_id = ?', userId);

    // Insert fight data with perfect consumable usage
    await db.run(`
      INSERT INTO player_fight_performance
      (user_id, report_code, fight_id, boss_id, difficulty, damage_done, healing_done,
       damage_taken, deaths, fight_duration_ms, dps, hps, dtps, health_potions,
       healthstones, combat_potions, flask_uptime_pct, food_buff_active,
       augment_rune_active, interrupts, dispels, raid_median_dps, raid_median_dtps, fight_date)
      VALUES (?, 'TEST002', 2, 1, 'Heroic', 1000000, 0, 50000, 0, 300000,
              3333, 0, 166, 1, 1, 1, 100, 1, 1, 3, 2, 3000, 150, '2026-01-01')
    `, userId);

    const res = await request
      .get(`/api/analytics/my-performance-detail`)
      .set('Authorization', `Bearer ${userToken}`);

    const data = expectSuccess(res);
    expect(data.summary.consumableScore).toBe(100);
  });
});

// ── Fix 1: Death rate SQL ──────────────────────────────────────────────
describe('Bug Fix — Death rate calculation', () => {
  let adminToken, userId, userToken;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    adminToken = admin.token;
    const user = await createTestUser({ role: 'raider' });
    userId = user.userId;
    userToken = user.token;
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  it('calculates correct death rate (deaths / fights)', async () => {
    // Insert 4 fights: 2 with 1 death, 2 with 0 deaths = 2/4 = 0.5
    for (let i = 1; i <= 4; i++) {
      await db.run(`
        INSERT INTO player_fight_performance
        (user_id, report_code, fight_id, boss_id, difficulty, damage_done, healing_done,
         damage_taken, deaths, fight_duration_ms, dps, hps, dtps, health_potions,
         healthstones, combat_potions, flask_uptime_pct, food_buff_active,
         augment_rune_active, interrupts, dispels, raid_median_dps, raid_median_dtps, fight_date)
        VALUES (?, ?, ?, 1, 'Heroic', 1000000, 0, 50000, ?, 300000,
                3333, 0, 166, 0, 0, 0, 100, 1, 1, 0, 0, 3000, 150, '2026-01-01')
      `, userId, `DEATH_TEST_${i}`, i, i <= 2 ? 1 : 0);
    }

    const res = await request
      .get(`/api/analytics/my-performance-detail`)
      .set('Authorization', `Bearer ${userToken}`);

    const data = expectSuccess(res);
    // 2 deaths / 4 fights = 0.5
    expect(data.summary.deathRate).toBe(0.5);
  });
});

// ── Fix 3: Anti-snipe max extension cap ────────────────────────────────
describe('Bug Fix — Anti-snipe max extension cap', () => {
  let adminToken, userToken, userId;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await createTestUser({ role: 'admin' });
    adminToken = admin.token;
    const user = await createTestUser({ role: 'raider' });
    userId = user.userId;
    userToken = user.token;
    await setUserDkp(userId, 10000);
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  it('extends auction when bid is within snipe threshold', async () => {
    const auction = await createTestAuction(adminToken, { durationMinutes: 5 });

    // Set ends_at to 15 seconds from now (within 30s threshold)
    const soonEndsAt = new Date(Date.now() + 15000).toISOString();
    await db.run('UPDATE auctions SET ends_at = ? WHERE id = ?', soonEndsAt, auction.id);

    const res = await request
      .post(`/api/auctions/${auction.id}/bid`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: 10 });

    const data = expectSuccess(res);
    expect(data.timeExtended).toBe(true);
    expect(data.newEndsAt).toBeTruthy();
  });

  it('does NOT extend auction when max extension cap is reached', async () => {
    const auction = await createTestAuction(adminToken, { durationMinutes: 1 });
    const auctionId = auction.id;

    // Move created_at far enough into the past so original end time is well past
    // originalEndTime = created_at + 1min → set created_at to 7min ago → originalEnd = 6min ago
    const pastCreatedAt = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    await db.run('UPDATE auctions SET created_at = ? WHERE id = ?', pastCreatedAt, auctionId);

    // Set ends_at within snipe threshold (15s from now)
    // totalExtended = (now + 15s + 30s) - (now - 6min) ≈ 6min45s > 5min cap → blocked
    const soonEndsAt = new Date(Date.now() + 15000).toISOString();
    await db.run('UPDATE auctions SET ends_at = ? WHERE id = ?', soonEndsAt, auctionId);

    const res = await request
      .post(`/api/auctions/${auctionId}/bid`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ amount: 20 });

    const data = expectSuccess(res);
    expect(data.timeExtended).toBe(false);
  });

  it('exports MAX_SNIPE_EXTENSION_MS as 5 minutes', () => {
    expect(MAX_SNIPE_EXTENSION_MS).toBe(5 * 60 * 1000);
  });
});
