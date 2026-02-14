import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter, userLimiter } from '../lib/rateLimiters.js';
import { scheduleAuctionClose, SNIPE_THRESHOLD_MS, SNIPE_EXTENSION_MS } from '../lib/auctionScheduler.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Auctions');
const router = Router();

// Get all active auctions
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const auctions = await db.all(`
      SELECT a.*, u.character_name as created_by_name
      FROM auctions a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.status = 'active'
      ORDER BY a.created_at DESC
    `);

    if (auctions.length === 0) {
      return res.json({ auctions: [] });
    }

    const auctionsWithBids = await Promise.all(auctions.map(async (auction) => {
      const bids = await db.all(`
        SELECT ab.*, u.character_name, u.character_class
        FROM auction_bids ab
        JOIN users u ON ab.user_id = u.id
        WHERE ab.auction_id = ?
        ORDER BY ab.amount DESC
      `, auction.id);

      const highestBid = bids.length > 0 ? bids[0].amount : 0;
      const highestBidder = bids.length > 0 ? bids[0] : null;

      // Check for ties at highest bid
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
    }));

    const userId = req.user.userId;
    const userDkp = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    const committedBids = await db.get(`
      SELECT COALESCE(SUM(ab.amount), 0) as total
      FROM auction_bids ab
      JOIN auctions a ON ab.auction_id = a.id
      WHERE ab.user_id = ? AND a.status = 'active'
      AND ab.amount = (
        SELECT MAX(ab2.amount) FROM auction_bids ab2
        WHERE ab2.auction_id = ab.auction_id
      )
    `, userId);

    const availableDkp = (userDkp?.current_dkp || 0) - (committedBids?.total || 0);

    res.json({ auctions: auctionsWithBids, availableDkp });
  } catch (error) {
    log.error('Get active auctions error', error);
    res.status(500).json({ error: 'Failed to get active auctions' });
  }
});

// Create new auction (officer+)
router.post('/', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { itemName, itemNameEN, itemImage, minBid, itemRarity, itemId, durationMinutes } = req.body;

    if (!itemName) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const duration = durationMinutes || 5;
    const endsAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

    const result = await db.run(`
      INSERT INTO auctions (item_name, item_name_en, item_image, item_rarity, min_bid, created_by, status, duration_minutes, ends_at, item_id)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `, itemName, itemNameEN || itemName, itemImage || '\uD83C\uDF81', itemRarity || 'epic', minBid || 0, req.user.userId, duration, endsAt, itemId || null);

    const auction = await db.get('SELECT * FROM auctions WHERE id = ?', result.lastInsertRowid);

    // Schedule auto-close using centralized function (enables anti-snipe rescheduling)
    scheduleAuctionClose(auction.id, new Date(endsAt).getTime());

    req.app.get('io').emit('auction_started', auction);
    res.status(201).json(auction);
  } catch (error) {
    log.error('Create auction error', error);
    res.status(500).json({ error: 'Failed to create auction' });
  }
});

// Place bid
router.post('/:auctionId/bid', userLimiter, authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { amount } = req.body;
    const userId = req.user.userId;

    const auction = await db.get('SELECT * FROM auctions WHERE id = ? AND status = ?', auctionId, 'active');
    if (!auction) {
      return res.status(404).json({ error: 'Active auction not found' });
    }

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Bid must be at least 1 DKP' });
    }

    const userDkp = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    if (!userDkp) {
      return res.status(400).json({ error: 'Insufficient DKP' });
    }

    const committedBids = await db.get(`
      SELECT COALESCE(SUM(ab.amount), 0) as total
      FROM auction_bids ab
      JOIN auctions a ON ab.auction_id = a.id
      WHERE ab.user_id = ? AND a.status = 'active' AND a.id != ?
      AND ab.amount = (
        SELECT MAX(ab2.amount) FROM auction_bids ab2
        WHERE ab2.auction_id = ab.auction_id
      )
    `, userId, auctionId);

    const availableDkp = userDkp.current_dkp - (committedBids?.total || 0);
    if (availableDkp < amount) {
      return res.status(400).json({ error: 'Insufficient DKP (accounting for your bids on other active auctions)' });
    }

    // Atomic bid placement: validate + delete old + insert new in one transaction
    const bidResult = await db.transaction(async (tx) => {
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

    const user = await db.get('SELECT character_name, character_class FROM users WHERE id = ?', userId);

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
      // Extend the auction by 30 seconds
      newEndsAt = new Date(endsAt + SNIPE_EXTENSION_MS).toISOString();
      await db.run('UPDATE auctions SET ends_at = ? WHERE id = ?', newEndsAt, auctionId);
      scheduleAuctionClose(auctionId, new Date(newEndsAt).getTime());
      timeExtended = true;
      log.info(`Anti-snipe: Auction ${auctionId} extended to ${newEndsAt}`);
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

    res.json({ message: 'Bid placed successfully', timeExtended, newEndsAt });
  } catch (error) {
    if (error.message === 'Bid must be higher than current highest bid') {
      return res.status(400).json({ error: error.message });
    }
    log.error('Place bid error', error);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// End auction (officer+) - with tie-breaking rolls
router.post('/:auctionId/end', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { auctionId } = req.params;

    const auction = await db.get('SELECT * FROM auctions WHERE id = ? AND status = ?', auctionId, 'active');
    if (!auction) {
      return res.status(404).json({ error: 'Active auction not found' });
    }

    const allBids = await db.all(`
      SELECT ab.*, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    const result = await db.transaction(async (tx) => {
      // Find valid bids (bidders with enough DKP)
      const validBids = [];
      for (const bid of allBids) {
        const bidderDkp = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', bid.user_id);
        if (bidderDkp && bidderDkp.current_dkp >= bid.amount) {
          validBids.push({ ...bid, currentDkp: bidderDkp.current_dkp });
        }
      }

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
    res.json(eventData);
  } catch (error) {
    log.error('End auction error', error);
    res.status(500).json({ error: 'Failed to end auction' });
  }
});

// Cancel auction (officer+)
router.post('/:auctionId/cancel', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { auctionId } = req.params;

    await db.run(`
      UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'
    `, auctionId);

    req.app.get('io').emit('auction_cancelled', { auctionId });
    res.json({ message: 'Auction cancelled' });
  } catch (error) {
    log.error('Cancel auction error', error);
    res.status(500).json({ error: 'Failed to cancel auction' });
  }
});

// Cancel ALL active auctions (admin only) - for cleanup
router.post('/cancel-all', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await db.run(`
      UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE status = 'active'
    `);

    req.app.get('io').emit('auctions_cleared', { count: result.changes });
    res.json({ message: `Cancelled ${result.changes} active auctions` });
  } catch (error) {
    log.error('Cancel all auctions error', error);
    res.status(500).json({ error: 'Failed to cancel auctions' });
  }
});

// Get auction history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const auctions = await db.all(`
      SELECT a.*,
             creator.character_name as created_by_name,
             winner.character_name as winner_name,
             winner.character_class as winner_class
      FROM auctions a
      LEFT JOIN users creator ON a.created_by = creator.id
      LEFT JOIN users winner ON a.winner_id = winner.id
      WHERE a.status IN ('completed', 'cancelled')
      ORDER BY a.ended_at DESC
      LIMIT ?
    `, limit);

    const formatted = await Promise.all(auctions.map(async a => {
      // Get bid count for expandable history
      const bidCount = await db.get('SELECT COUNT(*) as count FROM auction_bids WHERE auction_id = ?', a.id);

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
        bid_count: bidCount?.count || 0,
        winner: a.winner_name ? {
          characterName: a.winner_name,
          characterClass: a.winner_class
        } : null
      };

      // If it was a tie, include the rolls
      if (a.was_tie === 1) {
        const rolls = await db.all(`
          SELECT ar.*, u.character_name, u.character_class
          FROM auction_rolls ar
          JOIN users u ON ar.user_id = u.id
          WHERE ar.auction_id = ?
          ORDER BY ar.roll_result DESC
        `, a.id);

        entry.rolls = rolls.map(r => ({
          characterName: r.character_name,
          characterClass: r.character_class,
          bidAmount: r.bid_amount,
          roll: r.roll_result,
          isWinner: r.is_winner === 1
        }));
      }

      if (a.farewell_data) {
        try { entry.farewell = JSON.parse(a.farewell_data); } catch (_e) {}
      }
      return entry;
    }));

    res.json(formatted);
  } catch (error) {
    log.error('Auction history error', error);
    res.status(500).json({ error: 'Failed to get auction history' });
  }
});

// Get rolls for a specific auction
router.get('/:auctionId/rolls', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.params;

    const rolls = await db.all(`
      SELECT ar.*, u.character_name, u.character_class
      FROM auction_rolls ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.auction_id = ?
      ORDER BY ar.roll_result DESC
    `, auctionId);

    res.json(rolls.map(r => ({
      characterName: r.character_name,
      characterClass: r.character_class,
      bidAmount: r.bid_amount,
      roll: r.roll_result,
      isWinner: r.is_winner === 1,
      createdAt: r.created_at
    })));
  } catch (error) {
    log.error('Get auction rolls error', error);
    res.status(500).json({ error: 'Failed to get auction rolls' });
  }
});

// Get all bids for a specific auction (for history expansion)
router.get('/:auctionId/bids', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.params;

    const bids = await db.all(`
      SELECT ab.amount, ab.created_at, u.id as user_id, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    res.json(bids.map(b => ({
      amount: b.amount,
      characterName: b.character_name,
      characterClass: b.character_class,
      userId: b.user_id,
      createdAt: b.created_at
    })));
  } catch (error) {
    log.error('Get auction bids error', error);
    res.status(500).json({ error: 'Failed to get auction bids' });
  }
});

export default router;
