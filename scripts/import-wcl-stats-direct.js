/**
 * Direct script to import WCL reports for boss statistics
 * Uses services directly, no API/auth needed
 *
 * Usage: node scripts/import-wcl-stats-direct.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { processWarcraftLog } from '../services/warcraftlogs.js';
import { seedRaidData, processFightStats } from '../services/raids.js';
import { initDatabase } from '../database.js';

const WCL_REPORTS = [
  'https://www.warcraftlogs.com/reports/pBwWjLCGZbHyadYP',
  'https://www.warcraftlogs.com/reports/8T2dgLJk3GQ9yhmq',
  'https://www.warcraftlogs.com/reports/kWt9Yz6D1LcmdwhJ',
  'https://www.warcraftlogs.com/reports/hXgm9r7P1nG3xWzY',
];

async function importBossStats(url) {
  console.log(`\n📊 Processing: ${url}`);
  try {
    // Get report data from WCL
    const reportData = await processWarcraftLog(url);

    console.log(`   📝 Report: ${reportData.title}`);
    console.log(`   ⚔️  Fights: ${reportData.fights.length} total`);
    console.log(`   👥 Participants: ${reportData.participantCount}`);

    let processed = 0;
    let skipped = 0;
    const bossResults = [];

    // Process each fight
    for (const fight of reportData.fights) {
      const result = await processFightStats(reportData.code, fight, fight.difficulty);

      if (result.skipped) {
        skipped++;
        console.log(`   ⏭️  Skipped: ${fight.name} (${result.reason})`);
      } else {
        processed++;
        const status = result.kill ? '✅ Kill' : '❌ Wipe';
        const time = Math.round(fight.duration / 1000);
        console.log(`   ${status} ${fight.name} (${fight.difficulty || 'Normal'}) - ${time}s`);
        bossResults.push({
          name: fight.name,
          difficulty: fight.difficulty,
          kill: result.kill,
          duration: fight.duration
        });
      }
    }

    console.log(`   📈 Result: ${processed} processed, ${skipped} skipped`);
    return { processed, skipped, bossResults };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { processed: 0, skipped: 0, bossResults: [] };
  }
}

async function main() {
  console.log('🚀 WCL Boss Stats Direct Import');
  console.log('================================');

  try {
    // Initialize database
    console.log('\n📦 Initializing database...');
    await initDatabase();

    // Seed raid data to ensure boss definitions exist
    console.log('\n🏰 Seeding raid/boss definitions...');
    await seedRaidData();

    let totalProcessed = 0;
    let totalSkipped = 0;

    // Process each report
    for (const url of WCL_REPORTS) {
      const result = await importBossStats(url);
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
    }

    console.log('\n================================');
    console.log(`📊 TOTAL: ${totalProcessed} fights imported, ${totalSkipped} skipped`);
    console.log('✅ Import complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
