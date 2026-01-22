/**
 * Scheduled tasks for DKP management
 * These can be run via cron jobs or integrated with a task scheduler
 */

import { db } from '../database.js';

/**
 * Apply weekly DKP decay
 * Recommended to run every Monday at midnight
 * 
 * @param {number} decayPercentage - Percentage to decay (e.g., 10 for 10%)
 * @param {number} minimumDkp - Minimum DKP after decay (default 0)
 */
export function applyWeeklyDecay(decayPercentage = 10, minimumDkp = 0) {
  console.log(`🔄 Applying ${decayPercentage}% weekly DKP decay...`);

  const multiplier = 1 - (decayPercentage / 100);

  // Get all members' current DKP before decay
  const members = db.prepare(`
    SELECT user_id, current_dkp FROM member_dkp WHERE current_dkp > ?
  `).all(minimumDkp);

  // Start transaction
  const updateDkp = db.prepare(`
    UPDATE member_dkp 
    SET current_dkp = MAX(?, CAST(current_dkp * ? AS INTEGER)),
        last_decay_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);

  const logDecay = db.prepare(`
    INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
    VALUES (?, ?, 'Weekly DKP decay', NULL)
  `);

  const transaction = db.transaction(() => {
    for (const member of members) {
      const decayAmount = Math.floor(member.current_dkp * (decayPercentage / 100));
      const newDkp = Math.max(minimumDkp, member.current_dkp - decayAmount);
      
      updateDkp.run(minimumDkp, multiplier, member.user_id);
      
      if (decayAmount > 0) {
        logDecay.run(member.user_id, -decayAmount);
      }
    }
  });

  transaction();

  console.log(`✅ Decay applied to ${members.length} members`);
  return { affectedMembers: members.length, decayPercentage };
}

/**
 * Clean up old transaction logs
 * Keep only the last N days of history
 * 
 * @param {number} daysToKeep - Number of days to retain (default 90)
 */
export function cleanupOldTransactions(daysToKeep = 90) {
  console.log(`🧹 Cleaning up transactions older than ${daysToKeep} days...`);

  const result = db.prepare(`
    DELETE FROM dkp_transactions 
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `).run(daysToKeep);

  console.log(`✅ Removed ${result.changes} old transactions`);
  return { deletedCount: result.changes };
}

/**
 * Generate weekly DKP report
 */
export function generateWeeklyReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {},
    topEarners: [],
    topSpenders: [],
    auctionStats: {}
  };

  // Get total DKP in circulation
  const dkpStats = db.prepare(`
    SELECT 
      SUM(current_dkp) as total_dkp,
      AVG(current_dkp) as avg_dkp,
      MAX(current_dkp) as max_dkp,
      MIN(current_dkp) as min_dkp,
      COUNT(*) as member_count
    FROM member_dkp
    JOIN users ON member_dkp.user_id = users.id
    WHERE users.is_active = 1
  `).get();

  report.summary = dkpStats;

  // Top earners this week
  report.topEarners = db.prepare(`
    SELECT 
      u.character_name,
      u.character_class,
      SUM(dt.amount) as earned
    FROM dkp_transactions dt
    JOIN users u ON dt.user_id = u.id
    WHERE dt.amount > 0 
      AND dt.created_at >= datetime('now', '-7 days')
    GROUP BY dt.user_id
    ORDER BY earned DESC
    LIMIT 10
  `).all();

  // Top spenders this week
  report.topSpenders = db.prepare(`
    SELECT 
      u.character_name,
      u.character_class,
      ABS(SUM(dt.amount)) as spent
    FROM dkp_transactions dt
    JOIN users u ON dt.user_id = u.id
    WHERE dt.amount < 0 
      AND dt.created_at >= datetime('now', '-7 days')
      AND dt.reason LIKE 'Won auction:%'
    GROUP BY dt.user_id
    ORDER BY spent DESC
    LIMIT 10
  `).all();

  // Auction stats
  report.auctionStats = db.prepare(`
    SELECT 
      COUNT(*) as total_auctions,
      SUM(winning_bid) as total_dkp_spent,
      AVG(winning_bid) as avg_winning_bid
    FROM auctions
    WHERE status = 'completed'
      AND ended_at >= datetime('now', '-7 days')
  `).get();

  return report;
}

/**
 * Check for inactive members
 * Members who haven't attended raids in N days
 * 
 * @param {number} inactiveDays - Days threshold for inactivity
 */
export function findInactiveMembers(inactiveDays = 30) {
  const inactive = db.prepare(`
    SELECT 
      u.id,
      u.character_name,
      u.character_class,
      md.current_dkp,
      MAX(ra.joined_at) as last_raid
    FROM users u
    JOIN member_dkp md ON u.id = md.user_id
    LEFT JOIN raid_attendance ra ON u.id = ra.user_id
    WHERE u.is_active = 1
    GROUP BY u.id
    HAVING last_raid IS NULL 
       OR last_raid < datetime('now', '-' || ? || ' days')
    ORDER BY last_raid ASC
  `).all(inactiveDays);

  return inactive;
}

// If running directly as a script
const args = process.argv.slice(2);
if (args[0] === 'decay') {
  const percentage = parseInt(args[1]) || 10;
  applyWeeklyDecay(percentage);
} else if (args[0] === 'cleanup') {
  const days = parseInt(args[1]) || 90;
  cleanupOldTransactions(days);
} else if (args[0] === 'report') {
  const report = generateWeeklyReport();
  console.log(JSON.stringify(report, null, 2));
} else if (args[0] === 'inactive') {
  const days = parseInt(args[1]) || 30;
  const inactive = findInactiveMembers(days);
  console.log('Inactive members:', inactive);
}

export default {
  applyWeeklyDecay,
  cleanupOldTransactions,
  generateWeeklyReport,
  findInactiveMembers
};
