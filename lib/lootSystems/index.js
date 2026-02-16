import { getCachedConfig } from '../helpers.js';
import { LootSystem } from './base.js';
import { DKPSystem } from './dkp.js';
import { LootCouncilSystem } from './lootCouncil.js';
import { EPGPSystem } from './epgp.js';

// Re-export base class for consumers that import from index
export { LootSystem };

/**
 * Factory: returns the correct LootSystem instance based on guild config.
 * @param {object} db - Tenant database interface
 */
export async function getLootSystem(db) {
  const systemType = await getCachedConfig(db, 'loot_system', 'dkp');

  switch (systemType) {
    case 'epgp':
      return new EPGPSystem(db);
    case 'loot_council':
      return new LootCouncilSystem(db);
    case 'dkp':
    default:
      return new DKPSystem(db);
  }
}

/**
 * Get the current loot system type string.
 * @param {object} db - Tenant database interface
 */
export async function getLootSystemType(db) {
  return await getCachedConfig(db, 'loot_system', 'dkp');
}
