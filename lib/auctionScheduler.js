import { createLogger } from './logger.js';

const log = createLogger('Lib:AuctionScheduler');

// Anti-snipe configuration
export const SNIPE_THRESHOLD_MS = 30 * 1000; // 30 seconds
export const SNIPE_EXTENSION_MS = 30 * 1000; // 30 seconds
export const MAX_SNIPE_EXTENSION_MS = 5 * 60 * 1000; // 5 minutes max total extension

// How often to sweep for stuck auctions (ones past ends_at but still 'active')
const SWEEP_INTERVAL_MS = 30 * 1000; // 30 seconds

// Store auction auto-close timeouts for rescheduling
export const auctionTimeouts = new Map();

// Lazy reference to io — set after server starts
let _io = null;
export function setIO(io) { _io = io; }

// Parse ends_at safely — SQLite CURRENT_TIMESTAMP lacks 'Z' suffix
function parseEndsAt(endsAt) {
  return new Date(endsAt.endsWith('Z') ? endsAt : endsAt + 'Z').getTime();
}

export async function autoCloseAuction(db, auctionId) {
  try {
    const auction = await db.get(
      'SELECT id, item_name, item_image, item_rarity, item_id, status, ends_at FROM auctions WHERE id = ? AND status = ?', auctionId, 'active'
    );
    if (!auction) return;

    // Safety: if ends_at was extended (anti-snipe) but a stale timeout fired, reschedule
    if (auction.ends_at) {
      const endsAtMs = parseEndsAt(auction.ends_at);
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
      if (allBids.length === 0) {
        await tx.run('UPDATE auctions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', 'cancelled', auctionId);
        return { winner: null, wasTie: false, winningRoll: null, rolls: [] };
      }

      // Find highest bid amount and check for ties (DKP was validated at bid time)
      const highestAmount = allBids[0].amount;
      const topBidders = allBids.filter(b => b.amount === highestAmount);

      let winner;
      let wasTie = false;
      let winningRoll = null;
      const rolls = [];

      if (topBidders.length === 1) {
        winner = topBidders[0];
      } else {
        // TIE — resolve with random rolls 1-100, re-roll on equal rolls
        wasTie = true;
        log.info(`Tie detected for auction ${auctionId}: ${topBidders.length} bidders at ${highestAmount} DKP`);

        let candidates = topBidders;
        let roundNum = 0;
        const MAX_ROUNDS = 10;

        while (candidates.length > 1 && roundNum < MAX_ROUNDS) {
          roundNum++;
          const roundRolls = [];
          for (const bidder of candidates) {
            const roll = Math.floor(Math.random() * 100) + 1;
            roundRolls.push({
              userId: bidder.user_id,
              characterName: bidder.character_name,
              characterClass: bidder.character_class,
              bidAmount: bidder.amount,
              roll
            });
          }
          roundRolls.sort((a, b) => b.roll - a.roll);
          rolls.push(...roundRolls);

          const topRoll = roundRolls[0].roll;
          const tiedAtTop = roundRolls.filter(r => r.roll === topRoll);
          if (tiedAtTop.length === 1) {
            candidates = [topBidders.find(b => b.user_id === tiedAtTop[0].userId)];
          } else {
            log.info(`Auction ${auctionId} round ${roundNum}: ${tiedAtTop.length} tied at roll ${topRoll}, re-rolling`);
            candidates = tiedAtTop.map(r => topBidders.find(b => b.user_id === r.userId));
          }
        }

        winner = candidates[0];
        winningRoll = rolls.filter(r => r.userId === winner.user_id).pop()?.roll;

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

      // Safety: verify winner has enough DKP inside the transaction (race condition guard)
      const winnerDkp = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', winner.user_id);
      if (!winnerDkp || winnerDkp.current_dkp < winner.amount) {
        log.warn(`Auction ${auctionId}: winner ${winner.character_name} has insufficient DKP (${winnerDkp?.current_dkp || 0} < ${winner.amount})`);
        const actualDeduction = Math.min(winner.amount, winnerDkp?.current_dkp || 0);
        await tx.run(`
          UPDATE member_dkp
          SET current_dkp = current_dkp - ?,
              lifetime_spent = lifetime_spent + ?
          WHERE user_id = ?
        `, actualDeduction, actualDeduction, winner.user_id);

        const reason = `Won auction: ${auction.item_name} (auto-close, partial DKP: ${actualDeduction}/${winner.amount})`;
        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, auction_id)
          VALUES (?, ?, ?, NULL, ?)
        `, winner.user_id, -actualDeduction, reason, auctionId);
      } else {
        // Normal deduction
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
      }

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

export function cancelAuctionClose(auctionId) {
  if (auctionTimeouts.has(auctionId)) {
    clearTimeout(auctionTimeouts.get(auctionId));
    auctionTimeouts.delete(auctionId);
    log.info(`Cancelled auto-close for auction ${auctionId}`);
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
      endsAt = parseEndsAt(auction.ends_at);
    } else {
      const defaultDuration = auction.duration_minutes || 3;
      const newEndsAt = new Date(Date.now() + defaultDuration * 60 * 1000).toISOString();
      await db.run('UPDATE auctions SET ends_at = ?, duration_minutes = ? WHERE id = ?', newEndsAt, defaultDuration, auction.id);
      endsAt = new Date(newEndsAt).getTime();
      log.info(`Set default ends_at for auction ${auction.id}: ${newEndsAt}`);
    }

    scheduleAuctionClose(db, auction.id, endsAt);
  }
}

// Periodic sweep: catch auctions stuck as 'active' past their ends_at
// (handles lost timeouts, failed auto-close, server restarts, etc.)
let _sweepInterval = null;
const _sweepDbs = new Set();

export function startAuctionSweep(db) {
  _sweepDbs.add(db);

  // Only start the interval once, even for multiple tenant DBs
  if (_sweepInterval) return;

  _sweepInterval = setInterval(async () => {
    for (const sweepDb of _sweepDbs) {
      try {
        const stuck = await sweepDb.all(
          "SELECT id, ends_at FROM auctions WHERE status = 'active' AND ends_at IS NOT NULL"
        );

        const now = Date.now();
        for (const auction of stuck) {
          const endsAtMs = parseEndsAt(auction.ends_at);
          if (endsAtMs < now && !auctionTimeouts.has(auction.id)) {
            log.warn(`Sweep: auction ${auction.id} is past ends_at with no timeout — closing now`);
            autoCloseAuction(sweepDb, auction.id);
          }
        }
      } catch (err) {
        log.error('Auction sweep error', err);
      }
    }
  }, SWEEP_INTERVAL_MS);

  // Don't keep the process alive just for the sweep
  _sweepInterval.unref();
  log.info('Auction sweep started (every 30s)');
}
