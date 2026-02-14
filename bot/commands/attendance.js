import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../database.js';
import { resolveUser, formatUser } from '../utils/permissions.js';
import { CLASS_COLORS } from '../../src/utils/constants.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Attendance');

export const data = new SlashCommandBuilder()
  .setName('attendance')
  .setDescription('View your raid attendance for the last month');

export async function execute(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller) {
    return interaction.reply({ content: 'Your Discord account is not linked. Use `/link` to connect it.', ephemeral: true });
  }

  try {
    const member = formatUser(caller);

    // Count raid days in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split('T')[0];

    const totalRaidDays = await db.get(`
      SELECT COUNT(DISTINCT raid_date) as count
      FROM member_availability
      WHERE raid_date >= ?
    `, since);

    const attendedDays = await db.get(`
      SELECT COUNT(*) as count
      FROM member_availability
      WHERE user_id = ? AND raid_date >= ? AND status = 'confirmed'
    `, caller.id, since);

    const total = totalRaidDays?.count || 0;
    const attended = attendedDays?.count || 0;
    const pct = total > 0 ? Math.round((attended / total) * 100) : 0;

    const hex = CLASS_COLORS[member.characterClass] || '#ffffff';
    const colorInt = parseInt(hex.replace('#', ''), 16);

    const bar = buildProgressBar(pct);

    const embed = new EmbedBuilder()
      .setTitle(`\u{1F4CA} Attendance: ${member.characterName}`)
      .setColor(colorInt)
      .setDescription(`${bar} **${pct}%**`)
      .addFields(
        { name: 'Attended', value: `${attended} raids`, inline: true },
        { name: 'Total Raid Days', value: `${total}`, inline: true },
      )
      .setFooter({ text: 'Last 30 days' });

    return interaction.reply({ embeds: [embed] });
  } catch (error) {
    log.error('Attendance command error', error);
    return interaction.reply({ content: 'Failed to get attendance.', ephemeral: true });
  }
}

function buildProgressBar(pct, length = 10) {
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}
