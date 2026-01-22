import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, initDatabase } from './database.js';
import { authenticateToken, authorizeRole } from './middleware/auth.js';
import { authenticateBot } from './middleware/botAuth.js';

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
    const { username, password, characterName, characterClass, role } = req.body;

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
      INSERT INTO users (username, password, character_name, character_class, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashedPassword, characterName, characterClass, role || 'raider');

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
    SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.raid_role,
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

  const history = db.prepare(`
    SELECT dt.*, u.character_name as performed_by_name
    FROM dkp_transactions dt
    LEFT JOIN users u ON dt.performed_by = u.id
    WHERE dt.user_id = ?
    ORDER BY dt.created_at DESC
    LIMIT ?
  `).all(userId, limit);

  res.json(history);
});

// ============================================
// AUCTION ROUTES
// ============================================

// Get active auction
app.get('/api/auctions/active', authenticateToken, (req, res) => {
  const auction = db.prepare(`
    SELECT a.*, u.character_name as created_by_name
    FROM auctions a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.status = 'active'
    ORDER BY a.created_at DESC
    LIMIT 1
  `).get();

  if (!auction) {
    return res.json(null);
  }

  const bids = db.prepare(`
    SELECT ab.*, u.character_name, u.character_class
    FROM auction_bids ab
    JOIN users u ON ab.user_id = u.id
    WHERE ab.auction_id = ?
    ORDER BY ab.amount DESC
  `).all(auction.id);

  res.json({
    ...auction,
    bids: bids.map(b => ({
      id: b.id,
      userId: b.user_id,
      characterName: b.character_name,
      characterClass: b.character_class,
      amount: b.amount,
      createdAt: b.created_at
    }))
  });
});

// Create new auction (officer+)
app.post('/api/auctions', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { itemName, itemImage, minBid, itemRarity } = req.body;

  if (!itemName) {
    return res.status(400).json({ error: 'Item name is required' });
  }

  // Check for existing active auction
  const activeAuction = db.prepare('SELECT id FROM auctions WHERE status = ?').get('active');
  if (activeAuction) {
    return res.status(409).json({ error: 'An auction is already active' });
  }

  const result = db.prepare(`
    INSERT INTO auctions (item_name, item_image, item_rarity, min_bid, created_by, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(itemName, itemImage || '🎁', itemRarity || 'epic', minBid || 10, req.user.userId);

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
// DISCORD BOT ROUTES
// ============================================

// Get member by Discord ID (bot only)
app.get('/api/bot/member/discord/:discordId', authenticateBot, (req, res) => {
  const { discordId } = req.params;

  const member = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.character_name,
      u.character_class,
      u.raid_role,
      u.role,
      u.discord_id,
      m.current_dkp,
      m.lifetime_gained,
      m.lifetime_spent
    FROM users u
    LEFT JOIN member_dkp m ON u.id = m.user_id
    WHERE u.discord_id = ? AND u.is_active = 1
  `).get(discordId);

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  res.json(member);
});

// Link Discord user to DKP account (bot only)
app.post('/api/bot/link', authenticateBot, (req, res) => {
  const { username, discordId, discordUsername } = req.body;

  if (!username || !discordId) {
    return res.status(400).json({ error: 'Username and Discord ID required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE username = ? AND is_active = 1').get(username);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if already linked
  const existing = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(discordId);
  if (existing && existing.id !== user.id) {
    return res.status(400).json({ error: 'Discord account already linked to another user' });
  }

  db.prepare('UPDATE users SET discord_id = ?, discord_username = ? WHERE id = ?')
    .run(discordId, discordUsername, user.id);

  res.json({ message: 'Account linked successfully', userId: user.id });
});

// Get all members (bot only - includes discord info)
app.get('/api/bot/members', authenticateBot, (req, res) => {
  const members = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.character_name,
      u.character_class,
      u.raid_role,
      u.role,
      u.discord_id,
      u.discord_username,
      m.current_dkp,
      m.lifetime_gained,
      m.lifetime_spent
    FROM users u
    LEFT JOIN member_dkp m ON u.id = m.user_id
    WHERE u.is_active = 1
    ORDER BY m.current_dkp DESC
  `).all();

  res.json(members);
});

// Adjust DKP from bot (requires discord_id)
app.post('/api/bot/dkp/adjust', authenticateBot, (req, res) => {
  const { discordId, amount, reason } = req.body;

  if (!discordId || amount === undefined) {
    return res.status(400).json({ error: 'Discord ID and amount required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE discord_id = ? AND is_active = 1').get(discordId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userId = user.id;

  // Update DKP
  if (amount > 0) {
    db.prepare('UPDATE member_dkp SET current_dkp = current_dkp + ?, lifetime_gained = lifetime_gained + ? WHERE user_id = ?')
      .run(amount, amount, userId);
  } else {
    db.prepare('UPDATE member_dkp SET current_dkp = current_dkp + ?, lifetime_spent = lifetime_spent + ? WHERE user_id = ?')
      .run(amount, Math.abs(amount), userId);
  }

  const newDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(userId).current_dkp;

  // Log transaction (performed by bot - NULL as performed_by)
  db.prepare(`
    INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
    VALUES (?, ?, ?, NULL)
  `).run(userId, amount, reason || 'Adjusted via Discord bot');

  io.emit('dkp_updated', { userId, newDkp, amount });
  res.json({ message: 'DKP adjusted', newDkp });
});

// Create auction from bot
app.post('/api/bot/auctions', authenticateBot, (req, res) => {
  const { itemName, itemImage, itemRarity, minBid, createdBy } = req.body;

  if (!itemName || !minBid) {
    return res.status(400).json({ error: 'Item name and min bid required' });
  }

  // Check if there's already an active auction
  const activeAuction = db.prepare("SELECT id FROM auctions WHERE status = 'active'").get();
  if (activeAuction) {
    return res.status(400).json({ error: 'There is already an active auction' });
  }

  const result = db.prepare(`
    INSERT INTO auctions (item_name, item_image, item_rarity, min_bid, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(itemName, itemImage || null, itemRarity || 'rare', minBid, createdBy || null);

  const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(result.lastInsertRowid);

  io.emit('auction_started', auction);
  res.status(201).json(auction);
});

// Place bid from bot
app.post('/api/bot/auctions/:auctionId/bid', authenticateBot, (req, res) => {
  const { auctionId } = req.params;
  const { discordId, amount } = req.body;

  if (!discordId || !amount) {
    return res.status(400).json({ error: 'Discord ID and amount required' });
  }

  const user = db.prepare('SELECT id, character_name, character_class FROM users WHERE discord_id = ? AND is_active = 1').get(discordId);

  if (!user) {
    return res.status(404).json({ error: 'User not found or not linked' });
  }

  const userId = user.id;

  // Check auction exists and is active
  const auction = db.prepare("SELECT * FROM auctions WHERE id = ? AND status = 'active'").get(auctionId);
  if (!auction) {
    return res.status(404).json({ error: 'Auction not found or not active' });
  }

  // Check bid is valid
  if (amount < auction.min_bid) {
    return res.status(400).json({ error: `Bid must be at least ${auction.min_bid} DKP` });
  }

  // Check user has enough DKP
  const memberDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(userId);
  if (memberDkp.current_dkp < amount) {
    return res.status(400).json({ error: `Insufficient DKP. You have ${memberDkp.current_dkp} DKP` });
  }

  // Get current highest bid
  const highestBid = db.prepare('SELECT amount FROM auction_bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 1').get(auctionId);
  if (highestBid && amount <= highestBid.amount) {
    return res.status(400).json({ error: `Bid must be higher than current bid of ${highestBid.amount} DKP` });
  }

  // Place bid
  db.prepare(`
    INSERT INTO auction_bids (auction_id, user_id, amount)
    VALUES (?, ?, ?)
  `).run(auctionId, userId, amount);

  io.emit('bid_placed', {
    auctionId,
    userId,
    characterName: user.character_name,
    characterClass: user.character_class,
    amount
  });

  res.json({ message: 'Bid placed successfully' });
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
