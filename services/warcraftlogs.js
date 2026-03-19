import axios from 'axios';
import { createLogger } from '../lib/logger.js';
import { createCache } from '../lib/cache.js';

const log = createLogger('Service:WarcraftLogs');

// TTL cache for WCL API responses (10 minutes)
const wclCache = createCache(10 * 60 * 1000);

// Cache for report actors (avoids redundant GraphQL queries for actor name resolution)
const actorsCache = createCache(10 * 60 * 1000);

// Warcraft Logs API Configuration
const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';

let cachedToken = null;
let tokenExpiry = null;

/**
 * Get OAuth access token from Warcraft Logs
 */
async function getAccessToken() {
  const clientId = process.env.WCL_CLIENT_ID;
  const clientSecret = process.env.WCL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Warcraft Logs credentials not configured. Set WARCRAFTLOGS_CLIENT_ID and WARCRAFTLOGS_CLIENT_SECRET in .env');
  }

  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      WCL_TOKEN_URL,
      'grant_type=client_credentials',
      {
        auth: {
          username: clientId,
          password: clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);

    log.info('Warcraft Logs access token obtained');
    return cachedToken;

  } catch (error) {
    log.error('Failed to get Warcraft Logs access token', error);
    throw new Error('Failed to authenticate with Warcraft Logs API', { cause: error });
  }
}

/**
 * Extract report code from Warcraft Logs URL
 * Examples:
 *   https://www.warcraftlogs.com/reports/J1p4M8gd3b72RLGC
 *   https://classic.warcraftlogs.com/reports/J1p4M8gd3b72RLGC
 *   J1p4M8gd3b72RLGC
 */
function extractReportCode(urlOrCode) {
  // If it's just the code (no URL)
  if (!/^https?:\/\//.test(urlOrCode)) {
    return urlOrCode.trim();
  }

  // Extract from URL
  const match = urlOrCode.match(/\/reports\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error('Invalid Warcraft Logs URL format');
  }

  return match[1];
}

/**
 * Execute GraphQL query against Warcraft Logs API
 */
async function executeGraphQL(query, variables = {}) {
  const token = await getAccessToken();

  try {
    const response = await axios.post(
      WCL_API_URL,
      {
        query,
        variables
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.errors) {
      log.error('GraphQL Errors', response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data;

  } catch (error) {
    log.error('GraphQL query failed', error);
    throw new Error(`Warcraft Logs API error: ${error.message}`, { cause: error });
  }
}

/**
 * Get report data including participants from Warcraft Logs
 */
async function getReportData(reportCode) {
  const query = `
    query GetReportData($reportCode: String!) {
      reportData {
        report(code: $reportCode) {
          code
          title
          startTime
          endTime
          region {
            id
            name
            compactName
          }
          guild {
            id
            name
          }
          fights(killType: Encounters) {
            id
            encounterID
            name
            kill
            difficulty
            startTime
            endTime
            fightPercentage
          }
          masterData(translate: true) {
            actors(type: "Player") {
              id
              name
              server
              type
              subType
            }
          }
        }
      }
    }
  `;

  const data = await executeGraphQL(query, { reportCode });

  if (!data.reportData || !data.reportData.report) {
    throw new Error('Report not found');
  }

  return data.reportData.report;
}

/**
 * Parse report data and extract useful information
 */
function parseReportData(report) {
  const participants = report.masterData.actors.map(actor => ({
    name: actor.name,
    server: actor.server || 'Unknown',
    class: actor.subType,
    fullName: actor.server ? `${actor.name}-${actor.server}` : actor.name
  }));

  const fights = report.fights.map(fight => ({
    id: fight.id,
    encounterID: fight.encounterID,
    name: fight.name,
    kill: fight.kill,
    difficulty: fight.difficulty,
    startTime: fight.startTime,
    endTime: fight.endTime,
    duration: fight.endTime - fight.startTime,
    fightPercentage: fight.fightPercentage ?? null,
  }));

  // Group fights by encounterID to get unique bosses
  const uniqueBosses = {};
  fights.forEach(fight => {
    if (!uniqueBosses[fight.encounterID]) {
      uniqueBosses[fight.encounterID] = {
        encounterID: fight.encounterID,
        name: fight.name,
        killed: false,
        attempts: 0
      };
    }
    uniqueBosses[fight.encounterID].attempts++;
    if (fight.kill) {
      uniqueBosses[fight.encounterID].killed = true;
    }
  });

  const bossArray = Object.values(uniqueBosses);
  const bossesKilled = bossArray.filter(b => b.killed).length;
  const totalBosses = bossArray.length;
  const totalAttempts = fights.length;

  return {
    code: report.code,
    title: report.title,
    startTime: report.startTime,
    endTime: report.endTime,
    duration: report.endTime - report.startTime,
    region: report.region?.name || 'Unknown',
    guildName: report.guild?.name || null,
    participants,
    participantCount: participants.length,
    fights,
    bosses: bossArray,
    bossesKilled,
    totalBosses,
    totalAttempts
  };
}

/**
 * Main function: Process a Warcraft Logs URL and return parsed data
 */
export async function processWarcraftLog(urlOrCode) {
  try {
    // Extract report code
    const reportCode = extractReportCode(urlOrCode);

    // Check cache
    const cacheKey = `report:${reportCode}`;
    const cached = wclCache.get(cacheKey);
    if (cached) return cached;

    log.info(`Processing Warcraft Logs report: ${reportCode}`);

    // Fetch report data from API
    const reportData = await getReportData(reportCode);

    // Cache actors for reuse by getFightStatsWithDeathEvents (avoids redundant GraphQL query)
    const actors = reportData.masterData?.actors || [];
    const actorMap = {};
    for (const actor of actors) actorMap[actor.id] = actor.name;
    actorsCache.set(`actors:${reportCode}`, actorMap);

    // Parse and return structured data
    const parsedData = parseReportData(reportData);
    log.info(`Report processed: ${parsedData.participantCount} participants, ${parsedData.bossesKilled}/${parsedData.totalBosses} bosses killed (${parsedData.totalAttempts} total attempts)`);

    wclCache.set(cacheKey, parsedData);
    return parsedData;

  } catch (error) {
    log.error('Error processing Warcraft Log', error);
    throw error;
  }
}

/**
 * Get guild reports from WCL within a time window
 * Used to auto-detect logs for a specific raid date
 */
export async function getGuildReports(guildId, startTime, endTime) {
  const query = `
    query GetGuildReports($guildID: Int!, $startTime: Float!, $endTime: Float!) {
      reportData {
        reports(guildID: $guildID, startTime: $startTime, endTime: $endTime) {
          data {
            code
            title
            startTime
            endTime
            zone {
              id
              name
            }
            owner {
              name
            }
          }
        }
      }
    }
  `;

  const data = await executeGraphQL(query, {
    guildID: guildId,
    startTime,
    endTime,
  });

  if (!data.reportData?.reports?.data) {
    return [];
  }

  return data.reportData.reports.data.map(r => ({
    code: r.code,
    title: r.title,
    startTime: r.startTime,
    endTime: r.endTime,
    zone: r.zone?.name || 'Unknown',
    owner: r.owner?.name || 'Unknown',
  }));
}

/**
 * Resolve guild name/server to WCL numeric guild ID
 */
export async function getGuildId(guildName, serverSlug, serverRegion) {
  const query = `
    query GetGuildID($name: String!, $serverSlug: String!, $serverRegion: String!) {
      guildData {
        guild(name: $name, serverSlug: $serverSlug, serverRegion: $serverRegion) {
          id
          name
        }
      }
    }
  `;

  const data = await executeGraphQL(query, {
    name: guildName,
    serverSlug,
    serverRegion,
  });

  if (!data.guildData?.guild) {
    throw new Error(`Guild not found: ${guildName} on ${serverSlug}-${serverRegion}`);
  }

  return data.guildData.guild.id;
}

/**
 * Get death counts per player for specific fights
 * Uses the table API which gives us aggregated death data
 */
export async function getFightDeaths(reportCode, fightIds) {
  const query = `
    query GetDeathsTable($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          table(dataType: Deaths, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, {
      reportCode,
      fightIDs: fightIds,
    });

    const table = data.reportData?.report?.table?.data;
    if (!table?.entries) {
      return [];
    }

    // Table entries have: id, name, total (deaths)
    return table.entries.map(entry => ({
      name: entry.name,
      deaths: entry.total || 0,
    }));
  } catch (error) {
    log.error('Error fetching deaths table', error);
    return [];
  }
}

/**
 * Get damage done per player for specific fights
 * Returns the top performers by total damage
 */
export async function getFightDamage(reportCode, fightIds) {
  const query = `
    query GetDamageTable($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          table(dataType: DamageDone, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, {
      reportCode,
      fightIDs: fightIds,
    });

    const table = data.reportData?.report?.table?.data;
    if (!table?.entries) {
      return [];
    }

    return table.entries.map(entry => ({
      name: entry.name,
      damage: entry.total || 0,
      dps: entry.totalReduced ? Math.round(entry.totalReduced) : 0,
    }));
  } catch (error) {
    log.error('Error fetching damage table', error);
    return [];
  }
}

/**
 * Get healing done per player for specific fights
 */
export async function getFightHealing(reportCode, fightIds) {
  const query = `
    query GetHealingTable($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          table(dataType: Healing, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, {
      reportCode,
      fightIDs: fightIds,
    });

    const table = data.reportData?.report?.table?.data;
    if (!table?.entries) {
      return [];
    }

    return table.entries.map(entry => ({
      name: entry.name,
      healing: entry.total || 0,
      hps: entry.totalReduced ? Math.round(entry.totalReduced) : 0,
    }));
  } catch (error) {
    log.error('Error fetching healing table', error);
    return [];
  }
}

/**
 * Get damage taken per player for specific fights
 */
export async function getFightDamageTaken(reportCode, fightIds) {
  const query = `
    query GetDamageTakenTable($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          table(dataType: DamageTaken, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, {
      reportCode,
      fightIDs: fightIds,
    });

    const table = data.reportData?.report?.table?.data;
    if (!table?.entries) {
      return [];
    }

    return table.entries.map(entry => ({
      name: entry.name,
      damageTaken: entry.total || 0,
    }));
  } catch (error) {
    log.error('Error fetching damage taken table', error);
    return [];
  }
}

/**
 * Get comprehensive fight statistics (all data in one query for efficiency)
 */
export async function getFightStats(reportCode, fightIds) {
  // Check cache
  const cacheKey = `fightStats:${reportCode}:${[...fightIds].sort().join(',')}`;
  const cached = wclCache.get(cacheKey);
  if (cached) return cached;

  const query = `
    query GetFightStats($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          damage: table(dataType: DamageDone, fightIDs: $fightIDs, hostilityType: Friendlies)
          healing: table(dataType: Healing, fightIDs: $fightIDs, hostilityType: Friendlies)
          damageTaken: table(dataType: DamageTaken, fightIDs: $fightIDs, hostilityType: Friendlies)
          deaths: table(dataType: Deaths, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, {
      reportCode,
      fightIDs: fightIds,
    });

    const report = data.reportData?.report;
    if (!report) {
      return { damage: [], healing: [], damageTaken: [], deaths: [] };
    }

    const parseTable = (table) => {
      if (!table?.data?.entries) return [];
      return table.data.entries;
    };

    const result = {
      damage: parseTable(report.damage).map(e => ({
        name: e.name,
        total: e.total || 0,
      })),
      healing: parseTable(report.healing).map(e => ({
        name: e.name,
        total: e.total || 0,
      })),
      damageTaken: parseTable(report.damageTaken).map(e => ({
        name: e.name,
        total: e.total || 0,
      })),
      deaths: parseTable(report.deaths).map(e => ({
        name: e.name,
        total: e.total || 0,
      })),
    };

    wclCache.set(cacheKey, result);
    return result;
  } catch (error) {
    log.error('Error fetching fight stats', error);
    return { damage: [], healing: [], damageTaken: [], deaths: [] };
  }
}

/**
 * Get individual death events with timestamps for filtering wipe deaths
 * Returns: [{ name, timestamp, fightId }, ...]
 * timestamp is in milliseconds relative to fight start
 */
export async function getDeathEventsWithTimestamps(reportCode, fightId, startTime, endTime) {
  const query = `
    query GetDeathEvents($reportCode: String!, $startTime: Float!, $endTime: Float!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          events(startTime: $startTime, endTime: $endTime, fightIDs: $fightIDs, dataType: Deaths, hostilityType: Friendlies) {
            data
          }
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, {
      reportCode,
      startTime,
      endTime,
      fightIDs: [fightId],
    });

    const events = data.reportData?.report?.events?.data || [];

    // Each death event has: timestamp, targetID, targetInstance, etc.
    // We need to map targetID to player names, which requires the actors table
    return events.map(event => ({
      timestamp: event.timestamp,
      targetID: event.targetID,
      sourceID: event.sourceID,
      killerID: event.killerID,
    }));
  } catch (error) {
    log.error('Error fetching death events', error);
    return [];
  }
}

/**
 * Get comprehensive fight stats including death events for wipe filtering
 * fightInfo should include: { id, startTime, endTime, kill }
 */
export async function getFightStatsWithDeathEvents(reportCode, fightInfo) {
  const { id: fightId, startTime, endTime, kill } = fightInfo;

  // Check cache
  const cacheKey = `deathStats:${reportCode}:${fightId}`;
  const cached = wclCache.get(cacheKey);
  if (cached) return cached;

  const fightDuration = endTime - startTime;

  // Get basic stats (damage, healing, etc.)
  const basicStats = await getFightStats(reportCode, [fightId]);

  // If it's a kill, no need to filter deaths - all deaths count
  if (kill) {
    const result = {
      ...basicStats,
      fightDuration,
      isKill: true,
    };
    wclCache.set(cacheKey, result);
    return result;
  }

  // For wipes: deaths are NOT counted (only kill deaths matter for the Hall of Shame).
  // Wipe deaths are everyone dying — not useful for tracking individual mistakes.
  const result = {
    ...basicStats,
    deaths: [],
    fightDuration,
    isKill: false,
    wipeDeathsFiltered: 0,
  };

  wclCache.set(cacheKey, result);
  return result;
}

/**
 * Get extended fight stats: casts, buffs, interrupts, dispels
 * Used for deep performance analysis (consumables, utility)
 */
export async function getExtendedFightStats(reportCode, fightIds) {
  // Check cache
  const cacheKey = `extStats:${reportCode}:${[...fightIds].sort().join(',')}`;
  const cached = wclCache.get(cacheKey);
  if (cached) return cached;

  const query = `
    query GetExtendedFightStats($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          casts: table(dataType: Casts, fightIDs: $fightIDs, hostilityType: Friendlies)
          healing: table(dataType: Healing, fightIDs: $fightIDs, hostilityType: Friendlies)
          buffs: table(dataType: Buffs, fightIDs: $fightIDs, hostilityType: Friendlies)
          interrupts: table(dataType: Interrupts, fightIDs: $fightIDs, hostilityType: Friendlies)
          dispels: table(dataType: Dispels, fightIDs: $fightIDs, hostilityType: Friendlies)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode, fightIDs: fightIds });
    const report = data.reportData?.report;
    if (!report) {
      return { casts: [], buffs: [], interrupts: [], dispels: [] };
    }

    const parseTable = (table) => {
      if (!table?.data?.entries) return [];
      return table.data.entries;
    };

    const result = {
      casts: parseTable(report.casts),
      healing: parseTable(report.healing),
      buffs: parseTable(report.buffs),
      interrupts: parseTable(report.interrupts),
      dispels: parseTable(report.dispels),
    };

    wclCache.set(cacheKey, result);
    return result;
  } catch (error) {
    log.error('Error fetching extended fight stats', error);
    return { casts: [], healing: [], buffs: [], interrupts: [], dispels: [] };
  }
}

// ── Consumable spell IDs ──
// WCL's table(dataType: Casts) only returns top 5 abilities per player,
// so potions (1-2 casts) never appear. Use events API with spell ID filters instead.
const COMBAT_POTION_IDS = [
  1236994, // Potion of Recklessness
  1236616, // Light's Potential
  431932,  // Tempered Potion
  431914,  // Potion of Unwavering Focus
  431416,  // Frontline Potion
  431419,  // Elemental Potion of Ultimate Power
];
const MANA_POTION_IDS = [
  1248831, // Potion of Devoured Dreams (Wowhead spell ID)
  431418,  // Potion of Devoured Dreams (alt ID)
  1244385, // Potion of Devoured Dreams (alt ID)
  431421,  // Lightfused Mana Potion (alt ID)
  1236648, // Lightfused Mana Potion (confirmed from WCL logs)
];

/**
 * Fetch combat/mana potion usage per player using WCL events API.
 * Returns { combatPotions: { playerName: count }, manaPotions: { playerName: count } }
 */
export async function getConsumableCasts(reportCode, fightIds) {
  const cacheKey = `consumCasts:${reportCode}:${[...fightIds].sort().join(',')}`;
  const cached = wclCache.get(cacheKey);
  if (cached) return cached;

  const allIds = [...COMBAT_POTION_IDS, ...MANA_POTION_IDS];
  const filterExpr = allIds.map(id => `ability.id = ${id}`).join(' OR ');

  const query = `
    query GetConsumableCasts($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          masterData { actors(type: "Player") { id name } }
          events(dataType: Casts, fightIDs: $fightIDs, hostilityType: Friendlies,
                 limit: 500, filterExpression: "${filterExpr}") {
            data
          }
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode, fightIDs: fightIds });
    const report = data.reportData?.report;
    if (!report) return { combatPotions: {}, manaPotions: {} };

    // Build actor map
    const actorMap = {};
    for (const a of report.masterData?.actors || []) {
      actorMap[a.id] = a.name;
    }

    const combatPotions = {};
    const manaPotions = {};
    const combatSet = new Set(COMBAT_POTION_IDS);

    for (const event of report.events?.data || []) {
      const playerName = actorMap[event.sourceID];
      if (!playerName) continue;

      const spellId = event.abilityGameID;
      if (combatSet.has(spellId)) {
        combatPotions[playerName] = (combatPotions[playerName] || 0) + 1;
      } else {
        manaPotions[playerName] = (manaPotions[playerName] || 0) + 1;
      }
    }

    const result = { combatPotions, manaPotions };
    wclCache.set(cacheKey, result);
    return result;
  } catch (error) {
    log.error('Error fetching consumable casts', error);
    return { combatPotions: {}, manaPotions: {} };
  }
}

/**
 * Get WCL global percentile rankings for each player in a fight.
 * Uses the `rankings` field (not `table`) which includes rankPercent per spec/boss globally.
 * Returns { dps: { playerNameLower: rankPercent }, hps: { playerNameLower: rankPercent } }
 */
export async function getFightRankings(reportCode, fightIds) {
  const cacheKey = `rankings:${reportCode}:${[...fightIds].sort().join(',')}`;
  const cached = wclCache.get(cacheKey);
  if (cached) return cached;

  const query = `
    query GetFightRankings($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          dpsRankings: rankings(fightIDs: $fightIDs, playerMetric: dps)
          hpsRankings: rankings(fightIDs: $fightIDs, playerMetric: hps)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode, fightIDs: fightIds });
    const report = data.reportData?.report;
    if (!report) return { dps: {}, hps: {} };

    // WCL rankings structure: { data: [{ roles: { dps: { characters: [{ name, rankPercent }] } } }] }
    // data is an ARRAY (one entry per fight), roles contain tanks/healers/dps
    const parseRankings = (rankJson) => {
      const map = {};
      try {
        const parsed = typeof rankJson === 'string' ? JSON.parse(rankJson) : rankJson;
        const fights = parsed?.data || [];
        for (const fight of Array.isArray(fights) ? fights : [fights]) {
          const roles = fight?.roles || {};
          for (const role of Object.values(roles)) {
            for (const char of role?.characters || []) {
              if (char.name && char.rankPercent != null) {
                map[char.name.toLowerCase()] = char.rankPercent;
              }
            }
          }
        }
      } catch (_e) { /* malformed JSON from WCL — skip silently */ }
      return map;
    };

    const result = {
      dps: parseRankings(report.dpsRankings),
      hps: parseRankings(report.hpsRankings),
    };
    wclCache.set(cacheKey, result);
    return result;
  } catch (err) {
    log.warn('getFightRankings failed, proceeding without percentile data', { reportCode, err: err.message });
    return { dps: {}, hps: {} };
  }
}

/**
 * Get reports uploaded by a specific user
 * Used for auto-detecting new logs from a designated uploader
 */
export async function getUserReports(userId, limit = 10) {
  const query = `
    query GetUserReports($userID: Int!, $limit: Int!) {
      userData {
        user(id: $userID) {
          id
          name
          guilds {
            id
            name
          }
        }
      }
      reportData {
        reports(userID: $userID, limit: $limit) {
          data {
            code
            title
            startTime
            endTime
            zone {
              id
              name
            }
            guild {
              id
              name
            }
          }
        }
      }
    }
  `;

  const data = await executeGraphQL(query, {
    userID: userId,
    limit,
  });

  const userName = data.userData?.user?.name || 'Unknown';

  if (!data.reportData?.reports?.data) {
    return { userName, reports: [] };
  }

  return {
    userName,
    reports: data.reportData.reports.data.map(r => ({
      code: r.code,
      title: r.title,
      startTime: r.startTime,
      endTime: r.endTime,
      zone: r.zone?.name || 'Unknown',
      guildName: r.guild?.name || null,
    })),
  };
}

/**
 * Test if Warcraft Logs credentials are configured
 */
/**
 * Get combatant info (equipped gear, class, spec) for players in fights
 * Uses Summary table which includes gear data per player
 */
export async function getFightCombatantInfo(reportCode, fightIds) {
  const query = `
    query GetCombatantInfo($reportCode: String!, $fightIDs: [Int!]) {
      reportData {
        report(code: $reportCode) {
          playerDetails(fightIDs: $fightIDs)
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { reportCode, fightIDs: fightIds });
    const details = data.reportData?.report?.playerDetails?.data?.playerDetails;
    if (!details) return [];

    // playerDetails groups by role: tanks, healers, dps
    const allPlayers = [];
    for (const role of ['tanks', 'healers', 'dps']) {
      const players = details[role] || [];
      for (const p of players) {
        const gear = (p.combatantInfo?.gear || []).map(g => ({
          id: g.id,
          name: g.name,
          quality: g.quality,
          icon: g.icon,
          itemLevel: g.itemLevel,
        })).filter(g => g.id > 0);

        if (gear.length > 0) {
          allPlayers.push({
            name: p.name,
            type: p.type,   // class name e.g. "Mage"
            specs: p.specs,  // array of spec objects
            gear,
          });
        }
      }
    }

    return allPlayers;
  } catch (error) {
    log.warn('Error fetching combatant info: ' + error.message);
    return [];
  }
}

export function isConfigured() {
  return !!(process.env.WCL_CLIENT_ID && process.env.WCL_CLIENT_SECRET);
}

export { extractReportCode, getAccessToken };
