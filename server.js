import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, initDatabase } from './database.js';
import { authenticateToken, authorizeRole } from './middleware/auth.js';
import { processWarcraftLog, isConfigured as isWCLConfigured } from './services/warcraftlogs.js';
import { getAllRaidItems, searchItems, getItemsByRaid, refreshFromAPI, getAvailableRaids, getDataSourceStatus, isAPIConfigured } from './services/raidItems.js';
import { sendPasswordResetEmail, isEmailConfigured } from './services/email.js';

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

// Frontend is served separately via Vite (dkp-frontend project)
// No static files served from backend

// Make io accessible to routes
app.set('io', io);

// Auto-close auction function
function autoCloseAuction(auctionId) {
  const auction = db.prepare('SELECT * FROM auctions WHERE id = ? AND status = ?').get(auctionId, 'active');
  if (!auction) return; // Already ended or cancelled

  // Get all bids sorted by amount descending (fallback if top bidder can't afford)
  const allBids = db.prepare(`
    SELECT ab.*, u.character_name, u.character_class
    FROM auction_bids ab
    JOIN users u ON ab.user_id = u.id
    WHERE ab.auction_id = ?
    ORDER BY ab.amount DESC
  `).all(auctionId);

  let winningBid = null;

  const transaction = db.transaction(() => {
    // Try each bidder in order until one can afford it
    for (const bid of allBids) {
      const bidderDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(bid.user_id);
      if (bidderDkp && bidderDkp.current_dkp >= bid.amount) {
        winningBid = bid;
        break;
      }
    }

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
        VALUES (?, ?, ?, NULL)
      `).run(winningBid.user_id, -winningBid.amount, `Won auction: ${auction.item_name} (auto-close)`);

      // Update auction
      db.prepare(`
        UPDATE auctions
        SET status = 'completed', winner_id = ?, winning_bid = ?, ended_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(winningBid.user_id, winningBid.amount, auctionId);
    } else {
      // No valid bids - cancel auction
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
  console.log(`🔔 Auction ${auctionId} auto-closed. Winner: ${winningBid?.character_name || 'No bids'}`);
}

// Schedule auto-close for existing active auctions on startup
function scheduleExistingAuctions() {
  // Get all active auctions (with or without ends_at)
  const activeAuctions = db.prepare('SELECT id, ends_at, duration_minutes FROM auctions WHERE status = ?').all('active');

  for (const auction of activeAuctions) {
    let endsAt;

    if (auction.ends_at) {
      endsAt = new Date(auction.ends_at).getTime();
    } else {
      // Set default ends_at for auctions that don't have one (5 minutes from now)
      const defaultDuration = auction.duration_minutes || 5;
      const newEndsAt = new Date(Date.now() + defaultDuration * 60 * 1000).toISOString();
      db.prepare('UPDATE auctions SET ends_at = ?, duration_minutes = ? WHERE id = ?').run(newEndsAt, defaultDuration, auction.id);
      endsAt = new Date(newEndsAt).getTime();
      console.log(`⏰ Set default ends_at for auction ${auction.id}: ${newEndsAt}`);
    }

    const now = Date.now();
    const delay = endsAt - now;

    if (delay > 0) {
      setTimeout(() => autoCloseAuction(auction.id), delay);
      console.log(`📅 Scheduled auto-close for auction ${auction.id} in ${Math.round(delay / 1000)}s`);
    } else {
      // Auction should have ended already, close it now
      autoCloseAuction(auction.id);
    }
  }
}

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

// Note: Registration is disabled - users are created by admins only

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = db.prepare(`
      SELECT u.*, md.current_dkp
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE LOWER(u.username) = LOWER(?) AND u.is_active = 1
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

// Request password reset - searches by username or email
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { usernameOrEmail } = req.body;

    if (!usernameOrEmail) {
      return res.status(400).json({ error: 'Username or email required' });
    }

    // Search by username OR email (case-insensitive)
    const user = db.prepare(`
      SELECT id, username, email FROM users
      WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND is_active = 1
    `).get(usernameOrEmail, usernameOrEmail);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'No email configured for this user. Contact an administrator.' });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in database
    db.prepare(`
      UPDATE users SET reset_token = ?, reset_token_expires = datetime('now', '+1 hour')
      WHERE id = ?
    `).run(resetToken, user.id);

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    const emailSent = await sendPasswordResetEmail(user.email, user.username, resetUrl);

    if (!emailSent) {
      console.log(`Password reset link for ${user.username}: ${resetUrl}`);
    }

    res.json({
      message: emailSent ? 'Password reset link sent to your email' : 'Email not configured. Check server console for reset link.',
      ...((!emailSent || process.env.NODE_ENV !== 'production') && { resetToken })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'password_reset') {
        return res.status(400).json({ error: 'Invalid reset token' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token matches stored token and is not expired
    const user = db.prepare(`
      SELECT id FROM users
      WHERE id = ? AND reset_token = ? AND reset_token_expires > datetime('now')
    `).get(decoded.userId, token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare(`
      UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL
      WHERE id = ?
    `).run(hashedPassword, user.id);

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
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
    SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.spec, u.raid_role,
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
    spec: user.spec,
    raidRole: user.raid_role,
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

// Deactivate member (admin only) - creates farewell record
app.delete('/api/members/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { id } = req.params;

  // Get member info before deactivating
  const member = db.prepare(`
    SELECT u.*, md.current_dkp, md.lifetime_gained, md.lifetime_spent
    FROM users u
    LEFT JOIN member_dkp md ON u.id = md.user_id
    WHERE u.id = ?
  `).get(id);

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Get all items won by this member
  const itemsWon = db.prepare(`
    SELECT a.item_name, a.item_image, a.item_rarity, a.item_id, a.winning_bid, a.ended_at
    FROM auctions a
    WHERE a.winner_id = ? AND a.status = 'completed' AND a.farewell_data IS NULL
    ORDER BY a.ended_at DESC
  `).all(id);

  // Create farewell auction record
  const farewellData = JSON.stringify({
    type: 'farewell',
    member: {
      characterName: member.character_name,
      characterClass: member.character_class,
      spec: member.spec,
      raidRole: member.raid_role,
      currentDkp: member.current_dkp || 0,
      lifetimeGained: member.lifetime_gained || 0,
      lifetimeSpent: member.lifetime_spent || 0,
    },
    itemsWon,
    removedBy: req.user.userId,
  });

  // Insert farewell entry as a special completed auction with farewell_data
  db.prepare(`
    INSERT INTO auctions (item_name, item_image, item_rarity, status, winning_bid, winner_id, created_by, ended_at, duration_minutes, farewell_data)
    VALUES (?, ?, 'legendary', 'completed', ?, ?, ?, datetime('now'), 0, ?)
  `).run(
    `${member.character_name}`,
    null,
    member.lifetime_spent || 0,
    id,
    req.user.userId,
    farewellData
  );

  // Deactivate member
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);

  io.emit('member_removed', { memberId: id });
  io.emit('auction_ended');
  res.json({ message: 'Member deactivated', member: member.character_name });
});

// Create new member (admin or officer)
app.post('/api/members', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { username, password, characterName, characterClass, spec, raidRole, role, initialDkp } = req.body;

    // Validate required fields
    if (!username || !password || !characterName || !characterClass) {
      return res.status(400).json({ error: 'Username, password, character name and class are required' });
    }

    // Check if username already exists (case-insensitive)
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Validate role
    const validRole = ['admin', 'officer', 'raider'].includes(role) ? role : 'raider';
    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : 'DPS';

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = db.prepare(`
      INSERT INTO users (username, password, character_name, character_class, spec, raid_role, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(username, hashedPassword, characterName, characterClass, spec || null, validRaidRole, validRole);

    // Create DKP entry
    const dkp = parseInt(initialDkp) || 0;
    db.prepare(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained)
      VALUES (?, ?, ?)
    `).run(result.lastInsertRowid, dkp, dkp);

    io.emit('member_updated', { memberId: result.lastInsertRowid });

    res.status(201).json({
      message: 'Member created successfully',
      member: {
        id: result.lastInsertRowid,
        username,
        characterName,
        characterClass,
        spec,
        raidRole: validRaidRole,
        role: validRole,
        currentDkp: dkp
      }
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
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

// Helper: Get raid dates for the next N weeks
function getRaidDates(weeks = 2) {
  const raidDays = db.prepare(`
    SELECT day_of_week, day_name, raid_time
    FROM raid_days
    WHERE is_active = 1
    ORDER BY day_of_week
  `).all();

  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get dates for the next N weeks
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // JavaScript: 0=Sunday, 1=Monday, ... 6=Saturday
    // Database: 1=Monday, 2=Tuesday, ... 7=Sunday
    const jsDay = date.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay; // Convert Sunday from 0 to 7

    const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
    if (raidDay) {
      // Use local date components (not toISOString which returns UTC)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push({
        date: `${year}-${month}-${day}`,
        dayOfWeek: dbDay,
        dayName: raidDay.day_name,
        raidTime: raidDay.raid_time
      });
    }
  }

  return dates;
}

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

// Update raid days configuration (admin only)
app.put('/api/calendar/raid-days', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const { days } = req.body;

  if (!days || !Array.isArray(days)) {
    return res.status(400).json({ error: 'days array required' });
  }

  // First, deactivate all days
  db.prepare('UPDATE raid_days SET is_active = 0').run();

  // Then, upsert the provided days
  const upsert = db.prepare(`
    INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(day_of_week) DO UPDATE SET
      day_name = excluded.day_name,
      is_active = 1,
      raid_time = excluded.raid_time
  `);

  const dayNames = {
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
    5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
  };

  for (const day of days) {
    upsert.run(day.dayOfWeek, day.dayName || dayNames[day.dayOfWeek], day.raidTime || '20:00');
  }

  res.json({ message: 'Raid days updated' });
});

// Get upcoming raid dates for next 2 weeks
app.get('/api/calendar/dates', authenticateToken, (req, res) => {
  const weeks = parseInt(req.query.weeks) || 2;
  const dates = getRaidDates(Math.min(weeks, 4)); // Max 4 weeks
  res.json(dates);
});

// Get user's signups for upcoming dates
app.get('/api/calendar/my-signups', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const weeks = parseInt(req.query.weeks) || 2;

  const raidDates = getRaidDates(weeks);
  const dateStrings = raidDates.map(d => d.date);

  if (dateStrings.length === 0) {
    return res.json({ dates: [] });
  }

  // Get user's signups
  const placeholders = dateStrings.map(() => '?').join(',');
  const signups = db.prepare(`
    SELECT raid_date, status, notes, dkp_awarded, updated_at
    FROM member_availability
    WHERE user_id = ? AND raid_date IN (${placeholders})
  `).all(userId, ...dateStrings);

  // Merge with dates
  const result = raidDates.map(date => {
    const signup = signups.find(s => s.raid_date === date.date);
    return {
      ...date,
      status: signup?.status || null,
      notes: signup?.notes || null,
      dkpAwarded: signup?.dkp_awarded || 0,
      updatedAt: signup?.updated_at || null
    };
  });

  res.json({ dates: result });
});

// Create/update signup for a specific date
app.post('/api/calendar/signup', authenticateToken, (req, res) => {
  const { date, status, notes } = req.body;
  const userId = req.user.userId;

  if (!date || !status) {
    return res.status(400).json({ error: 'date and status are required' });
  }

  if (!['confirmed', 'declined', 'tentative'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: confirmed, declined, or tentative' });
  }

  // Validate date is a raid day
  // Use T12:00:00 to avoid timezone issues when parsing date string
  const dateObj = new Date(date + 'T12:00:00');
  const jsDay = dateObj.getDay();
  const dbDay = jsDay === 0 ? 7 : jsDay;

  const raidDay = db.prepare('SELECT * FROM raid_days WHERE day_of_week = ? AND is_active = 1').get(dbDay);
  if (!raidDay) {
    return res.status(400).json({ error: 'Selected date is not a raid day' });
  }

  // Check if signup already exists
  const existing = db.prepare(`
    SELECT id, dkp_awarded FROM member_availability WHERE user_id = ? AND raid_date = ?
  `).get(userId, date);

  let dkpAwarded = 0;
  const isFirstSignup = !existing;

  if (isFirstSignup) {
    // First signup for this date - award DKP
    const dkpPerDay = parseInt(db.prepare(
      "SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'"
    ).get()?.config_value || 2);

    dkpAwarded = dkpPerDay;

    // Insert new signup with DKP
    db.prepare(`
      INSERT INTO member_availability (user_id, raid_date, status, notes, dkp_awarded)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, date, status, notes || null, dkpAwarded);

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
    `).run(userId, dkpAwarded, `Calendario: registro para ${date}`, userId);

    io.emit('dkp_updated', { userId, amount: dkpAwarded, reason: 'calendar_signup' });
  } else {
    // Update existing signup (no additional DKP)
    db.prepare(`
      UPDATE member_availability
      SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND raid_date = ?
    `).run(status, notes || null, userId, date);

    dkpAwarded = existing.dkp_awarded;
  }

  res.json({
    message: isFirstSignup ? 'Signup created' : 'Signup updated',
    date,
    status,
    dkpAwarded,
    isFirstSignup
  });
});

// Get summary for a specific date (all users)
app.get('/api/calendar/summary/:date', authenticateToken, (req, res) => {
  const { date } = req.params;
  const isAdmin = ['admin', 'officer'].includes(req.user.role);

  // Get all active users
  const users = db.prepare(`
    SELECT u.id, u.character_name, u.character_class, u.raid_role, u.spec
    FROM users u
    WHERE u.is_active = 1
    ORDER BY u.character_name
  `).all();

  // Get signups for this date
  const signups = db.prepare(`
    SELECT user_id, status, notes
    FROM member_availability
    WHERE raid_date = ?
  `).all(date);

  // Merge and categorize
  const summary = {
    date,
    confirmed: [],
    declined: [],
    tentative: [],
    noResponse: []
  };

  for (const user of users) {
    const signup = signups.find(s => s.user_id === user.id);
    const memberInfo = {
      id: user.id,
      characterName: user.character_name,
      characterClass: user.character_class,
      raidRole: user.raid_role,
      spec: user.spec,
      // Only include notes for admins
      ...(isAdmin && signup?.notes && { notes: signup.notes })
    };

    if (!signup) {
      summary.noResponse.push(memberInfo);
    } else if (signup.status === 'confirmed') {
      summary.confirmed.push(memberInfo);
    } else if (signup.status === 'declined') {
      summary.declined.push(memberInfo);
    } else {
      summary.tentative.push(memberInfo);
    }
  }

  // Add counts
  summary.counts = {
    confirmed: summary.confirmed.length,
    declined: summary.declined.length,
    tentative: summary.tentative.length,
    noResponse: summary.noResponse.length,
    total: users.length
  };

  res.json(summary);
});

// Get all signups overview (admin/officer only)
app.get('/api/calendar/overview', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const weeks = parseInt(req.query.weeks) || 2;
  const raidDates = getRaidDates(weeks);

  // Get all active users
  const users = db.prepare(`
    SELECT id, character_name, character_class, raid_role, spec
    FROM users
    WHERE is_active = 1
    ORDER BY character_name
  `).all();

  if (raidDates.length === 0) {
    return res.json({ dates: [], members: [] });
  }

  // Get all signups for these dates
  const dateStrings = raidDates.map(d => d.date);
  const placeholders = dateStrings.map(() => '?').join(',');
  const allSignups = db.prepare(`
    SELECT user_id, raid_date, status, notes
    FROM member_availability
    WHERE raid_date IN (${placeholders})
  `).all(...dateStrings);

  // Build overview per date
  const datesOverview = raidDates.map(date => {
    const dateSignups = allSignups.filter(s => s.raid_date === date.date);
    return {
      ...date,
      counts: {
        confirmed: dateSignups.filter(s => s.status === 'confirmed').length,
        declined: dateSignups.filter(s => s.status === 'declined').length,
        tentative: dateSignups.filter(s => s.status === 'tentative').length,
        noResponse: users.length - dateSignups.length
      }
    };
  });

  // Build member grid
  const members = users.map(user => {
    const signups = {};
    for (const date of raidDates) {
      const signup = allSignups.find(s => s.user_id === user.id && s.raid_date === date.date);
      signups[date.date] = {
        status: signup?.status || null,
        notes: signup?.notes || null
      };
    }

    return {
      id: user.id,
      characterName: user.character_name,
      characterClass: user.character_class,
      raidRole: user.raid_role,
      spec: user.spec,
      signups
    };
  });

  res.json({
    dates: datesOverview,
    members
  });
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

    const highestBidder = bids.length > 0 ? bids[0] : null;

    // Calculate endsAt if not set (for old auctions)
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
        createdAt: b.created_at
      }))
    };
  });

  // Calculate user's available DKP (current minus committed bids on active auctions)
  const userId = req.user.userId;
  const userDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(userId);
  const committedBids = db.prepare(`
    SELECT COALESCE(SUM(ab.amount), 0) as total
    FROM auction_bids ab
    JOIN auctions a ON ab.auction_id = a.id
    WHERE ab.user_id = ? AND a.status = 'active'
    AND ab.amount = (
      SELECT MAX(ab2.amount) FROM auction_bids ab2
      WHERE ab2.auction_id = ab.auction_id AND ab2.user_id = ?
    )
  `).get(userId, userId);

  const availableDkp = (userDkp?.current_dkp || 0) - (committedBids?.total || 0);

  res.json({ auctions: auctionsWithBids, availableDkp });
});

// Create new auction (officer+)
app.post('/api/auctions', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  const { itemName, itemNameEN, itemImage, minBid, itemRarity, itemId, durationMinutes } = req.body;

  if (!itemName) {
    return res.status(400).json({ error: 'Item name is required' });
  }

  const duration = durationMinutes || 5;
  const endsAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

  // Multiple active auctions are now allowed
  const result = db.prepare(`
    INSERT INTO auctions (item_name, item_name_en, item_image, item_rarity, min_bid, created_by, status, duration_minutes, ends_at, item_id)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(itemName, itemNameEN || itemName, itemImage || '🎁', itemRarity || 'epic', minBid || 0, req.user.userId, duration, endsAt, itemId || null);

  const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(result.lastInsertRowid);

  // Schedule auto-close
  setTimeout(() => {
    autoCloseAuction(auction.id);
  }, duration * 60 * 1000);

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

  // Validate amount - must be at least 1 DKP
  if (!amount || amount < 1) {
    return res.status(400).json({ error: 'Bid must be at least 1 DKP' });
  }

  // Check user's DKP including committed bids on other active auctions
  const userDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(userId);
  if (!userDkp) {
    return res.status(400).json({ error: 'Insufficient DKP' });
  }

  // Calculate DKP committed to other active auctions (highest bid per auction)
  const committedBids = db.prepare(`
    SELECT COALESCE(SUM(ab.amount), 0) as total
    FROM auction_bids ab
    JOIN auctions a ON ab.auction_id = a.id
    WHERE ab.user_id = ? AND a.status = 'active' AND a.id != ?
    AND ab.amount = (
      SELECT MAX(ab2.amount) FROM auction_bids ab2
      WHERE ab2.auction_id = ab.auction_id AND ab2.user_id = ?
    )
  `).get(userId, auctionId, userId);

  const availableDkp = userDkp.current_dkp - (committedBids?.total || 0);
  if (availableDkp < amount) {
    return res.status(400).json({ error: 'Insufficient DKP (accounting for your bids on other active auctions)' });
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

  // Get all bids sorted by amount descending (fallback if top bidder can't afford)
  const allBids = db.prepare(`
    SELECT ab.*, u.character_name, u.character_class
    FROM auction_bids ab
    JOIN users u ON ab.user_id = u.id
    WHERE ab.auction_id = ?
    ORDER BY ab.amount DESC
  `).all(auctionId);

  let winningBid = null;

  const transaction = db.transaction(() => {
    // Try each bidder in order until one can afford it
    for (const bid of allBids) {
      const bidderDkp = db.prepare('SELECT current_dkp FROM member_dkp WHERE user_id = ?').get(bid.user_id);
      if (bidderDkp && bidderDkp.current_dkp >= bid.amount) {
        winningBid = bid;
        break;
      }
    }

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
      // No valid bids - cancel auction
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

// Cancel ALL active auctions (admin only) - for cleanup
app.post('/api/auctions/cancel-all', authenticateToken, authorizeRole(['admin']), (req, res) => {
  const result = db.prepare(`
    UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE status = 'active'
  `).run();

  io.emit('auctions_cleared', { count: result.changes });
  res.json({ message: `Cancelled ${result.changes} active auctions` });
});

// Get all raid items
app.get('/api/raid-items', authenticateToken, async (req, res) => {
  try {
    const items = await getAllRaidItems();
    res.json({ items });
  } catch (error) {
    console.error('Error fetching raid items:', error);
    res.status(500).json({ error: 'Failed to fetch raid items' });
  }
});

// Search raid items
app.get('/api/raid-items/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q || '';
    const items = query ? await searchItems(query) : await getAllRaidItems();
    res.json({ items });
  } catch (error) {
    console.error('Error searching raid items:', error);
    res.status(500).json({ error: 'Failed to search raid items' });
  }
});

// Get items by raid
app.get('/api/raid-items/:raidName', authenticateToken, async (req, res) => {
  try {
    const { raidName } = req.params;
    const items = await getItemsByRaid(raidName);
    res.json({ items });
  } catch (error) {
    console.error('Error fetching raid items by raid:', error);
    res.status(500).json({ error: 'Failed to fetch raid items' });
  }
});

// Get available raids
app.get('/api/raids-list', authenticateToken, async (req, res) => {
  try {
    const raids = await getAvailableRaids();
    res.json({ raids });
  } catch (error) {
    console.error('Error fetching raids list:', error);
    res.status(500).json({ error: 'Failed to fetch raids list' });
  }
});

// Get raid items data source status
app.get('/api/raid-items/status', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  res.json(getDataSourceStatus());
});

// Force refresh raid items from Blizzard API
app.post('/api/raid-items/refresh', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    if (!isAPIConfigured()) {
      return res.status(400).json({
        error: 'Blizzard API not configured. Set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET environment variables.'
      });
    }

    const result = await refreshFromAPI();
    if (result.success) {
      res.json({ message: `Successfully refreshed ${result.count} items from Blizzard API` });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error refreshing raid items:', error);
    res.status(500).json({ error: 'Failed to refresh raid items from API' });
  }
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

  // Format response with winner object
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
      winner: a.winner_name ? {
        characterName: a.winner_name,
        characterClass: a.winner_class
      } : null
    };
    if (a.farewell_data) {
      try { entry.farewell = JSON.parse(a.farewell_data); } catch (e) {}
    }
    return entry;
  });

  res.json(formatted);
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

    // Flat 10 DKP per raid attendance
    const raidDKP = 10;

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
          dkp_to_assign: raidDKP
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
        dkp_per_player: raidDKP,
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
scheduleExistingAuctions();

server.listen(PORT, () => {
  console.log('==========================================');
  console.log('  DKP Backend Server - BUILD v2.0');
  console.log('  Date: 2026-01-27');
  console.log('==========================================');
  console.log(`🎮 DKP Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for real-time updates`);
});

export { app, io };
