import axios from 'axios';

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

    console.log('✅ Warcraft Logs access token obtained');
    return cachedToken;

  } catch (error) {
    console.error('❌ Failed to get Warcraft Logs access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Warcraft Logs API');
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
      console.error('GraphQL Errors:', response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data;

  } catch (error) {
    console.error('❌ GraphQL query failed:', error.response?.data || error.message);
    throw new Error(`Warcraft Logs API error: ${error.message}`);
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
    duration: fight.endTime - fight.startTime
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
    console.log(`📊 Processing Warcraft Logs report: ${reportCode}`);

    // Fetch report data from API
    const reportData = await getReportData(reportCode);

    // Parse and return structured data
    const parsedData = parseReportData(reportData);
    console.log(`✅ Report processed: ${parsedData.participantCount} participants, ${parsedData.bossesKilled}/${parsedData.totalBosses} bosses killed (${parsedData.totalAttempts} total attempts)`);

    return parsedData;

  } catch (error) {
    console.error('❌ Error processing Warcraft Log:', error.message);
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
    console.error('Error fetching deaths table:', error.message);
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
    console.error('Error fetching damage table:', error.message);
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
    console.error('Error fetching healing table:', error.message);
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
    console.error('Error fetching damage taken table:', error.message);
    return [];
  }
}

/**
 * Get comprehensive fight statistics (all data in one query for efficiency)
 */
export async function getFightStats(reportCode, fightIds) {
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

    return {
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
  } catch (error) {
    console.error('Error fetching fight stats:', error.message);
    return { damage: [], healing: [], damageTaken: [], deaths: [] };
  }
}

/**
 * Test if Warcraft Logs credentials are configured
 */
export function isConfigured() {
  return !!(process.env.WCL_CLIENT_ID && process.env.WCL_CLIENT_SECRET);
}

export { extractReportCode, getAccessToken };
