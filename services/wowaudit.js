import { google } from 'googleapis';
import { createLogger } from '../lib/logger.js';
import {
  WOWAUDIT_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
} from '../lib/config.js';

const log = createLogger('Service:WoWAudit');

// ── WoWAudit Great Vault sheet layout ──
// Row 1: Category headers  → "", "Refreshed:", "", "Great Vault Score", "", "Raid", "", "", "Dungeon", "", "", "World (included)", "", ""
// Row 2: Sub-headers       → "", "<timestamp>", "", "", "", "Slot 1", "Slot 2", "Slot 3", "", "Slot 2", "Slot 3", "", "", ""
// Row 3+: Character data   → "<name>", "", "", <rank>, <score>, <raid1>, <raid2>, <raid3>, <dng1>, <dng2>, <dng3>, <world1>, <world2>, <world3>
//
// Values are ilvl numbers (e.g. 259) or empty ("") when not filled.
// Fixed column indices (0-based):
const COL = {
  NAME: 0,
  VAULT_SCORE_RANK: 3,
  VAULT_SCORE_VALUE: 4,
  RAID_1: 5,
  RAID_2: 6,
  RAID_3: 7,
  DUNGEON_1: 8,
  DUNGEON_2: 9,
  DUNGEON_3: 10,
  WORLD_1: 11,
  WORLD_2: 12,
  WORLD_3: 13,
};

const HEADER_ROWS = 2; // Skip 2 header rows before data

const SLOT_CATEGORIES = ['raid', 'raid', 'raid', 'dungeon', 'dungeon', 'dungeon', 'world', 'world', 'world'];
const VAULT_COL_INDICES = [COL.RAID_1, COL.RAID_2, COL.RAID_3, COL.DUNGEON_1, COL.DUNGEON_2, COL.DUNGEON_3, COL.WORLD_1, COL.WORLD_2, COL.WORLD_3];

/**
 * Parse a single vault slot value from the sheet.
 * Values are ilvl numbers or empty.
 */
export function parseVaultSlot(raw) {
  if (raw === null || raw === undefined || raw === '' || raw === '-' || raw === '0' || raw === 0) {
    return { ilvl: null, filled: false };
  }

  const num = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
  if (!isNaN(num) && num > 0) {
    return { ilvl: num, filled: true };
  }

  // Any other truthy value → filled but unknown ilvl
  return { ilvl: null, filled: true };
}

/**
 * Parse a character row's 9 vault columns into a structured vault object.
 */
export function parseCharacterVault(slotValues) {
  const slots = slotValues.map((val, i) => ({
    ...parseVaultSlot(val),
    category: SLOT_CATEGORIES[i] || 'unknown',
    index: i + 1,
  }));

  return {
    slots,
    filledCount: slots.filter(s => s.filled).length,
    raidSlots: slots.filter(s => s.category === 'raid'),
    dungeonSlots: slots.filter(s => s.category === 'dungeon'),
    worldSlots: slots.filter(s => s.category === 'world'),
  };
}

// ── Google Sheets client ──

let sheetsClient = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    return null;
  }

  const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Fetch all data from a specific sheet tab.
 */
export async function fetchSheetTab(tabName) {
  const sheets = getSheetsClient();
  if (!sheets) {
    throw new Error('Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.');
  }

  if (!WOWAUDIT_SHEET_ID) {
    throw new Error('WOWAUDIT_SHEET_ID not configured.');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: WOWAUDIT_SHEET_ID,
    range: tabName,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  return response.data.values || [];
}

/**
 * List all sheet tab names.
 */
export async function listSheetTabs() {
  const sheets = getSheetsClient();
  if (!sheets) {
    throw new Error('Google Sheets not configured.');
  }

  const response = await sheets.spreadsheets.get({
    spreadsheetId: WOWAUDIT_SHEET_ID,
    fields: 'sheets.properties.title',
  });

  return response.data.sheets.map(s => s.properties.title);
}

/**
 * Fetch and parse vault data from WoWAudit sheet.
 *
 * Returns: Map<characterNameLower, VaultData>
 *
 * @param {string} [vaultTabName] - Tab name to read. Auto-detected if not provided.
 */
export async function fetchVaultData(vaultTabName) {
  if (!vaultTabName) {
    const tabs = await listSheetTabs();
    const vaultTab = tabs.find(t => /vault|great.?vault/i.test(t));
    if (!vaultTab) {
      throw new Error(`No vault tab found. Available tabs: ${tabs.join(', ')}`);
    }
    vaultTabName = vaultTab;
    log.info(`Auto-detected vault tab: "${vaultTabName}"`);
  }

  const rows = await fetchSheetTab(vaultTabName);
  if (rows.length <= HEADER_ROWS) {
    log.warn('Vault tab has no data rows');
    return new Map();
  }

  // Parse each character row (skip header rows)
  const vaultMap = new Map();
  for (let i = HEADER_ROWS; i < rows.length; i++) {
    const row = rows[i];
    const charName = row[COL.NAME];
    if (!charName || String(charName).trim() === '') continue;

    const slotValues = VAULT_COL_INDICES.map(idx => row[idx] ?? null);
    const vault = parseCharacterVault(slotValues);
    const scoreRank = row[COL.VAULT_SCORE_RANK] ?? null;
    const scoreValue = row[COL.VAULT_SCORE_VALUE] ?? null;

    vaultMap.set(String(charName).trim().toLowerCase(), {
      characterName: String(charName).trim(),
      scoreRank: typeof scoreRank === 'number' ? scoreRank : null,
      scoreValue: typeof scoreValue === 'number' ? scoreValue : null,
      ...vault,
    });
  }

  log.info(`Parsed vault data for ${vaultMap.size} characters`);
  return vaultMap;
}

/**
 * Check if WoWAudit integration is configured and ready.
 */
export function isWoWAuditConfigured() {
  return !!(WOWAUDIT_SHEET_ID && GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY);
}