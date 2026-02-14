import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { getPlayerDetailedPerformance } from '../services/performanceAnalysis.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Analytics');
const router = Router();

// Attendance analytics
router.get('/attendance', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 8;
    const results = await db.all(`
      SELECT u.id, u.character_name, u.character_class,
        COUNT(CASE WHEN ma.status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN ma.status = 'tentative' THEN 1 END) as tentative,
        COUNT(CASE WHEN ma.status = 'declined' THEN 1 END) as declined,
        COUNT(ma.id) as total_signups
      FROM users u
      LEFT JOIN member_availability ma ON u.id = ma.user_id
        AND ma.raid_date >= date('now', '-' || ? || ' days')
      WHERE u.role IN ('admin', 'officer', 'raider')
      GROUP BY u.id
      ORDER BY confirmed DESC
    `, weeks * 7);

    // Get total raid days in period
    const raidDayCount = await db.get(`
      SELECT COUNT(DISTINCT raid_date) as total
      FROM member_availability
      WHERE raid_date >= date('now', '-' || ? || ' days')
    `, weeks * 7);

    res.json({
      members: results,
      totalRaidDays: raidDayCount?.total || 0,
      weeks,
    });
  } catch (error) {
    log.error('Analytics attendance error', error);
    res.status(500).json({ error: 'Failed to get attendance analytics' });
  }
});

// DKP trends
router.get('/dkp-trends', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 12;
    const trends = await db.all(`
      SELECT
        strftime('%Y-%W', created_at) as week,
        MIN(date(created_at)) as week_start,
        SUM(CASE WHEN amount > 0 AND reason NOT LIKE '%Decay%' THEN amount ELSE 0 END) as gained,
        SUM(CASE WHEN amount < 0 AND reason NOT LIKE '%Decay%' THEN ABS(amount) ELSE 0 END) as spent,
        SUM(CASE WHEN reason LIKE '%Decay%' THEN ABS(amount) ELSE 0 END) as decayed,
        COUNT(*) as transactions
      FROM dkp_transactions
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY week
      ORDER BY week ASC
    `, weeks * 7);

    res.json(trends);
  } catch (error) {
    log.error('Analytics DKP trends error', error);
    res.status(500).json({ error: 'Failed to get DKP trends' });
  }
});

// DKP economy overview
router.get('/economy', authenticateToken, async (req, res) => {
  try {
    const economy = await db.get(`
      SELECT
        COALESCE(SUM(current_dkp), 0) as total_circulation,
        COALESCE(AVG(current_dkp), 0) as avg_dkp,
        COALESCE(MIN(current_dkp), 0) as min_dkp,
        COALESCE(MAX(current_dkp), 0) as max_dkp,
        COUNT(*) as member_count
      FROM member_dkp
    `);

    // This week's activity
    const weekActivity = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as gained_this_week,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spent_this_week
      FROM dkp_transactions
      WHERE created_at >= date('now', '-7 days')
    `);

    // Top 5 by DKP
    const topMembers = await db.all(`
      SELECT md.current_dkp, u.character_name, u.character_class
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      ORDER BY md.current_dkp DESC
      LIMIT 5
    `);

    res.json({
      ...economy,
      ...weekActivity,
      topMembers,
    });
  } catch (error) {
    log.error('Analytics economy error', error);
    res.status(500).json({ error: 'Failed to get economy analytics' });
  }
});

// Auction analytics
router.get('/auctions', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 8;
    const stats = await db.get(`
      SELECT
        COUNT(*) as total_auctions,
        COALESCE(AVG(winning_bid), 0) as avg_price,
        COALESCE(MAX(winning_bid), 0) as max_price,
        COALESCE(MIN(CASE WHEN winning_bid > 0 THEN winning_bid END), 0) as min_price
      FROM auctions
      WHERE status = 'completed' AND ended_at >= date('now', '-' || ? || ' days')
    `, weeks * 7);

    // By rarity
    const byRarity = await db.all(`
      SELECT item_rarity, COUNT(*) as count, COALESCE(AVG(winning_bid), 0) as avg_price
      FROM auctions
      WHERE status = 'completed' AND ended_at >= date('now', '-' || ? || ' days')
      GROUP BY item_rarity
      ORDER BY avg_price DESC
    `, weeks * 7);

    // Weekly trend
    const weeklyTrend = await db.all(`
      SELECT
        strftime('%Y-%W', ended_at) as week,
        MIN(date(ended_at)) as week_start,
        COUNT(*) as count,
        COALESCE(AVG(winning_bid), 0) as avg_price
      FROM auctions
      WHERE status = 'completed' AND ended_at >= date('now', '-' || ? || ' days')
      GROUP BY week
      ORDER BY week ASC
    `, weeks * 7);

    // Most expensive items
    const topItems = await db.all(`
      SELECT item_name, item_rarity, winning_bid, ended_at,
             u.character_name as winner_name, u.character_class as winner_class
      FROM auctions a
      LEFT JOIN users u ON a.winner_id = u.id
      WHERE a.status = 'completed' AND a.ended_at >= date('now', '-' || ? || ' days')
      ORDER BY a.winning_bid DESC
      LIMIT 5
    `, weeks * 7);

    res.json({ ...stats, byRarity, weeklyTrend, topItems, weeks });
  } catch (error) {
    log.error('Analytics auctions error', error);
    res.status(500).json({ error: 'Failed to get auction analytics' });
  }
});

// Raid progression
router.get('/progression', authenticateToken, async (req, res) => {
  try {
    const progression = await db.all(`
      SELECT bs.difficulty,
             wb.name as boss_name, wb.boss_order,
             bs.total_kills, bs.total_wipes,
             bs.fastest_kill_ms, bs.first_kill_date,
             bs.wipes_to_first_kill,
             wz.name as zone_name, wz.boss_count
      FROM boss_statistics bs
      JOIN wcl_bosses wb ON bs.boss_id = wb.id
      JOIN wcl_zones wz ON wb.zone_id = wz.id
      WHERE wz.is_current = 1
      ORDER BY bs.difficulty DESC, wb.boss_order ASC
    `);

    // Group by difficulty
    const byDifficulty = {}
    for (const row of progression) {
      if (!byDifficulty[row.difficulty]) {
        byDifficulty[row.difficulty] = {
          difficulty: row.difficulty,
          zone_name: row.zone_name,
          boss_count: row.boss_count,
          bosses_killed: 0,
          bosses: [],
        }
      }
      if (row.total_kills > 0) byDifficulty[row.difficulty].bosses_killed++
      byDifficulty[row.difficulty].bosses.push(row)
    }

    res.json(Object.values(byDifficulty));
  } catch (error) {
    log.error('Analytics progression error', error);
    res.status(500).json({ error: 'Failed to get progression analytics' });
  }
});

// Guild superlatives (top performers from boss data)
router.get('/superlatives', authenticateToken, async (req, res) => {
  try {
    const topDps = await db.get(`
      SELECT br.value, br.character_name, br.character_class, wb.name as boss_name, br.difficulty
      FROM boss_records br
      JOIN wcl_bosses wb ON br.boss_id = wb.id
      WHERE br.record_type = 'top_dps'
      ORDER BY br.value DESC LIMIT 1
    `);

    const topHps = await db.get(`
      SELECT br.value, br.character_name, br.character_class, wb.name as boss_name, br.difficulty
      FROM boss_records br
      JOIN wcl_bosses wb ON br.boss_id = wb.id
      WHERE br.record_type = 'top_hps'
      ORDER BY br.value DESC LIMIT 1
    `);

    const mostDeaths = await db.get(`
      SELECT u.character_name, u.character_class, SUM(pbd.total_deaths) as total
      FROM player_boss_deaths pbd
      JOIN users u ON pbd.user_id = u.id
      GROUP BY pbd.user_id ORDER BY total DESC LIMIT 1
    `);

    const mostFights = await db.get(`
      SELECT u.character_name, u.character_class, SUM(pbp.fights_participated) as total
      FROM player_boss_performance pbp
      JOIN users u ON pbp.user_id = u.id
      GROUP BY pbp.user_id ORDER BY total DESC LIMIT 1
    `);

    const mostDamageTaken = await db.get(`
      SELECT u.character_name, u.character_class, SUM(pbp.total_damage_taken) as total
      FROM player_boss_performance pbp
      JOIN users u ON pbp.user_id = u.id
      GROUP BY pbp.user_id ORDER BY total DESC LIMIT 1
    `);

    res.json({ topDps, topHps, mostDeaths, mostFights, mostDamageTaken });
  } catch (error) {
    log.error('Analytics superlatives error', error);
    res.status(500).json({ error: 'Failed to get superlatives' });
  }
});

// My Performance — individual player stats
router.get('/my-performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Per-boss performance breakdown
    const bossBreakdown = await db.all(`
      SELECT wb.name as bossName, pbp.difficulty, pbp.fights_participated as fights,
             COALESCE(pbd.total_deaths, 0) as deaths,
             CASE WHEN pbp.fights_participated > 0 THEN ROUND(CAST(pbp.total_damage AS REAL) / pbp.fights_participated) ELSE 0 END as avgDps,
             pbp.best_dps as bestDps, pbp.best_hps as bestHps,
             ROUND(CAST(pbp.total_healing AS REAL) / NULLIF(pbp.fights_participated, 0)) as avgHps
      FROM player_boss_performance pbp
      JOIN wcl_bosses wb ON pbp.boss_id = wb.id
      LEFT JOIN player_boss_deaths pbd ON pbd.user_id = pbp.user_id AND pbd.boss_id = pbp.boss_id AND pbd.difficulty = pbp.difficulty
      WHERE pbp.user_id = ?
      ORDER BY pbp.difficulty DESC, wb.boss_order ASC
    `, [userId]);

    // Totals
    const totals = await db.get(`
      SELECT SUM(fights_participated) as totalFights, SUM(total_damage) as totalDamage, SUM(total_healing) as totalHealing
      FROM player_boss_performance WHERE user_id = ?
    `, [userId]);

    const deathTotals = await db.get(`
      SELECT SUM(total_deaths) as totalDeaths FROM player_boss_deaths WHERE user_id = ?
    `, [userId]);

    // Recent reports
    const recentReports = await db.all(`
      SELECT report_code as code, report_title as title, raid_date as date
      FROM warcraft_logs_processed
      WHERE is_reverted = 0
      ORDER BY processed_at DESC LIMIT 10
    `);

    const totalFights = totals?.totalFights || 0;
    const totalDeaths = deathTotals?.totalDeaths || 0;

    res.json({
      totalFights,
      totalDeaths,
      deathsPerFight: totalFights > 0 ? Math.round((totalDeaths / totalFights) * 100) / 100 : 0,
      bossBreakdown,
      recentReports,
    });
  } catch (error) {
    log.error('My performance error', error);
    res.status(500).json({ error: 'Failed to get performance data' });
  }
});

// Detailed performance analysis — per-fight data, trends, recommendations
router.get('/my-performance-detail', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const weeks = parseInt(req.query.weeks) || 8;
    const bossId = req.query.bossId ? parseInt(req.query.bossId) : undefined;
    const difficulty = req.query.difficulty || undefined;

    const data = await getPlayerDetailedPerformance(userId, { weeks, bossId, difficulty });
    res.json(data);
  } catch (error) {
    log.error('Performance detail error', error);
    res.status(500).json({ error: 'Failed to get detailed performance' });
  }
});

// Guild Insights — raid health, death leaders, progression blockers
router.get('/guild-insights', authenticateToken, async (req, res) => {
  try {
    // Raid health from boss_statistics
    const raidHealth = await db.get(`
      SELECT SUM(total_kills) as totalKills, SUM(total_wipes) as totalWipes,
             ROUND(AVG(fastest_kill_ms)) as avgFightTime
      FROM boss_statistics
    `);

    const totalKills = raidHealth?.totalKills || 0;
    const totalWipes = raidHealth?.totalWipes || 0;

    // Top performers by avg DPS (across all bosses)
    const topPerformers = await db.all(`
      SELECT u.character_name as name, u.character_class as class,
             ROUND(SUM(pbp.total_damage) / NULLIF(SUM(pbp.fights_participated), 0)) as avgDps,
             SUM(pbp.fights_participated) as fights
      FROM player_boss_performance pbp
      JOIN users u ON pbp.user_id = u.id
      WHERE pbp.fights_participated > 0
      GROUP BY pbp.user_id
      HAVING fights >= 3
      ORDER BY avgDps DESC LIMIT 10
    `);

    // Death leaders
    const deathLeaders = await db.all(`
      SELECT u.character_name as name, u.character_class as class,
             SUM(pbd.total_deaths) as totalDeaths,
             SUM(pbd.total_fights) as totalFights,
             ROUND(CAST(SUM(pbd.total_deaths) AS REAL) / NULLIF(SUM(pbd.total_fights), 0), 2) as deathsPerFight
      FROM player_boss_deaths pbd
      JOIN users u ON pbd.user_id = u.id
      GROUP BY pbd.user_id
      HAVING totalFights >= 3
      ORDER BY totalDeaths DESC LIMIT 10
    `);

    // Progression blockers — bosses with most wipes and no kills on hardest difficulty
    const blockers = await db.all(`
      SELECT wb.name as bossName, bs.difficulty, bs.total_wipes as wipes, bs.total_kills as kills,
             bs.fastest_kill_ms as bestTime
      FROM boss_statistics bs
      JOIN wcl_bosses wb ON bs.boss_id = wb.id
      WHERE bs.total_wipes > 0
      ORDER BY bs.total_wipes DESC LIMIT 5
    `);

    // Recent reports
    const recentReports = await db.all(`
      SELECT report_code as code, report_title as title, raid_date as date
      FROM warcraft_logs_processed
      WHERE is_reverted = 0
      ORDER BY processed_at DESC LIMIT 10
    `);

    res.json({
      raidHealth: {
        totalKills,
        totalWipes,
        killRate: (totalKills + totalWipes) > 0 ? Math.round(totalKills / (totalKills + totalWipes) * 100) / 100 : 0,
        avgFightTime: raidHealth?.avgFightTime || 0,
      },
      topPerformers,
      deathLeaders,
      progressionBlockers: blockers,
      recentReports,
    });
  } catch (error) {
    log.error('Guild insights error', error);
    res.status(500).json({ error: 'Failed to get guild insights' });
  }
});

export default router;
