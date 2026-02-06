/**
 * Raid/Boss Statistics Service
 * Manages WCL zone data, boss statistics, and death tracking
 */

import { db } from '../database.js';

// ── Static Data: Current Expansion Raids ──────────────────────────────

const EXPANSION_DATA = {
  'The War Within': {
    id: 5,
    tiers: [
      {
        tier: 1,
        zones: [
          {
            wclZoneId: 38, // Nerub-ar Palace
            name: "Nerub-ar Palace",
            slug: "nerubar-palace",
            bosses: [
              { encounterID: 2902, name: "Ulgrax the Devourer", slug: "ulgrax", order: 1 },
              { encounterID: 2917, name: "The Bloodbound Horror", slug: "bloodbound-horror", order: 2 },
              { encounterID: 2898, name: "Sikran, Captain of the Sureki", slug: "sikran", order: 3 },
              { encounterID: 2918, name: "Rasha'nan", slug: "rashanan", order: 4 },
              { encounterID: 2919, name: "Broodtwister Ovi'nax", slug: "ovinax", order: 5 },
              { encounterID: 2920, name: "Nexus-Princess Ky'veza", slug: "kyveza", order: 6 },
              { encounterID: 2921, name: "The Silken Court", slug: "silken-court", order: 7 },
              { encounterID: 2922, name: "Queen Ansurek", slug: "ansurek", order: 8 },
            ]
          }
        ]
      },
      {
        tier: 2,
        zones: [
          {
            wclZoneId: 42, // Liberation of Undermine
            name: "Liberation of Undermine",
            slug: "liberation-of-undermine",
            bosses: [
              { encounterID: 3009, name: "Vexie and the Geargrinders", slug: "vexie", order: 1 },
              { encounterID: 3010, name: "Cauldron of Carnage", slug: "cauldron-of-carnage", order: 2 },
              { encounterID: 3011, name: "Rik Reverb", slug: "rik-reverb", order: 3 },
              { encounterID: 3012, name: "Stix Bunkjunker", slug: "stix-bunkjunker", order: 4 },
              { encounterID: 3013, name: "Sprocketmonger Lockenstock", slug: "sprocketmonger-lockenstock", order: 5 },
              { encounterID: 3014, name: "The One-Armed Bandit", slug: "one-armed-bandit", order: 6 },
              { encounterID: 3015, name: "Mug'Zee, Heads of Security", slug: "mugzee", order: 7 },
              { encounterID: 3016, name: "Gallywix", slug: "gallywix", order: 8 },
            ]
          }
        ]
      },
      {
        tier: 3,
        zones: [
          {
            wclZoneId: 44, // Manaforge Omega
            name: "Manaforge Omega",
            slug: "manaforge-omega",
            bosses: [
              { encounterID: 3129, name: "Plexus Sentinel", slug: "plexus-sentinel", order: 1 },
              { encounterID: 3131, name: "Loom'ithar", slug: "loomithar", order: 2 },
              { encounterID: 3130, name: "Soulbinder Naazindhri", slug: "soulbinder-naazindhri", order: 3 },
              { encounterID: 3132, name: "Forgeweaver Araz", slug: "forgeweaver-araz", order: 4 },
              { encounterID: 3122, name: "The Soul Hunters", slug: "the-soul-hunters", order: 5, optional: true },
              { encounterID: 3133, name: "Fractillus", slug: "fractillus", order: 6 },
              { encounterID: 3134, name: "Nexus-King Salhadaar", slug: "nexus-king-salhadaar", order: 7 },
              { encounterID: 3135, name: "Dimensius, the All-Devouring", slug: "dimensius-the-all-devouring", order: 8 },
            ]
          }
        ]
      }
    ]
  }
};

// Current tier (update when new tier releases)
const CURRENT_TIER = 3;

// ── Mythic Trap URL Helper ────────────────────────────────────────────

function getMythicTrapUrl(raidSlug, bossSlug) {
  return `https://www.mythictrap.com/en/${raidSlug}/${bossSlug}`;
}

function getMythicTrapBossImage(raidSlug, bossSlug) {
  // Mythic Trap has high-quality boss artwork
  return `https://assets2.mythictrap.com/${raidSlug}/background_finals/${bossSlug}-custom.png?v=9`;
}

// ── Database Operations ───────────────────────────────────────────────

/**
 * Seed initial raid/boss data from static definitions
 */
export async function seedRaidData() {
  console.log('🏰 Seeding raid/boss data...');

  for (const [expansion, data] of Object.entries(EXPANSION_DATA)) {
    for (const tierData of data.tiers) {
      const isCurrent = tierData.tier === CURRENT_TIER ? 1 : 0;

      for (const zone of tierData.zones) {
        // Insert or update zone
        const existingZone = await db.get(
          'SELECT id FROM wcl_zones WHERE wcl_zone_id = ?',
          zone.wclZoneId
        );

        let zoneId;
        if (existingZone) {
          zoneId = existingZone.id;
          await db.run(
            `UPDATE wcl_zones SET
              name = ?, slug = ?, expansion = ?, tier = ?, is_current = ?,
              boss_count = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            zone.name, zone.slug, expansion, tierData.tier, isCurrent,
            zone.bosses.length, zoneId
          );
        } else {
          const result = await db.run(
            `INSERT INTO wcl_zones (wcl_zone_id, name, slug, expansion, tier, is_current, boss_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            zone.wclZoneId, zone.name, zone.slug, expansion, tierData.tier, isCurrent, zone.bosses.length
          );
          zoneId = result.lastInsertRowid;
        }

        // Insert or update bosses
        for (const boss of zone.bosses) {
          // Only add Mythic Trap URL for current raids
          const mythicTrapUrl = isCurrent ? getMythicTrapUrl(zone.slug, boss.slug) : null;
          // Boss image: Mythic Trap for current raids (high quality)
          const bossImage = isCurrent ? getMythicTrapBossImage(zone.slug, boss.slug) : null;

          const existingBoss = await db.get(
            'SELECT id, image_url FROM wcl_bosses WHERE wcl_encounter_id = ?',
            boss.encounterID
          );

          if (existingBoss) {
            // IMPORTANT: Never overwrite existing image_url with null
            // This preserves images when raids become legacy
            const finalImageUrl = bossImage || existingBoss.image_url;

            await db.run(
              `UPDATE wcl_bosses SET
                zone_id = ?, name = ?, slug = ?, boss_order = ?, mythic_trap_url = ?, image_url = ?
               WHERE id = ?`,
              zoneId, boss.name, boss.slug, boss.order, mythicTrapUrl, finalImageUrl, existingBoss.id
            );
          } else {
            await db.run(
              `INSERT INTO wcl_bosses (zone_id, wcl_encounter_id, name, slug, boss_order, mythic_trap_url, image_url)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              zoneId, boss.encounterID, boss.name, boss.slug, boss.order, mythicTrapUrl, bossImage
            );
          }
        }
      }
    }
  }

  console.log('✅ Raid/boss data seeded');
}

/**
 * Get all zones with bosses, separated by current/legacy
 */
export async function getAllZonesWithBosses() {
  const zones = await db.all(`
    SELECT z.*,
           (SELECT COUNT(*) FROM wcl_bosses WHERE zone_id = z.id) as boss_count
    FROM wcl_zones z
    ORDER BY z.tier DESC, z.name
  `);

  const result = { current: [], legacy: [] };

  for (const zone of zones) {
    const bosses = await db.all(`
      SELECT b.*,
             bs.difficulty as highest_difficulty,
             bs.total_kills as kills,
             bs.total_wipes as wipes,
             bs.fastest_kill_ms,
             bs.last_kill_date
      FROM wcl_bosses b
      LEFT JOIN boss_statistics bs ON b.id = bs.boss_id
        AND bs.difficulty = (
          SELECT difficulty FROM boss_statistics
          WHERE boss_id = b.id
          ORDER BY CASE difficulty
            WHEN 'Mythic' THEN 3
            WHEN 'Heroic' THEN 2
            WHEN 'Normal' THEN 1
            ELSE 0
          END DESC
          LIMIT 1
        )
      WHERE b.zone_id = ?
      ORDER BY b.boss_order
    `, zone.id);

    // Calculate progress - find ACTUAL highest difficulty across all bosses with kills
    const DIFF_PRIORITY = { 'Mythic': 3, 'Heroic': 2, 'Normal': 1, 'LFR': 0 };
    const bossesWithKills = bosses.filter(b => b.kills > 0);
    const highestDiff = bossesWithKills.length > 0
      ? bossesWithKills.reduce((best, b) =>
          (DIFF_PRIORITY[b.highest_difficulty] || 0) > (DIFF_PRIORITY[best] || 0) ? b.highest_difficulty : best
        , bossesWithKills[0].highest_difficulty)
      : null;
    const bossesKilled = bossesWithKills.filter(b => b.highest_difficulty === highestDiff).length;
    const diffShort = highestDiff ? highestDiff.charAt(0) : '';
    const progress = highestDiff ? `${bossesKilled}/${zone.boss_count} ${diffShort}` : null;

    const zoneData = {
      id: zone.id,
      wclZoneId: zone.wcl_zone_id,
      name: zone.name,
      slug: zone.slug,
      expansion: zone.expansion,
      tier: zone.tier,
      bossCount: zone.boss_count,
      progress,
      highestDifficulty: highestDiff,
      bosses: bosses.map(b => ({
        id: b.id,
        encounterID: b.wcl_encounter_id,
        name: b.name,
        slug: b.slug,
        order: b.boss_order,
        mythicTrapUrl: b.mythic_trap_url,
        imageUrl: b.image_url,
        highestDifficulty: b.highest_difficulty,
        kills: b.kills || 0,
        wipes: b.wipes || 0,
        fastestKill: b.fastest_kill_ms ? formatDuration(b.fastest_kill_ms) : null,
        lastKill: b.last_kill_date,
      }))
    };

    if (zone.is_current) {
      result.current.push(zoneData);
    } else {
      result.legacy.push(zoneData);
    }
  }

  return result;
}

/**
 * Get detailed stats for a specific boss
 * @param {number} bossId
 * @param {string|null} requestedDifficulty - Optional: 'Mythic', 'Heroic', 'Normal', 'LFR'. Defaults to highest available.
 */
export async function getBossDetails(bossId, requestedDifficulty = null) {
  const boss = await db.get(`
    SELECT b.*, z.name as raid_name, z.slug as raid_slug
    FROM wcl_bosses b
    JOIN wcl_zones z ON b.zone_id = z.id
    WHERE b.id = ?
  `, bossId);

  if (!boss) return null;

  // Get all available difficulties for this boss
  const availableDifficulties = await db.all(`
    SELECT difficulty, total_kills, total_wipes
    FROM boss_statistics
    WHERE boss_id = ?
    ORDER BY CASE difficulty
      WHEN 'Mythic' THEN 3
      WHEN 'Heroic' THEN 2
      WHEN 'Normal' THEN 1
      ELSE 0
    END DESC
  `, bossId);

  // Determine which difficulty to show
  let selectedDifficulty = requestedDifficulty;
  if (!selectedDifficulty || !availableDifficulties.find(d => d.difficulty === selectedDifficulty)) {
    selectedDifficulty = availableDifficulties.length > 0 ? availableDifficulties[0].difficulty : 'Heroic';
  }

  // Get statistics for selected difficulty
  const stats = await db.get(`
    SELECT * FROM boss_statistics
    WHERE boss_id = ? AND difficulty = ?
  `, bossId, selectedDifficulty);

  // Get death leaderboard
  const deathLeaderboard = await db.all(`
    SELECT pbd.*, u.character_name, u.character_class
    FROM player_boss_deaths pbd
    JOIN users u ON pbd.user_id = u.id
    WHERE pbd.boss_id = ? AND pbd.difficulty = ?
    ORDER BY pbd.total_deaths DESC
    LIMIT 20
  `, bossId, selectedDifficulty);

  // Get recent kills
  const recentKills = await db.all(`
    SELECT * FROM boss_kill_log
    WHERE boss_id = ? AND difficulty = ?
    ORDER BY kill_date DESC, created_at DESC
    LIMIT 10
  `, bossId, selectedDifficulty);

  // Get boss records (top performers)
  const records = await db.all(`
    SELECT * FROM boss_records
    WHERE boss_id = ? AND difficulty = ?
  `, bossId, selectedDifficulty);

  // Format records by type
  const recordsMap = {};
  for (const r of records) {
    recordsMap[r.record_type] = {
      userId: r.user_id,
      characterName: r.character_name,
      characterClass: r.character_class,
      value: r.value,
      valueFormatted: formatNumber(r.value),
      reportCode: r.report_code,
      recordedAt: r.recorded_at,
    };
  }

  // Get the player with most deaths (for highlight)
  const mostDeaths = deathLeaderboard.length > 0 ? deathLeaderboard[0] : null;

  return {
    boss: {
      id: boss.id,
      encounterID: boss.wcl_encounter_id,
      name: boss.name,
      raid: boss.raid_name,
      raidSlug: boss.raid_slug,
      mythicTrapUrl: boss.mythic_trap_url,
      imageUrl: boss.image_url,
    },
    // Available difficulties for the selector
    availableDifficulties: availableDifficulties.map(d => ({
      difficulty: d.difficulty,
      kills: d.total_kills,
      wipes: d.total_wipes,
    })),
    // Statistics for the selected difficulty
    statistics: {
      difficulty: stats?.difficulty || selectedDifficulty,
      kills: stats?.total_kills || 0,
      wipes: stats?.total_wipes || 0,
      fastestKill: stats?.fastest_kill_ms ? formatDuration(stats.fastest_kill_ms) : null,
      avgKillTime: stats?.avg_kill_time_ms ? formatDuration(stats.avg_kill_time_ms) : null,
      lastKill: stats?.last_kill_date || null,
      wipesToFirstKill: stats?.wipes_to_first_kill ?? null,
      firstKillDate: stats?.first_kill_date || null,
    },
    records: {
      topDamage: recordsMap['top_damage'] || null,
      topHealing: recordsMap['top_healing'] || null,
      mostDamageTaken: recordsMap['most_damage_taken'] || null,
      mostDeaths: mostDeaths ? {
        userId: mostDeaths.user_id,
        characterName: mostDeaths.character_name,
        characterClass: mostDeaths.character_class,
        value: mostDeaths.total_deaths,
        valueFormatted: String(mostDeaths.total_deaths),
        fights: mostDeaths.total_fights,
      } : null,
    },
    deathLeaderboard: deathLeaderboard.map((d, i) => ({
      rank: i + 1,
      userId: d.user_id,
      characterName: d.character_name,
      characterClass: d.character_class,
      deaths: d.total_deaths,
      fights: d.total_fights,
      deathRate: d.total_fights > 0
        ? `${((d.total_deaths / d.total_fights) * 100).toFixed(1)}%`
        : '0%',
    })),
    recentKills: recentKills.map(k => ({
      date: k.kill_date,
      killTime: formatDuration(k.kill_time_ms),
      reportCode: k.report_code,
      wclUrl: `https://www.warcraftlogs.com/reports/${k.report_code}`,
    })),
  };
}

/**
 * Check if a fight has already been processed
 */
export async function isFightProcessed(reportCode, encounterId, fightId) {
  const existing = await db.get(
    `SELECT id FROM boss_stats_processed
     WHERE report_code = ? AND encounter_id = ? AND fight_id = ?`,
    reportCode, encounterId, fightId
  );
  return !!existing;
}

/**
 * Process fight statistics from a WCL report
 */
export async function processFightStats(reportCode, fight, difficulty) {
  // Check for deduplication
  if (await isFightProcessed(reportCode, fight.encounterID, fight.id)) {
    return { skipped: true, reason: 'already_processed' };
  }

  // Find the boss in our database
  const boss = await db.get(
    'SELECT id FROM wcl_bosses WHERE wcl_encounter_id = ?',
    fight.encounterID
  );

  if (!boss) {
    return { skipped: true, reason: 'boss_not_found' };
  }

  const fightDuration = fight.endTime - fight.startTime;
  const normalizedDifficulty = normalizeDifficulty(difficulty);

  // Mark fight as processed
  await db.run(
    `INSERT INTO boss_stats_processed (report_code, encounter_id, fight_id, difficulty, kill, fight_time_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    reportCode, fight.encounterID, fight.id, normalizedDifficulty, fight.kill ? 1 : 0, fightDuration
  );

  // Get or create statistics entry
  const existingStats = await db.get(
    'SELECT * FROM boss_statistics WHERE boss_id = ? AND difficulty = ?',
    boss.id, normalizedDifficulty
  );

  if (existingStats) {
    if (fight.kill) {
      // Update kill stats
      const newTotalKillTime = (existingStats.total_kill_time_ms || 0) + fightDuration;
      const newKills = existingStats.total_kills + 1;
      const newAvgKillTime = Math.round(newTotalKillTime / newKills);
      const newFastest = existingStats.fastest_kill_ms
        ? Math.min(existingStats.fastest_kill_ms, fightDuration)
        : fightDuration;

      // Check if this is the first kill - track wipes to first kill
      const isFirstKill = existingStats.total_kills === 0;

      if (isFirstKill) {
        // First kill! Record how many wipes it took
        await db.run(
          `UPDATE boss_statistics SET
            total_kills = ?, total_kill_time_ms = ?, avg_kill_time_ms = ?,
            fastest_kill_ms = ?, last_kill_date = date('now'),
            wipes_to_first_kill = ?, first_kill_date = date('now'),
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          newKills, newTotalKillTime, newAvgKillTime, newFastest,
          existingStats.total_wipes, existingStats.id
        );
        console.log(`🎉 First kill on boss ${boss.id} (${normalizedDifficulty})! Took ${existingStats.total_wipes} wipes.`);
      } else {
        await db.run(
          `UPDATE boss_statistics SET
            total_kills = ?, total_kill_time_ms = ?, avg_kill_time_ms = ?,
            fastest_kill_ms = ?, last_kill_date = date('now'), updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          newKills, newTotalKillTime, newAvgKillTime, newFastest, existingStats.id
        );
      }

      // Log the kill
      await db.run(
        `INSERT INTO boss_kill_log (boss_id, difficulty, report_code, fight_id, kill_time_ms, kill_date)
         VALUES (?, ?, ?, ?, ?, date('now'))`,
        boss.id, normalizedDifficulty, reportCode, fight.id, fightDuration
      );
    } else {
      // Update wipe count
      await db.run(
        `UPDATE boss_statistics SET total_wipes = total_wipes + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        existingStats.id
      );
    }
  } else {
    // Create new statistics entry
    const today = new Date().toISOString().split('T')[0];
    await db.run(
      `INSERT INTO boss_statistics (boss_id, difficulty, total_kills, total_wipes, fastest_kill_ms, avg_kill_time_ms, total_kill_time_ms, last_kill_date, wipes_to_first_kill, first_kill_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      boss.id, normalizedDifficulty,
      fight.kill ? 1 : 0,
      fight.kill ? 0 : 1,
      fight.kill ? fightDuration : null,
      fight.kill ? fightDuration : null,
      fight.kill ? fightDuration : 0,
      fight.kill ? today : null,
      fight.kill ? 0 : null, // wipes_to_first_kill is 0 if killed on first try
      fight.kill ? today : null
    );

    if (fight.kill) {
      await db.run(
        `INSERT INTO boss_kill_log (boss_id, difficulty, report_code, fight_id, kill_time_ms, kill_date)
         VALUES (?, ?, ?, ?, ?, date('now'))`,
        boss.id, normalizedDifficulty, reportCode, fight.id, fightDuration
      );
    }
  }

  return { skipped: false, bossId: boss.id, kill: fight.kill };
}

/**
 * Record player performance stats (damage, healing, damage taken)
 * Stats format from getFightStats: { damage: [{name, total}], healing: [{name, total}], damageTaken: [{name, total}] }
 */
export async function recordPlayerPerformance(bossId, difficulty, fightStats, participantUserMap, reportCode, fightId) {
  const normalizedDifficulty = normalizeDifficulty(difficulty);

  // Process damage dealers
  for (const entry of fightStats.damage || []) {
    const userId = participantUserMap[entry.name.toLowerCase()];
    if (!userId) continue;

    await updatePlayerPerformance(userId, bossId, normalizedDifficulty, {
      damage: entry.total,
    });

    // Check for record
    await checkAndUpdateRecord(bossId, normalizedDifficulty, 'top_damage', userId, entry.total, entry.name, reportCode, fightId, participantUserMap);
  }

  // Process healers
  for (const entry of fightStats.healing || []) {
    const userId = participantUserMap[entry.name.toLowerCase()];
    if (!userId) continue;

    await updatePlayerPerformance(userId, bossId, normalizedDifficulty, {
      healing: entry.total,
    });

    // Check for record
    await checkAndUpdateRecord(bossId, normalizedDifficulty, 'top_healing', userId, entry.total, entry.name, reportCode, fightId, participantUserMap);
  }

  // Process damage taken
  for (const entry of fightStats.damageTaken || []) {
    const userId = participantUserMap[entry.name.toLowerCase()];
    if (!userId) continue;

    await updatePlayerPerformance(userId, bossId, normalizedDifficulty, {
      damageTaken: entry.total,
    });

    // Check for record (most damage taken - could be "shame" or "tank badge")
    await checkAndUpdateRecord(bossId, normalizedDifficulty, 'most_damage_taken', userId, entry.total, entry.name, reportCode, fightId, participantUserMap);
  }
}

/**
 * Update player performance aggregates
 */
async function updatePlayerPerformance(userId, bossId, difficulty, stats) {
  const existing = await db.get(
    'SELECT * FROM player_boss_performance WHERE user_id = ? AND boss_id = ? AND difficulty = ?',
    userId, bossId, difficulty
  );

  if (existing) {
    const updates = [];
    const values = [];

    if (stats.damage !== undefined) {
      updates.push('total_damage = total_damage + ?');
      values.push(stats.damage);
    }
    if (stats.healing !== undefined) {
      updates.push('total_healing = total_healing + ?');
      values.push(stats.healing);
    }
    if (stats.damageTaken !== undefined) {
      updates.push('total_damage_taken = total_damage_taken + ?');
      values.push(stats.damageTaken);
    }
    if (stats.potions !== undefined) {
      updates.push('total_potions_used = total_potions_used + ?');
      values.push(stats.potions);
    }

    updates.push('fights_participated = fights_participated + 1');
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(existing.id);

    await db.run(
      `UPDATE player_boss_performance SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );
  } else {
    await db.run(
      `INSERT INTO player_boss_performance (user_id, boss_id, difficulty, total_damage, total_healing, total_damage_taken, total_potions_used, fights_participated)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      userId, bossId, difficulty,
      stats.damage || 0,
      stats.healing || 0,
      stats.damageTaken || 0,
      stats.potions || 0
    );
  }
}

/**
 * Check and update boss records (all-time top performers)
 */
async function checkAndUpdateRecord(bossId, difficulty, recordType, userId, value, characterName, reportCode, fightId, participantUserMap) {
  const existing = await db.get(
    'SELECT * FROM boss_records WHERE boss_id = ? AND difficulty = ? AND record_type = ?',
    bossId, difficulty, recordType
  );

  // Get character class from participantUserMap or users table
  let characterClass = null;
  const user = await db.get('SELECT character_class FROM users WHERE id = ?', userId);
  if (user) characterClass = user.character_class;

  if (!existing) {
    // First record
    await db.run(
      `INSERT INTO boss_records (boss_id, difficulty, record_type, user_id, value, character_name, character_class, report_code, fight_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bossId, difficulty, recordType, userId, value, characterName, characterClass, reportCode, fightId
    );
  } else if (value > existing.value) {
    // New record!
    await db.run(
      `UPDATE boss_records SET
        user_id = ?, value = ?, character_name = ?, character_class = ?,
        report_code = ?, fight_id = ?, recorded_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      userId, value, characterName, characterClass, reportCode, fightId, existing.id
    );
    console.log(`🏆 New ${recordType} record for boss ${bossId}: ${characterName} with ${formatNumber(value)}`);
  }
}

/**
 * Record player deaths for a fight
 * Deaths format: [{ name: "PlayerName", deaths: 2 }, ...]
 */
export async function recordPlayerDeaths(bossId, difficulty, deaths, participantUserMap) {
  const normalizedDifficulty = normalizeDifficulty(difficulty);

  // Deaths already come with counts from WCL table API
  const deathCounts = {};
  for (const death of deaths) {
    if (death.name && death.deaths > 0) {
      deathCounts[death.name] = death.deaths;
    }
  }

  // Update database for each player
  for (const [playerName, count] of Object.entries(deathCounts)) {
    const userId = participantUserMap[playerName.toLowerCase()];
    if (!userId) continue;

    const existing = await db.get(
      'SELECT * FROM player_boss_deaths WHERE user_id = ? AND boss_id = ? AND difficulty = ?',
      userId, bossId, normalizedDifficulty
    );

    if (existing) {
      await db.run(
        `UPDATE player_boss_deaths SET
          total_deaths = total_deaths + ?, total_fights = total_fights + 1,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        count, existing.id
      );
    } else {
      await db.run(
        `INSERT INTO player_boss_deaths (user_id, boss_id, difficulty, total_deaths, total_fights)
         VALUES (?, ?, ?, ?, 1)`,
        userId, bossId, normalizedDifficulty, count
      );
    }
  }

  // Also increment fight count for players who didn't die
  for (const [name, userId] of Object.entries(participantUserMap)) {
    if (!deathCounts[name]) {
      const existing = await db.get(
        'SELECT * FROM player_boss_deaths WHERE user_id = ? AND boss_id = ? AND difficulty = ?',
        userId, bossId, normalizedDifficulty
      );

      if (existing) {
        await db.run(
          `UPDATE player_boss_deaths SET total_fights = total_fights + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          existing.id
        );
      } else {
        await db.run(
          `INSERT INTO player_boss_deaths (user_id, boss_id, difficulty, total_deaths, total_fights)
           VALUES (?, ?, ?, 0, 1)`,
          userId, bossId, normalizedDifficulty
        );
      }
    }
  }
}

/**
 * Mark a zone as legacy or current
 */
export async function setZoneLegacy(zoneId, isLegacy) {
  await db.run(
    'UPDATE wcl_zones SET is_current = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    isLegacy ? 0 : 1, zoneId
  );
}

// ── Helper Functions ──────────────────────────────────────────────────

function formatDuration(ms) {
  if (!ms) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

function normalizeDifficulty(difficulty) {
  if (!difficulty) return 'Normal';
  const d = String(difficulty).toLowerCase();
  if (d.includes('mythic') || d === '5') return 'Mythic';
  if (d.includes('heroic') || d === '4') return 'Heroic';
  if (d.includes('normal') || d === '3') return 'Normal';
  if (d.includes('lfr') || d === '1') return 'LFR';
  return 'Normal';
}

export default {
  seedRaidData,
  getAllZonesWithBosses,
  getBossDetails,
  isFightProcessed,
  processFightStats,
  recordPlayerDeaths,
  recordPlayerPerformance,
  setZoneLegacy,
};
