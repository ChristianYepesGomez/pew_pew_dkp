/**
 * Script to recalculate wipes_to_first_kill for existing boss statistics
 * Usage: node scripts/recalculate-wipes-to-first-kill.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { db, initDatabase } from '../database.js';

async function main() {
  console.log('🔄 Recalculating wipes_to_first_kill for existing data...\n');

  await initDatabase();

  // Get all boss/difficulty combos that have kills
  const stats = await db.all(`
    SELECT bs.*, b.name as boss_name
    FROM boss_statistics bs
    JOIN wcl_bosses b ON bs.boss_id = b.id
    WHERE bs.total_kills > 0
  `);

  console.log(`Found ${stats.length} boss/difficulty combos with kills\n`);

  for (const stat of stats) {
    // Get all processed fights for this boss/difficulty ordered by processing time
    const fights = await db.all(`
      SELECT kill, processed_at
      FROM boss_stats_processed
      WHERE encounter_id = (SELECT wcl_encounter_id FROM wcl_bosses WHERE id = ?)
        AND difficulty = ?
      ORDER BY processed_at ASC
    `, stat.boss_id, stat.difficulty);

    // Count wipes before the first kill
    let wipesBeforeFirstKill = 0;
    let foundFirstKill = false;
    let firstKillDate = null;

    for (const fight of fights) {
      if (fight.kill) {
        if (!foundFirstKill) {
          foundFirstKill = true;
          firstKillDate = fight.processed_at ? fight.processed_at.split('T')[0] : null;
        }
        break; // Stop after first kill
      }
      wipesBeforeFirstKill++;
    }

    if (foundFirstKill) {
      // Update the stats
      await db.run(`
        UPDATE boss_statistics
        SET wipes_to_first_kill = ?, first_kill_date = COALESCE(first_kill_date, ?)
        WHERE id = ?
      `, wipesBeforeFirstKill, firstKillDate, stat.id);

      console.log(`✅ ${stat.boss_name} (${stat.difficulty}): ${wipesBeforeFirstKill} wipes to first kill`);
    } else {
      console.log(`⚠️  ${stat.boss_name} (${stat.difficulty}): No kill found in processed data`);
    }
  }

  console.log('\n✅ Recalculation complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
