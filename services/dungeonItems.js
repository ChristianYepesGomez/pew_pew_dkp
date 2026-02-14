// Dungeon Items Service
// Fetches M+ dungeon items from Blizzard API
// Mirrors raidItems.js pattern with cache chain

import { discoverMythicDungeons, fetchRaidItemsMultiLang } from './blizzardAPI.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:DungeonItems');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, '../data/dungeon-items-cache.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

let cachedItems = null;
let lastCheck = 0;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between API checks

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (data.timestamp && Date.now() - data.timestamp < CACHE_DURATION && data.items?.length > 0) {
        return data.items;
      }
    }
  } catch {}
  return null;
}

function saveCache(items) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), items }, null, 2));
  } catch (err) {
    console.warn('Failed to save dungeon items cache:', err.message);
  }
}

export async function getAllDungeonItems() {
  // Check cache first
  if (cachedItems && Date.now() - lastCheck < CHECK_INTERVAL) {
    return cachedItems;
  }

  // Try file cache
  const fileCached = loadCache();
  if (fileCached) {
    cachedItems = fileCached;
    lastCheck = Date.now();
    return fileCached;
  }

  // Discover dungeons and fetch items
  try {
    const dungeons = await discoverMythicDungeons();
    if (dungeons.length === 0) return [];

    const allItems = [];
    for (const dungeon of dungeons) {
      try {
        const items = await fetchRaidItemsMultiLang(dungeon.id);
        // Tag each item with sourceType
        const tagged = items.map(item => ({
          ...item,
          sourceType: 'mythicplus',
          dungeon: dungeon.name,
        }));
        allItems.push(...tagged);
      } catch (err) {
        console.warn(`Failed to fetch items for dungeon ${dungeon.name} (${dungeon.id}):`, err.message);
      }
    }

    if (allItems.length > 0) {
      saveCache(allItems);
      cachedItems = allItems;
      lastCheck = Date.now();
      log.info(`Loaded ${allItems.length} M+ dungeon items from ${dungeons.length} dungeons`);
    }

    return allItems;
  } catch (error) {
    console.warn('Failed to fetch dungeon items:', error.message);

    // Try stale cache
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (data.items?.length > 0) {
          cachedItems = data.items;
          return data.items;
        }
      }
    } catch {}

    return [];
  }
}

export default { getAllDungeonItems };
