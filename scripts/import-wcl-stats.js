/**
 * Script to import WCL reports for boss statistics (testing/seeding)
 *
 * Usage: node scripts/import-wcl-stats.js
 *
 * Requires: Backend server running, admin user credentials set in environment
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'chris';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const WCL_REPORTS = [
  'https://www.warcraftlogs.com/reports/pBwWjLCGZbHyadYP',
  'https://www.warcraftlogs.com/reports/8T2dgLJk3GQ9yhmq',
  'https://www.warcraftlogs.com/reports/kWt9Yz6D1LcmdwhJ',
  'https://www.warcraftlogs.com/reports/hXgm9r7P1nG3xWzY',
];

async function login() {
  console.log('🔐 Logging in as admin...');
  const response = await axios.post(`${API_URL}/auth/login`, {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  return response.data.token;
}

async function importBossStats(token, url) {
  console.log(`\n📊 Importing: ${url}`);
  try {
    const response = await axios.post(
      `${API_URL}/warcraftlogs/import-boss-stats`,
      { url },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { report, stats, bosses } = response.data;
    console.log(`   📝 Report: ${report.title}`);
    console.log(`   ⚔️  Bosses: ${report.bossesKilled}/${report.totalBosses} killed`);
    console.log(`   📈 Processed: ${stats.processed} fights (${stats.skipped} skipped)`);

    if (bosses && bosses.length > 0) {
      console.log('   🏰 Boss results:');
      for (const boss of bosses) {
        const status = boss.kill ? '✅ Kill' : '❌ Wipe';
        const time = Math.round(boss.duration / 1000);
        console.log(`      - ${boss.name} (${boss.difficulty}): ${status} (${time}s)`);
      }
    }

    return response.data;
  } catch (error) {
    console.error(`   ❌ Error: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 WCL Boss Stats Import Tool');
  console.log('=============================\n');

  try {
    const token = await login();
    console.log('✅ Logged in successfully');

    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const url of WCL_REPORTS) {
      const result = await importBossStats(token, url);
      if (result) {
        totalProcessed += result.stats.processed;
        totalSkipped += result.stats.skipped;
      }
    }

    console.log('\n=============================');
    console.log(`📊 Total: ${totalProcessed} fights processed, ${totalSkipped} skipped`);
    console.log('✅ Import complete!');
  } catch (error) {
    console.error('❌ Fatal error:', error.response?.data?.error || error.message);
    process.exit(1);
  }
}

main();
