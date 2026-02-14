import { EmbedBuilder } from 'discord.js';

const STATUS_EMOJI = {
  confirmed: '\u2705',
  declined: '\u274c',
  tentative: '\u2753',
  null: '\u2b1c',
};

/**
 * Build embed for upcoming raid schedule.
 */
export function buildCalendarEmbed(dates) {
  if (dates.length === 0) {
    return new EmbedBuilder()
      .setTitle('\u{1F4C5} Raid Schedule')
      .setColor(0x0070dd)
      .setDescription('No raids scheduled.');
  }

  const lines = dates.map(d => {
    const locked = d.isLocked ? ' \u{1F512}' : '';
    return `**${d.dayName}** ${d.date} @ ${d.raidTime}${locked}`;
  });

  return new EmbedBuilder()
    .setTitle('\u{1F4C5} Raid Schedule')
    .setColor(0x0070dd)
    .setDescription(lines.join('\n'));
}

/**
 * Build embed for a raid date summary (signups).
 */
export function buildRaidSummaryEmbed(summary) {
  const embed = new EmbedBuilder()
    .setTitle(`\u{1F4C5} ${summary.date} \u2014 Raid Signups`)
    .setColor(0x0070dd);

  const confirmed = summary.confirmed.map(m => m.characterName).join(', ') || 'None';
  const declined = summary.declined.map(m => m.characterName).join(', ') || 'None';
  const tentative = summary.tentative.map(m => m.characterName).join(', ') || 'None';
  const noResponse = summary.noResponse.map(m => m.characterName).join(', ') || 'None';

  embed.addFields(
    { name: `${STATUS_EMOJI.confirmed} Confirmed (${summary.counts.confirmed})`, value: confirmed },
    { name: `${STATUS_EMOJI.declined} Declined (${summary.counts.declined})`, value: declined },
    { name: `${STATUS_EMOJI.tentative} Tentative (${summary.counts.tentative})`, value: tentative },
    { name: `${STATUS_EMOJI.null} No Response (${summary.counts.noResponse})`, value: noResponse },
  );

  return embed;
}

/**
 * Build embed for user's own signup status.
 */
export function buildMySignupsEmbed(dates, characterName) {
  if (dates.length === 0) {
    return new EmbedBuilder()
      .setTitle(`\u{1F4C5} Your Signups`)
      .setColor(0x0070dd)
      .setDescription('No upcoming raid dates.');
  }

  const lines = dates.map(d => {
    const emoji = STATUS_EMOJI[d.status] || STATUS_EMOJI.null;
    const status = d.status || 'Not signed up';
    return `${emoji} **${d.dayName}** ${d.date} \u2014 ${status}`;
  });

  return new EmbedBuilder()
    .setTitle(`\u{1F4C5} Signups for ${characterName}`)
    .setColor(0x0070dd)
    .setDescription(lines.join('\n'));
}
