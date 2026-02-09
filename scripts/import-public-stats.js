import fetch from 'node-fetch';
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://dkp-christianyepesgomez.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzAxNTY2NTUsImlkIjoiYmMzNmI0ODQtMDExNy00MTkyLTkyYjMtODY0MzM4OGU5ODYzIiwicmlkIjoiNTU2ZDEwYjctMmM1My00ODBjLTk5YTEtMmM0Njk3OTlmMmFkIn0.dEZ_2bHHo18xoPhwJv6YmpNQnIcGcqrigQGKePJ5-OUSujnrYURgLiPIu5DO8X8lTgNUpmqrvY4o8rda2AuQDw'
});

// Get WCL access token
async function getAccessToken() {
  const tokenRes = await fetch('https://www.warcraftlogs.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&client_id=a0fca498-35b2-424f-b5c9-7d7522e623e2&client_secret=YMuWfAzw5l7fSHkso3ZKO2jzj5M65JY4lNHeQQzu'
  });
  const data = await tokenRes.json();
  return data.access_token;
}

// Helper to normalize difficulty
function normalizeDifficulty(d) {
  if (!d) return 'Normal';
  const diff = String(d).toLowerCase();
  if (diff.includes('mythic') || d === 5) return 'Mythic';
  if (diff.includes('heroic') || d === 4) return 'Heroic';
  if (diff.includes('normal') || d === 3) return 'Normal';
  return 'Normal';
}

// Process a single report
async function processReport(code, accessToken) {
  console.log('Processing report:', code);

  // Get fights from the report
  const query = `{
    reportData {
      report(code: "${code}") {
        title
        fights(killType: Encounters) {
          id
          encounterID
          name
          difficulty
          kill
          startTime
          endTime
        }
      }
    }
  }`;

  const res = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  const report = data.data?.reportData?.report;
  if (!report) {
    console.log('No report data');
    return;
  }

  console.log('Report:', report.title, '- Fights:', report.fights?.length || 0);

  for (const fight of report.fights || []) {
    const difficulty = normalizeDifficulty(fight.difficulty);
    const duration = fight.endTime - fight.startTime;

    // Find boss in database
    const boss = await client.execute({
      sql: 'SELECT id, name FROM wcl_bosses WHERE wcl_encounter_id = ?',
      args: [fight.encounterID]
    });

    if (!boss.rows.length) {
      console.log('  Boss not found:', fight.name, fight.encounterID);
      continue;
    }

    const bossId = boss.rows[0].id;
    const bossName = boss.rows[0].name;

    // Check if already processed
    const exists = await client.execute({
      sql: 'SELECT id FROM boss_stats_processed WHERE report_code = ? AND encounter_id = ? AND fight_id = ?',
      args: [code, fight.encounterID, fight.id]
    });

    if (exists.rows.length) {
      console.log('  Already processed:', bossName, fight.id);
      continue;
    }

    // Mark as processed
    await client.execute({
      sql: 'INSERT INTO boss_stats_processed (report_code, encounter_id, fight_id, difficulty, kill, fight_time_ms) VALUES (?, ?, ?, ?, ?, ?)',
      args: [code, fight.encounterID, fight.id, difficulty, fight.kill ? 1 : 0, duration]
    });

    // Update or create statistics
    const stats = await client.execute({
      sql: 'SELECT * FROM boss_statistics WHERE boss_id = ? AND difficulty = ?',
      args: [bossId, difficulty]
    });

    if (stats.rows.length) {
      const s = stats.rows[0];
      if (fight.kill) {
        const newKills = (s.total_kills || 0) + 1;
        const newTotalTime = (s.total_kill_time_ms || 0) + duration;
        const newAvg = Math.round(newTotalTime / newKills);
        const newFastest = s.fastest_kill_ms ? Math.min(s.fastest_kill_ms, duration) : duration;

        await client.execute({
          sql: 'UPDATE boss_statistics SET total_kills = ?, total_kill_time_ms = ?, avg_kill_time_ms = ?, fastest_kill_ms = ?, last_kill_date = date("now") WHERE id = ?',
          args: [newKills, newTotalTime, newAvg, newFastest, s.id]
        });
        console.log('  Kill:', bossName, difficulty, '- Total kills:', newKills);
      } else {
        await client.execute({
          sql: 'UPDATE boss_statistics SET total_wipes = total_wipes + 1 WHERE id = ?',
          args: [s.id]
        });
        console.log('  Wipe:', bossName, difficulty);
      }
    } else {
      // Create new
      const today = new Date().toISOString().split('T')[0];
      await client.execute({
        sql: 'INSERT INTO boss_statistics (boss_id, difficulty, total_kills, total_wipes, fastest_kill_ms, avg_kill_time_ms, total_kill_time_ms, last_kill_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          bossId, difficulty,
          fight.kill ? 1 : 0,
          fight.kill ? 0 : 1,
          fight.kill ? duration : null,
          fight.kill ? duration : null,
          fight.kill ? duration : 0,
          fight.kill ? today : null
        ]
      });
      console.log('  New:', bossName, difficulty, fight.kill ? 'KILL' : 'WIPE');
    }
  }
}

// Main
async function main() {
  const accessToken = await getAccessToken();

  // Process multiple reports
  const reports = ['ZX7fqKYRQnW2agk1', 'ycD1gJCVfwaKd7GM', 'fA42Ma3VhmBXjGnw', '3hxWHL6ybXJdfKpF', 'Z7hDqzLQGCbn4gxM'];
  for (const code of reports) {
    await processReport(code, accessToken);
  }

  // Show final stats
  const finalStats = await client.execute('SELECT bs.*, b.name as boss_name FROM boss_statistics bs JOIN wcl_bosses b ON bs.boss_id = b.id ORDER BY b.boss_order');
  console.log('\n=== Final Stats ===');
  for (const s of finalStats.rows) {
    console.log(s.boss_name, '-', s.difficulty, '- Kills:', s.total_kills, '- Wipes:', s.total_wipes);
  }
}

main().catch(console.error);
