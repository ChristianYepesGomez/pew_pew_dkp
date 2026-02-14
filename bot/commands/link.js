import { SlashCommandBuilder } from 'discord.js';
import { generateLinkCode } from '../utils/linking.js';
import { resolveUser } from '../utils/permissions.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Link');

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link your Discord account to your DKP account')
  .addStringOption(opt =>
    opt.setName('username').setDescription('Your DKP username').setRequired(true)
  );

export async function execute(interaction) {
  // Check if already linked
  const existing = await resolveUser(interaction.user.id);
  if (existing) {
    return interaction.reply({
      content: `Your Discord is already linked to **${existing.character_name || existing.username}**.`,
      ephemeral: true,
    });
  }

  const username = interaction.options.getString('username');

  try {
    const result = await generateLinkCode(
      interaction.user.id,
      interaction.user.username,
      username
    );

    if (result.error) {
      return interaction.reply({ content: result.error, ephemeral: true });
    }

    return interaction.reply({
      content: [
        `\u{1F517} **Link Code: \`${result.code}\`**`,
        '',
        `Go to **Settings** on the web app and enter this code to link your account.`,
        `This code expires in ${result.expiresInMinutes} minutes.`,
      ].join('\n'),
      ephemeral: true,
    });
  } catch (error) {
    log.error('Link command error', error);
    return interaction.reply({ content: 'Failed to generate link code.', ephemeral: true });
  }
}
