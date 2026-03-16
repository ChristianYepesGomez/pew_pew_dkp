import { createLogger } from './logger.js';

const log = createLogger('Lib:AuctionScheduler');

// Anti-snipe configuration
export const SNIPE_THRESHOLD_MS = 30 * 1000; // 30 seconds
export const SNIPE_EXTENSION_MS = 30 * 1000; // 30 seconds
export const MAX_SNIPE_EXTENSION_MS = 5 * 60 * 1000; // 5 minutes max total extension

// Store auction auto-close timeouts for rescheduling
export const auctionTimeouts = new Map();

// Lazy reference to io — set after server starts
let _io = null;
export function setIO(io) { _io = io; }

export async function autoCloseAuction(db, auctionId) {
  try {
    const auction = await db.get(
      'SELECT id, item_name, item_image, item_rarity, item_id, status, ends_at FROM auctions WHERE id = ? AND status = ?', auctionId, 'active'
    );
    if (!auction) return;

    // Safety: if ends_at was extended (anti-snipe) but a stale timeout fired, reschedule
    if (auction.ends_at) {
      const endsAtMs = new Date(auction.ends_at.endsWith('Z') ? auction.ends_at : auction.ends_at + 'Z').getTime();
      const remaining = endsAtMs - Date.now();
      if (remaining > 1000) {
        log.info(`Auto-close for auction ${auctionId} fired early (${Math.round(remaining / 1000)}s remaining), rescheduling`);
        scheduleAuctionClose(db, auctionId, endsAtMs);
        return;
      }
    }

    const allBids = await db.all(`
      SELECT ab.user_id, ab.amount, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    const closeResult = await db.transaction(async (tx) => {
      // Batch-load all bidder DKP in one query (eliminates N+1)
      const bidderIds = [...new Set(allBids.map(b => b.user_id))];
      const dkpMap = new Map();
      if (bidderIds.length > 0) {
        const ph = bidderIds.map(() => '?').join(',');
        const dkpRows = await tx.all(
          `SELECT user_id, current_dkp FROM member_dkp WHERE user_id IN (${ph})`, ...bidderIds
        );
        for (const row of dkpRows) dkpMap.set(row.user_id, row.current_dkp);
      }

      // Filter to valid bids (user has enough DKP)
      const validBids = allBids.filter(bid => {
        const dkp = dkpMap.get(bid.user_id);
        return dkp !== undefined && dkp >= bid.amount;
      });

      if (validBids.length === 0) {
        await tx.run('UPDATE auctions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', 'cancelled', auctionId);
        return { winner: null, wasTie: false, winningRoll: null, rolls: [] };
      }

      // Find highest bid amount and check for ties
      const highestAmount = validBids[0].amount;
      const topBidders = validBids.filter(b => b.amount === highestAmount);

      let winner;
      let wasTie = false;
      let winningRoll = null;
      const rolls = [];

      if (topBidders.length === 1) {
        winner = topBidders[0];
      } else {
        // TIE — resolve with random rolls 1-100
        wasTie = true;
        log.info(`Tie detected for auction ${auctionId}: ${topBidders.length} bidders at ${highestAmount} DKP`);

        for (const bidder of topBidders) {
          const roll = Math.floor(Math.random() * 100) + 1;
          rolls.push({
            userId: bidder.user_id,
            characterName: bidder.character_name,
            characterClass: bidder.character_class,
            bidAmount: bidder.amount,
            roll
          });
        }

        rolls.sort((a, b) => b.roll - a.roll);
        winner = topBidders.find(b => b.user_id === rolls[0].userId);
        winningRoll = rolls[0].roll;

        // Record all rolls
        for (const rollData of rolls) {
          const isWinner = rollData.userId === winner.user_id ? 1 : 0;
          await tx.run(
            'INSERT INTO auction_rolls (auction_id, user_id, bid_amount, roll_result, is_winner) VALUES (?, ?, ?, ?, ?)',
            auctionId, rollData.userId, rollData.bidAmount, rollData.roll, isWinner
          );
        }

        log.info(`Tie resolved: ${winner.character_name} wins with roll ${winningRoll}`);
      }

      // Deduct DKP from winner
      await tx.run(`
        UPDATE member_dkp
        SET current_dkp = current_dkp - ?,
            lifetime_spent = lifetime_spent + ?
        WHERE user_id = ?
      `, winner.amount, winner.amount, winner.user_id);

      const reason = wasTie
        ? `Won auction (roll ${winningRoll}): ${auction.item_name} (auto-close)`
        : `Won auction: ${auction.item_name} (auto-close)`;

      await tx.run(`
        INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, auction_id)
        VALUES (?, ?, ?, NULL, ?)
      `, winner.user_id, -winner.amount, reason, auctionId);

      await tx.run(`
        UPDATE auctions
        SET status = 'completed', winner_id = ?, winning_bid = ?, ended_at = CURRENT_TIMESTAMP,
            was_tie = ?, winning_roll = ?
        WHERE id = ?
      `, winner.user_id, winner.amount, wasTie ? 1 : 0, winningRoll, auctionId);

      return { winner, wasTie, winningRoll, rolls };
    });

    const { winner: winningBid, wasTie, winningRoll, rolls } = closeResult;

    const result = {
      auctionId,
      itemName: auction.item_name,
      itemImage: auction.item_image,
      itemRarity: auction.item_rarity,
      itemId: auction.item_id,
      winnerId: winningBid?.user_id || null,
      winningBid: winningBid?.amount || null,
      wasTie,
      winningRoll,
      rolls,
      winner: winningBid ? {
        userId: winningBid.user_id,
        characterName: winningBid.character_name,
        characterClass: winningBid.character_class,
        amount: winningBid.amount
      } : null
    };

    if (_io) _io.emit('auction_ended', result);
    log.info(`Auction ${auctionId} auto-closed. Winner: ${winningBid?.character_name || 'No bids'}`);
  } catch (error) {
    log.error(`Error auto-closing auction ${auctionId}`, error);
  }
}

export function scheduleAuctionClose(db, auctionId, endsAt) {
  if (auctionTimeouts.has(auctionId)) {
    clearTimeout(auctionTimeouts.get(auctionId));
  }

  const now = Date.now();
  const delay = endsAt - now;

  if (delay > 0) {
    const timeout = setTimeout(() => {
      auctionTimeouts.delete(auctionId);
      autoCloseAuction(db, auctionId);
    }, delay);
    auctionTimeouts.set(auctionId, timeout);
    log.info(`Scheduled auto-close for auction ${auctionId} in ${Math.round(delay / 1000)}s`);
  } else {
    auctionTimeouts.delete(auctionId);
    autoCloseAuction(db, auctionId);
  }
}

export async function scheduleExistingAuctions(db) {
  const activeAuctions = await db.all(
    'SELECT id, ends_at, duration_minutes FROM auctions WHERE status = ?', 'active'
  );

  for (const auction of activeAuctions) {
    let endsAt;

    if (auction.ends_at) {
      endsAt = new Date(auction.ends_at).getTime();
    } else {
      const defaultDuration = auction.duration_minutes || 5;
      const newEndsAt = new Date(Date.now() + defaultDuration * 60 * 1000).toISOString();
      await db.run('UPDATE auctions SET ends_at = ?, duration_minutes = ? WHERE id = ?', newEndsAt, defaultDuration, auction.id);
      endsAt = new Date(newEndsAt).getTime();
      log.info(`Set default ends_at for auction ${auction.id}: ${newEndsAt}`);
    }

    scheduleAuctionClose(db, auction.id, endsAt);
  }
}
