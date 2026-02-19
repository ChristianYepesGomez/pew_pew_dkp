import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { db } from '../../database.js';
import { resolveUser, hasRole } from '../utils/permissions.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Config');

const CHANNEL_KEYS = {
  auctions: 'channel_auctions',
  raids: 'channel_raids',
  dkp_log: 'channel_dkp_log',
};

export const data = new SlashCommandBuilder()
  .setName('botconfig')
  .setDescription('Configure the bot (admin only)')
  .addSubcommand(sub =>
    sub.setName('setchannel').setDescription('Set a notification channel')
      .addStringOption(opt =>
        opt.setName('type').setDescription('Channel purpose')
          .setRequired(true)
          .addChoices(
            { name: 'Auctions', value: 'auctions' },
            { name: 'Raid Schedule', value: 'raids' },
            { name: 'DKP Log', value: 'dkp_log' },
          )
      )
      .addChannelOption(opt =>
        opt.setName('channel').setDescription('Target channel')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand(sub =>
    sub.setName('show').setDescription('Show current configuration')
  );

export async function execute(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller || !hasRole(caller, ['admin'])) {
    return interaction.reply({ content: 'Only admins can configure the bot.', ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'setchannel') return handleSetChannel(interaction);
  if (sub === 'show') return handleShow(interaction);
}

async function handleSetChannel(interaction) {
  const type = interaction.options.getString('type');
  const channel = interaction.options.getChannel('channel');
  const guildId = interaction.guildId;
  const configKey = CHANNEL_KEYS[type];

  if (!configKey) {
    return interaction.reply({ content: 'Invalid channel type.', ephemeral: true });
  }

  try {
    await db.run(`
      INSERT INTO bot_config (guild_id, config_key, config_value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(guild_id, config_key) DO UPDATE SET
        config_value = excluded.config_value,
        updated_at = CURRENT_TIMESTAMP
    `, guildId, configKey, channel.id);

    return interaction.reply({
      content: `**${type}** notifications will now go to <#${channel.id}>.`,
    });
  } catch (error) {
    log.error('Set channel error', error);
    return interaction.reply({ content: 'Failed to set channel.', ephemeral: true });
  }
}

async function handleShow(interaction) {
  const guildId = interaction.guildId;

  try {
    const configs = await db.all(
      'SELECT config_key, config_value FROM bot_config WHERE guild_id = ?',
      guildId
    );

    if (configs.length === 0) {
      return interaction.reply({
        content: 'No channels configured yet. Use `/botconfig setchannel` to set them up.',
        ephemeral: true,
      });
    }

    const keyLabels = {
      channel_auctions: 'Auctions',
      channel_raids: 'Raid Schedule',
      channel_dkp_log: 'DKP Log',
    };

    const lines = configs.map(c => {
      const label = keyLabels[c.config_key] || c.config_key;
      return `**${label}:** <#${c.config_value}>`;
    });

    return interaction.reply({
      content: `**Bot Configuration**\n${lines.join('\n')}`,
      ephemeral: true,
    });
  } catch (error) {
    log.error('Show config error', error);
    return interaction.reply({ content: 'Failed to get configuration.', ephemeral: true });
  }
}
