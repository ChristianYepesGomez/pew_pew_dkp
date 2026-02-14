import { EmbedBuilder } from 'discord.js';
import { RARITY_COLORS } from '../../src/utils/constants.js';

function rarityColorInt(rarity) {
  const hex = RARITY_COLORS[rarity] || RARITY_COLORS.epic;
  return parseInt(hex.replace('#', ''), 16);
}

function timeLeft(endsAt) {
  if (!endsAt) return 'Unknown';
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/**
 * Build embed for a single active auction.
 */
export function buildAuctionEmbed(auction) {
  const embed = new EmbedBuilder()
    .setTitle(`${auction.itemImage || '\u{1F381}'} ${auction.itemName}`)
    .setColor(rarityColorInt(auction.itemRarity));

  const highBidder = auction.highestBidder;
  const fields = [
    { name: 'Current Bid', value: highBidder ? `${highBidder.amount} DKP by ${highBidder.characterName}` : 'No bids', inline: true },
    { name: 'Time Left', value: timeLeft(auction.endsAt), inline: true },
  ];

  if (auction.bidsCount !== undefined) {
    fields.push({ name: 'Bids', value: `${auction.bidsCount}`, inline: true });
  }

  embed.addFields(fields);

  if (auction.hasTie) {
    embed.addFields({ name: '\u26a0\ufe0f Tie', value: `${auction.tiedBidders.length} bidders tied at ${highBidder.amount} DKP` });
  }

  return embed;
}

/**
 * Build embed for auction list (multiple auctions).
 */
export function buildAuctionListEmbed(auctions) {
  if (auctions.length === 0) {
    return new EmbedBuilder()
      .setTitle('\u{1F3AA} Active Auctions')
      .setColor(0xa335ee)
      .setDescription('No active auctions right now.');
  }

  const lines = auctions.map((a, i) => {
    const bid = a.highestBidder ? `${a.highestBidder.amount} DKP` : 'No bids';
    return `**${i + 1}.** ${a.itemImage || '\u{1F381}'} **${a.itemName}** \u2014 ${bid} \u2014 ${timeLeft(a.endsAt)}`;
  });

  return new EmbedBuilder()
    .setTitle('\u{1F3AA} Active Auctions')
    .setColor(0xa335ee)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${auctions.length} active auction${auctions.length !== 1 ? 's' : ''}` });
}

/**
 * Build embed for auction ended event.
 */
export function buildAuctionEndedEmbed(data) {
  const embed = new EmbedBuilder()
    .setTitle(`${data.itemImage || '\u{1F381}'} Auction Ended: ${data.itemName}`)
    .setColor(data.winner ? 0x00ff00 : 0xff0000);

  if (data.winner) {
    embed.setDescription(`**${data.winner.characterName}** won for **${data.winner.amount} DKP**`);
    if (data.wasTie && data.rolls?.length > 0) {
      const rollLines = data.rolls.map(r =>
        `${r.isWinner ? '\u{1F451}' : '\u{1F3B2}'} ${r.characterName} \u2014 Roll: ${r.roll}`
      );
      embed.addFields({ name: 'Tie-Break Rolls', value: rollLines.join('\n') });
    }
  } else {
    embed.setDescription('No valid bids \u2014 auction cancelled.');
  }

  return embed;
}

/**
 * Build embed for a new bid notification.
 */
export function buildBidEmbed(data) {
  return new EmbedBuilder()
    .setTitle(`\u{1F4B0} New Bid`)
    .setColor(0xffd700)
    .setDescription(`**${data.characterName}** bid **${data.amount} DKP** on auction #${data.auctionId}`)
    .setFooter({ text: data.timeExtended ? '\u26a0\ufe0f Anti-snipe: time extended!' : '' });
}
