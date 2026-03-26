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
    let weeks = parseInt(String(req.query.weeks)) || 8;
    if (isNaN(weeks) || weeks < 1 || weeks > 52) weeks = 8;
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
    let weeks = parseInt(String(req.query.weeks)) || 12;
    if (isNaN(weeks) || weeks < 1 || weeks > 52) weeks = 12;
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
    const [topDps, topHps, mostDeaths, mostFights, mostDamageTaken] = await Promise.all([
      req.db.get(`
        SELECT br.value, br.character_name, br.character_class, wb.name as boss_name, br.difficulty
        FROM boss_records br
        JOIN wcl_bosses wb ON br.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE br.record_type = 'top_dps' AND wz.is_current = 1
        ORDER BY br.value DESC LIMIT 1
      `),
      req.db.get(`
        SELECT br.value, br.character_name, br.character_class, wb.name as boss_name, br.difficulty
        FROM boss_records br
        JOIN wcl_bosses wb ON br.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE br.record_type = 'top_hps' AND wz.is_current = 1
        ORDER BY br.value DESC LIMIT 1
      `),
      req.db.get(`
        SELECT u.character_name, u.character_class, SUM(pbd.total_deaths) as total
        FROM player_boss_deaths pbd
        JOIN users u ON pbd.user_id = u.id
        JOIN wcl_bosses wb ON pbd.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE wz.is_current = 1
        GROUP BY pbd.user_id ORDER BY total DESC LIMIT 1
      `),
      req.db.get(`
        SELECT u.character_name, u.character_class, SUM(pbp.fights_participated) as total
        FROM player_boss_performance pbp
        JOIN users u ON pbp.user_id = u.id
        JOIN wcl_bosses wb ON pbp.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE wz.is_current = 1
        GROUP BY pbp.user_id ORDER BY total DESC LIMIT 1
      `),
      req.db.get(`
        SELECT u.character_name, u.character_class, SUM(pbp.total_damage_taken) as total
        FROM player_boss_performance pbp
        JOIN users u ON pbp.user_id = u.id
        JOIN wcl_bosses wb ON pbp.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE wz.is_current = 1
        GROUP BY pbp.user_id ORDER BY total DESC LIMIT 1
      `),
    ]);

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

    // Per-boss performance breakdown — only current-season bosses
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
      JOIN wcl_zones wz ON wb.zone_id = wz.id
      LEFT JOIN player_boss_deaths pbd ON pbd.user_id = pbp.user_id AND pbd.boss_id = pbp.boss_id AND pbd.difficulty = pbp.difficulty
      LEFT JOIN boss_statistics bs ON bs.boss_id = pbp.boss_id AND bs.difficulty = pbp.difficulty
      WHERE pbp.user_id = ? AND wz.is_current = 1
      ORDER BY pbp.difficulty DESC, wb.boss_order ASC
    `, userId);

    // Totals — only current-season bosses
    const totals = await req.db.get(`
      SELECT SUM(pbp.fights_participated) as totalFights, SUM(pbp.total_damage) as totalDamage, SUM(pbp.total_healing) as totalHealing
      FROM player_boss_performance pbp
      JOIN wcl_bosses wb ON pbp.boss_id = wb.id
      JOIN wcl_zones wz ON wb.zone_id = wz.id
      WHERE pbp.user_id = ? AND wz.is_current = 1
    `, userId);

    const deathTotals = await req.db.get(`
      SELECT SUM(pbd.total_deaths) as totalDeaths
      FROM player_boss_deaths pbd
      JOIN wcl_bosses wb ON pbd.boss_id = wb.id
      JOIN wcl_zones wz ON wb.zone_id = wz.id
      WHERE pbd.user_id = ? AND wz.is_current = 1
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
    const [raidHealth, topPerformers, deathLeaders, blockers, recentReports] = await Promise.all([
      req.db.get(`
        SELECT SUM(bs.total_kills) as totalKills, SUM(bs.total_wipes) as totalWipes,
               ROUND(AVG(bs.fastest_kill_ms)) as avgFightTime
        FROM boss_statistics bs
        JOIN wcl_bosses wb ON bs.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE wz.is_current = 1
      `),
      req.db.all(`
        SELECT u.character_name as name, u.character_class as class,
               ROUND(SUM(pbp.total_damage) / NULLIF(SUM(pbp.fights_participated), 0)) as avgDps,
               SUM(pbp.fights_participated) as fights
        FROM player_boss_performance pbp
        JOIN users u ON pbp.user_id = u.id
        JOIN wcl_bosses wb ON pbp.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE pbp.fights_participated > 0 AND wz.is_current = 1
        GROUP BY pbp.user_id
        HAVING fights >= 3
        ORDER BY avgDps DESC LIMIT 10
      `),
      req.db.all(`
        SELECT u.character_name as name, u.character_class as class,
               SUM(pbd.total_deaths) as totalDeaths,
               SUM(pbd.total_fights) as totalFights,
               ROUND(CAST(SUM(pbd.total_deaths) AS REAL) / NULLIF(SUM(pbd.total_fights), 0), 2) as deathsPerFight
        FROM player_boss_deaths pbd
        JOIN users u ON pbd.user_id = u.id
        JOIN wcl_bosses wb ON pbd.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE wz.is_current = 1
        GROUP BY pbd.user_id
        HAVING totalFights >= 3
        ORDER BY totalDeaths DESC LIMIT 10
      `),
      req.db.all(`
        SELECT wb.name as bossName, bs.difficulty, bs.total_wipes as wipes, bs.total_kills as kills,
               bs.fastest_kill_ms as bestTime
        FROM boss_statistics bs
        JOIN wcl_bosses wb ON bs.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE bs.total_wipes > 0 AND wz.is_current = 1
        ORDER BY bs.total_wipes DESC LIMIT 5
      `),
      req.db.all(`
        SELECT report_code as code, report_title as title, raid_date as date
        FROM warcraft_logs_processed
        WHERE is_reverted = 0
        ORDER BY processed_at DESC LIMIT 10
      `),
    ]);

    const totalKills = raidHealth?.totalKills || 0;
    const totalWipes = raidHealth?.totalWipes || 0;

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
    const CURRENT_BOSS_CTE = `WITH current_boss_ids AS (
      SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1
    )`;

    const [topDps, topHps, topDeaths, topDamageTaken, topPotions, topInterrupts, topDispels, topCombatPotions, topHealthstones, topManaPotions, topAttendance] = await Promise.all([
      // Top 10 DPS — best single fight DPS (kills only) + external buffs, DPS players only
      req.db.all(`
        ${CURRENT_BOSS_CTE},
        player_totals AS (
          SELECT user_id, character_name, COUNT(*) as fights,
                 SUM(healing_done) as total_healing, SUM(damage_done) as total_damage
          FROM player_fight_performance
          WHERE dps > 0 AND is_kill = 1 AND boss_id IN (SELECT id FROM current_boss_ids)
          GROUP BY user_id, character_name
          HAVING COUNT(*) >= ? AND SUM(healing_done) < SUM(damage_done)
        ),
        best AS (
          SELECT pfp.user_id, pfp.character_name, pfp.dps, pfp.external_buffs_json,
                 ROW_NUMBER() OVER (PARTITION BY pfp.user_id, pfp.character_name ORDER BY pfp.dps DESC) as rn
          FROM player_fight_performance pfp
          JOIN player_totals pt ON pfp.user_id = pt.user_id AND pfp.character_name = pt.character_name
          WHERE pfp.dps > 0 AND pfp.is_kill = 1 AND pfp.boss_id IN (SELECT id FROM current_boss_ids)
        )
        SELECT COALESCE(b.character_name, u.character_name) as character_name,
               COALESCE(pfp_class.wcl_class, u.character_class) as character_class,
               ROUND(b.dps) as value, b.external_buffs_json, pt.fights
        FROM best b
        JOIN users u ON b.user_id = u.id
        JOIN player_totals pt ON b.user_id = pt.user_id AND b.character_name = pt.character_name
        LEFT JOIN player_fight_performance pfp_class ON pfp_class.user_id = b.user_id AND pfp_class.character_name = b.character_name AND pfp_class.wcl_class IS NOT NULL
        WHERE b.rn = 1
        GROUP BY b.user_id, b.character_name
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 HPS — best single fight HPS (kills only) + external buffs, healers only
      req.db.all(`
        ${CURRENT_BOSS_CTE},
        player_totals AS (
          SELECT user_id, character_name, COUNT(*) as fights,
                 SUM(healing_done) as total_healing, SUM(damage_done) as total_damage
          FROM player_fight_performance
          WHERE hps > 0 AND is_kill = 1 AND boss_id IN (SELECT id FROM current_boss_ids)
          GROUP BY user_id, character_name
          HAVING COUNT(*) >= ? AND SUM(healing_done) > SUM(damage_done)
        ),
        best AS (
          SELECT pfp.user_id, pfp.character_name, pfp.hps, pfp.external_buffs_json,
                 ROW_NUMBER() OVER (PARTITION BY pfp.user_id, pfp.character_name ORDER BY pfp.hps DESC) as rn
          FROM player_fight_performance pfp
          JOIN player_totals pt ON pfp.user_id = pt.user_id AND pfp.character_name = pt.character_name
          WHERE pfp.hps > 0 AND pfp.is_kill = 1 AND pfp.boss_id IN (SELECT id FROM current_boss_ids)
        )
        SELECT COALESCE(b.character_name, u.character_name) as character_name,
               COALESCE(pfp_class.wcl_class, u.character_class) as character_class,
               ROUND(b.hps) as value, b.external_buffs_json, pt.fights
        FROM best b
        JOIN users u ON b.user_id = u.id
        JOIN player_totals pt ON b.user_id = pt.user_id AND b.character_name = pt.character_name
        LEFT JOIN player_fight_performance pfp_class ON pfp_class.user_id = b.user_id AND pfp_class.character_name = b.character_name AND pfp_class.wcl_class IS NOT NULL
        WHERE b.rn = 1
        GROUP BY b.user_id, b.character_name
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Deaths
      req.db.all(`
        SELECT u.character_name, u.character_class,
               SUM(pbd.total_deaths) as value,
               SUM(pbd.total_fights) as fights
        FROM player_boss_deaths pbd
        JOIN users u ON pbd.user_id = u.id
        JOIN wcl_bosses wb ON pbd.boss_id = wb.id
        JOIN wcl_zones wz ON wb.zone_id = wz.id
        WHERE wz.is_current = 1
        GROUP BY pbd.user_id
        HAVING SUM(pbd.total_fights) >= ?
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Damage Taken
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               SUM(pfp.damage_taken) as value,
               COUNT(*) as fights
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.damage_taken > 0
          AND pfp.is_kill = 1
          AND u.raid_role != 'Tank'
          AND pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(*) >= ?
          AND SUM(pfp.healing_done) < SUM(pfp.damage_done)
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Health Potions
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               SUM(pfp.health_potions) as value,
               COUNT(*) as fights
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(*) >= ? AND SUM(pfp.health_potions) > 0
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Interrupts
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               SUM(pfp.interrupts) as value,
               COUNT(*) as fights
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(*) >= ? AND SUM(pfp.interrupts) > 0
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Dispels
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               SUM(pfp.dispels) as value
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(*) >= ? AND SUM(pfp.dispels) > 0
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Combat Potions
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               SUM(pfp.combat_potions) as value
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(*) >= ? AND SUM(pfp.combat_potions) > 0
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Healthstones
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               SUM(pfp.healthstones) as value
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(*) >= ? AND SUM(pfp.healthstones) > 0
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Mana Potions
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               SUM(pfp.mana_potions) as value
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(*) >= ? AND SUM(pfp.mana_potions) > 0
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),

      // Top 10 Attendance
      req.db.all(`
        SELECT COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               COUNT(DISTINCT pfp.fight_date) as value
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        GROUP BY pfp.user_id, pfp.character_name
        HAVING COUNT(DISTINCT pfp.fight_date) >= ?
        ORDER BY value DESC LIMIT 10
      `, MIN_FIGHTS),
    ]);

    return success(res, { topDps, topHps, topDeaths, topDamageTaken, topPotions, topInterrupts, topDispels, topCombatPotions, topHealthstones, topManaPotions, topAttendance });
  } catch (err) {
    log.error('Guild leaderboards error', err);
    return error(res, 'Failed to get guild leaderboards', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Percentile matrix — WCL-style grid: players × bosses
// Returns best percentile per player per boss, role-aware, with WCL links
router.get('/percentile-matrix', authenticateToken, async (req, res) => {
  try {
    // Available difficulties (with kills) for filter
    const difficulties = await req.db.all(`
      SELECT DISTINCT bs.difficulty
      FROM boss_statistics bs
      JOIN wcl_bosses wb ON bs.boss_id = wb.id
      JOIN wcl_zones wz ON wb.zone_id = wz.id
      WHERE wz.is_current = 1 AND bs.total_kills > 0
      ORDER BY CASE bs.difficulty WHEN 'Mythic' THEN 3 WHEN 'Heroic' THEN 2 WHEN 'Normal' THEN 1 ELSE 0 END DESC
    `);
    const availableDiffs = difficulties.map(d => d.difficulty);

    // Default to highest difficulty with a kill, or use requested
    const difficulty = req.query.difficulty && availableDiffs.includes(req.query.difficulty)
      ? String(req.query.difficulty)
      : (availableDiffs[0] || 'Heroic');

    // Get current-season bosses with stats for selected difficulty
    const bosses = await req.db.all(`
      SELECT wb.id, wb.name, wb.boss_order, wb.zone_id, wz.name as zone_name,
             COALESCE(bs.total_kills, 0) as total_kills, COALESCE(bs.total_wipes, 0) as total_wipes,
             bs.best_wipe_percent
      FROM wcl_bosses wb
      JOIN wcl_zones wz ON wb.zone_id = wz.id
      LEFT JOIN boss_statistics bs ON bs.boss_id = wb.id AND bs.difficulty = ?
      WHERE wz.is_current = 1
      ORDER BY wz.id, wb.boss_order
    `, difficulty);

    // Get per-player best percentile per boss (role-aware) + the report/fight for WCL link
    // Uses pfp.character_name to separate stats by character (handles rerolls)
    // Determines healer vs DPS from wcl_spec instead of user's current raid_role
    const HEALER_SPECS = "('Holy','Discipline','Restoration','Mistweaver','Preservation')";
    const playerStats = await req.db.all(`
      WITH role_pct AS (
        SELECT pfp.user_id, pfp.boss_id,
               CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS} THEN pfp.hps_percentile ELSE pfp.dps_percentile END as pct,
               pfp.report_code, pfp.fight_id,
               COALESCE(pfp.character_name, u.character_name) as character_name,
               COALESCE(pfp.wcl_class, u.character_class) as character_class,
               CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS} THEN 'Healer' ELSE u.raid_role END as raid_role,
               ROW_NUMBER() OVER (
                 PARTITION BY pfp.user_id, pfp.character_name, pfp.boss_id
                 ORDER BY CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS} THEN pfp.hps_percentile ELSE pfp.dps_percentile END DESC
               ) as rn
        FROM player_fight_performance pfp
        JOIN users u ON pfp.user_id = u.id
        WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
          AND pfp.difficulty = ?
          AND pfp.is_kill = 1
          AND CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS} THEN pfp.hps_percentile ELSE pfp.dps_percentile END IS NOT NULL
      )
      SELECT user_id, boss_id, character_name, character_class, raid_role,
             pct as best_pct, report_code, fight_id
      FROM role_pct WHERE rn = 1
    `, difficulty);

    // Also get avg percentile per player per boss (all kills)
    const avgStats = await req.db.all(`
      SELECT pfp.user_id, pfp.character_name, pfp.boss_id,
             ROUND(AVG(CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS} THEN pfp.hps_percentile ELSE pfp.dps_percentile END), 1) as avg_pct,
             COUNT(*) as fights
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      WHERE pfp.boss_id IN (SELECT wb.id FROM wcl_bosses wb JOIN wcl_zones wz ON wb.zone_id = wz.id WHERE wz.is_current = 1)
        AND pfp.difficulty = ?
        AND pfp.is_kill = 1
        AND CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS} THEN pfp.hps_percentile ELSE pfp.dps_percentile END IS NOT NULL
      GROUP BY pfp.user_id, pfp.character_name, pfp.boss_id
    `, difficulty);

    // Build avg lookup (keyed by character_name instead of user_id)
    const avgLookup = {};
    for (const row of avgStats) {
      avgLookup[`${row.character_name}:${row.boss_id}`] = { avgPct: row.avg_pct, fights: row.fights };
    }

    // Build player map (keyed by character_name to separate rerolled characters)
    const playerMap = new Map();
    for (const row of playerStats) {
      const key = row.character_name;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          userId: row.user_id,
          characterName: row.character_name,
          characterClass: row.character_class,
          raidRole: row.raid_role,
          bosses: {},
          allPcts: [],
        });
      }
      const player = playerMap.get(key);
      const avg = avgLookup[`${row.character_name}:${row.boss_id}`];
      player.bosses[row.boss_id] = {
        bestPct: Math.round(row.best_pct * 10) / 10,
        avgPct: avg?.avgPct || Math.round(row.best_pct * 10) / 10,
        fights: avg?.fights || 1,
        reportCode: row.report_code,
        fightId: row.fight_id,
      };
      player.allPcts.push(row.best_pct);
    }

    // Calculate overall avg and sort
    const players = [...playerMap.values()]
      .map(p => {
        const avg = p.allPcts.length > 0
          ? Math.round(p.allPcts.reduce((a, b) => a + b, 0) / p.allPcts.length * 10) / 10
          : 0;
        delete p.allPcts;
        return { ...p, avgPercentile: avg };
      })
      .sort((a, b) => b.avgPercentile - a.avgPercentile);

    return success(res, {
      bosses: bosses.map(b => ({
        id: b.id,
        name: b.name,
        order: b.boss_order,
        zoneName: b.zone_name,
        kills: b.total_kills,
        wipes: b.total_wipes,
        bestWipePct: b.best_wipe_percent,
      })),
      players,
      difficulties: availableDiffs,
      selectedDifficulty: difficulty,
    });
  } catch (err) {
    log.error('Percentile matrix error', err);
    return error(res, 'Failed to get percentile matrix', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Boss percentile breakdown — all players' percentiles for a specific boss
router.get('/boss/:bossId/percentiles', authenticateToken, async (req, res) => {
  try {
    const bossId = parseInt(req.params.bossId, 10);
    if (isNaN(bossId)) return error(res, 'Invalid boss ID', 400, ErrorCodes.VALIDATION_ERROR);
    const difficulty = req.query.difficulty ? String(req.query.difficulty) : null;

    const diffFilter = difficulty ? 'AND pfp.difficulty = ?' : '';
    const diffParams = difficulty ? [bossId, difficulty] : [bossId];

    const HEALER_SPECS_BP = "('Holy','Discipline','Restoration','Mistweaver','Preservation')";
    const players = await req.db.all(`
      SELECT pfp.user_id,
             COALESCE(pfp.character_name, u.character_name) as character_name,
             COALESCE(pfp.wcl_class, u.character_class) as character_class,
             CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS_BP} THEN 'Healer' ELSE u.raid_role END as raid_role,
             MAX(CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS_BP} THEN pfp.hps_percentile ELSE pfp.dps_percentile END) as best_pct,
             ROUND(AVG(CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS_BP} THEN pfp.hps_percentile ELSE pfp.dps_percentile END), 1) as avg_pct,
             MAX(pfp.dps) as best_dps,
             MAX(pfp.hps) as best_hps,
             COUNT(*) as fights
      FROM player_fight_performance pfp
      JOIN users u ON pfp.user_id = u.id
      WHERE pfp.boss_id = ?
        AND CASE WHEN pfp.wcl_spec IN ${HEALER_SPECS_BP} THEN pfp.hps_percentile ELSE pfp.dps_percentile END IS NOT NULL
        ${diffFilter}
      GROUP BY pfp.user_id, pfp.character_name
      ORDER BY best_pct DESC
    `, ...diffParams);

    return success(res, {
      players: players.map(p => ({
        userId: p.user_id,
        characterName: p.character_name,
        characterClass: p.character_class,
        raidRole: p.raid_role,
        bestPct: Math.round(p.best_pct * 10) / 10,
        avgPct: Math.round(p.avg_pct * 10) / 10,
        bestDps: Math.round(p.best_dps),
        bestHps: Math.round(p.best_hps),
        fights: p.fights,
      })),
    });
  } catch (err) {
    log.error('Boss percentiles error', err);
    return error(res, 'Failed to get boss percentiles', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
