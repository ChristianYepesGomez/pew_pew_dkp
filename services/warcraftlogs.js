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
  const clientId = process.env.WARCRAFTLOGS_CLIENT_ID;
  const clientSecret = process.env.WARCRAFTLOGS_CLIENT_SECRET;

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
 * Test if Warcraft Logs credentials are configured
 */
export function isConfigured() {
  return !!(process.env.WARCRAFTLOGS_CLIENT_ID && process.env.WARCRAFTLOGS_CLIENT_SECRET);
}

export { extractReportCode, getAccessToken };
