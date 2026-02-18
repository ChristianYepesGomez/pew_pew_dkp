/**
 * Seed fake but realistic player_fight_performance data for leaderboard testing.
 * Run with: node scripts/seed-fight-performance.js
 */
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rf = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(1));

// ── Player profiles ──────────────────────────────────────────────────────────
// role: 'dps' | 'healer' | 'tank'
// dps/hps: [min, max] per second (realistic TWW heroic numbers)
// dtps: typical damage taken per second
// interrupts: avg per fight (some classes kick more)
const PROFILES = {
  2:  { name: 'Inkail',    role: 'healer', hps: [220000, 420000], dps: [15000, 40000],  dtps: [8000, 25000],  interrupts: [0, 2],  potions: [0.4, 0.9] },
  3:  { name: 'Chillss',   role: 'dps',    dps: [320000, 560000], hps: [5000, 20000],   dtps: [20000, 70000], interrupts: [2, 8],  potions: [0.5, 1.0] },
  4:  { name: 'Casadich',  role: 'healer', hps: [180000, 360000], dps: [12000, 35000],  dtps: [7000, 22000],  interrupts: [1, 5],  potions: [0.3, 0.8] },
  5:  { name: 'Ásthar',    role: 'dps',    dps: [260000, 480000], hps: [8000, 25000],   dtps: [18000, 55000], interrupts: [0, 3],  potions: [0.5, 1.0] },
  6:  { name: 'Kraven',    role: 'dps',    dps: [210000, 400000], hps: [10000, 30000],  dtps: [15000, 50000], interrupts: [0, 2],  potions: [0.4, 0.9] },
  7:  { name: 'Zreox',     role: 'dps',    dps: [240000, 440000], hps: [4000, 15000],   dtps: [18000, 60000], interrupts: [2, 7],  potions: [0.6, 1.0] },
  8:  { name: 'Zohg',      role: 'dps',    dps: [200000, 380000], hps: [3000, 12000],   dtps: [12000, 45000], interrupts: [0, 4],  potions: [0.4, 0.9] },
  9:  { name: 'Auba',      role: 'dps',    dps: [180000, 360000], hps: [4000, 15000],   dtps: [15000, 55000], interrupts: [1, 6],  potions: [0.5, 1.0] },
  10: { name: 'Vheissu',   role: 'healer', hps: [200000, 400000], dps: [10000, 28000],  dtps: [6000, 20000],  interrupts: [0, 2],  potions: [0.3, 0.7] },
  11: { name: 'Brewzlee',  role: 'healer', hps: [170000, 340000], dps: [12000, 32000],  dtps: [8000, 28000],  interrupts: [2, 6],  potions: [0.4, 0.8] },
  12: { name: 'Misifuu',   role: 'tank',   dps: [80000, 160000],  hps: [5000, 18000],   dtps: [280000, 520000],interrupts: [3, 10], potions: [0.5, 1.0] },
  13: { name: 'Zoila',     role: 'dps',    dps: [160000, 320000], hps: [3000, 10000],   dtps: [10000, 40000], interrupts: [0, 3],  potions: [0.3, 0.7] },
  14: { name: 'Galartxu',  role: 'dps',    dps: [230000, 450000], hps: [5000, 18000],   dtps: [22000, 65000], interrupts: [0, 2],  potions: [0.4, 0.9] },
  15: { name: 'Dlenian',   role: 'dps',    dps: [190000, 370000], hps: [8000, 22000],   dtps: [16000, 52000], interrupts: [1, 5],  potions: [0.4, 0.9] },
};

// Simulate 3 weeks of raids, 8 bosses each
const WEEKS = [
  { reportCode: 'SEED_WEEK1', dateOffset: 21 },
  { reportCode: 'SEED_WEEK2', dateOffset: 14 },
  { reportCode: 'SEED_WEEK3', dateOffset: 7  },
];

const BOSSES = [
  { bossId: 9001, name: 'Vexie',        durationRange: [210000, 300000] },
  { bossId: 9002, name: 'Cauldron',     durationRange: [240000, 330000] },
  { bossId: 9003, name: 'Rik Reverb',   durationRange: [180000, 270000] },
  { bossId: 9004, name: 'Stix Bunkjunker', durationRange: [300000, 420000] },
  { bossId: 9005, name: 'One-Armed',    durationRange: [270000, 390000] },
  { bossId: 9006, name: 'Sprocketmonger', durationRange: [360000, 480000] },
  { bossId: 9007, name: 'Mug\'Zee',    durationRange: [300000, 420000] },
  { bossId: 9008, name: 'Chrome King', durationRange: [420000, 540000] },
];

async function clearSeedData() {
  await client.execute(`DELETE FROM player_fight_performance WHERE report_code LIKE 'SEED_%'`);
  console.log('Cleared existing seed data');
}

async function seedFightPerformance() {
  let inserted = 0;

  for (const week of WEEKS) {
    const { reportCode, dateOffset } = week;
    const fightDate = new Date();
    fightDate.setDate(fightDate.getDate() - dateOffset);
    const dateStr = fightDate.toISOString().split('T')[0];

    for (let bossIdx = 0; bossIdx < BOSSES.length; bossIdx++) {
      const boss = BOSSES[bossIdx];
      const fightId = bossIdx + 1;
      const durationMs = ri(boss.durationRange[0], boss.durationRange[1]);
      const durationSec = durationMs / 1000;
      const difficulty = 'Heroic';

      // Compute raid median DPS from DPS players
      const dpsValues = [];
      for (const [, p] of Object.entries(PROFILES)) {
        if (p.role === 'dps') dpsValues.push(rf(p.dps[0], p.dps[1]));
      }
      dpsValues.sort((a, b) => a - b);
      const mid = Math.floor(dpsValues.length / 2);
      const medianDps = dpsValues.length % 2 !== 0
        ? dpsValues[mid]
        : (dpsValues[mid - 1] + dpsValues[mid]) / 2;

      const dtpsValues = [];
      for (const [, p] of Object.entries(PROFILES)) {
        if (p.role !== 'healer') dtpsValues.push(rf(p.dtps[0], p.dtps[1]));
      }
      dtpsValues.sort((a, b) => a - b);
      const midD = Math.floor(dtpsValues.length / 2);
      const medianDtps = dtpsValues.length % 2 !== 0
        ? dtpsValues[midD]
        : (dtpsValues[midD - 1] + dtpsValues[midD]) / 2;

      for (const [userIdStr, profile] of Object.entries(PROFILES)) {
        const userId = parseInt(userIdStr, 10);

        // Skip ~15% of fights (player absent)
        if (Math.random() < 0.15) continue;

        let dps, hps, dtps, damageDone, healingDone, damageTaken;

        if (profile.role === 'healer') {
          hps = rf(profile.hps[0], profile.hps[1]);
          dps = rf(profile.dps[0], profile.dps[1]);
          dtps = rf(profile.dtps[0], profile.dtps[1]);
          healingDone = Math.round(hps * durationSec);
          damageDone = Math.round(dps * durationSec);
        } else {
          dps = rf(profile.dps[0], profile.dps[1]);
          hps = rf(profile.hps[0], profile.hps[1]);
          dtps = rf(profile.dtps[0], profile.dtps[1]);
          damageDone = Math.round(dps * durationSec);
          healingDone = Math.round(hps * durationSec);
        }
        damageTaken = Math.round(dtps * durationSec);

        const deaths = Math.random() < 0.12 ? 1 : 0;
        const healthPotions = Math.random() < profile.potions[1] ? (Math.random() < profile.potions[0] ? 2 : 1) : 0;
        const healthstones = Math.random() < 0.5 ? 1 : 0;
        const combatPotions = profile.role !== 'healer' && Math.random() < 0.75 ? 1 : 0;
        const flaskUptime = rf(72, 100);
        const foodBuff = Math.random() < 0.88 ? 1 : 0;
        const augmentRune = profile.role === 'dps' && Math.random() < 0.6 ? 1 : 0;
        const interrupts = ri(profile.interrupts[0], profile.interrupts[1]);
        const dispels = Math.random() < 0.3 ? ri(0, 3) : 0;
        // Realistic WCL percentiles: DPS players 30-99, healers 25-95, tanks lower
        const dpsPercentile = profile.role === 'dps' ? rf(30, 99) : (profile.role === 'tank' ? rf(15, 80) : null);
        const hpsPercentile = profile.role === 'healer' ? rf(25, 95) : null;

        try {
          await client.execute({
            sql: `INSERT OR IGNORE INTO player_fight_performance
                  (user_id, report_code, fight_id, boss_id, difficulty,
                   damage_done, healing_done, damage_taken, deaths, fight_duration_ms,
                   dps, hps, dtps, health_potions, healthstones, combat_potions,
                   flask_uptime_pct, food_buff_active, augment_rune_active,
                   interrupts, dispels, raid_median_dps, raid_median_dtps, fight_date,
                   dps_percentile, hps_percentile)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: [
              userId, reportCode, fightId, boss.bossId, difficulty,
              damageDone, healingDone, damageTaken, deaths, durationMs,
              dps, hps, dtps,
              healthPotions, healthstones, combatPotions,
              flaskUptime, foodBuff, augmentRune,
              interrupts, dispels,
              medianDps, medianDtps,
              dateStr,
              dpsPercentile, hpsPercentile,
            ],
          });
          inserted++;
        } catch (err) {
          if (!err.message?.includes('UNIQUE')) console.error(err.message);
        }
      }
    }
    console.log(`Week ${reportCode} done`);
  }

  return inserted;
}

async function main() {
  console.log('Seeding player_fight_performance...\n');
  await clearSeedData();
  const count = await seedFightPerformance();
  console.log(`\nInserted ${count} fight performance records`);

  // Preview leaderboards
  console.log('\n=== Top DPS (best single fight) ===');
  const topDps = await client.execute(`
    SELECT u.character_name, ROUND(MAX(pfp.dps)) as best_dps, COUNT(*) as fights
    FROM player_fight_performance pfp JOIN users u ON pfp.user_id = u.id
    WHERE pfp.dps > 0 GROUP BY pfp.user_id
    HAVING SUM(pfp.healing_done) < SUM(pfp.damage_done)
    ORDER BY best_dps DESC LIMIT 5
  `);
  for (const r of topDps.rows) console.log(`  ${r.character_name}: ${(r.best_dps/1000).toFixed(0)}K DPS (${r.fights} fights)`);

  console.log('\n=== Top HPS (best single fight) ===');
  const topHps = await client.execute(`
    SELECT u.character_name, ROUND(MAX(pfp.hps)) as best_hps, COUNT(*) as fights
    FROM player_fight_performance pfp JOIN users u ON pfp.user_id = u.id
    WHERE pfp.hps > 0 GROUP BY pfp.user_id
    HAVING SUM(pfp.healing_done) > SUM(pfp.damage_done)
    ORDER BY best_hps DESC LIMIT 5
  `);
  for (const r of topHps.rows) console.log(`  ${r.character_name}: ${(r.best_hps/1000).toFixed(0)}K HPS (${r.fights} fights)`);

  console.log('\n=== Top DTPS (worst single fight, excl. tanks/healers) ===');
  const topDtps = await client.execute(`
    SELECT u.character_name, ROUND(MAX(pfp.dtps)) as worst_dtps, COUNT(*) as fights
    FROM player_fight_performance pfp JOIN users u ON pfp.user_id = u.id
    WHERE pfp.dtps > 0 GROUP BY pfp.user_id
    HAVING SUM(pfp.healing_done) < SUM(pfp.damage_done)
      AND SUM(pfp.damage_taken) < SUM(pfp.damage_done) * 3
    ORDER BY worst_dtps DESC LIMIT 5
  `);
  for (const r of topDtps.rows) console.log(`  ${r.character_name}: ${(r.worst_dtps/1000).toFixed(0)}K DTPS (${r.fights} fights)`);

  console.log('\n=== Top Potions ===');
  const topPotions = await client.execute(`
    SELECT u.character_name, SUM(pfp.health_potions) as total
    FROM player_fight_performance pfp JOIN users u ON pfp.user_id = u.id
    GROUP BY pfp.user_id HAVING total > 0 ORDER BY total DESC LIMIT 5
  `);
  for (const r of topPotions.rows) console.log(`  ${r.character_name}: ${r.total} potions`);

  console.log('\n=== Top Interrupts ===');
  const topInterrupts = await client.execute(`
    SELECT u.character_name, SUM(pfp.interrupts) as total
    FROM player_fight_performance pfp JOIN users u ON pfp.user_id = u.id
    GROUP BY pfp.user_id HAVING total > 0 ORDER BY total DESC LIMIT 5
  `);
  for (const r of topInterrupts.rows) console.log(`  ${r.character_name}: ${r.total} interrupts`);

  console.log('\n=== Top Dispels ===');
  const topDispels = await client.execute(`
    SELECT u.character_name, SUM(pfp.dispels) as total
    FROM player_fight_performance pfp JOIN users u ON pfp.user_id = u.id
    GROUP BY pfp.user_id HAVING total > 0 ORDER BY total DESC LIMIT 5
  `);
  for (const r of topDispels.rows) console.log(`  ${r.character_name}: ${r.total} dispels`);

  console.log('\n=== Top Combat Potions ===');
  const topCombatPotions = await client.execute(`
    SELECT u.character_name, SUM(pfp.combat_potions) as total
    FROM player_fight_performance pfp JOIN users u ON pfp.user_id = u.id
    GROUP BY pfp.user_id HAVING total > 0 ORDER BY total DESC LIMIT 5
  `);
  for (const r of topCombatPotions.rows) console.log(`  ${r.character_name}: ${r.total} combat potions`);

  console.log('\n=== Top Percentile WCL ===');
  const topPercentile = await client.execute(`
    WITH best AS (
      SELECT user_id, MAX(COALESCE(dps_percentile, hps_percentile)) as best_pct
      FROM player_fight_performance
      WHERE dps_percentile IS NOT NULL OR hps_percentile IS NOT NULL
      GROUP BY user_id
    )
    SELECT u.character_name, ROUND(b.best_pct, 1) as pct
    FROM best b JOIN users u ON b.user_id = u.id
    ORDER BY pct DESC LIMIT 5
  `);
  for (const r of topPercentile.rows) console.log(`  ${r.character_name}: ${r.pct}%`);
}

main().catch(console.error);
