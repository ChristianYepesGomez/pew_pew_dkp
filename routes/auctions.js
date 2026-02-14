import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter, userLimiter } from '../lib/rateLimiters.js';
import { scheduleAuctionClose, SNIPE_THRESHOLD_MS, SNIPE_EXTENSION_MS, MAX_SNIPE_EXTENSION_MS } from '../lib/auctionScheduler.js';
import { createLogger } from '../lib/logger.js';
import { success, error, paginated } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { validateParams } from '../middleware/validate.js';
import { parsePagination } from '../lib/pagination.js';

const log = createLogger('Route:Auctions');
const router = Router();

// Helper: calculate DKP committed in active auction bids
async function getCommittedBids(db, userId, excludeAuctionId = null) {
  const sql = excludeAuctionId
    ? `SELECT COALESCE(SUM(ab.amount), 0) as total
       FROM auction_bids ab
       JOIN auctions a ON ab.auction_id = a.id
       WHERE ab.user_id = ? AND a.status = 'active' AND a.id != ?
       AND ab.amount = (SELECT MAX(ab2.amount) FROM auction_bids ab2 WHERE ab2.auction_id = ab.auction_id)`
    : `SELECT COALESCE(SUM(ab.amount), 0) as total
       FROM auction_bids ab
       JOIN auctions a ON ab.auction_id = a.id
       WHERE ab.user_id = ? AND a.status = 'active'
       AND ab.amount = (SELECT MAX(ab2.amount) FROM auction_bids ab2 WHERE ab2.auction_id = ab.auction_id)`;
  const args = excludeAuctionId ? [userId, excludeAuctionId] : [userId];
  const result = await db.get(sql, ...args);
  return result?.total || 0;
}

// Get all active auctions
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const auctions = await req.db.all(`
      SELECT a.id, a.item_name, a.item_image, a.item_rarity, a.item_id, a.min_bid,
             a.status, a.winner_id, a.winning_bid, a.created_by, a.created_at,
             a.ended_at, a.ends_at, a.duration_minutes,
             u.character_name as created_by_name
      FROM auctions a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.status = 'active'
      ORDER BY a.created_at DESC
    `);

    if (auctions.length === 0) {
      return success(res, { auctions: [] });
    }

    // Batch-load ALL bids for ALL active auctions in one query (eliminates N+1)
    const auctionIds = auctions.map(a => a.id);
    const placeholders = auctionIds.map(() => '?').join(',');
    const allBids = await req.db.all(`
      SELECT ab.id, ab.auction_id, ab.user_id, ab.amount, ab.created_at,
             u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id IN (${placeholders})
      ORDER BY ab.auction_id, ab.amount DESC
    `, ...auctionIds);

    // Group bids by auction_id
    const bidsByAuction = new Map();
    for (const bid of allBids) {
      if (!bidsByAuction.has(bid.auction_id)) {
        bidsByAuction.set(bid.auction_id, []);
      }
      bidsByAuction.get(bid.auction_id).push(bid);
    }

    const auctionsWithBids = auctions.map(auction => {
      const bids = bidsByAuction.get(auction.id) || [];
      const highestBid = bids.length > 0 ? bids[0].amount : 0;
      const highestBidder = bids.length > 0 ? bids[0] : null;

      const tiedBidders = bids.filter(b => b.amount === highestBid);
      const hasTie = tiedBidders.length > 1;

      let endsAt = auction.ends_at;
      if (!endsAt && auction.created_at) {
        const duration = auction.duration_minutes || 5;
        const createdTime = new Date(auction.created_at).getTime();
        endsAt = new Date(createdTime + duration * 60 * 1000).toISOString();
      }

      return {
        id: auction.id,
        itemName: auction.item_name,
        itemImage: auction.item_image,
        itemRarity: auction.item_rarity,
        itemId: auction.item_id,
        minimumBid: auction.min_bid,
        currentBid: highestBid,
        status: auction.status,
        winnerId: auction.winner_id,
        winningBid: auction.winning_bid,
        createdBy: auction.created_by,
        createdByName: auction.created_by_name,
        createdAt: auction.created_at,
        endedAt: auction.ended_at,
        endsAt: endsAt,
        durationMinutes: auction.duration_minutes || 5,
        bidsCount: bids.length,
        hasTie: hasTie,
        tiedBidders: hasTie ? tiedBidders.map(b => ({
          userId: b.user_id,
          characterName: b.character_name,
          characterClass: b.character_class,
          amount: b.amount
        })) : [],
        highestBidder: highestBidder ? {
          characterName: highestBidder.character_name,
          characterClass: highestBidder.character_class,
          amount: highestBidder.amount
        } : null,
        bids: bids.map(b => ({
          id: b.id,
          userId: b.user_id,
          characterName: b.character_name,
          characterClass: b.character_class,
          amount: b.amount,
          createdAt: b.created_at,
          isTied: b.amount === highestBid && hasTie
        }))
      };
    });

    const userId = req.user.userId;
    const userDkp = await req.db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    const committed = await getCommittedBids(req.db, userId);
    const availableDkp = (userDkp?.current_dkp || 0) - committed;

    return success(res, { auctions: auctionsWithBids, availableDkp });
  } catch (err) {
    log.error('Get active auctions error', err);
    return error(res, 'Failed to get active auctions', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Create new auction (officer+)
router.post('/', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { itemName, itemNameEN, itemImage, minBid, itemRarity, itemId, durationMinutes } = req.body;

    if (!itemName) {
      return error(res, 'Item name is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const duration = durationMinutes || 5;
    const endsAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

    const result = await req.db.run(`
      INSERT INTO auctions (item_name, item_name_en, item_image, item_rarity, min_bid, created_by, status, duration_minutes, ends_at, item_id)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `, itemName, itemNameEN || itemName, itemImage || '\uD83C\uDF81', itemRarity || 'epic', minBid || 0, req.user.userId, duration, endsAt, itemId || null);

    const auction = await req.db.get(`
      SELECT id, item_name, item_name_en, item_image, item_rarity, item_id, min_bid,
             status, winner_id, winning_bid, created_by, created_at, ended_at,
             duration_minutes, ends_at, farewell_data, was_tie, winning_roll
      FROM auctions WHERE id = ?
    `, result.lastInsertRowid);

    // Schedule auto-close using centralized function (enables anti-snipe rescheduling)
    scheduleAuctionClose(req.db, auction.id, new Date(endsAt).getTime());

    req.app.get('io').emit('auction_started', auction);
    return success(res, auction, null, 201);
  } catch (err) {
    log.error('Create auction error', err);
    return error(res, 'Failed to create auction', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Place bid
router.post('/:auctionId/bid', userLimiter, authenticateToken, validateParams({ auctionId: 'integer' }), async (req, res) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);
    const { amount } = req.body;
    const userId = req.user.userId;

    const auction = await req.db.get(
      'SELECT id, ends_at, created_at, duration_minutes FROM auctions WHERE id = ? AND status = ?', auctionId, 'active'
    );
    if (!auction) {
      return error(res, 'Active auction not found', 404, ErrorCodes.AUCTION_CLOSED);
    }

    if (!amount || amount < 1) {
      return error(res, 'Bid must be at least 1 DKP', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const userDkp = await req.db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    if (!userDkp) {
      return error(res, 'Insufficient DKP', 400, ErrorCodes.INSUFFICIENT_DKP);
    }

    const committed = await getCommittedBids(req.db, userId, auctionId);
    const availableDkp = userDkp.current_dkp - committed;
    if (availableDkp < amount) {
      return error(res, 'Insufficient DKP (accounting for your bids on other active auctions)', 400, ErrorCodes.INSUFFICIENT_DKP);
    }

    // Atomic bid placement: validate + delete old + insert new in one transaction
    const bidResult = await req.db.transaction(async (tx) => {
      const highestBid = await tx.get(`
        SELECT MAX(amount) as max_bid FROM auction_bids WHERE auction_id = ?
      `, auctionId);

      if (highestBid && highestBid.max_bid >= amount) {
        throw new Error('Bid must be higher than current highest bid');
      }

      // Get current top bidder BEFORE placing new bid (for outbid notification)
      const previousTopBid = await tx.get(`
        SELECT ab.user_id, ab.amount, u.character_name
        FROM auction_bids ab
        JOIN users u ON ab.user_id = u.id
        WHERE ab.auction_id = ?
        ORDER BY ab.amount DESC
        LIMIT 1
      `, auctionId);

      await tx.run('DELETE FROM auction_bids WHERE auction_id = ? AND user_id = ?', auctionId, userId);

      await tx.run(`
        INSERT INTO auction_bids (auction_id, user_id, amount)
        VALUES (?, ?, ?)
      `, auctionId, userId, amount);

      return { previousTopBid };
    });

    const { previousTopBid } = bidResult;

    const user = await req.db.get('SELECT character_name, character_class FROM users WHERE id = ?', userId);

    // Check if this bid is a tie or outbid
    const isTie = previousTopBid && previousTopBid.amount === amount && previousTopBid.user_id !== userId;
    const isOutbid = previousTopBid && previousTopBid.amount < amount && previousTopBid.user_id !== userId;

    // Anti-snipe: Check if bid is within last 30 seconds and extend time
    let timeExtended = false;
    let newEndsAt = null;
    const endsAt = new Date(auction.ends_at).getTime();
    const now = Date.now();
    const timeRemaining = endsAt - now;

    if (timeRemaining > 0 && timeRemaining <= SNIPE_THRESHOLD_MS) {
      // Check if max extension cap has been reached
      // SQLite CURRENT_TIMESTAMP is UTC but lacks 'Z' suffix — ensure UTC parsing
      const createdAtUtc = auction.created_at.endsWith('Z') ? auction.created_at : auction.created_at + 'Z';
      const originalEndTime = new Date(createdAtUtc).getTime() + (auction.duration_minutes || 5) * 60 * 1000;
      const totalExtended = (endsAt + SNIPE_EXTENSION_MS) - originalEndTime;

      if (totalExtended <= MAX_SNIPE_EXTENSION_MS) {
        newEndsAt = new Date(endsAt + SNIPE_EXTENSION_MS).toISOString();
        await req.db.run('UPDATE auctions SET ends_at = ? WHERE id = ?', newEndsAt, auctionId);
        scheduleAuctionClose(req.db, auctionId, new Date(newEndsAt).getTime());
        timeExtended = true;
        log.info(`Anti-snipe: Auction ${auctionId} extended to ${newEndsAt}`);
      } else {
        log.info(`Anti-snipe: Auction ${auctionId} max extension reached (${MAX_SNIPE_EXTENSION_MS / 1000}s cap)`);
      }
    }

    req.app.get('io').emit('bid_placed', {
      auctionId,
      userId,
      characterName: user.character_name,
      characterClass: user.character_class,
      amount,
      // Include outbid info for notifications
      outbidUserId: isOutbid ? previousTopBid.user_id : null,
      outbidCharacterName: isOutbid ? previousTopBid.character_name : null,
      tieWithUserId: isTie ? previousTopBid.user_id : null,
      tieWithCharacterName: isTie ? previousTopBid.character_name : null,
      // Anti-snipe info
      timeExtended,
      newEndsAt,
    });

    return success(res, { timeExtended, newEndsAt }, 'Bid placed successfully');
  } catch (err) {
    if (err.message === 'Bid must be higher than current highest bid') {
      return error(res, err.message, 400, ErrorCodes.BID_TOO_LOW);
    }
    log.error('Place bid error', err);
    return error(res, 'Failed to place bid', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// End auction (officer+) - with tie-breaking rolls
router.post('/:auctionId/end', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), validateParams({ auctionId: 'integer' }), async (req, res) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);

    const auction = await req.db.get(
      'SELECT id, item_name, item_image, status FROM auctions WHERE id = ? AND status = ?', auctionId, 'active'
    );
    if (!auction) {
      return error(res, 'Active auction not found', 404, ErrorCodes.AUCTION_CLOSED);
    }

    const allBids = await req.db.all(`
      SELECT ab.user_id, ab.amount, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    const result = await req.db.transaction(async (tx) => {
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

      const validBids = allBids
        .filter(bid => {
          const dkp = dkpMap.get(bid.user_id);
          return dkp !== undefined && dkp >= bid.amount;
        })
        .map(bid => ({ ...bid, currentDkp: dkpMap.get(bid.user_id) }));

      if (validBids.length === 0) {
        // No valid bids - cancel auction
        await tx.run('UPDATE auctions SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?', 'cancelled', auctionId);
        return { winner: null, wasTie: false, rolls: [] };
      }

      // Find highest bid amount among valid bids
      const highestAmount = validBids[0].amount;
      const topBidders = validBids.filter(b => b.amount === highestAmount);

      let winner;
      let wasTie = false;
      let winningRoll = null;
      const rolls = [];

      if (topBidders.length === 1) {
        // Single highest bidder - no tie
        winner = topBidders[0];
      } else {
        // TIE! Generate rolls for each tied bidder
        wasTie = true;
        log.info(`Tie detected for auction ${auctionId}: ${topBidders.length} bidders at ${highestAmount} DKP`);

        for (const bidder of topBidders) {
          const roll = Math.floor(Math.random() * 100) + 1; // 1-100
          rolls.push({
            userId: bidder.user_id,
            characterName: bidder.character_name,
            characterClass: bidder.character_class,
            bidAmount: bidder.amount,
            roll
          });
        }

        // Sort by roll DESC, highest wins
        rolls.sort((a, b) => b.roll - a.roll);
        const winnerRollData = rolls[0];
        winner = topBidders.find(b => b.user_id === winnerRollData.userId);
        winningRoll = winnerRollData.roll;

        // Record all rolls in auction_rolls table
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

      // Record transaction
      const reason = wasTie
        ? `Won auction (roll ${winningRoll}): ${auction.item_name}`
        : `Won auction: ${auction.item_name}`;

      await tx.run(`
        INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, auction_id)
        VALUES (?, ?, ?, ?, ?)
      `, winner.user_id, -winner.amount, reason, req.user.userId, auctionId);

      // Update auction
      await tx.run(`
        UPDATE auctions
        SET status = 'completed', winner_id = ?, winning_bid = ?, ended_at = CURRENT_TIMESTAMP,
            was_tie = ?, winning_roll = ?
        WHERE id = ?
      `, winner.user_id, winner.amount, wasTie ? 1 : 0, winningRoll, auctionId);

      return {
        winner: {
          userId: winner.user_id,
          characterName: winner.character_name,
          characterClass: winner.character_class,
          amount: winner.amount
        },
        wasTie,
        winningRoll,
        rolls: wasTie ? rolls : []
      };
    });

    const eventData = {
      auctionId,
      itemName: auction.item_name,
      itemImage: auction.item_image,
      winnerId: result.winner?.userId || null,
      winningBid: result.winner?.amount || null,
      ...result
    };

    req.app.get('io').emit('auction_ended', eventData);
    return success(res, eventData);
  } catch (err) {
    log.error('End auction error', err);
    return error(res, 'Failed to end auction', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Cancel auction (officer+)
router.post('/:auctionId/cancel', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), validateParams({ auctionId: 'integer' }), async (req, res) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);

    await req.db.run(`
      UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'
    `, auctionId);

    req.app.get('io').emit('auction_cancelled', { auctionId });
    return success(res, null, 'Auction cancelled');
  } catch (err) {
    log.error('Cancel auction error', err);
    return error(res, 'Failed to cancel auction', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Cancel ALL active auctions (admin only) - for cleanup
router.post('/cancel-all', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await req.db.run(`
      UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE status = 'active'
    `);

    req.app.get('io').emit('auctions_cleared', { count: result.changes });
    return success(res, null, `Cancelled ${result.changes} active auctions`);
  } catch (err) {
    log.error('Cancel all auctions error', err);
    return error(res, 'Failed to cancel auctions', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get auction history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query);

    const totalRow = await req.db.get(`
      SELECT COUNT(*) as total FROM auctions WHERE status IN ('completed', 'cancelled')
    `);
    const total = totalRow.total;

    const auctions = await req.db.all(`
      SELECT a.id, a.item_name, a.item_image, a.item_rarity, a.item_id,
             a.status, a.winning_bid, a.created_at, a.ended_at,
             a.was_tie, a.winning_roll, a.farewell_data,
             creator.character_name as created_by_name,
             winner.character_name as winner_name,
             winner.character_class as winner_class
      FROM auctions a
      LEFT JOIN users creator ON a.created_by = creator.id
      LEFT JOIN users winner ON a.winner_id = winner.id
      WHERE a.status IN ('completed', 'cancelled')
      ORDER BY a.ended_at DESC
      LIMIT ? OFFSET ?
    `, limit, offset);

    if (auctions.length === 0) {
      return paginated(res, [], { limit, offset, total });
    }

    // Batch-load bid counts for all auctions (eliminates N+1)
    const auctionIds = auctions.map(a => a.id);
    const ph = auctionIds.map(() => '?').join(',');
    const bidCounts = await req.db.all(
      `SELECT auction_id, COUNT(*) as count FROM auction_bids WHERE auction_id IN (${ph}) GROUP BY auction_id`,
      ...auctionIds
    );
    const bidCountMap = new Map(bidCounts.map(r => [r.auction_id, r.count]));

    // Batch-load rolls for all tie auctions (eliminates N+1)
    const tieAuctionIds = auctions.filter(a => a.was_tie === 1).map(a => a.id);
    const rollsByAuction = new Map();
    if (tieAuctionIds.length > 0) {
      const tiePh = tieAuctionIds.map(() => '?').join(',');
      const allRolls = await req.db.all(`
        SELECT ar.auction_id, ar.bid_amount, ar.roll_result, ar.is_winner,
               u.character_name, u.character_class
        FROM auction_rolls ar
        JOIN users u ON ar.user_id = u.id
        WHERE ar.auction_id IN (${tiePh})
        ORDER BY ar.auction_id, ar.roll_result DESC
      `, ...tieAuctionIds);
      for (const r of allRolls) {
        if (!rollsByAuction.has(r.auction_id)) rollsByAuction.set(r.auction_id, []);
        rollsByAuction.get(r.auction_id).push({
          characterName: r.character_name,
          characterClass: r.character_class,
          bidAmount: r.bid_amount,
          roll: r.roll_result,
          isWinner: r.is_winner === 1
        });
      }
    }

    const formatted = auctions.map(a => {
      const entry = {
        id: a.id,
        item_name: a.item_name,
        item_image: a.item_image,
        item_rarity: a.item_rarity,
        item_id: a.item_id,
        status: a.status,
        winning_bid: a.winning_bid,
        created_at: a.created_at,
        ended_at: a.ended_at,
        was_tie: a.was_tie === 1,
        winning_roll: a.winning_roll,
        bid_count: bidCountMap.get(a.id) || 0,
        winner: a.winner_name ? {
          characterName: a.winner_name,
          characterClass: a.winner_class
        } : null
      };

      if (a.was_tie === 1) {
        entry.rolls = rollsByAuction.get(a.id) || [];
      }

      if (a.farewell_data) {
        try { entry.farewell = JSON.parse(a.farewell_data); } catch (_e) {}
      }
      return entry;
    });

    return paginated(res, formatted, { limit, offset, total });
  } catch (err) {
    log.error('Auction history error', err);
    return error(res, 'Failed to get auction history', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get rolls for a specific auction
router.get('/:auctionId/rolls', authenticateToken, validateParams({ auctionId: 'integer' }), async (req, res) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);

    const rolls = await req.db.all(`
      SELECT ar.bid_amount, ar.roll_result, ar.is_winner, ar.created_at,
             u.character_name, u.character_class
      FROM auction_rolls ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.auction_id = ?
      ORDER BY ar.roll_result DESC
    `, auctionId);

    return success(res, rolls.map(r => ({
      characterName: r.character_name,
      characterClass: r.character_class,
      bidAmount: r.bid_amount,
      roll: r.roll_result,
      isWinner: r.is_winner === 1,
      createdAt: r.created_at
    })));
  } catch (err) {
    log.error('Get auction rolls error', err);
    return error(res, 'Failed to get auction rolls', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get all bids for a specific auction (for history expansion)
router.get('/:auctionId/bids', authenticateToken, validateParams({ auctionId: 'integer' }), async (req, res) => {
  try {
    const auctionId = parseInt(req.params.auctionId, 10);

    const bids = await req.db.all(`
      SELECT ab.amount, ab.created_at, u.id as user_id, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    return success(res, bids.map(b => ({
      amount: b.amount,
      characterName: b.character_name,
      characterClass: b.character_class,
      userId: b.user_id,
      createdAt: b.created_at
    })));
  } catch (err) {
    log.error('Get auction bids error', err);
    return error(res, 'Failed to get auction bids', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
