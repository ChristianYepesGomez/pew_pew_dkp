// Blizzard API Service
// Fetches real raid and item data from Blizzard's Game Data API
// Docs: https://develop.battle.net/documentation/world-of-warcraft/game-data-apis

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  region: process.env.BLIZZARD_REGION || 'eu',
  locale: process.env.BLIZZARD_LOCALE || 'es_ES',
  clientId: process.env.BLIZZARD_CLIENT_ID,
  clientSecret: process.env.BLIZZARD_CLIENT_SECRET,
  cacheFile: path.join(__dirname, '../data/raid-items-cache.json'),
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
};

// API URLs
const getApiUrl = (region) => `https://${region}.api.blizzard.com`;
const getOAuthUrl = (region) => `https://${region}.battle.net/oauth/token`;

// Current raid instance IDs - UPDATE THESE WHEN NEW RAIDS RELEASE
// Find IDs at: https://wowhead.com/raids or via Blizzard API journal-instance index
const CURRENT_RAID_INSTANCES = [
  { id: 1296, name: 'Manaforge Omega', expansion: 'The War Within', season: 3 },
  // Add more raids here when they release
  // { id: XXXX, name: 'Liberation of Undermine', expansion: 'The War Within', season: 2 },
];

// Excluded item types (crafting mats, currency, etc.)
const EXCLUDED_ITEM_TYPES = [
  'Crafting Reagent',
  'Junk',
  'Quest',
  'Key',
  'Currency',
  'Consumable',
  'Cloth', // Raw cloth
  'Enchanting',
  'Gem', // Raw gems
  'Recipe',
];

// Excluded item name patterns
const EXCLUDED_PATTERNS = [
  /^Spark of/i,
  /^Seda de/i, // Silk
  /^Silk/i,
  /^Thread/i,
  /^Hilo/i,
  /Essence$/i,
  /^Patrón:/i, // Pattern:
  /^Pattern:/i,
  /^Recipe:/i,
  /^Receta:/i,
];

let accessToken = null;
let tokenExpiry = 0;

// Get OAuth access token
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  if (!CONFIG.clientId || !CONFIG.clientSecret) {
    throw new Error('Blizzard API credentials not configured. Set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET environment variables.');
  }

  try {
    const response = await axios.post(
      getOAuthUrl(CONFIG.region),
      'grant_type=client_credentials',
      {
        auth: {
          username: CONFIG.clientId,
          password: CONFIG.clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 minute early
    return accessToken;
  } catch (error) {
    console.error('Error getting Blizzard access token:', error.message);
    throw error;
  }
}

// Make authenticated API request
async function apiRequest(endpoint, params = {}) {
  const token = await getAccessToken();
  const url = `${getApiUrl(CONFIG.region)}${endpoint}`;

  try {
    const response = await axios.get(url, {
      params: {
        namespace: `static-${CONFIG.region}`,
        locale: CONFIG.locale,
        ...params,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error.message);
    throw error;
  }
}

// Get journal instance (raid) data
async function getJournalInstance(instanceId) {
  return apiRequest(`/data/wow/journal-instance/${instanceId}`);
}

// Get journal encounter (boss) data
async function getJournalEncounter(encounterId) {
  return apiRequest(`/data/wow/journal-encounter/${encounterId}`);
}

// Get item data
async function getItem(itemId) {
  return apiRequest(`/data/wow/item/${itemId}`);
}

// Get item media (icon)
async function getItemMedia(itemId) {
  try {
    const response = await apiRequest(`/data/wow/media/item/${itemId}`);
    // Find the icon asset
    const iconAsset = response.assets?.find(a => a.key === 'icon');
    return iconAsset?.value || null;
  } catch {
    return null;
  }
}

// Check if item should be excluded
function shouldExcludeItem(item) {
  // Check item type
  if (item.item_subclass?.name && EXCLUDED_ITEM_TYPES.some(type =>
    item.item_subclass.name.toLowerCase().includes(type.toLowerCase())
  )) {
    return true;
  }

  // Check name patterns
  const name = item.name || '';
  if (EXCLUDED_PATTERNS.some(pattern => pattern.test(name))) {
    return true;
  }

  // Exclude items without equip slot (usually not gear)
  if (!item.inventory_type || item.inventory_type.type === 'NON_EQUIP') {
    // Allow trinkets and other special items
    const allowedTypes = ['TRINKET', 'FINGER', 'NECK', 'BACK', 'SHIRT', 'TABARD'];
    if (!allowedTypes.includes(item.inventory_type?.type)) {
      return true;
    }
  }

  return false;
}

// Map Blizzard quality to our rarity
function mapQuality(quality) {
  const qualityMap = {
    POOR: 'common',
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    EPIC: 'epic',
    LEGENDARY: 'legendary',
    ARTIFACT: 'legendary',
    HEIRLOOM: 'epic',
  };
  return qualityMap[quality?.type] || 'common';
}

// Map inventory type to slot name
function mapSlot(inventoryType) {
  const slotMap = {
    HEAD: 'Head',
    NECK: 'Neck',
    SHOULDER: 'Shoulder',
    SHIRT: 'Shirt',
    CHEST: 'Chest',
    WAIST: 'Waist',
    LEGS: 'Legs',
    FEET: 'Feet',
    WRIST: 'Wrist',
    HANDS: 'Hands',
    FINGER: 'Finger',
    TRINKET: 'Trinket',
    BACK: 'Back',
    MAIN_HAND: 'Main Hand',
    OFF_HAND: 'Off Hand',
    ONE_HAND: 'One-Hand',
    TWO_HAND: 'Two-Hand',
    RANGED: 'Ranged',
    SHIELD: 'Shield',
    HOLDABLE: 'Off Hand',
  };
  return slotMap[inventoryType?.type] || inventoryType?.name || 'Unknown';
}

// Fetch all items for a raid instance
async function fetchRaidItems(instanceId) {
  console.log(`Fetching items for raid instance ${instanceId}...`);

  const instance = await getJournalInstance(instanceId);
  const items = [];

  console.log(`Found raid: ${instance.name} with ${instance.encounters?.length || 0} encounters`);

  for (const encounterRef of instance.encounters || []) {
    const encounter = await getJournalEncounter(encounterRef.id);
    console.log(`  Processing boss: ${encounter.name}`);

    for (const itemRef of encounter.items || []) {
      try {
        const item = itemRef.item;
        if (!item?.id) continue;

        // Get full item details
        const itemDetails = await getItem(item.id);

        // Check if should exclude
        if (shouldExcludeItem(itemDetails)) {
          continue;
        }

        // Get item icon
        const iconUrl = await getItemMedia(item.id);

        items.push({
          id: item.id,
          name: {
            en: item.name, // The API returns localized name based on locale
            es: item.name, // We'll get Spanish from the locale setting
          },
          rarity: mapQuality(itemDetails.quality),
          icon: iconUrl,
          slot: mapSlot(itemDetails.inventory_type),
          raid: instance.name,
          boss: encounter.name,
          itemLevel: itemDetails.level,
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.warn(`    Failed to fetch item ${itemRef.item?.id}: ${error.message}`);
      }
    }
  }

  return items;
}

// Fetch items in both languages
async function fetchRaidItemsMultiLang(instanceId) {
  console.log(`Fetching items in multiple languages for instance ${instanceId}...`);

  // Fetch in Spanish (primary)
  const originalLocale = CONFIG.locale;
  CONFIG.locale = 'es_ES';
  const spanishItems = await fetchRaidItems(instanceId);

  // Fetch in English
  CONFIG.locale = 'en_US';
  const englishItems = await fetchRaidItems(instanceId);
  CONFIG.locale = originalLocale;

  // Merge translations
  const mergedItems = spanishItems.map(esItem => {
    const enItem = englishItems.find(en => en.id === esItem.id);
    return {
      ...esItem,
      name: {
        es: esItem.name.es,
        en: enItem?.name.en || esItem.name.es,
      },
      boss: esItem.boss, // Keep Spanish boss name
      bossEn: enItem?.boss || esItem.boss, // Also store English
    };
  });

  return mergedItems;
}

// Load cached data
function loadCache() {
  try {
    if (fs.existsSync(CONFIG.cacheFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.cacheFile, 'utf8'));
      if (Date.now() - data.timestamp < CONFIG.cacheDuration) {
        console.log('Using cached raid items data');
        return data.items;
      }
    }
  } catch (error) {
    console.warn('Failed to load cache:', error.message);
  }
  return null;
}

// Save to cache
function saveCache(items) {
  try {
    const dir = path.dirname(CONFIG.cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.cacheFile, JSON.stringify({
      timestamp: Date.now(),
      items,
    }, null, 2));
    console.log('Saved raid items to cache');
  } catch (error) {
    console.warn('Failed to save cache:', error.message);
  }
}

// Main function to get all current raid items
export async function getCurrentRaidItems(forceRefresh = false) {
  // Try cache first
  if (!forceRefresh) {
    const cached = loadCache();
    if (cached) return cached;
  }

  // Check if credentials are configured
  if (!CONFIG.clientId || !CONFIG.clientSecret) {
    console.warn('Blizzard API not configured - using static fallback data');
    return null; // Will trigger fallback to static data
  }

  try {
    const allItems = [];

    for (const raid of CURRENT_RAID_INSTANCES) {
      const items = await fetchRaidItemsMultiLang(raid.id);
      allItems.push(...items);
    }

    // Save to cache
    saveCache(allItems);

    return allItems;
  } catch (error) {
    console.error('Failed to fetch raid items from Blizzard API:', error.message);

    // Try to use stale cache
    try {
      if (fs.existsSync(CONFIG.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.cacheFile, 'utf8'));
        console.warn('Using stale cache due to API error');
        return data.items;
      }
    } catch {}

    return null; // Will trigger fallback
  }
}

// Get list of available raids from API
export async function getAvailableRaids() {
  try {
    const expansions = await apiRequest('/data/wow/journal-expansion/index');
    const raids = [];

    for (const exp of expansions.tiers || []) {
      const expansion = await apiRequest(`/data/wow/journal-expansion/${exp.id}`);

      for (const instance of expansion.raids || []) {
        raids.push({
          id: instance.id,
          name: instance.name,
          expansion: expansion.name,
        });
      }
    }

    return raids;
  } catch (error) {
    console.error('Failed to get available raids:', error.message);
    return [];
  }
}

// Manually refresh cache
export async function refreshCache() {
  return getCurrentRaidItems(true);
}

// Update raid configuration
export function setCurrentRaids(raids) {
  CURRENT_RAID_INSTANCES.length = 0;
  CURRENT_RAID_INSTANCES.push(...raids);
}

export default {
  getCurrentRaidItems,
  getAvailableRaids,
  refreshCache,
  setCurrentRaids,
};
