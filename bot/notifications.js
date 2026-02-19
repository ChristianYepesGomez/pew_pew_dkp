import { db } from '../database.js';
import { buildAuctionEndedEmbed, buildBidEmbed } from './embeds/auction.js';
import { createLogger } from '../lib/logger.js';
import { EmbedBuilder } from 'discord.js';

const log = createLogger('Bot:Notifications');

/**
 * Get a configured channel ID for a specific purpose from bot_config.
 * Config keys: 'channel_auctions', 'channel_raids', 'channel_dkp_log'
 */
async function getChannelId(guildId, configKey) {
  const row = await db.get(
    'SELECT config_value FROM bot_config WHERE guild_id = ? AND config_key = ?',
    guildId, configKey
  );
  return row?.config_value || null;
}

/**
 * Send a message to a configured channel.
 */
async function sendToChannel(client, guildId, configKey, content) {
  const channelId = await getChannelId(guildId, configKey);
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.send(content);
    }
  } catch (error) {
    log.error(`Failed to send to channel ${configKey}`, error);
  }
}

/**
 * Send a DM to a user by their DKP user ID (resolves discord_id from DB).
 */
async function sendDM(client, dkpUserId, content) {
  const user = await db.get('SELECT discord_id FROM users WHERE id = ?', dkpUserId);
  if (!user?.discord_id) return;

  try {
    const discordUser = await client.users.fetch(user.discord_id);
    if (discordUser) {
      await discordUser.send(content);
    }
  } catch (error) {
    // DMs might be disabled — log but don't crash
    log.debug(`Failed to DM user ${dkpUserId}`, error);
  }
}

// ── Raid Reminders ──────────────────────────────────────────────

const REMINDER_INTERVALS_MS = [
  2 * 60 * 60 * 1000,  // 2 hours before
  1 * 60 * 60 * 1000,  // 1 hour before
  30 * 60 * 1000,       // 30 minutes before
];

const sentReminders = new Set(); // "date:intervalMs" keys to avoid duplicates
let reminderInterval = null;

/**
 * Start the raid reminder check loop. Runs every 5 minutes.
 */
function startRaidReminders(client, guildId) {
  if (reminderInterval) return;

  reminderInterval = setInterval(() => {
    checkRaidReminders(client, guildId).catch(err => {
      log.error('Raid reminder check failed', err);
    });
  }, 5 * 60 * 1000); // Check every 5 minutes

  // Run once immediately
  checkRaidReminders(client, guildId).catch(err => {
    log.error('Initial raid reminder check failed', err);
  });

  log.info('Raid reminder loop started (every 5min)');
}

async function checkRaidReminders(client, guildId) {
  const raidDays = await db.all(
    'SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1'
  );
  if (raidDays.length === 0) return;

  // Get current time in Spain
  const nowInSpain = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const spainFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const todayStr = spainFormatter.format(new Date());

  // Check today and tomorrow
  for (let offset = 0; offset <= 1; offset++) {
    const checkDate = new Date(nowInSpain);
    checkDate.setDate(checkDate.getDate() + offset);
    const jsDay = checkDate.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;

    const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
    if (!raidDay) continue;

    const [raidH, raidM] = (raidDay.raid_time || '21:00').split(':').map(Number);
    const raidStart = new Date(checkDate);
    raidStart.setHours(raidH, raidM, 0, 0);

    const timeUntilRaid = raidStart.getTime() - nowInSpain.getTime();

    // Check each reminder interval
    for (const intervalMs of REMINDER_INTERVALS_MS) {
      const key = `${todayStr}:${raidDay.day_of_week}:${offset}:${intervalMs}`;

      // Send if we're within the window (0 to 5 min past the reminder time)
      const diff = timeUntilRaid - intervalMs;
      if (diff >= -5 * 60 * 1000 && diff <= 0 && !sentReminders.has(key)) {
        sentReminders.add(key);

        const y = checkDate.getFullYear();
        const m = String(checkDate.getMonth() + 1).padStart(2, '0');
        const d = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        await sendRaidReminder(client, guildId, dateStr, raidDay, intervalMs);
      }
    }
  }

  // Cleanup old reminder keys (keep set from growing forever)
  if (sentReminders.size > 100) {
    sentReminders.clear();
  }
}

async function sendRaidReminder(client, guildId, dateStr, raidDay, intervalMs) {
  const label = intervalMs >= 60 * 60 * 1000
    ? `${Math.round(intervalMs / (60 * 60 * 1000))}h`
    : `${Math.round(intervalMs / (60 * 1000))}min`;

  // Get signup summary
  const users = await db.all(
    'SELECT id, character_name FROM users WHERE is_active = 1'
  );
  const signups = await db.all(
    'SELECT user_id, status FROM member_availability WHERE raid_date = ?',
    dateStr
  );

  const confirmed = signups.filter(s => s.status === 'confirmed');
  const noResponse = users.filter(u => !signups.find(s => s.user_id === u.id));

  const embed = new EmbedBuilder()
    .setTitle(`\u{23F0} Raid in ${label}: ${raidDay.day_name}`)
    .setColor(0xff6600)
    .setDescription(`**${dateStr}** @ **${raidDay.raid_time || '21:00'}**`)
    .addFields(
      { name: 'Confirmed', value: `${confirmed.length} raiders`, inline: true },
      { name: 'No Response', value: `${noResponse.length} missing`, inline: true },
    );

  if (noResponse.length > 0 && noResponse.length <= 15) {
    const names = noResponse.map(u => u.character_name || 'Unknown').join(', ');
    embed.addFields({ name: 'Missing Signups', value: names });
  }

  await sendToChannel(client, guildId, 'channel_raids', { embeds: [embed] });

  // DM users who haven't responded (only for the 1h reminder)
  if (intervalMs === 1 * 60 * 60 * 1000) {
    for (const user of noResponse) {
      await sendDM(client, user.id, {
        embeds: [new EmbedBuilder()
          .setTitle('\u{23F0} Raid Reminder')
          .setColor(0xff6600)
          .setDescription(`Raid starts in 1 hour (**${dateStr}** @ ${raidDay.raid_time || '21:00'}).\nYou haven't signed up yet! Use \`/signup\` or the web app.`)
        ],
      });
    }
  }

  log.info(`Sent ${label} raid reminder for ${dateStr}`);
}

// ── Socket.IO Event Hook ────────────────────────────────────────

/**
 * Hook into Socket.IO events and push notifications to Discord.
 * Call this once after both the bot and io are initialized.
 */
export function setupNotifications(client, io) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    log.warn('DISCORD_GUILD_ID not set — notifications disabled');
    return;
  }

  // Start raid reminder loop
  startRaidReminders(client, guildId);

  // Monkey-patch io.emit to intercept relevant events
  const originalEmit = io.emit.bind(io);

  io.emit = (event, ...args) => {
    // Call original emit first
    originalEmit(event, ...args);

    // Then push to Discord
    handleEvent(client, guildId, event, args[0]).catch(err => {
      log.error(`Notification error for ${event}`, err);
    });
  };

  log.info('Discord notifications hooked into Socket.IO');
}

async function handleEvent(client, guildId, event, data) {
  switch (event) {
    case 'auction_started': {
      if (!data?.item_name) return;
      const embed = new EmbedBuilder()
        .setTitle(`\u{1F3AA} New Auction: ${data.item_name}`)
        .setColor(0xa335ee)
        .setDescription(`Duration: ${data.duration_minutes || 5} minutes\nMin bid: ${data.min_bid || 0} DKP`)
        .setTimestamp();
      await sendToChannel(client, guildId, 'channel_auctions', { embeds: [embed] });
      break;
    }

    case 'auction_ended': {
      if (!data?.itemName) return;
      const embed = buildAuctionEndedEmbed(data);
      await sendToChannel(client, guildId, 'channel_auctions', { embeds: [embed] });

      // DM the winner
      if (data.winnerId) {
        await sendDM(client, data.winnerId, {
          embeds: [new EmbedBuilder()
            .setTitle('\u{1F389} You won an auction!')
            .setColor(0x00ff00)
            .setDescription(`**${data.itemName}** for **${data.winningBid} DKP**`)
          ],
        });
      }
      break;
    }

    case 'bid_placed': {
      if (!data?.auctionId) return;
      const embed = buildBidEmbed(data);
      await sendToChannel(client, guildId, 'channel_auctions', { embeds: [embed] });

      // Outbid DM
      if (data.outbidUserId) {
        await sendDM(client, data.outbidUserId, {
          embeds: [new EmbedBuilder()
            .setTitle('\u{1F4B8} You were outbid!')
            .setColor(0xff6600)
            .setDescription(`**${data.characterName}** bid **${data.amount} DKP** on auction #${data.auctionId}`)
          ],
        });
      }
      break;
    }

    case 'dkp_updated': {
      if (!data?.userId) return;
      // Only log bulk/decay events to the DKP channel
      if (data.reason === 'calendar_signup') return;

      const user = await db.get('SELECT character_name FROM users WHERE id = ?', data.userId);
      if (!user) return;

      const sign = (data.amount || 0) >= 0 ? '+' : '';
      await sendToChannel(client, guildId, 'channel_dkp_log',
        `\u{1F4B0} **${user.character_name}** DKP ${sign}${data.amount || '?'}`
      );
      break;
    }

    case 'dkp_decay_applied': {
      if (!data?.percentage) return;
      await sendToChannel(client, guildId, 'channel_dkp_log',
        `\u26a0\ufe0f **DKP Decay** applied: ${data.percentage}%`
      );
      break;
    }

    case 'dkp_bulk_updated': {
      if (!data?.userIds) return;
      await sendToChannel(client, guildId, 'channel_dkp_log',
        `\u{1F4B0} Bulk DKP adjustment: ${data.userIds.length} members, ${data.amount >= 0 ? '+' : ''}${data.amount} DKP`
      );
      break;
    }

    case 'member_removed': {
      if (!data?.memberId) return;
      await sendToChannel(client, guildId, 'channel_dkp_log',
        `\u{1F44B} A member has been removed from the roster.`
      );
      break;
    }
  }
}
