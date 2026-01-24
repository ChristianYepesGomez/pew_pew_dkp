import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, initDatabase } from './database.js';
import { authenticateToken, authorizeRole } from './middleware/auth.js';
import { processWarcraftLog, isConfigured as isWCLConfigured } from './services/warcraftlogs.js';
import { getAllRaidItems, searchItems, getItemsByRaid, CURRENT_RAIDS } from './services/raidItems.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Serve static files (Frontend HTML)
app.use(express.static('public'));

// Make io accessible to routes
app.set('io', io);

// ============================================
// HEALTH CHECK (for Docker/Render)
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================
// AUTH ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, characterName, characterClass, role, raidRole, spec, server } = req.body;

    if (!username || !password || !characterName || !characterClass) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if username exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user (default role is 'raider')
    const result = db.prepare(`
      INSERT INTO users (username, password, character_name, character_class, role, raid_role, spec, server)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hashedPassword, characterName, characterClass, role || 'raider', raidRole || 'DPS', spec, server);

    // Create initial DKP record
    db.prepare(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent)
      VALUES (?, 0, 0, 0)
    `).run(result.lastInsertRowid);

    res.status(201).json({ 
      message: 'User registered successfully',
      userId: result.lastInsertRowid 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = db.prepare(`
      SELECT u.*, md.current_dkp 
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.username = ? AND u.is_active = 1
    `).get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        characterName: user.character_name,
        characterClass: user.character_class,
        role: user.role,
        currentDkp: user.current_dkp || 0
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Change own password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Get current user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, userId);

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Reset password (Admin only)
app.post('/api/auth/reset-password', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'User ID and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, userId);

    res.json({ message: `Password reset successfully for ${user.character_name}` });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.character_name, u.character_class, u.role, 
           md.current_dkp, md.lifetime_gained, md.lifetime_spent
    FROM users u
    LEFT JOIN member_dkp md ON u.id = md.user_id
    WHERE u.id = ?
  `).get(req.user.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    username: user.username,
    characterName: user.character_name,
    characterClass: user.character_class,
    role: user.role,
    currentDkp: user.current_dkp || 0,
    lifetimeGained: user.lifetime_gained || 0,
    lifetimeSpent: user.lifetime_spent || 0
  });
});

// ============================================
// MEMBER/ROSTER ROUTES
// ============================================

// Get all members with DKP (sorted by DKP descending)
app.get('/api/members', authenticateToken, (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.raid_role, u.spec,
           md.current_dkp, md.lifetime_gained, md.lifetime_spent
    FROM users u
    LEFT JOIN member_dkp md ON u.id = md.user_id
    WHERE u.is_active = 1
    ORDER BY md.current_dkp DESC
  `).all();

  res.json(members.map(m => ({
    id: m.id,
    username: m.username,
    characterName: m.character_name,
    characterClass: m.character_class,
    role: m.role,
    raidRole: m.raid_role,
    spec: m.spec,
    currentDkp: m.current_dkp || 0,
    lifetimeGained: m.lifetime_gained || 0,
    lifetimeSpent: m.lifetime_spent || 0
  })));
});

// Update member role (admin only)
app.put('/api/members/:id/role', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'officer', 'raider'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  
  io.emit('member_updated', { memberId: id });
  res.json({ message: 'Role updated successfully' });
});

// Deactivate member (admin only)
app.delete('/api/members/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { id } = req.params;
  
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
  
  io.emit('member_removed', { memberId: id });
  res.json({ message: 'Member deactivated' });
});

// ============================================
// DKP ROUTES
// ============================================

// Adjust DKP for single member (officer+)
app.post('/api/dkp/adjust', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { userId, amount, reason } = req.body;

  if (!userId || amount === undefined) {
    return res.status(400).json({ error: 'Missing userId or amount' });
  }

  const currentDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(userId);
  if (!currentDkp) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const newDkp = Math.max(0, currentDkp.current_dkp + amount);

  // Update DKP
  if (amount > 0) {
    db.prepare(`
      UPDATE member_dkp 
      SET current_dkp = ?, lifetime_gained = lifetime_gained + ?
      WHERE user_id = ?
    `).run(newDkp, amount, userId);
  } else {
    db.prepare(`
      UPDATE member_dkp SET current_dkp = ? WHERE user_id = ?
    `).run(newDkp, userId);
  }

  // Log the transaction
  db.prepare(`
    INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
    VALUES (?, ?, ?, ?)
  `).run(userId, amount, reason || 'Manual adjustment', req.user.userId);

  io.emit('dkp_updated', { userId, newDkp, amount });
  res.json({ message: 'DKP adjusted', newDkp });
});

// Bulk DKP adjustment (raid attendance, etc.)
app.post('/api/dkp/bulk-adjust', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { userIds, amount, reason } = req.body;

  if (!userIds || !Array.isArray(userIds) || amount === undefined) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const updateStmt = db.prepare(`
    UPDATE member_dkp 
    SET current_dkp = MAX(0, current_dkp + ?),
        lifetime_gained = CASE WHEN ? > 0 THEN lifetime_gained + ? ELSE lifetime_gained END
    WHERE user_id = ?
  `);

  const logStmt = db.prepare(`
    INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const userId of userIds) {
      updateStmt.run(amount, amount, amount, userId);
      logStmt.run(userId, amount, reason || 'Bulk adjustment', req.user.userId);
    }
  });

  transaction();

  io.emit('dkp_bulk_updated', { userIds, amount });
  res.json({ message: `DKP adjusted for ${userIds.length} members` });
});

// Apply DKP decay (admin only)
app.post('/api/dkp/decay', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { percentage } = req.body;

  if (!percentage || percentage <= 0 || percentage > 100) {
    return res.status(400).json({ error: 'Invalid decay percentage' });
  }

  const multiplier = 1 - (percentage / 100);

  db.prepare(`
    UPDATE member_dkp 
    SET current_dkp = CAST(current_dkp * ? AS INTEGER)
  `).run(multiplier);

  // Log decay event
  db.prepare(`
    INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
    SELECT user_id, -CAST(current_dkp * ? AS INTEGER), ?, ?
    FROM member_dkp
  `).run(percentage / 100, `DKP Decay ${percentage}%`, req.user.userId);

  io.emit('dkp_decay_applied', { percentage });
  res.json({ message: `${percentage}% DKP decay applied` });
});

// Get DKP history for a user
app.get('/api/dkp/history/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 50;

  // Get DKP stats
  const dkpStats = db.prepare(`
    SELECT current_dkp, lifetime_gained, lifetime_spent, last_decay_at
    FROM member_dkp
    WHERE user_id = ?
  `).get(userId);

  // Get transaction history
  const history = db.prepare(`
    SELECT dt.*, u.character_name, u.username
    FROM dkp_transactions dt
    LEFT JOIN users u ON dt.performed_by = u.id
    WHERE dt.user_id = ?
    ORDER BY dt.created_at DESC
    LIMIT ?
  `).all(userId, limit);

  res.json({
    currentDkp: dkpStats?.current_dkp || 0,
    lifetimeGained: dkpStats?.lifetime_gained || 0,
    lifetimeSpent: dkpStats?.lifetime_spent || 0,
    lastDecay: dkpStats?.last_decay_at,
    transactions: history.map(h => ({
      id: h.id,
      userId: h.user_id,
      amount: h.amount,
      reason: h.reason,
      performedBy: h.performed_by,
      characterName: h.character_name,
      username: h.username,
      createdAt: h.created_at
    }))
  });
});

// ============================================
// CALENDAR ROUTES
// ============================================

// Get configured raid days
app.get('/api/calendar/raid-days', authenticateToken, (req, res) => {
  const raidDays = db.prepare(`
    SELECT day_of_week, day_name, is_active, raid_time
    FROM raid_days
    WHERE is_active = 1
    ORDER BY day_of_week
  `).all();

  res.json(raidDays);
});

// Get user's availability for a specific week
app.get('/api/calendar/my-availability/:week_start', authenticateToken, (req, res) => {
  const { week_start } = req.params;
  const userId = req.user.userId;

  const availability = db.prepare(`
    SELECT ma.day_of_week, ma.status, ma.notes, ma.updated_at, rd.day_name, rd.raid_time
    FROM member_availability ma
    JOIN raid_days rd ON ma.day_of_week = rd.day_of_week
    WHERE ma.user_id = ? AND ma.week_start = ? AND rd.is_active = 1
    ORDER BY ma.day_of_week
  `).all(userId, week_start);

  // Get all raid days and merge with user's availability
  const raidDays = db.prepare(`
    SELECT day_of_week, day_name, raid_time
    FROM raid_days
    WHERE is_active = 1
    ORDER BY day_of_week
  `).all();

  const result = raidDays.map(day => {
    const userAvail = availability.find(a => a.day_of_week === day.day_of_week);
    return {
      dayOfWeek: day.day_of_week,
      dayName: day.day_name,
      raidTime: day.raid_time,
      status: userAvail?.status || 'tentative',
      notes: userAvail?.notes || null,
      updatedAt: userAvail?.updated_at || null
    };
  });

  res.json(result);
});

// Update user's availability for a specific day
app.put('/api/calendar/availability', authenticateToken, (req, res) => {
  const { week_start, day_of_week, status, notes } = req.body;
  const userId = req.user.userId;

  if (!week_start || !day_of_week || !status) {
    return res.status(400).json({ error: 'week_start, day_of_week, and status are required' });
  }

  if (!['confirmed', 'declined', 'tentative'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: confirmed, declined, or tentative' });
  }

  // Verify that the day is a valid raid day
  const raidDay = db.prepare('SELECT * FROM raid_days WHERE day_of_week = ? AND is_active = 1').get(day_of_week);
  if (!raidDay) {
    return res.status(400).json({ error: 'Invalid raid day' });
  }

  // Upsert availability
  db.prepare(`
    INSERT INTO member_availability (user_id, week_start, day_of_week, status, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, week_start, day_of_week)
    DO UPDATE SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
  `).run(userId, week_start, day_of_week, status, notes || null, status, notes || null);

  // Check if user completed all days for the week
  const completedDays = db.prepare(`
    SELECT COUNT(*) as count
    FROM member_availability ma
    JOIN raid_days rd ON ma.day_of_week = rd.day_of_week
    WHERE ma.user_id = ? AND ma.week_start = ? AND rd.is_active = 1
  `).get(userId, week_start);

  const totalRaidDays = db.prepare('SELECT COUNT(*) as count FROM raid_days WHERE is_active = 1').get();

  let dkpAwarded = 0;
  if (completedDays.count === totalRaidDays.count) {
    // User completed all days - award DKP if not already awarded
    const existingReward = db.prepare(`
      SELECT * FROM calendar_dkp_rewards WHERE user_id = ? AND week_start = ?
    `).get(userId, week_start);

    if (!existingReward) {
      const dkpPerDay = parseInt(db.prepare(
        "SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'"
      ).get()?.config_value || 1);

      dkpAwarded = completedDays.count * dkpPerDay;

      // Award DKP
      db.prepare(`
        UPDATE member_dkp
        SET current_dkp = current_dkp + ?,
            lifetime_gained = lifetime_gained + ?
        WHERE user_id = ?
      `).run(dkpAwarded, dkpAwarded, userId);

      // Log transaction
      db.prepare(`
        INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
        VALUES (?, ?, ?, ?)
      `).run(userId, dkpAwarded, `Calendario completado: semana del ${week_start}`, userId);

      // Record reward
      db.prepare(`
        INSERT INTO calendar_dkp_rewards (user_id, week_start, days_completed, dkp_awarded)
        VALUES (?, ?, ?, ?)
      `).run(userId, week_start, completedDays.count, dkpAwarded);

      io.emit('dkp_updated', { userId, amount: dkpAwarded, reason: 'calendar_completed' });
    }
  }

  res.json({
    message: 'Availability updated',
    completed: completedDays.count === totalRaidDays.count,
    dkpAwarded
  });
});

// Get week overview (admin/officer only)
app.get('/api/calendar/week-overview/:week_start', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { week_start } = req.params;

  // Get all raid days
  const raidDays = db.prepare(`
    SELECT day_of_week, day_name, raid_time
    FROM raid_days
    WHERE is_active = 1
    ORDER BY day_of_week
  `).all();

  // Get all active users
  const users = db.prepare(`
    SELECT id, character_name, character_class, raid_role
    FROM users
    WHERE is_active = 1
    ORDER BY character_name
  `).all();

  // Get all availability for this week
  const availability = db.prepare(`
    SELECT user_id, day_of_week, status
    FROM member_availability
    WHERE week_start = ?
  `).all(week_start);

  // Build overview
  const overview = {
    weekStart: week_start,
    raidDays: raidDays.map(day => ({
      dayOfWeek: day.day_of_week,
      dayName: day.day_name,
      raidTime: day.raid_time,
      confirmed: 0,
      declined: 0,
      tentative: 0,
      noResponse: 0
    })),
    members: users.map(user => {
      const userAvailability = {};
      raidDays.forEach(day => {
        const avail = availability.find(a => a.user_id === user.id && a.day_of_week === day.day_of_week);
        userAvailability[day.day_of_week] = avail?.status || 'no_response';
      });

      return {
        id: user.id,
        characterName: user.character_name,
        characterClass: user.character_class,
        raidRole: user.raid_role,
        availability: userAvailability
      };
    })
  };

  // Calculate counts per day
  raidDays.forEach((day, index) => {
    overview.members.forEach(member => {
      const status = member.availability[day.day_of_week];
      if (status === 'confirmed') overview.raidDays[index].confirmed++;
      else if (status === 'declined') overview.raidDays[index].declined++;
      else if (status === 'tentative') overview.raidDays[index].tentative++;
      else overview.raidDays[index].noResponse++;
    });
  });

  res.json(overview);
});

// ============================================
// AUCTION ROUTES
// ============================================

// Get all active auctions
app.get('/api/auctions/active', authenticateToken, (req, res) => {
  const auctions = db.prepare(`
    SELECT a.*, u.character_name as created_by_name
    FROM auctions a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.status = 'active'
    ORDER BY a.created_at DESC
  `).all();

  if (auctions.length === 0) {
    return res.json({ auctions: [] });
  }

  // Get bids for all active auctions
  const auctionsWithBids = auctions.map(auction => {
    const bids = db.prepare(`
      SELECT ab.*, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `).all(auction.id);

    const highestBid = bids.length > 0 ? bids[0].amount : 0;

    return {
      id: auction.id,
      itemName: auction.item_name,
      itemImage: auction.item_image,
      itemRarity: auction.item_rarity,
      minimumBid: auction.min_bid,
      currentBid: highestBid,
      status: auction.status,
      winnerId: auction.winner_id,
      winningBid: auction.winning_bid,
      createdBy: auction.created_by,
      createdByName: auction.created_by_name,
      createdAt: auction.created_at,
      endedAt: auction.ended_at,
      bidsCount: bids.length,
      bids: bids.map(b => ({
        id: b.id,
        userId: b.user_id,
        characterName: b.character_name,
        characterClass: b.character_class,
        amount: b.amount,
        createdAt: b.created_at
      }))
    };
  });

  res.json({ auctions: auctionsWithBids });
});

// Create new auction (officer+)
app.post('/api/auctions', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { itemName, itemNameEN, itemImage, minBid, itemRarity, itemId } = req.body;

  if (!itemName) {
    return res.status(400).json({ error: 'Item name is required' });
  }

  // Multiple active auctions are now allowed
  const result = db.prepare(`
    INSERT INTO auctions (item_name, item_name_en, item_image, item_rarity, min_bid, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(itemName, itemNameEN || itemName, itemImage || '🎁', itemRarity || 'epic', minBid || 0, req.user.userId);

  const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(result.lastInsertRowid);

  io.emit('auction_started', auction);
  res.status(201).json(auction);
});

// Place bid
app.post('/api/auctions/:auctionId/bid', authenticateToken, (req, res) => {
  const { auctionId } = req.params;
  const { amount } = req.body;
  const userId = req.user.userId;

  // Validate auction
  const auction = db.prepare('SELECT * FROM auctions WHERE id = ? AND status = ?').get(auctionId, 'active');
  if (!auction) {
    return res.status(404).json({ error: 'Active auction not found' });
  }

  // Validate amount
  if (amount < auction.min_bid) {
    return res.status(400).json({ error: `Bid must be at least ${auction.min_bid} DKP` });
  }

  // Check user's DKP
  const userDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(userId);
  if (!userDkp || userDkp.current_dkp < amount) {
    return res.status(400).json({ error: 'Insufficient DKP' });
  }

  // Check if higher bid exists
  const highestBid = db.prepare(`
    SELECT MAX(amount) as max_bid FROM auction_bids WHERE auction_id = ?
  `).get(auctionId);

  if (highestBid && highestBid.max_bid >= amount) {
    return res.status(400).json({ error: 'Bid must be higher than current highest bid' });
  }

  // Remove previous bid from this user if exists
  db.prepare('DELETE FROM auction_bids WHERE auction_id = ? AND user_id = ?').run(auctionId, userId);

  // Place new bid
  db.prepare(`
    INSERT INTO auction_bids (auction_id, user_id, amount)
    VALUES (?, ?, ?)
  `).run(auctionId, userId, amount);

  const user = db.prepare('SELECT character_name, character_class FROM users WHERE id = ?').get(userId);

  io.emit('bid_placed', {
    auctionId,
    userId,
    characterName: user.character_name,
    characterClass: user.character_class,
    amount
  });

  res.json({ message: 'Bid placed successfully' });
});

// End auction (officer+)
app.post('/api/auctions/:auctionId/end', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { auctionId } = req.params;

  const auction = db.prepare('SELECT * FROM auctions WHERE id = ? AND status = ?').get(auctionId, 'active');
  if (!auction) {
    return res.status(404).json({ error: 'Active auction not found' });
  }

  // Get winning bid
  const winningBid = db.prepare(`
    SELECT ab.*, u.character_name, u.character_class
    FROM auction_bids ab
    JOIN users u ON ab.user_id = u.id
    WHERE ab.auction_id = ?
    ORDER BY ab.amount DESC
    LIMIT 1
  `).get(auctionId);

  const transaction = db.transaction(() => {
    if (winningBid) {
      // Deduct DKP from winner
      db.prepare(`
        UPDATE member_dkp 
        SET current_dkp = current_dkp - ?,
            lifetime_spent = lifetime_spent + ?
        WHERE user_id = ?
      `).run(winningBid.amount, winningBid.amount, winningBid.user_id);

      // Log transaction
      db.prepare(`
        INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
        VALUES (?, ?, ?, ?)
      `).run(winningBid.user_id, -winningBid.amount, `Won auction: ${auction.item_name}`, req.user.userId);

      // Update auction
      db.prepare(`
        UPDATE auctions 
        SET status = 'completed', winner_id = ?, winning_bid = ?, ended_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(winningBid.user_id, winningBid.amount, auctionId);
    } else {
      // No bids - cancel auction
      db.prepare(`
        UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(auctionId);
    }
  });

  transaction();

  const result = {
    auctionId,
    itemName: auction.item_name,
    winner: winningBid ? {
      userId: winningBid.user_id,
      characterName: winningBid.character_name,
      characterClass: winningBid.character_class,
      amount: winningBid.amount
    } : null
  };

  io.emit('auction_ended', result);
  res.json(result);
});

// Cancel auction (officer+)
app.post('/api/auctions/:auctionId/cancel', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { auctionId } = req.params;

  db.prepare(`
    UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'
  `).run(auctionId);

  io.emit('auction_cancelled', { auctionId });
  res.json({ message: 'Auction cancelled' });
});

// Get all raid items
app.get('/api/raid-items', authenticateToken, (req, res) => {
  const items = getAllRaidItems();
  res.json({ items });
});

// Search raid items
app.get('/api/raid-items/search', authenticateToken, (req, res) => {
  const query = req.query.q || '';
  const items = query ? searchItems(query) : getAllRaidItems();
  res.json({ items });
});

// Get items by raid
app.get('/api/raid-items/:raidName', authenticateToken, (req, res) => {
  const { raidName } = req.params;
  const items = getItemsByRaid(raidName);
  res.json({ items });
});

// Get all raids
app.get('/api/raids-list', authenticateToken, (req, res) => {
  const raids = Object.keys(CURRENT_RAIDS).map(name => ({
    name,
    bosses: Object.keys(CURRENT_RAIDS[name].bosses)
  }));
  res.json({ raids });
});

// Get auction history
app.get('/api/auctions/history', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  const auctions = db.prepare(`
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
  `).all(limit);

  res.json(auctions);
});

// ============================================
// RAID ROUTES
// ============================================

// Create raid event (officer+)
app.post('/api/raids', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { name, scheduledAt, dkpReward } = req.body;

  const result = db.prepare(`
    INSERT INTO raids (name, scheduled_at, dkp_reward, created_by)
    VALUES (?, ?, ?, ?)
  `).run(name, scheduledAt, dkpReward || 10, req.user.userId);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Raid created' });
});

// Record attendance
app.post('/api/raids/:raidId/attendance', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { raidId } = req.params;
  const { attendees } = req.body; // Array of user IDs

  const raid = db.prepare('SELECT * FROM raids WHERE id = ?').get(raidId);
  if (!raid) {
    return res.status(404).json({ error: 'Raid not found' });
  }

  const insertAttendance = db.prepare(`
    INSERT OR IGNORE INTO raid_attendance (raid_id, user_id) VALUES (?, ?)
  `);

  const updateDkp = db.prepare(`
    UPDATE member_dkp 
    SET current_dkp = current_dkp + ?,
        lifetime_gained = lifetime_gained + ?
    WHERE user_id = ?
  `);

  const logTransaction = db.prepare(`
    INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const userId of attendees) {
      insertAttendance.run(raidId, userId);
      updateDkp.run(raid.dkp_reward, raid.dkp_reward, userId);
      logTransaction.run(userId, raid.dkp_reward, `Raid attendance: ${raid.name}`, req.user.userId);
    }
  });

  transaction();

  io.emit('attendance_recorded', { raidId, attendees, dkpReward: raid.dkp_reward });
  res.json({ message: `Attendance recorded for ${attendees.length} members` });
});

// ============================================
// IMPORT ROUTES
// ============================================

// Import roster from CSV (admin only)
app.post('/api/import/roster', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { members } = req.body;

  if (!members || !Array.isArray(members)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, character_name, character_class, raid_role, role)
    VALUES (?, ?, ?, ?, ?, 'raider')
  `);

  const insertDkp = db.prepare(`
    INSERT OR IGNORE INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent)
    VALUES (?, ?, ?, 0)
  `);

  let imported = 0;
  const defaultPassword = bcrypt.hashSync('changeme123', 10);

  const transaction = db.transaction(() => {
    for (const member of members) {
      const result = insertUser.run(
        member.username || member.characterName.toLowerCase(),
        defaultPassword,
        member.characterName,
        member.characterClass,
        member.raidRole || 'DPS'
      );
      
      if (result.changes > 0) {
        insertDkp.run(result.lastInsertRowid, member.dkp || 0, member.dkp || 0);
        imported++;
      }
    }
  });

  transaction();

  res.json({ message: `Imported ${imported} members` });
});

// ============================================
// WARCRAFT LOGS ROUTES
// ============================================

// Get DKP configuration
app.get('/api/warcraftlogs/config', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const configs = db.prepare('SELECT * FROM dkp_config').all();

  const configObj = {};
  for (const config of configs) {
    configObj[config.config_key] = {
      value: config.config_value,
      description: config.description,
      updatedAt: config.updated_at
    };
  }

  res.json({
    configured: isWCLConfigured(),
    config: configObj
  });
});

// Update DKP configuration
app.put('/api/warcraftlogs/config', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { config_key, config_value } = req.body;

  if (!config_key || config_value === undefined) {
    return res.status(400).json({ error: 'config_key and config_value required' });
  }

  db.prepare(`
    UPDATE dkp_config
    SET config_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
    WHERE config_key = ?
  `).run(config_value, req.user.userId, config_key);

  res.json({ message: 'Configuration updated', config_key, config_value });
});

// Preview Warcraft Logs report (before confirming DKP assignment)
app.post('/api/warcraftlogs/preview', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }

    if (!isWCLConfigured()) {
      return res.status(503).json({
        error: 'Warcraft Logs API not configured. Please set credentials in .env'
      });
    }

    // Process the log from Warcraft Logs API
    const reportData = await processWarcraftLog(url);

    // Get DKP configuration
    const raidDKP = parseInt(db.prepare(
      "SELECT config_value FROM dkp_config WHERE config_key = 'raid_attendance_dkp'"
    ).get()?.config_value || 50);

    const bossBonus = parseInt(db.prepare(
      "SELECT config_value FROM dkp_config WHERE config_key = 'boss_kill_bonus'"
    ).get()?.config_value || 10);

    const defaultServer = db.prepare(
      "SELECT config_value FROM dkp_config WHERE config_key = 'default_server'"
    ).get()?.config_value || 'Unknown';

    // Match participants with database users
    const matchResults = [];
    const anomalies = [];

    for (const participant of reportData.participants) {
      // Try to find user by character_name (case insensitive)
      const user = db.prepare(`
        SELECT u.id, u.username, u.character_name, u.server, md.current_dkp
        FROM users u
        LEFT JOIN member_dkp md ON u.id = md.user_id
        WHERE LOWER(u.character_name) = LOWER(?) AND u.is_active = 1
      `).get(participant.name);

      if (user) {
        // Check if server matches (if user has server configured)
        const serverMatch = !user.server ||
                           user.server.toLowerCase() === participant.server.toLowerCase() ||
                           participant.server === 'Unknown';

        matchResults.push({
          wcl_name: participant.name,
          wcl_server: participant.server,
          wcl_class: participant.class,
          matched: true,
          user_id: user.id,
          username: user.username,
          character_name: user.character_name,
          current_dkp: user.current_dkp,
          server_match: serverMatch,
          dkp_to_assign: raidDKP + (reportData.bossesKilled * bossBonus)
        });

        if (!serverMatch) {
          anomalies.push({
            type: 'server_mismatch',
            message: `${participant.name}: Servidor en WCL (${participant.server}) no coincide con BD (${user.server})`,
            participant: participant.name
          });
        }
      } else {
        // No match found
        matchResults.push({
          wcl_name: participant.name,
          wcl_server: participant.server,
          wcl_class: participant.class,
          matched: false,
          user_id: null,
          username: null,
          character_name: null,
          current_dkp: null,
          server_match: false,
          dkp_to_assign: 0
        });

        anomalies.push({
          type: 'not_found',
          message: `${participant.name} (${participant.server}) no encontrado en la base de datos`,
          participant: participant.name
        });
      }
    }

    const matchedCount = matchResults.filter(r => r.matched).length;
    const totalDKP = matchResults.reduce((sum, r) => sum + r.dkp_to_assign, 0);

    res.json({
      report: {
        code: reportData.code,
        title: reportData.title,
        startTime: reportData.startTime,
        endTime: reportData.endTime,
        duration: Math.floor(reportData.duration / 60000), // minutes
        region: reportData.region,
        guildName: reportData.guildName,
        participantCount: reportData.participantCount,
        bossesKilled: reportData.bossesKilled,
        totalBosses: reportData.totalBosses,
        totalAttempts: reportData.totalAttempts,
        bosses: reportData.bosses
      },
      dkp_calculation: {
        base_dkp: raidDKP,
        boss_bonus: bossBonus,
        bosses_killed: reportData.bossesKilled,
        dkp_per_player: raidDKP + (reportData.bossesKilled * bossBonus),
        total_dkp_to_assign: totalDKP
      },
      participants: matchResults,
      summary: {
        total_participants: reportData.participantCount,
        matched: matchedCount,
        not_matched: reportData.participantCount - matchedCount,
        anomalies_count: anomalies.length
      },
      anomalies,
      can_proceed: true // Always allow processing, even without matched players
    });

  } catch (error) {
    console.error('Error previewing Warcraft Log:', error);
    res.status(500).json({
      error: 'Failed to process Warcraft Log',
      message: error.message
    });
  }
});

// Confirm and assign DKP from Warcraft Logs report
app.post('/api/warcraftlogs/confirm', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { reportCode, participants } = req.body;

    if (!reportCode || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ error: 'reportCode and participants array required' });
    }

    // Check if already processed
    const alreadyProcessed = db.prepare(
      'SELECT * FROM warcraft_logs_processed WHERE report_code = ?'
    ).get(reportCode);

    if (alreadyProcessed) {
      return res.status(409).json({
        error: 'This report has already been processed'
      });
    }

    // Filter only matched participants
    const matchedParticipants = participants.filter(p => p.matched && p.user_id);

    if (matchedParticipants.length === 0) {
      return res.status(400).json({ error: 'No matched participants to assign DKP' });
    }

    // Get report title from first preview (or default)
    const reportTitle = req.body.reportTitle || `Raid ${reportCode}`;
    const startTime = req.body.startTime || Date.now();
    const endTime = req.body.endTime || Date.now();

    // Transaction: assign DKP and log everything
    const transaction = db.transaction(() => {
      let totalAssigned = 0;

      for (const participant of matchedParticipants) {
        const dkpAmount = participant.dkp_to_assign;

        // Update DKP
        db.prepare(`
          UPDATE member_dkp
          SET current_dkp = current_dkp + ?,
              lifetime_gained = lifetime_gained + ?
          WHERE user_id = ?
        `).run(dkpAmount, dkpAmount, participant.user_id);

        // Log transaction
        db.prepare(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `).run(
          participant.user_id,
          dkpAmount,
          `Warcraft Logs: ${reportTitle}`,
          req.user.userId
        );

        totalAssigned += dkpAmount;

        // Emit WebSocket event
        const newDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?')
          .get(participant.user_id)?.current_dkp || 0;

        io.emit('dkp_updated', {
          userId: participant.user_id,
          newDkp,
          amount: dkpAmount
        });
      }

      // Mark report as processed
      db.prepare(`
        INSERT INTO warcraft_logs_processed
        (report_code, report_title, start_time, end_time, region, guild_name, participants_count, dkp_assigned, processed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reportCode,
        reportTitle,
        startTime,
        endTime,
        req.body.region || 'Unknown',
        req.body.guildName || null,
        matchedParticipants.length,
        totalAssigned,
        req.user.userId
      );

      return totalAssigned;
    });

    const totalDKP = transaction();

    res.json({
      message: 'DKP assigned successfully from Warcraft Logs',
      report_code: reportCode,
      participants_count: matchedParticipants.length,
      total_dkp_assigned: totalDKP
    });

  } catch (error) {
    console.error('Error confirming Warcraft Log:', error);
    res.status(500).json({
      error: 'Failed to assign DKP',
      message: error.message
    });
  }
});

// Get history of processed Warcraft Logs reports
app.get('/api/warcraftlogs/history', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  const history = db.prepare(`
    SELECT wlp.*, u.character_name as processed_by_name
    FROM warcraft_logs_processed wlp
    LEFT JOIN users u ON wlp.processed_by = u.id
    ORDER BY wlp.processed_at DESC
    LIMIT ?
  `).all(limit);

  res.json(history);
});

// ============================================
// WEBSOCKET HANDLING
// ============================================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_guild', (guildId) => {
    socket.join(`guild_${guildId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ============================================
// START SERVER
// ============================================

initDatabase();

server.listen(PORT, () => {
  console.log(`🎮 DKP Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for real-time updates`);
});

export { app, io };
