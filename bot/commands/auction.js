import { SlashCommandBuilder } from 'discord.js';
import { db } from '../../database.js';
import { resolveUser, hasRole } from '../utils/permissions.js';
import { buildAuctionListEmbed, buildAuctionEmbed } from '../embeds/auction.js';
import { scheduleAuctionClose, SNIPE_THRESHOLD_MS, SNIPE_EXTENSION_MS } from '../../lib/auctionScheduler.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Auction');

export const data = new SlashCommandBuilder()
  .setName('auction')
  .setDescription('Auction commands')
  .addSubcommand(sub =>
    sub.setName('list').setDescription('View active auctions')
  )
  .addSubcommand(sub =>
    sub.setName('bid').setDescription('Place a bid on an auction')
      .addIntegerOption(opt => opt.setName('id').setDescription('Auction ID').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Bid amount in DKP').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('create').setDescription('Create a new auction (officer+)')
      .addStringOption(opt => opt.setName('item').setDescription('Item name').setRequired(true))
      .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes (default 5)'))
      .addIntegerOption(opt => opt.setName('min_bid').setDescription('Minimum bid (default 0)'))
  )
  .addSubcommand(sub =>
    sub.setName('end').setDescription('End an auction (officer+)')
      .addIntegerOption(opt => opt.setName('id').setDescription('Auction ID').setRequired(true))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') return handleList(interaction);
  if (sub === 'bid') return handleBid(interaction);
  if (sub === 'create') return handleCreate(interaction);
  if (sub === 'end') return handleEnd(interaction);
}

async function handleList(interaction) {
  const auctions = await db.all(`
    SELECT a.id, a.item_name, a.item_image, a.item_rarity, a.item_id, a.min_bid,
           a.status, a.ends_at, a.duration_minutes, a.created_at
    FROM auctions a
    WHERE a.status = 'active'
    ORDER BY a.created_at DESC
  `);

  const formatted = await Promise.all(auctions.map(async (a) => {
    const topBid = await db.get(`
      SELECT ab.amount, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC LIMIT 1
    `, a.id);

    const bidCount = await db.get('SELECT COUNT(*) as count FROM auction_bids WHERE auction_id = ?', a.id);

    let endsAt = a.ends_at;
    if (!endsAt && a.created_at) {
      const duration = a.duration_minutes || 5;
      endsAt = new Date(new Date(a.created_at).getTime() + duration * 60 * 1000).toISOString();
    }

    return {
      id: a.id,
      itemName: a.item_name,
      itemImage: a.item_image,
      itemRarity: a.item_rarity,
      endsAt,
      bidsCount: bidCount?.count || 0,
      highestBidder: topBid ? { amount: topBid.amount, characterName: topBid.character_name, characterClass: topBid.character_class } : null,
      hasTie: false,
      tiedBidders: [],
    };
  }));

  return interaction.reply({ embeds: [buildAuctionListEmbed(formatted)] });
}

async function handleBid(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller) {
    return interaction.reply({ content: 'Your Discord account is not linked. Use `/link` to connect it.', ephemeral: true });
  }

  const auctionId = interaction.options.getInteger('id');
  const amount = interaction.options.getInteger('amount');

  const auction = await db.get('SELECT id, ends_at FROM auctions WHERE id = ? AND status = ?', auctionId, 'active');
  if (!auction) {
    return interaction.reply({ content: `Auction #${auctionId} not found or not active.`, ephemeral: true });
  }

  if (amount < 1) {
    return interaction.reply({ content: 'Bid must be at least 1 DKP.', ephemeral: true });
  }

  // Check available DKP
  const userDkp = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', caller.id);
  if (!userDkp) {
    return interaction.reply({ content: 'You have no DKP record.', ephemeral: true });
  }

  // Calculate committed DKP on other active auctions
  const committed = await db.get(`
    SELECT COALESCE(SUM(ab.amount), 0) as total
    FROM auction_bids ab
    JOIN auctions a ON ab.auction_id = a.id
    WHERE ab.user_id = ? AND a.status = 'active' AND a.id != ?
    AND ab.amount = (SELECT MAX(ab2.amount) FROM auction_bids ab2 WHERE ab2.auction_id = ab.auction_id)
  `, caller.id, auctionId);

  const available = userDkp.current_dkp - (committed?.total || 0);
  if (available < amount) {
    return interaction.reply({ content: `Insufficient DKP. Available: ${available} (accounting for other bids).`, ephemeral: true });
  }

  try {
    await db.transaction(async (tx) => {
      const highestBid = await tx.get('SELECT MAX(amount) as max_bid FROM auction_bids WHERE auction_id = ?', auctionId);
      if (highestBid && highestBid.max_bid >= amount) {
        throw new Error('BID_TOO_LOW');
      }
      await tx.run('DELETE FROM auction_bids WHERE auction_id = ? AND user_id = ?', auctionId, caller.id);
      await tx.run('INSERT INTO auction_bids (auction_id, user_id, amount) VALUES (?, ?, ?)', auctionId, caller.id, amount);
    });

    // Anti-snipe
    const endsAt = new Date(auction.ends_at).getTime();
    const timeRemaining = endsAt - Date.now();
    let timeExtended = false;

    if (timeRemaining > 0 && timeRemaining <= SNIPE_THRESHOLD_MS) {
      const newEndsAt = new Date(endsAt + SNIPE_EXTENSION_MS).toISOString();
      await db.run('UPDATE auctions SET ends_at = ? WHERE id = ?', newEndsAt, auctionId);
      scheduleAuctionClose(auctionId, new Date(newEndsAt).getTime());
      timeExtended = true;
    }

    const msg = `Bid placed: **${amount} DKP** on auction #${auctionId}${timeExtended ? ' (anti-snipe: time extended!)' : ''}`;
    return interaction.reply({ content: msg });
  } catch (error) {
    if (error.message === 'BID_TOO_LOW') {
      return interaction.reply({ content: 'Your bid must be higher than the current highest bid.', ephemeral: true });
    }
    log.error('Auction bid command error', error);
    return interaction.reply({ content: 'Failed to place bid.', ephemeral: true });
  }
}

async function handleCreate(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller || !hasRole(caller, ['admin', 'officer'])) {
    return interaction.reply({ content: 'Only officers and admins can create auctions.', ephemeral: true });
  }

  const itemName = interaction.options.getString('item');
  const duration = interaction.options.getInteger('duration') || 5;
  const minBid = interaction.options.getInteger('min_bid') || 0;

  const endsAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

  try {
    const result = await db.run(`
      INSERT INTO auctions (item_name, item_name_en, item_image, item_rarity, min_bid, created_by, status, duration_minutes, ends_at)
      VALUES (?, ?, '\u{1F381}', 'epic', ?, ?, 'active', ?, ?)
    `, itemName, itemName, minBid, caller.id, duration, endsAt);

    scheduleAuctionClose(result.lastInsertRowid, new Date(endsAt).getTime());

    return interaction.reply({
      content: `Auction #${result.lastInsertRowid} created: **${itemName}** (${duration}min, min bid: ${minBid})`,
    });
  } catch (error) {
    log.error('Auction create command error', error);
    return interaction.reply({ content: 'Failed to create auction.', ephemeral: true });
  }
}

async function handleEnd(interaction) {
  const caller = await resolveUser(interaction.user.id);
  if (!caller || !hasRole(caller, ['admin', 'officer'])) {
    return interaction.reply({ content: 'Only officers and admins can end auctions.', ephemeral: true });
  }

  const auctionId = interaction.options.getInteger('id');
  const auction = await db.get('SELECT * FROM auctions WHERE id = ? AND status = ?', auctionId, 'active');
  if (!auction) {
    return interaction.reply({ content: `Auction #${auctionId} not found or not active.`, ephemeral: true });
  }

  try {
    const allBids = await db.all(`
      SELECT ab.*, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    const result = await db.transaction(async (tx) => {
      const validBids = [];
      for (const bid of allBids) {
        const dkp = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', bid.user_id);
        if (dkp && dkp.current_dkp >= bid.amount) {
          validBids.push({ ...bid, currentDkp: dkp.current_dkp });
        }
      }

      if (validBids.length === 0) {
        await tx.run("UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ?", auctionId);
        return { winner: null };
      }

      const winner = validBids[0];
      await tx.run('UPDATE member_dkp SET current_dkp = current_dkp - ?, lifetime_spent = lifetime_spent + ? WHERE user_id = ?',
        winner.amount, winner.amount, winner.user_id);
      await tx.run('INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, auction_id) VALUES (?, ?, ?, ?, ?)',
        winner.user_id, -winner.amount, `Won auction: ${auction.item_name}`, caller.id, auctionId);
      await tx.run("UPDATE auctions SET status = 'completed', winner_id = ?, winning_bid = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?",
        winner.user_id, winner.amount, auctionId);

      return {
        winner: { characterName: winner.character_name, characterClass: winner.character_class, amount: winner.amount },
      };
    });

    if (result.winner) {
      return interaction.reply({
        content: `Auction #${auctionId} ended. **${result.winner.characterName}** won **${auction.item_name}** for **${result.winner.amount} DKP**.`,
      });
    }
    return interaction.reply({ content: `Auction #${auctionId} cancelled (no valid bids).` });
  } catch (error) {
    log.error('Auction end command error', error);
    return interaction.reply({ content: 'Failed to end auction.', ephemeral: true });
  }
}
