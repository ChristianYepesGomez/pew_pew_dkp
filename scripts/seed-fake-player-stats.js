import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Get all users from roster
  const users = await client.execute(`
    SELECT id, character_name, character_class
    FROM users
    WHERE is_active = 1 AND character_name IS NOT NULL
  `);

  console.log('Users found:', users.rows.length);
  if (users.rows.length === 0) {
    console.log('No users found!');
    return;
  }

  // Ensure Dimensius Mythic has a boss_statistics row (0 kills, 6 wipes)
  const dimensius = await client.execute(`
    SELECT id FROM wcl_bosses WHERE wcl_encounter_id = 3135
  `);
  if (dimensius.rows.length > 0) {
    const dimId = dimensius.rows[0].id;
    const dimStats = await client.execute({
      sql: 'SELECT id FROM boss_statistics WHERE boss_id = ? AND difficulty = ?',
      args: [dimId, 'Mythic']
    });
    if (dimStats.rows.length === 0) {
      await client.execute({
        sql: 'INSERT INTO boss_statistics (boss_id, difficulty, total_kills, total_wipes) VALUES (?, ?, 0, 6)',
        args: [dimId, 'Mythic']
      });
      console.log('Created Dimensius Mythic stats: 0 kills, 6 wipes');
    } else {
      // Ensure it has wipes
      await client.execute({
        sql: 'UPDATE boss_statistics SET total_wipes = MAX(total_wipes, 6) WHERE boss_id = ? AND difficulty = ?',
        args: [dimId, 'Mythic']
      });
      console.log('Ensured Dimensius Mythic has at least 6 wipes');
    }
  }

  // Get all bosses with statistics (including 0-kill bosses with wipes)
  const bosses = await client.execute(`
    SELECT b.id, b.name, bs.difficulty, bs.total_kills, bs.total_wipes
    FROM wcl_bosses b
    JOIN boss_statistics bs ON b.id = bs.boss_id
    WHERE bs.total_kills > 0 OR bs.total_wipes > 0
  `);

  console.log('Bosses with kills:', bosses.rows.length);

  // Helper to get random user
  const randomUser = () => users.rows[Math.floor(Math.random() * users.rows.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // For each boss, create death leaderboard and records
  for (const boss of bosses.rows) {
    console.log(`\nProcessing: ${boss.name} (${boss.difficulty})`);

    // Create death entries for 5-10 random players
    const deathCount = randomInt(5, Math.min(10, users.rows.length));
    const usedUsers = new Set();

    for (let i = 0; i < deathCount; i++) {
      let user;
      do {
        user = randomUser();
      } while (usedUsers.has(user.id));
      usedUsers.add(user.id);

      const deaths = randomInt(1, 15);
      const fights = randomInt(deaths, deaths + 10);

      // Check if exists
      const existing = await client.execute({
        sql: 'SELECT id FROM player_boss_deaths WHERE user_id = ? AND boss_id = ? AND difficulty = ?',
        args: [user.id, boss.id, boss.difficulty]
      });

      if (existing.rows.length === 0) {
        await client.execute({
          sql: 'INSERT INTO player_boss_deaths (user_id, boss_id, difficulty, total_deaths, total_fights) VALUES (?, ?, ?, ?, ?)',
          args: [user.id, boss.id, boss.difficulty, deaths, fights]
        });
        console.log(`  Death: ${user.character_name} - ${deaths} deaths in ${fights} fights`);
      }
    }

    // Create records (top damage, top healing, most damage taken)
    const recordTypes = ['top_damage', 'top_healing', 'most_damage_taken'];

    for (const recordType of recordTypes) {
      const user = randomUser();
      let value;

      if (recordType === 'top_damage') {
        value = randomInt(800000000, 2500000000); // 800M - 2.5B
      } else if (recordType === 'top_healing') {
        value = randomInt(400000000, 1200000000); // 400M - 1.2B
      } else {
        value = randomInt(50000000, 300000000); // 50M - 300M
      }

      // Check if exists
      const existing = await client.execute({
        sql: 'SELECT id FROM boss_records WHERE boss_id = ? AND difficulty = ? AND record_type = ?',
        args: [boss.id, boss.difficulty, recordType]
      });

      if (existing.rows.length === 0) {
        await client.execute({
          sql: `INSERT INTO boss_records (boss_id, difficulty, record_type, user_id, value, character_name, character_class, report_code, fight_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [boss.id, boss.difficulty, recordType, user.id, value, user.character_name, user.character_class, 'FAKE123', 1]
        });
        console.log(`  Record ${recordType}: ${user.character_name} - ${(value / 1000000).toFixed(1)}M`);
      }
    }

    // Create kill log entries (only for bosses with actual kills)
    const kills = boss.total_kills || 0;
    for (let i = 0; i < kills; i++) {
      const killTime = randomInt(180000, 480000); // 3-8 minutes
      const existing = await client.execute({
        sql: 'SELECT id FROM boss_kill_log WHERE boss_id = ? AND difficulty = ? AND fight_id = ?',
        args: [boss.id, boss.difficulty, i + 100]
      });

      if (existing.rows.length === 0) {
        await client.execute({
          sql: `INSERT INTO boss_kill_log (boss_id, difficulty, report_code, fight_id, kill_time_ms, kill_date)
                VALUES (?, ?, ?, ?, ?, date('now', '-' || ? || ' days'))`,
          args: [boss.id, boss.difficulty, 'FAKE' + (i + 1), i + 100, killTime, randomInt(1, 30)]
        });
      }
    }
  }

  // Show summary
  console.log('\n=== Summary ===');

  const deathsCount = await client.execute('SELECT COUNT(*) as c FROM player_boss_deaths');
  const recordsCount = await client.execute('SELECT COUNT(*) as c FROM boss_records');
  const killLogsCount = await client.execute('SELECT COUNT(*) as c FROM boss_kill_log');

  console.log('Player death entries:', deathsCount.rows[0].c);
  console.log('Boss records:', recordsCount.rows[0].c);
  console.log('Kill logs:', killLogsCount.rows[0].c);

  // Show top deaths
  console.log('\n=== Top Deaths (sample) ===');
  const topDeaths = await client.execute(`
    SELECT pbd.*, u.character_name, b.name as boss_name
    FROM player_boss_deaths pbd
    JOIN users u ON pbd.user_id = u.id
    JOIN wcl_bosses b ON pbd.boss_id = b.id
    ORDER BY pbd.total_deaths DESC
    LIMIT 5
  `);
  for (const d of topDeaths.rows) {
    console.log(`${d.character_name}: ${d.total_deaths} deaths on ${d.boss_name} (${d.difficulty})`);
  }
}

main().catch(console.error);
