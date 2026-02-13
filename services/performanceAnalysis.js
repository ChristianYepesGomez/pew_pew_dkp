import { db } from '../database.js';

// ── Consumable detection patterns ──
const CONSUMABLE_PATTERNS = {
  healthPotion: /healing potion|potion of .*(heal|life)|algari healing/i,
  healthstone: /healthstone/i,
  combatPotion: /tempered potion|potion of unwavering focus|frontline potion|elemental potion|potion of the .*(war|twilight)/i,
};

const BUFF_PATTERNS = {
  flask: /flask|phial/i,
  food: /well fed|sated|nourished|satisfecho|alimentado/i,
  augmentRune: /augment rune/i,
};

/**
 * Process extended fight data from WCL and store per-fight snapshots
 * Called during the import loop for each fight
 */
export async function processExtendedFightData(reportCode, bossInfo, basicStats, extendedStats, participantUserMap, reportDate) {
  const { bossId, fightId, difficulty, startTime, endTime } = bossInfo;
  const fightDurationMs = endTime - startTime;
  const fightDurationSec = fightDurationMs / 1000;

  // Build per-player data from basic + extended stats
  const playerData = {};

  const ensurePlayer = (name) => {
    if (!playerData[name]) {
      playerData[name] = {
        damageDone: 0, healingDone: 0, damageTaken: 0, deaths: 0,
        healthPotions: 0, healthstones: 0, combatPotions: 0,
        flaskUptime: 0, foodBuff: 0, augmentRune: 0,
        interrupts: 0, dispels: 0,
      };
    }
  };

  // Damage done
  for (const e of basicStats.damage || []) {
    ensurePlayer(e.name);
    playerData[e.name].damageDone = e.total || 0;
  }

  // Healing done
  for (const e of basicStats.healing || []) {
    ensurePlayer(e.name);
    playerData[e.name].healingDone = e.total || 0;
  }

  // Damage taken
  for (const e of basicStats.damageTaken || []) {
    ensurePlayer(e.name);
    playerData[e.name].damageTaken = e.total || 0;
  }

  // Deaths
  for (const e of basicStats.deaths || []) {
    ensurePlayer(e.name);
    playerData[e.name].deaths = e.total || 0;
  }

  // Casts — scan for consumable usage
  for (const entry of extendedStats.casts || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    // Check sub-entries (abilities) for consumable patterns
    const abilities = entry.abilities || entry.entries || [];
    for (const ability of abilities) {
      const abilityName = ability.name || '';
      if (CONSUMABLE_PATTERNS.healthPotion.test(abilityName)) {
        playerData[entry.name].healthPotions += (ability.total || ability.hitCount || 1);
      }
      if (CONSUMABLE_PATTERNS.healthstone.test(abilityName)) {
        playerData[entry.name].healthstones += (ability.total || ability.hitCount || 1);
      }
      if (CONSUMABLE_PATTERNS.combatPotion.test(abilityName)) {
        playerData[entry.name].combatPotions += (ability.total || ability.hitCount || 1);
      }
    }
  }

  // Buffs — check for flask, food, augment rune
  for (const entry of extendedStats.buffs || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    const auras = entry.abilities || entry.entries || [];
    for (const aura of auras) {
      const auraName = aura.name || '';
      const uptime = aura.uptime || 0; // percentage 0-100
      if (BUFF_PATTERNS.flask.test(auraName)) {
        playerData[entry.name].flaskUptime = Math.max(playerData[entry.name].flaskUptime, uptime);
      }
      if (BUFF_PATTERNS.food.test(auraName)) {
        playerData[entry.name].foodBuff = 1;
      }
      if (BUFF_PATTERNS.augmentRune.test(auraName)) {
        playerData[entry.name].augmentRune = 1;
      }
    }
  }

  // Interrupts
  for (const entry of extendedStats.interrupts || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    playerData[entry.name].interrupts = entry.total || 0;
  }

  // Dispels
  for (const entry of extendedStats.dispels || []) {
    if (!entry.name) continue;
    ensurePlayer(entry.name);
    playerData[entry.name].dispels = entry.total || 0;
  }

  // Calculate raid medians for DPS and DTPS
  const allDps = [];
  const allDtps = [];
  for (const [, data] of Object.entries(playerData)) {
    if (data.damageDone > 0) allDps.push(data.damageDone / fightDurationSec);
    if (data.damageTaken > 0) allDtps.push(data.damageTaken / fightDurationSec);
  }
  allDps.sort((a, b) => a - b);
  allDtps.sort((a, b) => a - b);
  const medianDps = allDps.length > 0 ? allDps[Math.floor(allDps.length / 2)] : 0;
  const medianDtps = allDtps.length > 0 ? allDtps[Math.floor(allDtps.length / 2)] : 0;

  // Insert per-player records
  let inserted = 0;
  for (const [playerName, data] of Object.entries(playerData)) {
    const userId = participantUserMap[playerName.toLowerCase()];
    if (!userId) continue;

    const dps = fightDurationSec > 0 ? data.damageDone / fightDurationSec : 0;
    const hps = fightDurationSec > 0 ? data.healingDone / fightDurationSec : 0;
    const dtps = fightDurationSec > 0 ? data.damageTaken / fightDurationSec : 0;

    try {
      await db.run(
        `INSERT OR IGNORE INTO player_fight_performance
         (user_id, report_code, fight_id, boss_id, difficulty, damage_done, healing_done, damage_taken, deaths,
          fight_duration_ms, dps, hps, dtps, health_potions, healthstones, combat_potions,
          flask_uptime_pct, food_buff_active, augment_rune_active, interrupts, dispels,
          raid_median_dps, raid_median_dtps, fight_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userId, reportCode, fightId, bossId, difficulty,
        data.damageDone, data.healingDone, data.damageTaken, data.deaths,
        fightDurationMs, dps, hps, dtps,
        data.healthPotions, data.healthstones, data.combatPotions,
        data.flaskUptime, data.foodBuff, data.augmentRune,
        data.interrupts, data.dispels,
        medianDps, medianDtps,
        reportDate || new Date().toISOString().split('T')[0]
      );
      inserted++;
    } catch (err) {
      // UNIQUE constraint = already processed, skip
      if (!err.message?.includes('UNIQUE')) {
        console.warn(`Failed to insert fight perf for ${playerName}:`, err.message);
      }
    }
  }

  return inserted;
}

/**
 * Get detailed performance analysis for a player
 */
export async function getPlayerDetailedPerformance(userId, options = {}) {
  const { weeks = 8, bossId, difficulty } = options;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (weeks * 7));
  const cutoffDate = cutoff.toISOString().split('T')[0];

  // Base WHERE clause
  let where = 'WHERE p.user_id = ? AND p.fight_date >= ?';
  const params = [userId, cutoffDate];
  if (bossId) { where += ' AND p.boss_id = ?'; params.push(bossId); }
  if (difficulty) { where += ' AND p.difficulty = ?'; params.push(difficulty); }

  // Summary stats
  const summary = await db.get(`
    SELECT
      COUNT(*) as totalFights,
      ROUND(AVG(p.dps), 1) as avgDps,
      ROUND(AVG(p.hps), 1) as avgHps,
      ROUND(AVG(p.dtps), 1) as avgDtps,
      SUM(p.deaths) as totalDeaths,
      ROUND(CAST(SUM(p.deaths) AS REAL) / MAX(COUNT(*), 1), 2) as deathRate,
      ROUND(AVG(p.health_potions), 2) as avgHealthPotions,
      ROUND(AVG(p.healthstones), 2) as avgHealthstones,
      ROUND(AVG(p.combat_potions), 2) as avgCombatPotions,
      ROUND(AVG(p.flask_uptime_pct), 1) as avgFlaskUptime,
      ROUND(AVG(p.food_buff_active) * 100, 1) as foodRate,
      ROUND(AVG(p.augment_rune_active) * 100, 1) as augmentRate,
      ROUND(AVG(p.interrupts), 1) as avgInterrupts,
      ROUND(AVG(p.dispels), 1) as avgDispels,
      ROUND(AVG(CASE WHEN p.raid_median_dps > 0 THEN (p.dps / p.raid_median_dps) * 100 ELSE 100 END), 1) as dpsVsMedianPct
    FROM player_fight_performance p
    ${where}
  `, ...params);

  // Calculate consumable score (0-100)
  const healthPotionRate = summary?.totalFights > 0 ? (await db.get(`
    SELECT ROUND(CAST(SUM(CASE WHEN p.health_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as rate
    FROM player_fight_performance p ${where}
  `, ...params))?.rate || 0 : 0;

  const healthstoneRate = summary?.totalFights > 0 ? (await db.get(`
    SELECT ROUND(CAST(SUM(CASE WHEN p.healthstones > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as rate
    FROM player_fight_performance p ${where}
  `, ...params))?.rate || 0 : 0;

  const combatPotionRate = summary?.totalFights > 0 ? (await db.get(`
    SELECT ROUND(CAST(SUM(CASE WHEN p.combat_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as rate
    FROM player_fight_performance p ${where}
  `, ...params))?.rate || 0 : 0;

  const consumableScore = Math.round(
    (healthPotionRate * 0.2 + healthstoneRate * 0.15 + combatPotionRate * 0.25 +
     (summary?.avgFlaskUptime || 0) * 0.25 + (summary?.foodRate || 0) * 0.1 + (summary?.augmentRate || 0) * 0.05) / 100 * 100
  );

  // Boss breakdown
  const bossBreakdown = await db.all(`
    SELECT
      p.boss_id as bossId,
      b.name as bossName,
      p.difficulty,
      COUNT(*) as fights,
      SUM(p.deaths) as deaths,
      ROUND(CAST(SUM(p.deaths) AS REAL) / MAX(COUNT(*), 1), 2) as deathRate,
      ROUND(AVG(p.dps), 1) as avgDps,
      ROUND(MAX(p.dps), 1) as bestDps,
      ROUND(AVG(p.dtps), 1) as avgDtps,
      ROUND(CAST(SUM(CASE WHEN p.health_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as healthPotionRate,
      ROUND(CAST(SUM(CASE WHEN p.healthstones > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as healthstoneRate,
      ROUND(CAST(SUM(CASE WHEN p.combat_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1) as combatPotionRate,
      ROUND(AVG(p.interrupts), 1) as interruptsPerFight,
      ROUND(AVG(p.dispels), 1) as dispelsPerFight,
      ROUND(AVG(CASE WHEN p.raid_median_dps > 0 THEN (p.dps / p.raid_median_dps) * 100 ELSE 100 END), 1) as dpsVsMedian
    FROM player_fight_performance p
    LEFT JOIN wcl_bosses b ON b.id = p.boss_id
    ${where}
    GROUP BY p.boss_id, p.difficulty
    ORDER BY p.difficulty DESC, COUNT(*) DESC
  `, ...params);

  // Weekly trends (Thursday-Wednesday weeks)
  const weeklyTrends = await db.all(`
    SELECT
      -- Calculate Thursday-based week start
      date(p.fight_date, '-' || ((CAST(strftime('%w', p.fight_date) AS INTEGER) + 3) % 7) || ' days') as weekStart,
      COUNT(*) as fights,
      ROUND(AVG(p.dps), 1) as avgDps,
      ROUND(AVG(p.hps), 1) as avgHps,
      ROUND(CAST(SUM(p.deaths) AS REAL) / MAX(COUNT(*), 1), 2) as avgDeaths,
      ROUND(AVG(p.dtps), 1) as avgDtps,
      ROUND(
        (CAST(SUM(CASE WHEN p.health_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 20 +
         CAST(SUM(CASE WHEN p.healthstones > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 15 +
         CAST(SUM(CASE WHEN p.combat_potions > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 25 +
         AVG(p.flask_uptime_pct) * 0.25 +
         AVG(p.food_buff_active) * 10 +
         AVG(p.augment_rune_active) * 5),
      1) as consumableScore
    FROM player_fight_performance p
    ${where}
    GROUP BY weekStart
    ORDER BY weekStart ASC
  `, ...params);

  // Add week-over-week changes
  for (let i = 1; i < weeklyTrends.length; i++) {
    const prev = weeklyTrends[i - 1];
    const curr = weeklyTrends[i];
    curr.dpsChange = prev.avgDps > 0 ? Math.round((curr.avgDps - prev.avgDps) / prev.avgDps * 100) : 0;
    curr.deathChange = prev.avgDeaths > 0 ? Math.round((curr.avgDeaths - prev.avgDeaths) / prev.avgDeaths * 100) : 0;
  }

  // Recent fights
  const recentFights = await db.all(`
    SELECT
      p.fight_date as date,
      b.name as boss,
      p.difficulty,
      ROUND(p.dps, 1) as dps,
      p.deaths,
      p.damage_taken as damageTaken,
      p.health_potions as potions,
      p.healthstones,
      p.combat_potions as combatPotions,
      p.interrupts,
      p.dispels,
      ROUND(CASE WHEN p.raid_median_dps > 0 THEN (p.dps / p.raid_median_dps) * 100 ELSE 100 END, 1) as dpsVsMedian
    FROM player_fight_performance p
    LEFT JOIN wcl_bosses b ON b.id = p.boss_id
    ${where}
    ORDER BY p.fight_date DESC, p.id DESC
    LIMIT 20
  `, ...params);

  // Generate recommendations
  const recommendations = generateRecommendations({
    summary: { ...summary, consumableScore, healthPotionRate, healthstoneRate, combatPotionRate },
    bossBreakdown,
    weeklyTrends,
  });

  return {
    summary: {
      totalFights: summary?.totalFights || 0,
      avgDps: summary?.avgDps || 0,
      avgHps: summary?.avgHps || 0,
      avgDtps: summary?.avgDtps || 0,
      deathRate: summary?.deathRate || 0,
      consumableScore,
      dpsVsMedianPct: summary?.dpsVsMedianPct || 100,
      healthPotionRate,
      healthstoneRate,
      combatPotionRate,
      avgFlaskUptime: summary?.avgFlaskUptime || 0,
      foodRate: summary?.foodRate || 0,
      augmentRate: summary?.augmentRate || 0,
      avgInterrupts: summary?.avgInterrupts || 0,
      avgDispels: summary?.avgDispels || 0,
    },
    bossBreakdown,
    weeklyTrends,
    recentFights,
    recommendations,
  };
}

/**
 * Smart recommendation engine
 */
function generateRecommendations({ summary, bossBreakdown, weeklyTrends }) {
  const tips = [];

  if (!summary || summary.totalFights === 0) return tips;

  // ── Survivability ──
  if (summary.deathRate > 0.4) {
    tips.push({
      category: 'survivability', key: 'high_death_rate', severity: 'critical',
      message: `Tu tasa de muertes (${summary.deathRate.toFixed(2)}/pelea) está por encima de lo ideal (< 0.3). Revisa mecánicas de boss y posicionamiento.`,
      messageEn: `Your death rate (${summary.deathRate.toFixed(2)}/fight) is above the ideal (< 0.3). Review boss mechanics and positioning.`,
      data: { rate: summary.deathRate },
    });
  } else if (summary.deathRate <= 0.2) {
    tips.push({
      category: 'survivability', key: 'good_survival', severity: 'positive',
      message: `Excelente supervivencia (${summary.deathRate.toFixed(2)} muertes/pelea). Sigue así.`,
      messageEn: `Excellent survival (${summary.deathRate.toFixed(2)} deaths/fight). Keep it up.`,
      data: { rate: summary.deathRate },
    });
  }

  // Boss-specific high damage taken
  for (const boss of bossBreakdown) {
    if (boss.dpsVsMedian && boss.avgDtps > 0 && boss.fights >= 3) {
      // Check if player takes significantly more damage than median on a boss
      const dtpsRatio = boss.avgDtps / (summary.avgDtps || 1);
      if (dtpsRatio > 1.4) {
        tips.push({
          category: 'survivability', key: 'high_damage_boss', severity: 'warning',
          message: `Recibes mucho más daño de lo normal en ${boss.bossName} (${boss.difficulty}). Revisa mecánicas específicas de este boss.`,
          messageEn: `You take significantly more damage than usual on ${boss.bossName} (${boss.difficulty}). Review boss-specific mechanics.`,
          data: { boss: boss.bossName, difficulty: boss.difficulty },
        });
      }
    }
  }

  // Trend-based survival
  if (weeklyTrends.length >= 4) {
    const recent = weeklyTrends.slice(-2);
    const older = weeklyTrends.slice(-4, -2);
    const recentDeaths = recent.reduce((s, w) => s + w.avgDeaths, 0) / recent.length;
    const olderDeaths = older.reduce((s, w) => s + w.avgDeaths, 0) / older.length;
    if (olderDeaths > 0) {
      const changePct = Math.round(((recentDeaths - olderDeaths) / olderDeaths) * 100);
      if (changePct <= -20) {
        tips.push({
          category: 'survivability', key: 'improving_survival', severity: 'positive',
          message: `Tus muertes han bajado un ${Math.abs(changePct)}% en las últimas semanas. Buen progreso.`,
          messageEn: `Your deaths decreased ${Math.abs(changePct)}% in recent weeks. Good progress.`,
          data: { changePct },
        });
      } else if (changePct >= 20) {
        tips.push({
          category: 'survivability', key: 'worsening_survival', severity: 'warning',
          message: `Tus muertes han subido un ${changePct}% recientemente. Presta atención a mecánicas.`,
          messageEn: `Your deaths increased ${changePct}% recently. Pay attention to mechanics.`,
          data: { changePct },
        });
      }
    }
  }

  // ── Consumables ──
  if (summary.healthPotionRate < 50) {
    tips.push({
      category: 'consumables', key: 'low_health_potion', severity: 'warning',
      message: `Usas pociones de vida en solo el ${summary.healthPotionRate.toFixed(0)}% de peleas. Deberían ser tu primera reacción defensiva.`,
      messageEn: `You use health potions in only ${summary.healthPotionRate.toFixed(0)}% of fights. They should be your first defensive reaction.`,
      data: { rate: summary.healthPotionRate },
    });
  }

  if (summary.healthstoneRate < 30) {
    tips.push({
      category: 'consumables', key: 'no_healthstone', severity: 'info',
      message: `Apenas usas Piedras de Salud (${summary.healthstoneRate.toFixed(0)}%). Son gratis y tienen CD independiente de pociones.`,
      messageEn: `You rarely use Healthstones (${summary.healthstoneRate.toFixed(0)}%). They're free and have a separate cooldown from potions.`,
      data: { rate: summary.healthstoneRate },
    });
  }

  if (summary.combatPotionRate < 70) {
    tips.push({
      category: 'consumables', key: 'low_combat_potion', severity: 'warning',
      message: `Usas pociones de combate en el ${summary.combatPotionRate.toFixed(0)}% de los pulls. Úsalas siempre en pulls de progresión.`,
      messageEn: `You use combat potions in ${summary.combatPotionRate.toFixed(0)}% of pulls. Use them on every progression pull.`,
      data: { rate: summary.combatPotionRate },
    });
  }

  if (summary.avgFlaskUptime < 90) {
    tips.push({
      category: 'consumables', key: 'low_flask', severity: 'warning',
      message: `Tu flask estuvo activo solo el ${summary.avgFlaskUptime.toFixed(0)}% del tiempo. Mantén flask activo siempre.`,
      messageEn: `Your flask was active only ${summary.avgFlaskUptime.toFixed(0)}% of the time. Keep your flask active at all times.`,
      data: { uptime: summary.avgFlaskUptime },
    });
  }

  if (summary.foodRate < 80) {
    tips.push({
      category: 'consumables', key: 'no_food', severity: 'info',
      message: `No tienes buff de comida en el ${(100 - summary.foodRate).toFixed(0)}% de las peleas. Es DPS/HPS gratis.`,
      messageEn: `You're missing food buff in ${(100 - summary.foodRate).toFixed(0)}% of fights. It's free DPS/HPS.`,
      data: { rate: summary.foodRate },
    });
  }

  if (summary.healthPotionRate >= 60 && summary.combatPotionRate >= 70 && summary.avgFlaskUptime >= 90 && summary.foodRate >= 80) {
    tips.push({
      category: 'consumables', key: 'good_consumables', severity: 'positive',
      message: 'Excelente uso de consumibles. Mantenlo así.',
      messageEn: 'Excellent consumable usage. Keep it up.',
      data: {},
    });
  }

  // ── Performance ──
  if (weeklyTrends.length >= 4) {
    const recent = weeklyTrends.slice(-2);
    const older = weeklyTrends.slice(-4, -2);
    const recentDps = recent.reduce((s, w) => s + w.avgDps, 0) / recent.length;
    const olderDps = older.reduce((s, w) => s + w.avgDps, 0) / older.length;
    if (olderDps > 0) {
      const changePct = Math.round(((recentDps - olderDps) / olderDps) * 100);
      if (changePct >= 10) {
        tips.push({
          category: 'performance', key: 'dps_improving', severity: 'positive',
          message: `Tu DPS ha mejorado un ${changePct}% en las últimas semanas.`,
          messageEn: `Your DPS improved ${changePct}% in recent weeks.`,
          data: { changePct },
        });
      } else if (changePct <= -10) {
        tips.push({
          category: 'performance', key: 'dps_declining', severity: 'warning',
          message: `Tu DPS ha bajado un ${Math.abs(changePct)}%. Revisa rotación, gear o talentos.`,
          messageEn: `Your DPS dropped ${Math.abs(changePct)}%. Review your rotation, gear, or talents.`,
          data: { changePct },
        });
      }
    }
  }

  if (summary.dpsVsMedianPct < 80) {
    tips.push({
      category: 'performance', key: 'below_raid_median', severity: 'critical',
      message: `Tu DPS está un ${(100 - summary.dpsVsMedianPct).toFixed(0)}% debajo de la media del raid. Consulta guías en Archon o Murlok.io.`,
      messageEn: `Your DPS is ${(100 - summary.dpsVsMedianPct).toFixed(0)}% below the raid median. Check guides on Archon or Murlok.io.`,
      data: { pct: summary.dpsVsMedianPct },
    });
  } else if (summary.dpsVsMedianPct > 110) {
    tips.push({
      category: 'performance', key: 'above_raid_median', severity: 'positive',
      message: `Tu DPS está un ${(summary.dpsVsMedianPct - 100).toFixed(0)}% por encima de la media del raid. Buen trabajo.`,
      messageEn: `Your DPS is ${(summary.dpsVsMedianPct - 100).toFixed(0)}% above the raid median. Good job.`,
      data: { pct: summary.dpsVsMedianPct },
    });
  }

  // DPS consistency check across boss breakdown
  if (bossBreakdown.length >= 3) {
    const dpsValues = bossBreakdown.filter(b => b.avgDps > 0).map(b => b.avgDps);
    if (dpsValues.length >= 3) {
      const min = Math.min(...dpsValues);
      const max = Math.max(...dpsValues);
      const variance = max > 0 ? ((max - min) / max) * 100 : 0;
      if (variance > 40) {
        tips.push({
          category: 'performance', key: 'inconsistent_dps', severity: 'info',
          message: `Tu DPS varía mucho entre bosses (${(min / 1000).toFixed(1)}K - ${(max / 1000).toFixed(1)}K). Algunos bosses pueden necesitar más práctica.`,
          messageEn: `Your DPS varies significantly across bosses (${(min / 1000).toFixed(1)}K - ${(max / 1000).toFixed(1)}K). Some bosses may need more practice.`,
          data: { min, max, variance },
        });
      }
    }
  }

  // ── Utility ──
  if (summary.avgInterrupts < 1 && summary.totalFights >= 5) {
    tips.push({
      category: 'utility', key: 'low_interrupts', severity: 'info',
      message: `Haces pocas interrupciones (${summary.avgInterrupts.toFixed(1)}/pelea). Más kicks ayudan al raid significativamente.`,
      messageEn: `You do few interrupts (${summary.avgInterrupts.toFixed(1)}/fight). More kicks help the raid significantly.`,
      data: { avg: summary.avgInterrupts },
    });
  } else if (summary.avgInterrupts >= 3) {
    tips.push({
      category: 'utility', key: 'good_interrupts', severity: 'positive',
      message: `Buen trabajo con los interrupts (${summary.avgInterrupts.toFixed(1)}/pelea).`,
      messageEn: `Good job with interrupts (${summary.avgInterrupts.toFixed(1)}/fight).`,
      data: { avg: summary.avgInterrupts },
    });
  }

  return tips;
}
