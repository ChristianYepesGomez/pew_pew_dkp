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
      'SELECT id, item_name, item_image, status FROM auctions WHERE id = ? AND status = ?', auctionId, 'active'
    );
    if (!auction) return;

    const allBids = await db.all(`
      SELECT ab.user_id, ab.amount, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    const winningBid = await db.transaction(async (tx) => {
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

      let winner = null;
      for (const bid of allBids) {
        const dkp = dkpMap.get(bid.user_id);
        if (dkp !== undefined && dkp >= bid.amount) {
          winner = bid;
          break;
        }
      }

      if (winner) {
        await tx.run(`
          UPDATE member_dkp
          SET current_dkp = current_dkp - ?,
              lifetime_spent = lifetime_spent + ?
          WHERE user_id = ?
        `, winner.amount, winner.amount, winner.user_id);

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, auction_id)
          VALUES (?, ?, ?, NULL, ?)
        `, winner.user_id, -winner.amount, `Won auction: ${auction.item_name} (auto-close)`, auctionId);

        await tx.run(`
          UPDATE auctions
          SET status = 'completed', winner_id = ?, winning_bid = ?, ended_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, winner.user_id, winner.amount, auctionId);
      } else {
        await tx.run(`
          UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ?
        `, auctionId);
      }

      return winner;
    });

    const result = {
      auctionId,
      itemName: auction.item_name,
      itemImage: auction.item_image,
      winnerId: winningBid?.user_id || null,
      winningBid: winningBid?.amount || null,
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
