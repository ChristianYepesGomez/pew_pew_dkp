import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getPlayerDetailedPerformance } from '../services/performanceAnalysis.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Analytics');
const router = Router();

// Attendance analytics
router.get('/attendance', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(String(req.query.weeks)) || 8;
    const results = await req.db.all(`
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
    const raidDayCount = await req.db.get(`
      SELECT COUNT(DISTINCT raid_date) as total
      FROM member_availability
      WHERE raid_date >= date('now', '-' || ? || ' days')
    `, weeks * 7);

    return success(res, {
      members: results,
      totalRaidDays: raidDayCount?.total || 0,
      weeks,
    });
  } catch (err) {
    log.error('Analytics attendance error', err);
    return error(res, 'Failed to get attendance analytics', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// DKP trends
router.get('/dkp-trends', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(String(req.query.weeks)) || 12;
    const trends = await req.db.all(`
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

    return success(res, trends);
  } catch (err) {
    log.error('Analytics DKP trends error', err);
    return error(res, 'Failed to get DKP trends', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// DKP economy overview
router.get('/economy', authenticateToken, async (req, res) => {
  try {
    const economy = await req.db.get(`
      SELECT
        COALESCE(SUM(current_dkp), 0) as total_circulation,
        COALESCE(AVG(current_dkp), 0) as avg_dkp,
        COALESCE(MIN(current_dkp), 0) as min_dkp,
        COALESCE(MAX(current_dkp), 0) as max_dkp,
        COUNT(*) as member_count
      FROM member_dkp
    `);

    // This week's activity
    const weekActivity = await req.db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as gained_this_week,
        COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as spent_this_week
      FROM dkp_transactions
      WHERE created_at >= date('now', '-7 days')
    `);

    // Top 5 by DKP
    const topMembers = await req.db.all(`
      SELECT md.current_dkp, u.character_name, u.character_class
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      ORDER BY md.current_dkp DESC
      LIMIT 5
    `);

    return success(res, {
      ...economy,
      ...weekActivity,
      topMembers,
    });
  } catch (err) {
    log.error('Analytics economy error', err);
    return error(res, 'Failed to get economy analytics', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Auction analytics
router.get('/auctions', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(String(req.query.weeks)) || 8;
    const stats = await req.db.get(`
      SELECT
        COUNT(*) as total_auctions,
        COALESCE(AVG(winning_bid), 0) as avg_price,
        COALESCE(MAX(winning_bid), 0) as max_price,
        COALESCE(MIN(CASE WHEN winning_bid > 0 THEN winning_bid END), 0) as min_price
      FROM auctions
      WHERE status = 'completed' AND ended_at >= date('now', '-' || ? || ' days')
    `, weeks * 7);

    // By rarity
    const byRarity = await req.db.all(`
      SELECT item_rarity, COUNT(*) as count, COALESCE(AVG(winning_bid), 0) as avg_price
      FROM auctions
      WHERE status = 'completed' AND ended_at >= date('now', '-' || ? || ' days')
      GROUP BY item_rarity
      ORDER BY avg_price DESC
    `, weeks * 7);

    // Weekly trend
    const weeklyTrend = await req.db.all(`
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
    const topItems = await req.db.all(`
      SELECT item_name, item_rarity, winning_bid, ended_at,
             u.character_name as winner_name, u.character_class as winner_class
      FROM auctions a
      LEFT JOIN users u ON a.winner_id = u.id
      WHERE a.status = 'completed' AND a.ended_at >= date('now', '-' || ? || ' days')
      ORDER BY a.winning_bid DESC
      LIMIT 5
    `, weeks * 7);

    return success(res, { ...stats, byRarity, weeklyTrend, topItems, weeks });
  } catch (err) {
    log.error('Analytics auctions error', err);
    return error(res, 'Failed to get auction analytics', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Raid progression
router.get('/progression', authenticateToken, async (req, res) => {
  try {
    const progression = await req.db.all(`
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

    return success(res, Object.values(byDifficulty));
  } catch (err) {
    log.error('Analytics progression error', err);
    return error(res, 'Failed to get progression analytics', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Guild superlatives (top performers from boss data)
router.get('/superlatives', authenticateToken, async (req, res) => {
  try {
    const topDps = await req.db.get(`
      SELECT br.value, br.character_name, br.character_class, wb.name as boss_name, br.difficulty
      FROM boss_records br
      JOIN wcl_bosses wb ON br.boss_id = wb.id
      WHERE br.record_type = 'top_dps'
      ORDER BY br.value DESC LIMIT 1
    `);

    const topHps = await req.db.get(`
      SELECT br.value, br.character_name, br.character_class, wb.name as boss_name, br.difficulty
      FROM boss_records br
      JOIN wcl_bosses wb ON br.boss_id = wb.id
      WHERE br.record_type = 'top_hps'
      ORDER BY br.value DESC LIMIT 1
    `);

    const mostDeaths = await req.db.get(`
      SELECT u.character_name, u.character_class, SUM(pbd.total_deaths) as total
      FROM player_boss_deaths pbd
      JOIN users u ON pbd.user_id = u.id
      GROUP BY pbd.user_id ORDER BY total DESC LIMIT 1
    `);

    const mostFights = await req.db.get(`
      SELECT u.character_name, u.character_class, SUM(pbp.fights_participated) as total
      FROM player_boss_performance pbp
      JOIN users u ON pbp.user_id = u.id
      GROUP BY pbp.user_id ORDER BY total DESC LIMIT 1
    `);

    const mostDamageTaken = await req.db.get(`
      SELECT u.character_name, u.character_class, SUM(pbp.total_damage_taken) as total
      FROM player_boss_performance pbp
      JOIN users u ON pbp.user_id = u.id
      GROUP BY pbp.user_id ORDER BY total DESC LIMIT 1
    `);

    return success(res, { topDps, topHps, mostDeaths, mostFights, mostDamageTaken });
  } catch (err) {
    log.error('Analytics superlatives error', err);
    return error(res, 'Failed to get superlatives', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// My Performance — individual player stats
router.get('/my-performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Per-boss performance breakdown
    const bossBreakdown = await req.db.all(`
      SELECT wb.name as bossName, pbp.difficulty, pbp.fights_participated as fights,
             COALESCE(pbd.total_deaths, 0) as deaths,
             CASE WHEN pbp.fights_participated > 0 THEN ROUND(CAST(pbp.total_damage AS REAL) / pbp.fights_participated) ELSE 0 END as avgDps,
             pbp.best_dps as bestDps, pbp.best_hps as bestHps,
             ROUND(CAST(pbp.total_healing AS REAL) / NULLIF(pbp.fights_participated, 0)) as avgHps,
             COALESCE(bs.total_kills, 0) as guildKills,
             COALESCE(bs.total_wipes, 0) as guildWipes,
             bs.best_wipe_percent as bestWipePercent
      FROM player_boss_performance pbp
      JOIN wcl_bosses wb ON pbp.boss_id = wb.id
      LEFT JOIN player_boss_deaths pbd ON pbd.user_id = pbp.user_id AND pbd.boss_id = pbp.boss_id AND pbd.difficulty = pbp.difficulty
      LEFT JOIN boss_statistics bs ON bs.boss_id = pbp.boss_id AND bs.difficulty = pbp.difficulty
      WHERE pbp.user_id = ?
      ORDER BY pbp.difficulty DESC, wb.boss_order ASC
    `, userId);

    // Totals
    const totals = await req.db.get(`
      SELECT SUM(fights_participated) as totalFights, SUM(total_damage) as totalDamage, SUM(total_healing) as totalHealing
      FROM player_boss_performance WHERE user_id = ?
    `, userId);

    const deathTotals = await req.db.get(`
      SELECT SUM(total_deaths) as totalDeaths FROM player_boss_deaths WHERE user_id = ?
    `, userId);

    // Recent reports
    const recentReports = await req.db.all(`
      SELECT report_code as code, report_title as title, raid_date as date
      FROM warcraft_logs_processed
      WHERE is_reverted = 0
      ORDER BY processed_at DESC LIMIT 10
    `);

    const totalFights = totals?.totalFights || 0;
    const totalDeaths = deathTotals?.totalDeaths || 0;

    return success(res, {
      totalFights,
      totalDeaths,
      deathsPerFight: totalFights > 0 ? Math.round((totalDeaths / totalFights) * 100) / 100 : 0,
      bossBreakdown,
      recentReports,
    });
  } catch (err) {
    log.error('My performance error', err);
    return error(res, 'Failed to get performance data', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Detailed performance analysis — per-fight data, trends, recommendations
router.get('/my-performance-detail', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const weeks = parseInt(String(req.query.weeks)) || 8;
    const bossId = req.query.bossId ? parseInt(String(req.query.bossId)) : undefined;
    const difficulty = req.query.difficulty || undefined;

    const data = await getPlayerDetailedPerformance(req.db, userId, { weeks, bossId, difficulty });
    return success(res, data);
  } catch (err) {
    log.error('Performance detail error', err);
    return error(res, 'Failed to get detailed performance', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Guild Insights — raid health, death leaders, progression blockers
router.get('/guild-insights', authenticateToken, async (req, res) => {
  try {
    // Raid health from boss_statistics
    const raidHealth = await req.db.get(`
      SELECT SUM(total_kills) as totalKills, SUM(total_wipes) as totalWipes,
             ROUND(AVG(fastest_kill_ms)) as avgFightTime
      FROM boss_statistics
    `);

    const totalKills = raidHealth?.totalKills || 0;
    const totalWipes = raidHealth?.totalWipes || 0;

    // Top performers by avg DPS (across all bosses)
    const topPerformers = await req.db.all(`
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
    const deathLeaders = await req.db.all(`
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
    const blockers = await req.db.all(`
      SELECT wb.name as bossName, bs.difficulty, bs.total_wipes as wipes, bs.total_kills as kills,
             bs.fastest_kill_ms as bestTime
      FROM boss_statistics bs
      JOIN wcl_bosses wb ON bs.boss_id = wb.id
      WHERE bs.total_wipes > 0
      ORDER BY bs.total_wipes DESC LIMIT 5
    `);

    // Recent reports
    const recentReports = await req.db.all(`
      SELECT report_code as code, report_title as title, raid_date as date
      FROM warcraft_logs_processed
      WHERE is_reverted = 0
      ORDER BY processed_at DESC LIMIT 10
    `);

    return success(res, {
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
  } catch (err) {
    log.error('Guild insights error', err);
    return error(res, 'Failed to get guild insights', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Guild Leaderboards — top 10 per category (frontend shows top 3, modal shows top 10)
// NOTE: Health potion detection uses CONSUMABLE_PATTERNS.healthPotion in warcraftlogs.js.
// When Midnight expansion launches, add the new healing potion name to that pattern.
router.get('/guild-leaderboards', authenticateToken, async (req, res) => {
  try {
    const MIN_FIGHTS = 1;

    // Top 10 DPS — best single fight DPS + external buffs from that fight, DPS players only
    const topDps = await req.db.all(`
      WITH player_totals AS (
        SELECT user_id, COUNT(*) as fights,
               SUM(healing_done) as total_healing, SUM(damage_done) as total_damage
        FROM player_fight_performance
        WHERE dps > 0
        GROUP BY user_id
        HAVING COUNT(*) >= ? AND SUM(healing_done) < SUM(damage_done)
      ),
      best AS (
        SELECT pfp.user_id, pfp.dps, pfp.external_buffs_json,
               ROW_NUMBER() OVER (PARTITION BY pfp.user_id ORDER BY pfp.dps DESC) as rn
        FROM player_fight_performance pfp
        JOIN player_totals pt ON pfp.user_id = pt.user_id
        WHERE pfp.dps > 0
      )
      SELECT u.character_name, u.character_class,
             ROUND(b.dps) as value, b.external_buffs_json, pt.fights
      FROM best b
      JOIN users u ON b.user_id = u.id
      JOIN player_totals pt ON b.user_id = pt.user_id
      WHERE b.rn = 1
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 HPS — best single fight HPS + external buffs from that fight, healers only
    const topHps = await req.db.all(`
      WITH player_totals AS (
        SELECT user_id, COUNT(*) as fights,
               SUM(healing_done) as total_healing, SUM(damage_done) as total_damage
        FROM player_fight_performance
        WHERE hps > 0
        GROUP BY user_id
        HAVING COUNT(*) >= ? AND SUM(healing_done) > SUM(damage_done)
      ),
      best AS (
        SELECT pfp.user_id, pfp.hps, pfp.external_buffs_json,
               ROW_NUMBER() OVER (PARTITION BY pfp.user_id ORDER BY pfp.hps DESC) as rn
        FROM player_fight_performance pfp
        JOIN player_totals pt ON pfp.user_id = pt.user_id
        WHERE pfp.hps > 0
      )
      SELECT u.character_name, u.character_class,
             ROUND(b.hps) as value, b.external_buffs_json, pt.fights
      FROM best b
      JOIN users u ON b.user_id = u.id
      JOIN player_totals pt ON b.user_id = pt.user_id
      WHERE b.rn = 1
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 Deaths — hall of shame
    const topDeaths = await req.db.all(`
      SELECT u.character_name, u.character_class,
             SUM(pbd.total_deaths) as value,
             SUM(pbd.total_fights) as fights
      FROM player_boss_deaths pbd
      JOIN users u ON pbd.user_id = u.id
      GROUP BY pbd.user_id
      HAVING SUM(pbd.total_fights) >= ?
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 Damage Taken — total damage taken across all tracked fights, excludes tanks and healers
    // Heuristic: healing_done < damage_done (not healer) AND damage_taken < damage_done * 3 (not tank)
    const topDamageTaken = await req.db.all(`
      SELECT u.character_name, u.character_class,
             SUM(pfp.damage_taken) as value,
             COUNT(*) as fights
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      WHERE pfp.damage_taken > 0
      GROUP BY pfp.user_id
      HAVING COUNT(*) >= ?
        AND SUM(pfp.healing_done) < SUM(pfp.damage_done)
        AND SUM(pfp.damage_taken) < SUM(pfp.damage_done) * 3
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 Health Potions — total used across all tracked fights
    const topPotions = await req.db.all(`
      SELECT u.character_name, u.character_class,
             SUM(pfp.health_potions) as value,
             COUNT(*) as fights
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      GROUP BY pfp.user_id
      HAVING COUNT(*) >= ? AND SUM(pfp.health_potions) > 0
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 Interrupts — total kicks/interrupts performed
    const topInterrupts = await req.db.all(`
      SELECT u.character_name, u.character_class,
             SUM(pfp.interrupts) as value,
             COUNT(*) as fights
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      GROUP BY pfp.user_id
      HAVING COUNT(*) >= ? AND SUM(pfp.interrupts) > 0
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 Dispels — total dispels performed
    const topDispels = await req.db.all(`
      SELECT u.character_name, u.character_class,
             SUM(pfp.dispels) as value
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      GROUP BY pfp.user_id
      HAVING COUNT(*) >= ? AND SUM(pfp.dispels) > 0
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 Combat Potions — total combat potions used (discipline of preparation)
    const topCombatPotions = await req.db.all(`
      SELECT u.character_name, u.character_class,
             SUM(pfp.combat_potions) as value
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      GROUP BY pfp.user_id
      HAVING COUNT(*) >= ? AND SUM(pfp.combat_potions) > 0
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 Attendance — most raid fights attended
    const topAttendance = await req.db.all(`
      SELECT u.character_name, u.character_class,
             COUNT(*) as value
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      GROUP BY pfp.user_id
      HAVING COUNT(*) >= ?
      ORDER BY value DESC LIMIT 10
    `, MIN_FIGHTS);

    // Top 10 WCL Percentile — best single-fight global percentile per player (DPS or HPS)
    // Uses window function to select the boss/date of the best parse per player
    const topPercentile = await req.db.all(`
      WITH best AS (
        SELECT user_id,
               MAX(COALESCE(dps_percentile, hps_percentile)) as best_pct
        FROM player_fight_performance
        WHERE dps_percentile IS NOT NULL OR hps_percentile IS NOT NULL
        GROUP BY user_id
      ),
      ranked AS (
        SELECT pfp.user_id, pfp.boss_id,
               COALESCE(pfp.dps_percentile, pfp.hps_percentile) as pct,
               pfp.fight_date, pfp.report_code, pfp.fight_id,
               ROW_NUMBER() OVER (PARTITION BY pfp.user_id ORDER BY pfp.fight_date DESC) as rn
        FROM player_fight_performance pfp
        JOIN best b ON pfp.user_id = b.user_id
          AND COALESCE(pfp.dps_percentile, pfp.hps_percentile) = b.best_pct
      )
      SELECT u.character_name, u.character_class,
             ROUND(r.pct, 1) as value,
             COALESCE(wb.name, '') as boss_name,
             r.fight_date, r.report_code, r.fight_id
      FROM ranked r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN wcl_bosses wb ON r.boss_id = wb.id
      WHERE r.rn = 1
      ORDER BY value DESC LIMIT 10
    `);

    return success(res, { topDps, topHps, topDeaths, topDamageTaken, topPotions, topInterrupts, topDispels, topCombatPotions, topAttendance, topPercentile });
  } catch (err) {
    log.error('Guild leaderboards error', err);
    return error(res, 'Failed to get guild leaderboards', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
