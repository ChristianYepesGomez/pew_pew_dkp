import { SlashCommandBuilder } from 'discord.js';
import { db } from '../../database.js';
import { resolveUser, formatUser, hasRole } from '../utils/permissions.js';
import { buildDkpEmbed, buildLeaderboardEmbed } from '../embeds/dkp.js';
import { addDkpWithCap } from '../../lib/helpers.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:DKP');

export const data = new SlashCommandBuilder()
  .setName('dkp')
  .setDescription('View and manage DKP')
  .addSubcommand(sub =>
    sub.setName('me').setDescription('View your DKP')
  )
  .addSubcommand(sub =>
    sub.setName('user').setDescription('View another user\'s DKP')
      .addUserOption(opt => opt.setName('target').setDescription('Discord user to look up').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('leaderboard').setDescription('Show top 10 DKP holders')
  )
  .addSubcommand(sub =>
    sub.setName('adjust').setDescription('Adjust a user\'s DKP (admin only)')
      .addUserOption(opt => opt.setName('target').setDescription('User to adjust').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('DKP amount (negative to remove)').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for adjustment'))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'me') {
    return handleMe(interaction);
  } else if (sub === 'user') {
    return handleUser(interaction);
  } else if (sub === 'leaderboard') {
    return handleLeaderboard(interaction);
  } else if (sub === 'adjust') {
    return handleAdjust(interaction);
  }
}

async function handleMe(interaction) {
  const user = await resolveUser(interaction.user.id);
  if (!user) {
    return interaction.reply({ content: 'Your Discord account is not linked. Use `/link` to connect it.', ephemeral: true });
  }
  const member = formatUser(user);
  return interaction.reply({ embeds: [buildDkpEmbed(member)] });
}

async function handleUser(interaction) {
  const target = interaction.options.getUser('target');
  const user = await resolveUser(target.id);
  if (!user) {
    return interaction.reply({ content: `${target.username} has not linked their Discord account.`, ephemeral: true });
  }
  const member = formatUser(user);
  return interaction.reply({ embeds: [buildDkpEmbed(member)] });
}

async function handleLeaderboard(interaction) {
  const rows = await db.all(`
    SELECT u.id, u.username, u.character_name, u.character_class, u.spec,
           md.current_dkp, md.lifetime_gained, md.lifetime_spent
    FROM users u
    LEFT JOIN member_dkp md ON u.id = md.user_id
    WHERE u.is_active = 1
    ORDER BY md.current_dkp DESC
  `);

  const members = rows.map(r => ({
    id: r.id,
    username: r.username,
    characterName: r.character_name,
    characterClass: r.character_class,
    spec: r.spec,
    currentDkp: r.current_dkp || 0,
    lifetimeGained: r.lifetime_gained || 0,
    lifetimeSpent: r.lifetime_spent || 0,
  }));

  // Try to find the requesting user's DKP user ID
  const caller = await resolveUser(interaction.user.id);
  const embed = buildLeaderboardEmbed(members, caller?.id);
  return interaction.reply({ embeds: [embed] });
}

async function handleAdjust(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller || !hasRole(caller, ['admin'])) {
    return interaction.reply({ content: 'Only admins can adjust DKP.', ephemeral: true });
  }

  const target = interaction.options.getUser('target');
  const amount = interaction.options.getInteger('amount');
  const reason = interaction.options.getString('reason') || 'Discord bot adjustment';

  const targetUser = await resolveUser(target.id);
  if (!targetUser) {
    return interaction.reply({ content: `${target.username} has not linked their Discord account.`, ephemeral: true });
  }

  try {
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    if (amount > 0) {
      await db.transaction(async (tx) => {
        await addDkpWithCap(tx, targetUser.id, amount, dkpCap);
        await tx.run(
          'INSERT INTO dkp_transactions (user_id, amount, reason, performed_by) VALUES (?, ?, ?, ?)',
          targetUser.id, amount, reason, caller.id
        );
      });
    } else {
      await db.transaction(async (tx) => {
        await tx.run('UPDATE member_dkp SET current_dkp = MAX(0, current_dkp + ?) WHERE user_id = ?', amount, targetUser.id);
        await tx.run(
          'INSERT INTO dkp_transactions (user_id, amount, reason, performed_by) VALUES (?, ?, ?, ?)',
          targetUser.id, amount, reason, caller.id
        );
      });
    }

    // Get updated DKP
    const updated = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', targetUser.id);
    const sign = amount > 0 ? '+' : '';

    return interaction.reply({
      content: `DKP adjusted: **${targetUser.character_name}** ${sign}${amount} DKP (now ${updated?.current_dkp || 0}). Reason: ${reason}`,
    });
  } catch (error) {
    log.error('DKP adjust command error', error);
    return interaction.reply({ content: 'Failed to adjust DKP.', ephemeral: true });
  }
}
