import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../database.js';
import { resolveUser, hasRole } from '../utils/permissions.js';
import { processWarcraftLog, isConfigured as isWCLConfigured } from '../../services/warcraftlogs.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Import');

export const data = new SlashCommandBuilder()
  .setName('import')
  .setDescription('Preview a Warcraft Logs report (admin only)')
  .addStringOption(opt =>
    opt.setName('link').setDescription('WCL report URL or code').setRequired(true)
  );

export async function execute(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller || !hasRole(caller, ['admin'])) {
    return interaction.reply({ content: 'Only admins can import logs.', ephemeral: true });
  }

  if (!isWCLConfigured()) {
    return interaction.reply({
      content: 'Warcraft Logs API is not configured. Set WCL credentials in the server environment.',
      ephemeral: true,
    });
  }

  const link = interaction.options.getString('link');

  await interaction.deferReply();

  try {
    const reportData = await processWarcraftLog(link);

    // Check if already processed
    const existing = await db.get(
      'SELECT id FROM warcraft_logs_processed WHERE report_code = ?',
      reportData.code
    );

    // Match participants to guild members
    const members = await db.all(`
      SELECT m.user_id, u.character_name, u.username
      FROM member_dkp m
      JOIN users u ON m.user_id = u.id
      WHERE u.is_active = 1
    `);

    const alts = await db.all(`
      SELECT c.user_id, c.character_name
      FROM characters c
      JOIN users u ON c.user_id = u.id
      WHERE u.is_active = 1
    `);

    const nameMap = new Map();
    for (const m of members) {
      if (m.character_name) nameMap.set(m.character_name.toLowerCase(), m);
      if (m.username) nameMap.set(m.username.toLowerCase(), m);
    }
    for (const alt of alts) {
      if (alt.character_name) {
        const member = members.find(m => m.user_id === alt.user_id);
        if (member) nameMap.set(alt.character_name.toLowerCase(), member);
      }
    }

    let matched = 0;
    for (const p of reportData.participants) {
      if (nameMap.has(p.name.toLowerCase())) matched++;
    }

    const raidDate = new Date(reportData.startTime)
      .toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

    const embed = new EmbedBuilder()
      .setTitle(`\u{1F4DC} WCL Report: ${reportData.title || reportData.code}`)
      .setColor(existing ? 0xff6600 : 0x00ff00)
      .addFields(
        { name: 'Raid Date', value: raidDate, inline: true },
        { name: 'Participants', value: `${reportData.participantCount}`, inline: true },
        { name: 'Matched', value: `${matched}/${reportData.participantCount}`, inline: true },
        { name: 'Bosses Killed', value: `${reportData.bossesKilled}/${reportData.totalBosses}`, inline: true },
        { name: 'Total Attempts', value: `${reportData.totalAttempts}`, inline: true },
      );

    if (existing) {
      embed.setFooter({ text: 'This report has already been processed.' });
    } else {
      embed.setFooter({ text: 'Use the web app to confirm DKP assignment.' });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    log.error('Import command error', error);
    return interaction.editReply({
      content: `Failed to process report: ${error.message}`,
    });
  }
}
