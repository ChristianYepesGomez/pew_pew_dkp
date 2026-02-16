import { EmbedBuilder } from 'discord.js';
import { CLASS_COLORS } from '../../src/utils/constants.js';

function classColorInt(className) {
  const hex = CLASS_COLORS[className] || '#ffffff';
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Build an embed showing a single user's DKP info.
 */
export function buildDkpEmbed(member) {
  return new EmbedBuilder()
    .setTitle(`${member.characterName || member.username}`)
    .setColor(classColorInt(member.characterClass))
    .addFields(
      { name: 'Current DKP', value: `**${member.currentDkp}**`, inline: true },
      { name: 'Lifetime Gained', value: `${member.lifetimeGained}`, inline: true },
      { name: 'Lifetime Spent', value: `${member.lifetimeSpent}`, inline: true },
    )
    .setFooter({ text: `${member.characterClass || 'Unknown'}${member.spec ? ` (${member.spec})` : ''}` });
}

/**
 * Build a DKP leaderboard embed (top N members).
 */
export function buildLeaderboardEmbed(members, requestingUserId) {
  const top = members.slice(0, 10);
  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

  const lines = top.map((m, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    return `${medal} **${m.characterName || m.username}** (${m.characterClass || '?'}) \u2014 ${m.currentDkp} DKP`;
  });

  const embed = new EmbedBuilder()
    .setTitle('\u{1F3C6} DKP Leaderboard')
    .setColor(0xa335ee) // epic purple
    .setDescription(lines.join('\n'));

  if (requestingUserId) {
    const rank = members.findIndex(m => m.id === requestingUserId);
    if (rank >= 10) {
      const user = members[rank];
      embed.setFooter({ text: `Your rank: #${rank + 1} (${user.currentDkp} DKP)` });
    }
  }

  return embed;
}
