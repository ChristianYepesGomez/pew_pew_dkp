import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../database.js';
import { resolveUser, formatUser } from '../utils/permissions.js';
import { CLASS_COLORS, RARITY_COLORS } from '../../src/utils/constants.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:BIS');

export const data = new SlashCommandBuilder()
  .setName('bis')
  .setDescription('View your BIS wishlist');

export async function execute(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller) {
    return interaction.reply({ content: 'Your Discord account is not linked. Use `/link` to connect it.', ephemeral: true });
  }

  try {
    const member = formatUser(caller);

    const items = await db.all(`
      SELECT item_name, item_slot, item_rarity, boss_name, raid_name, obtained, priority
      FROM bis_items
      WHERE user_id = ?
      ORDER BY priority DESC, item_slot
    `, caller.id);

    if (items.length === 0) {
      return interaction.reply({ content: 'You have no BIS items set. Add them on the web app!', ephemeral: true });
    }

    const hex = CLASS_COLORS[member.characterClass] || '#ffffff';
    const colorInt = parseInt(hex.replace('#', ''), 16);

    const lines = items.slice(0, 15).map(item => {
      const check = item.obtained ? '\u2705' : '\u2b1c';
      const slot = item.item_slot ? `[${item.item_slot}]` : '';
      const source = item.boss_name ? ` \u2014 ${item.boss_name}` : '';
      return `${check} **${item.item_name}** ${slot}${source}`;
    });

    const obtained = items.filter(i => i.obtained).length;

    const embed = new EmbedBuilder()
      .setTitle(`\u{1F451} BIS Wishlist: ${member.characterName}`)
      .setColor(colorInt)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${obtained}/${items.length} obtained` });

    return interaction.reply({ embeds: [embed] });
  } catch (error) {
    log.error('BIS command error', error);
    return interaction.reply({ content: 'Failed to get BIS list.', ephemeral: true });
  }
}
