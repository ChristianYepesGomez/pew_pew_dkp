// Blizzard API Service
// Fetches real raid and item data from Blizzard's Game Data API
// Docs: https://develop.battle.net/documentation/world-of-warcraft/game-data-apis

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../lib/logger.js';
import { createCache } from '../lib/cache.js';

const log = createLogger('Service:BlizzardAPI');
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
// Also update EXPANSION_DATA + CURRENT_EXPANSION/CURRENT_TIER in services/raids.js
const CURRENT_RAID_INSTANCES = [
  { id: 1302, name: 'Manaforge Omega', expansion: 'The War Within', season: 3 },
  // TODO (nueva expansión): añadir la nueva raid aquí y comentar la anterior
  // { id: ???, name: '???', expansion: 'Midnight', season: 1 },
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

// Excluded item name patterns (both English and Spanish)
const EXCLUDED_PATTERNS = [
  /^Spark of/i,
  /^Chispa de/i, // Spark of (Spanish)
  /^Seda de/i, // Silk
  /^Silk/i,
  /^Thread/i,
  /^Hilo/i,
  /Essence$/i,
  /Esencia$/i, // Essence (Spanish)
  /^Patrón:/i, // Pattern:
  /^Pattern:/i,
  /^Recipe:/i,
  /^Receta:/i,
  /^Design:/i,
  /^Diseño:/i, // Design (Spanish)
  /^Formula:/i,
  /^Fórmula:/i, // Formula (Spanish)
  /^Schematic:/i,
  /^Esquema:/i, // Schematic (Spanish)
];

let accessToken = null;
let tokenExpiry = 0;
let tokenRefreshPromise = null; // Mutex: prevents concurrent token refreshes

// Icon cache - persists while server runs, avoids repeated Blizzard API calls
const iconCache = new Map();

// TTL caches for character armory data
const equipmentCache = createCache(60 * 60 * 1000); // 1 hour
const mediaCache = createCache(24 * 60 * 60 * 1000); // 24 hours

// Get OAuth access token (with mutex to prevent concurrent refreshes)
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // If a refresh is already in progress, wait for it
  if (tokenRefreshPromise) return tokenRefreshPromise;

  if (!CONFIG.clientId || !CONFIG.clientSecret) {
    throw new Error('Blizzard API credentials not configured. Set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET environment variables.');
  }

  tokenRefreshPromise = (async () => {
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
      log.error('Error getting Blizzard access token', error);
      throw error;
    }
  })().finally(() => { tokenRefreshPromise = null; });

  return tokenRefreshPromise;
}

// Make authenticated API request
async function apiRequest(endpoint, params = {}, namespace = null) {
  const token = await getAccessToken();
  const url = `${getApiUrl(CONFIG.region)}${endpoint}`;

  try {
    const response = await axios.get(url, {
      params: {
        namespace: namespace || `static-${CONFIG.region}`,
        locale: CONFIG.locale,
        ...params,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    log.error(`API request failed for ${endpoint}`, error);
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

// Get item media (icon) - with in-memory cache and timeout
async function getItemMedia(itemId) {
  if (iconCache.has(itemId)) return iconCache.get(itemId);
  try {
    const token = await getAccessToken();
    const response = await axios.get(
      `${getApiUrl(CONFIG.region)}/data/wow/media/item/${itemId}`,
      {
        params: { namespace: `static-${CONFIG.region}`, locale: CONFIG.locale },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000, // 3 second timeout per icon
      }
    );
    const iconAsset = response.data.assets?.find(a => a.key === 'icon');
    const url = iconAsset?.value || null;
    iconCache.set(itemId, url);
    return url;
  } catch {
    iconCache.set(itemId, null);
    return null;
  }
}

// Check if item should be excluded
function shouldExcludeItem(item) {
  // Armor (4) and Weapon (2) classes are always gear - keep them
  const itemClassId = item.item_class?.id;
  if (itemClassId === 2 || itemClassId === 4) {
    return false;
  }

  // For non-gear classes, check item subclass against excluded types
  if (item.item_subclass?.name && EXCLUDED_ITEM_TYPES.some(type =>
    item.item_subclass.name.toLowerCase().includes(type.toLowerCase())
  )) {
    return true;
  }

  // Check name patterns (only for non-gear items)
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
  log.info(`Fetching items for raid instance ${instanceId}...`);

  const instance = await getJournalInstance(instanceId);
  const items = [];
  const seenIds = new Set();

  log.info(`Found raid: ${instance.name} with ${instance.encounters?.length || 0} encounters`);

  for (const encounterRef of instance.encounters || []) {
    const encounter = await getJournalEncounter(encounterRef.id);
    log.info(`  Processing boss: ${encounter.name}`);

    for (const itemRef of encounter.items || []) {
      try {
        const item = itemRef.item;
        if (!item?.id) continue;

        // Skip duplicate items (shared loot tables across sub-bosses)
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        // Get full item details
        const itemDetails = await getItem(item.id);

        // Check if should exclude (based on item type, not name - names are language-dependent)
        if (shouldExcludeItem(itemDetails)) {
          continue;
        }

        // Get item icon
        const iconUrl = await getItemMedia(item.id);

        items.push({
          id: item.id,
          name: item.name, // Store localized name as string
          rarity: mapQuality(itemDetails.quality),
          icon: iconUrl,
          slot: mapSlot(itemDetails.inventory_type),
          slotType: itemDetails.inventory_type?.type, // Store raw slot type for consistency
          raid: instance.name,
          boss: encounter.name,
          itemLevel: itemDetails.level,
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        log.warn(`Failed to fetch item ${itemRef.item?.id}: ${error.message}`);
      }
    }
  }

  return items;
}

// Fetch items in both languages
async function fetchRaidItemsMultiLang(instanceId) {
  log.info(`Fetching items in multiple languages for instance ${instanceId}...`);

  // Fetch in English first (for consistent slot names)
  const originalLocale = CONFIG.locale;
  CONFIG.locale = 'en_US';
  const englishItems = await fetchRaidItems(instanceId);
  log.info(`  Fetched ${englishItems.length} items in English`);

  // Fetch in Spanish
  CONFIG.locale = 'es_ES';
  const spanishItems = await fetchRaidItems(instanceId);
  log.info(`  Fetched ${spanishItems.length} items in Spanish`);

  CONFIG.locale = originalLocale;

  const spanishItemsMap = new Map(spanishItems.map(item => [item.id, item]));

  // Merge translations - use English as base for consistent slot names
  const mergedItems = [];
  const processedIds = new Set();

  // First, process all English items and add Spanish translations
  for (const enItem of englishItems) {
    const esItem = spanishItemsMap.get(enItem.id);

    mergedItems.push({
      id: enItem.id,
      name: {
        en: enItem.name,
        es: esItem?.name || enItem.name, // Fallback to English if no Spanish
      },
      rarity: enItem.rarity,
      icon: enItem.icon,
      slot: enItem.slot, // Use English slot name
      slotType: enItem.slotType, // Raw slot type for paper doll matching
      raid: esItem?.raid || enItem.raid, // Spanish raid name for display
      raidEn: enItem.raid, // English raid name
      boss: esItem?.boss || enItem.boss, // Spanish boss name for display
      bossEn: enItem.boss, // English boss name
      itemLevel: enItem.itemLevel,
    });

    processedIds.add(enItem.id);
  }

  // Add any Spanish-only items (items that might have been filtered differently)
  for (const esItem of spanishItems) {
    if (!processedIds.has(esItem.id)) {
      mergedItems.push({
        id: esItem.id,
        name: {
          en: esItem.name, // No English available, use Spanish
          es: esItem.name,
        },
        rarity: esItem.rarity,
        icon: esItem.icon,
        slot: esItem.slot,
        slotType: esItem.slotType,
        raid: esItem.raid,
        raidEn: esItem.raid,
        boss: esItem.boss,
        bossEn: esItem.boss,
        itemLevel: esItem.itemLevel,
      });
    }
  }

  log.info(`  Merged ${mergedItems.length} unique items`);
  return mergedItems;
}

// Load cached data
function loadCache() {
  try {
    if (fs.existsSync(CONFIG.cacheFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.cacheFile, 'utf8'));
      if (Date.now() - data.timestamp < CONFIG.cacheDuration) {
        log.info('Using cached raid items data');
        return data.items;
      }
    }
  } catch (error) {
    log.warn('Failed to load cache: ' + error.message);
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
    log.info('Saved raid items to cache');
  } catch (error) {
    log.warn('Failed to save cache: ' + error.message);
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
    // Try stale cache before falling back to static data
    try {
      if (fs.existsSync(CONFIG.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.cacheFile, 'utf8'));
        if (data.items && data.items.length > 0) {
          log.info(`Using cached raid items (${data.items.length} items) - API not configured`);
          return data.items;
        }
      }
    } catch {}
    log.warn('Blizzard API not configured and no cache available - using static fallback');
    return null;
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
    log.error('Failed to fetch raid items from Blizzard API', error);

    // Try to use stale cache
    try {
      if (fs.existsSync(CONFIG.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.cacheFile, 'utf8'));
        log.warn('Using stale cache due to API error');
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
    log.error('Failed to get available raids', error);
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

// ============================================
// USER OAUTH (for character import)
// ============================================

const BLIZZARD_CLASS_MAP = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
  5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
  9: 'Warlock', 10: 'Monk', 11: 'Druid', 12: 'Demon Hunter',
  13: 'Evoker',
};

// Map Blizzard spec IDs to internal spec names and raid roles
const BLIZZARD_SPEC_MAP = {
  // Warrior
  71: { spec: 'Arms', role: 'DPS' },
  72: { spec: 'Fury', role: 'DPS' },
  73: { spec: 'Protection Warrior', role: 'Tank' },
  // Paladin
  65: { spec: 'Holy Paladin', role: 'Healer' },
  66: { spec: 'Protection Paladin', role: 'Tank' },
  70: { spec: 'Retribution', role: 'DPS' },
  // Hunter
  253: { spec: 'Beast Mastery', role: 'DPS' },
  254: { spec: 'Marksmanship', role: 'DPS' },
  255: { spec: 'Survival', role: 'DPS' },
  // Rogue
  259: { spec: 'Assassination', role: 'DPS' },
  260: { spec: 'Outlaw', role: 'DPS' },
  261: { spec: 'Subtlety', role: 'DPS' },
  // Priest
  256: { spec: 'Discipline', role: 'Healer' },
  257: { spec: 'Holy Priest', role: 'Healer' },
  258: { spec: 'Shadow', role: 'DPS' },
  // Death Knight
  250: { spec: 'Blood', role: 'Tank' },
  251: { spec: 'Frost DK', role: 'DPS' },
  252: { spec: 'Unholy', role: 'DPS' },
  // Shaman
  262: { spec: 'Elemental', role: 'DPS' },
  263: { spec: 'Enhancement', role: 'DPS' },
  264: { spec: 'Restoration Shaman', role: 'Healer' },
  // Mage
  62: { spec: 'Arcane', role: 'DPS' },
  63: { spec: 'Fire', role: 'DPS' },
  64: { spec: 'Frost Mage', role: 'DPS' },
  // Warlock
  265: { spec: 'Affliction', role: 'DPS' },
  266: { spec: 'Demonology', role: 'DPS' },
  267: { spec: 'Destruction', role: 'DPS' },
  // Monk
  268: { spec: 'Brewmaster', role: 'Tank' },
  269: { spec: 'Windwalker', role: 'DPS' },
  270: { spec: 'Mistweaver', role: 'Healer' },
  // Druid
  102: { spec: 'Balance', role: 'DPS' },
  103: { spec: 'Feral', role: 'DPS' },
  104: { spec: 'Guardian', role: 'Tank' },
  105: { spec: 'Restoration Druid', role: 'Healer' },
  // Demon Hunter
  577: { spec: 'Havoc', role: 'DPS' },
  581: { spec: 'Vengeance', role: 'Tank' },
  // Evoker
  1467: { spec: 'Devastation', role: 'DPS' },
  1468: { spec: 'Preservation', role: 'Healer' },
  1473: { spec: 'Augmentation', role: 'DPS' },
};

export function isBlizzardOAuthConfigured() {
  return !!(CONFIG.clientId && CONFIG.clientSecret);
}

export function getBlizzardOAuthUrl(redirectUri, state) {
  const region = CONFIG.region;
  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'wow.profile',
    state,
  });
  return `https://${region}.battle.net/oauth/authorize?${params.toString()}`;
}

export async function getUserToken(code, redirectUri) {
  const response = await axios.post(
    getOAuthUrl(CONFIG.region),
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
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
  return response.data.access_token;
}

// Fetch detailed character profile to get accurate active spec
async function getCharacterProfile(userToken, realmSlug, characterName) {
  const region = CONFIG.region;
  try {
    const response = await axios.get(
      `${getApiUrl(region)}/profile/wow/character/${realmSlug}/${characterName.toLowerCase()}`,
      {
        params: {
          namespace: `profile-${region}`,
          locale: CONFIG.locale,
        },
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    log.warn(`Failed to fetch profile for ${characterName}-${realmSlug}: ${error.message}`);
    return null;
  }
}

export async function getUserCharacters(userToken) {
  const region = CONFIG.region;
  const response = await axios.get(
    `${getApiUrl(region)}/profile/user/wow`,
    {
      params: {
        namespace: `profile-${region}`,
      },
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    }
  );

  // Blizzard API returns some fields as localized objects: {en_US: "...", es_ES: "...", ...}
  const locStr = (val) => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val[CONFIG.locale] || val.en_US || val.en_GB || Object.values(val)[0];
    return undefined;
  };

  // First pass: collect basic character info
  const basicCharacters = [];
  for (const account of response.data.wow_accounts || []) {
    for (const char of account.characters || []) {
      basicCharacters.push({
        name: locStr(char.name) || char.name,
        realm: locStr(char.realm?.name) || char.realm?.slug || 'Unknown',
        realmSlug: char.realm?.slug || '',
        className: BLIZZARD_CLASS_MAP[char.playable_class?.id] || `Class ${char.playable_class?.id}`,
        classId: char.playable_class?.id,
        level: char.level || 0,
        faction: char.faction?.type || 'Unknown',
        // Spec from summary (may be inaccurate)
        summarySpecId: char.active_spec?.id,
      });
    }
  }

  // Filter to max-level characters only (to reduce API calls)
  const maxLevel = basicCharacters.reduce((max, c) => Math.max(max, c.level), 0);
  const eligibleCharacters = basicCharacters
    .filter(c => c.name && c.level >= maxLevel && maxLevel > 0);

  // Second pass: fetch detailed profile for each eligible character to get accurate spec
  const characters = [];
  for (const char of eligibleCharacters) {
    // Fetch detailed profile for accurate spec info
    const profile = await getCharacterProfile(userToken, char.realmSlug, char.name);

    let spec = null;
    let raidRole = null;

    if (profile?.active_spec?.id) {
      // Use spec from detailed profile (more accurate)
      const specInfo = BLIZZARD_SPEC_MAP[profile.active_spec.id];
      spec = specInfo?.spec || null;
      raidRole = specInfo?.role || null;
    } else if (char.summarySpecId) {
      // Fallback to summary spec if profile fetch failed
      const specInfo = BLIZZARD_SPEC_MAP[char.summarySpecId];
      spec = specInfo?.spec || null;
      raidRole = specInfo?.role || null;
    }

    characters.push({
      name: char.name,
      realm: char.realm,
      realmSlug: char.realmSlug,
      className: char.className,
      classId: char.classId,
      spec,
      raidRole,
      level: char.level,
      faction: char.faction,
    });

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return characters.sort((a, b) => a.name.localeCompare(b.name));
}

// Get character equipment from public profile (uses app token)
export async function getCharacterEquipment(realmSlug, characterName) {
  // Check cache
  const cacheKey = `equip:${realmSlug}:${characterName.toLowerCase()}`;
  const cached = equipmentCache.get(cacheKey);
  if (cached) return cached;

  const region = CONFIG.region;
  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${getApiUrl(region)}/profile/wow/character/${realmSlug}/${characterName.toLowerCase()}/equipment`,
      {
        params: {
          namespace: `profile-${region}`,
          locale: CONFIG.locale,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Map equipment to a simpler format
    const items = (response.data.equipped_items || []).map(equipped => ({
      slot: equipped.slot?.type || 'UNKNOWN',
      slotName: equipped.slot?.name || equipped.slot?.type || 'UNKNOWN',
      itemId: equipped.item?.id,
      name: equipped.name,
      quality: equipped.quality?.type || 'COMMON',
      rarity: mapQuality(equipped.quality),
      itemLevel: equipped.level?.value,
      icon: null,
    }));

    // Fetch all icons in parallel with 8s overall timeout
    // Icons are cached in memory so subsequent loads are instant
    const iconTimeout = new Promise(resolve => setTimeout(resolve, 8000, 'timeout'));
    const iconFetch = Promise.all(items.map(async (item) => {
      if (item.itemId) {
        try {
          item.icon = await getItemMedia(item.itemId);
        } catch {
          // Icon fetch failed, leave as null
        }
      }
    }));
    await Promise.race([iconFetch, iconTimeout]);

    const result = {
      character: response.data.character?.name,
      realm: response.data.character?.realm?.name,
      averageItemLevel: response.data.equipped_item_level,
      items,
    };

    equipmentCache.set(cacheKey, result);
    return result;
  } catch (error) {
    if (error.response?.status === 404) {
      return { error: 'Character not found or profile is private' };
    }
    log.error(`Failed to fetch equipment for ${characterName}-${realmSlug}`, error);
    throw error;
  }
}

// Get character media (avatar/render)
export async function getCharacterMedia(realmSlug, characterName) {
  // Check cache
  const cacheKey = `media:${realmSlug}:${characterName.toLowerCase()}`;
  const cached = mediaCache.get(cacheKey);
  if (cached) return cached;

  const region = CONFIG.region;
  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `${getApiUrl(region)}/profile/wow/character/${realmSlug}/${characterName.toLowerCase()}/character-media`,
      {
        params: {
          namespace: `profile-${region}`,
          locale: CONFIG.locale,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const assets = response.data.assets || [];
    const result = {
      avatar: assets.find(a => a.key === 'avatar')?.value,
      inset: assets.find(a => a.key === 'inset')?.value,
      main: assets.find(a => a.key === 'main')?.value,
      mainRaw: assets.find(a => a.key === 'main-raw')?.value,
    };

    mediaCache.set(cacheKey, result);
    return result;
  } catch (error) {
    log.warn(`Failed to fetch media for ${characterName}-${realmSlug}: ${error.message}`);
    return null;
  }
}

// Current M+ season dungeons — UPDATE THESE WHEN A NEW SEASON STARTS
// journal-instance IDs used for fetching loot via journal-instance API
const CURRENT_MYTHIC_DUNGEONS = [
  { id: 15093, name: 'Ara-Kara, City of Echoes' },
  { id: 14971, name: 'The Dawnbreaker' },
  { id: 15452, name: 'Operation: Floodgate' },
  { id: 14954, name: 'Priory of the Sacred Flame' },
  { id: 16104, name: 'Cinderbrew Meadery' },
  { id: 12831, name: 'Halls of Atonement' },
  { id: 1194,  name: 'Tazavesh, the Veiled Market' },
  // Tazavesh Streets + So'leah's Gambit share journal instance 1194
];

export async function discoverMythicDungeons() {
  return CURRENT_MYTHIC_DUNGEONS;
}

export { fetchRaidItemsMultiLang };

export default {
  getCurrentRaidItems,
  getAvailableRaids,
  refreshCache,
  setCurrentRaids,
  discoverMythicDungeons,
  fetchRaidItemsMultiLang,
  isBlizzardOAuthConfigured,
  getBlizzardOAuthUrl,
  getUserToken,
  getUserCharacters,
  getCharacterEquipment,
  getCharacterMedia,
};
