// Item Popularity Service
// Aggregates equipped item data from WCL reports to show what real players use

import { db } from '../database.js';
import { getFightCombatantInfo } from './warcraftlogs.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:ItemPopularity');

// WCL gear slot index → slot name mapping
const GEAR_SLOT_MAP = {
  0: 'Head', 1: 'Neck', 2: 'Shoulder', 3: 'Shirt', 4: 'Chest',
  5: 'Waist', 6: 'Legs', 7: 'Feet', 8: 'Wrist', 9: 'Hands',
  10: 'Finger', 11: 'Finger', 12: 'Trinket', 13: 'Trinket',
  14: 'Back', 15: 'Main Hand', 16: 'Off Hand',
};

/**
 * Process a WCL report's kill fights to extract item popularity data
 * Called after import-boss-stats in background
 */
export async function processReportPopularity(reportCode, killFights) {
  if (!killFights || killFights.length === 0) return;

  const fightIds = killFights.map(f => f.fightId || f.id);

  try {
    const players = await getFightCombatantInfo(reportCode, fightIds);
    if (players.length === 0) return;

    for (const player of players) {
      const className = player.type;
      const specName = player.specs?.[0]?.spec || null;
      if (!className) continue;

      // Increment total_players for this class/spec combo
      // Each gear slot item gets recorded
      for (let i = 0; i < player.gear.length; i++) {
        const item = player.gear[i];
        const slotName = GEAR_SLOT_MAP[i];
        if (!slotName || slotName === 'Shirt') continue;

        await db.run(`
          INSERT INTO item_popularity (item_id, item_name, item_slot, class, spec, content_type, usage_count, total_players, last_updated)
          VALUES (?, ?, ?, ?, ?, 'raid', 1, 1, CURRENT_TIMESTAMP)
          ON CONFLICT(item_id, class, spec, content_type) DO UPDATE SET
            usage_count = usage_count + 1,
            total_players = total_players + 1,
            item_name = COALESCE(excluded.item_name, item_name),
            item_slot = COALESCE(excluded.item_slot, item_slot),
            last_updated = CURRENT_TIMESTAMP
        `, [item.id, item.name, slotName, className, specName]);
      }
    }

    log.info(`Item popularity: processed ${players.length} players from ${reportCode}`);
  } catch (error) {
    console.warn('Error processing item popularity:', error.message);
  }
}

/**
 * Get popular items for a class/spec/slot combination
 * Returns items sorted by usage percentage
 */
export async function getPopularItems(className, specName = null, contentType = 'raid', slot = null) {
  let query = `
    SELECT item_id, item_name, item_slot, usage_count, total_players,
           ROUND(CAST(usage_count AS REAL) / NULLIF(total_players, 0) * 100, 1) as usage_pct
    FROM item_popularity
    WHERE class = ?
  `;
  const params = [className];

  if (specName) {
    query += ' AND spec = ?';
    params.push(specName);
  }

  query += ' AND content_type = ?';
  params.push(contentType);

  if (slot) {
    query += ' AND item_slot = ?';
    params.push(slot);
  }

  query += ' ORDER BY usage_count DESC LIMIT 50';

  try {
    return await db.all(query, params);
  } catch (error) {
    console.warn('Error getting popular items:', error.message);
    return [];
  }
}

export default { processReportPopularity, getPopularItems };
