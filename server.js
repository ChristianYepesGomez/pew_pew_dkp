import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { db, initDatabase } from './database.js';
import { authenticateToken, authorizeRole } from './middleware/auth.js';
import { processWarcraftLog, isConfigured as isWCLConfigured, getGuildReports, getGuildId, getFightDeaths, getFightStats } from './services/warcraftlogs.js';
import { getAllRaidItems, searchItems, getItemsByRaid, refreshFromAPI, getAvailableRaids, getDataSourceStatus, isAPIConfigured } from './services/raidItems.js';
import { sendPasswordResetEmail, isEmailConfigured } from './services/email.js';
import { getBlizzardOAuthUrl, getUserToken, getUserCharacters, isBlizzardOAuthConfigured } from './services/blizzardAPI.js';
import { seedRaidData, getAllZonesWithBosses, getBossDetails, processFightStats, setZoneLegacy, recordPlayerDeaths, recordPlayerPerformance } from './services/raids.js';

const app = express();
const server = createServer(app);

// CORS - support comma-separated origins and strip trailing slashes
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(u => u.trim().replace(/\/+$/, ''));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};

const io = new Server(server, { cors: corsOptions });

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Security: warn if using default JWT secret
if (JWT_SECRET === 'your-secret-key-change-in-production' && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET in production! Set a strong secret in your environment variables.');
}

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per window
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for sensitive admin operations (DKP, WCL, etc.)
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // max 50 operations per window
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for user operations (bidding, etc.)
const userLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // max 30 operations per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors(corsOptions));
app.use(express.json());

// Frontend is served separately via Vite (dkp-frontend project)
// No static files served from backend

// Make io accessible to routes
app.set('io', io);

// Email validation helper (standardized across all endpoints)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => email && EMAIL_REGEX.test(email.trim());

// Auto-close auction function
async function autoCloseAuction(auctionId) {
  try {
    const auction = await db.get('SELECT * FROM auctions WHERE id = ? AND status = ?', auctionId, 'active');
    if (!auction) return;

    const allBids = await db.all(`
      SELECT ab.*, u.character_name, u.character_class
      FROM auction_bids ab
      JOIN users u ON ab.user_id = u.id
      WHERE ab.auction_id = ?
      ORDER BY ab.amount DESC
    `, auctionId);

    const winningBid = await db.transaction(async (tx) => {
      let winner = null;
      for (const bid of allBids) {
        const bidderDkp = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', bid.user_id);
        if (bidderDkp && bidderDkp.current_dkp >= bid.amount) {
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
      winner: winningBid ? {
        userId: winningBid.user_id,
        characterName: winningBid.character_name,
        characterClass: winningBid.character_class,
        amount: winningBid.amount
      } : null
    };

    io.emit('auction_ended', result);
    console.log(`🔔 Auction ${auctionId} auto-closed. Winner: ${winningBid?.character_name || 'No bids'}`);
  } catch (error) {
    console.error(`Error auto-closing auction ${auctionId}:`, error);
  }
}

// Schedule auto-close for existing active auctions on startup
async function scheduleExistingAuctions() {
  const activeAuctions = await db.all('SELECT id, ends_at, duration_minutes FROM auctions WHERE status = ?', 'active');

  for (const auction of activeAuctions) {
    let endsAt;

    if (auction.ends_at) {
      endsAt = new Date(auction.ends_at).getTime();
    } else {
      const defaultDuration = auction.duration_minutes || 5;
      const newEndsAt = new Date(Date.now() + defaultDuration * 60 * 1000).toISOString();
      await db.run('UPDATE auctions SET ends_at = ?, duration_minutes = ? WHERE id = ?', newEndsAt, defaultDuration, auction.id);
      endsAt = new Date(newEndsAt).getTime();
      console.log(`⏰ Set default ends_at for auction ${auction.id}: ${newEndsAt}`);
    }

    const now = Date.now();
    const delay = endsAt - now;

    if (delay > 0) {
      setTimeout(() => autoCloseAuction(auction.id), delay);
      console.log(`📅 Scheduled auto-close for auction ${auction.id} in ${Math.round(delay / 1000)}s`);
    } else {
      autoCloseAuction(auction.id);
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get current raid week identifier (YYYY-WW format based on Wednesday)
// Raid weeks run Thu-Mon-Wed, resetting each Wednesday at server reset
// Vault is "a semana vencida" - you claim it after completing the previous week's content
function getCurrentRaidWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  // Find the Wednesday that ends this raid week
  // Wed is day 3. If today is Thu-Sat (4-6) or Sun (0), we're past this week's reset
  const wednesday = new Date(now);
  if (day === 0) wednesday.setDate(wednesday.getDate() + 3); // Sun -> next Wed
  else if (day === 4) wednesday.setDate(wednesday.getDate() + 6); // Thu -> next Wed
  else if (day === 5) wednesday.setDate(wednesday.getDate() + 5); // Fri -> next Wed
  else if (day === 6) wednesday.setDate(wednesday.getDate() + 4); // Sat -> next Wed
  else if (day < 3) wednesday.setDate(wednesday.getDate() + (3 - day)); // Mon-Tue -> this Wed
  // day === 3 (Wednesday) stays as-is

  // Format as YYYY-WW (year + ISO week number)
  const startOfYear = new Date(wednesday.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((wednesday - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${wednesday.getFullYear()}-${weekNumber.toString().padStart(2, '0')}`;
}

// Apply DKP cap when adding DKP
async function addDkpWithCap(tx, userId, amount, capValue = 250) {
  const current = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
  const currentDkp = current?.current_dkp || 0;
  const newDkp = Math.min(currentDkp + amount, capValue);
  const actualGain = newDkp - currentDkp;

  if (actualGain > 0) {
    await tx.run(`
      UPDATE member_dkp
      SET current_dkp = ?,
          lifetime_gained = lifetime_gained + ?
      WHERE user_id = ?
    `, newDkp, actualGain, userId);
  }

  return { newDkp, actualGain, wasCapped: actualGain < amount };
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
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await db.get(`
      SELECT u.*, md.current_dkp
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE LOWER(u.username) = LOWER(?) AND u.is_active = 1
    `, username);

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

// Register a new account (public, rate-limited)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validate required fields - only username, password, and email required
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, password, and email are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if username already exists
    const existingUser = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', username.trim());
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Check if email already exists
    const existingEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', email.trim());
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user without character - character will be added later via Blizzard import
    const userResult = await db.run(`
      INSERT INTO users (username, password, role, email)
      VALUES (?, ?, 'raider', ?)
    `, username.trim(), hashedPassword, email.trim());

    const userId = userResult.lastID;

    // Create member_dkp entry with default DPS role
    await db.run(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent, role)
      VALUES (?, 0, 0, 0, 'DPS')
    `, userId);

    console.log(`✅ New user registered: ${username} (email: ${email})`);

    res.status(201).json({
      message: 'Account created successfully',
      userId: userId
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Request password reset - searches by username or email
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { usernameOrEmail } = req.body;

    if (!usernameOrEmail) {
      return res.status(400).json({ error: 'Username or email required' });
    }

    const user = await db.get(`
      SELECT id, username, email FROM users
      WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND is_active = 1
    `, usernameOrEmail, usernameOrEmail);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'No email configured for this user. Contact an administrator.' });
    }

    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await db.run(`
      UPDATE users SET reset_token = ?, reset_token_expires = datetime('now', '+1 hour')
      WHERE id = ?
    `, resetToken, user.id);

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
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'password_reset') {
        return res.status(400).json({ error: 'Invalid reset token' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = await db.get(`
      SELECT id FROM users
      WHERE id = ? AND reset_token = ? AND reset_token_expires > datetime('now')
    `, decoded.userId, token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run(`
      UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL
      WHERE id = ?
    `, hashedPassword, user.id);

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

    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', hashedPassword, userId);

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Reset password for another user (Admin/Officer only)
app.post('/api/auth/admin-reset-password', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'User ID and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', hashedPassword, userId);

    res.json({ message: `Password reset successfully for ${user.character_name}` });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get(`
      SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.spec, u.raid_role, u.email, u.avatar,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.id = ?
    `, req.user.userId);

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
      email: user.email || null,
      avatar: user.avatar || null,
      currentDkp: user.current_dkp || 0,
      lifetimeGained: user.lifetime_gained || 0,
      lifetimeSpent: user.lifetime_spent || 0
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update own profile (email, password, avatar)
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { email, currentPassword, newPassword, avatar } = req.body;
    const userId = req.user.userId;

    // Handle email update
    if (email !== undefined) {
      if (email !== null && email !== '' && !isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      await db.run(
        'UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        email || null, userId
      );
    }

    // Handle password change
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      // Verify current password
      const user = await db.get('SELECT password FROM users WHERE id = ?', userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash and save new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.run(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        hashedPassword, userId
      );
    }

    // Handle avatar upload (Base64 image, max 500KB)
    if (avatar !== undefined) {
      if (avatar === null || avatar === '') {
        // Remove avatar
        await db.run('UPDATE users SET avatar = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', userId);
      } else {
        // Validate Base64 image
        const base64Pattern = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;
        if (!base64Pattern.test(avatar)) {
          return res.status(400).json({ error: 'Invalid image format. Use JPEG, PNG, WebP, or GIF.' });
        }
        // Check size (roughly 500KB limit for Base64)
        if (avatar.length > 700000) {
          return res.status(400).json({ error: 'Image too large. Maximum 500KB allowed.' });
        }
        await db.run('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', avatar, userId);
      }
      // Notify clients to refresh member list (avatar changed)
      io.emit('member_updated', { memberId: userId });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ============================================
// BLIZZARD OAUTH (character import)
// ============================================

// Get Blizzard OAuth authorization URL
app.get('/api/auth/blizzard/url', authenticateToken, (req, res) => {
  if (!isBlizzardOAuthConfigured()) {
    return res.status(503).json({ error: 'Blizzard API not configured' });
  }

  const state = jwt.sign(
    { userId: req.user.userId, type: 'blizzard_oauth' },
    JWT_SECRET,
    { expiresIn: '10m' }
  );

  const protocol = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/auth/blizzard/callback`;

  const url = getBlizzardOAuthUrl(redirectUri, state);
  res.json({ url, configured: true });
});

// Blizzard OAuth callback - redirects popup to frontend for same-origin postMessage
function toBase64Url(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

app.get('/api/auth/blizzard/callback', async (req, res) => {
  const { code, state, error: authError } = req.query;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');

  if (authError) {
    return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Authorization denied by user' })}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Missing authorization code' })}`);
  }

  let decoded;
  try {
    decoded = jwt.verify(state, JWT_SECRET);
    if (decoded.type !== 'blizzard_oauth') {
      return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Invalid state parameter' })}`);
    }
  } catch {
    return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Expired or invalid state. Please try again.' })}`);
  }

  try {
    const protocol = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/blizzard/callback`;

    const userToken = await getUserToken(code, redirectUri);
    const characters = await getUserCharacters(userToken);

    console.log(`Blizzard OAuth: fetched ${characters.length} characters for user ${decoded.userId}`);
    res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ characters })}`);
  } catch (err) {
    console.error('Blizzard OAuth callback error:', err.message);
    res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Failed to fetch characters from Blizzard. Please try again.' })}`);
  }
});


// ============================================
// MEMBER/ROSTER ROUTES
// ============================================

// Get all members with DKP (sorted by DKP descending)
app.get('/api/members', authenticateToken, async (req, res) => {
  try {
    // Get current raid week (Thursday-based)
    const currentWeek = getCurrentRaidWeek();

    const members = await db.all(`
      SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.raid_role, u.spec, u.avatar,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent,
             md.weekly_vault_completed, md.vault_week
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.is_active = 1
      ORDER BY md.current_dkp DESC
    `);

    // Get DKP cap from config
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    res.json(members.map(m => ({
      id: m.id,
      username: m.username,
      characterName: m.character_name,
      characterClass: m.character_class,
      role: m.role,
      raidRole: m.raid_role,
      spec: m.spec,
      avatar: m.avatar || null,
      currentDkp: m.current_dkp || 0,
      lifetimeGained: m.lifetime_gained || 0,
      lifetimeSpent: m.lifetime_spent || 0,
      weeklyVaultCompleted: m.vault_week === currentWeek ? (m.weekly_vault_completed === 1) : false,
      dkpCap
    })));
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// Update member role (admin only)
app.put('/api/members/:id/role', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'officer', 'raider'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await db.run('UPDATE users SET role = ? WHERE id = ?', role, id);

    io.emit('member_updated', { memberId: id });
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Toggle weekly vault completion (admin/officer only)
app.put('/api/members/:id/vault', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const currentWeek = getCurrentRaidWeek();

    // Get current state
    const member = await db.get(`
      SELECT md.weekly_vault_completed, md.vault_week, u.character_name
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE md.user_id = ?
    `, id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Check if already completed this week
    const wasCompleted = member.vault_week === currentWeek && member.weekly_vault_completed === 1;

    if (wasCompleted) {
      // Remove vault completion AND remove the DKP that was awarded
      const vaultDkpConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'weekly_vault_dkp'");
      const vaultDkp = parseInt(vaultDkpConfig?.config_value || '10', 10);

      await db.transaction(async (tx) => {
        // Remove vault status
        await tx.run(`
          UPDATE member_dkp
          SET weekly_vault_completed = 0
          WHERE user_id = ?
        `, id);

        // Remove the DKP that was awarded
        await tx.run(`
          UPDATE member_dkp
          SET current_dkp = MAX(0, current_dkp - ?),
              lifetime_gained = MAX(0, lifetime_gained - ?)
          WHERE user_id = ?
        `, vaultDkp, vaultDkp, id);

        // Log the reversal transaction
        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, id, -vaultDkp, 'Weekly Vault unmarked (DKP removed)', req.user.userId);
      });

      io.emit('member_updated', { memberId: parseInt(id) });
      io.emit('dkp_updated', { userId: parseInt(id) });
      res.json({ message: 'Vault completion removed, DKP deducted', completed: false, dkpRemoved: vaultDkp });
    } else {
      // Mark as completed and award DKP
      const vaultDkpConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'weekly_vault_dkp'");
      const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
      const vaultDkp = parseInt(vaultDkpConfig?.config_value || '10', 10);
      const dkpCap = parseInt(capConfig?.config_value || '250', 10);

      await db.transaction(async (tx) => {
        // Update vault status
        await tx.run(`
          UPDATE member_dkp
          SET weekly_vault_completed = 1,
              vault_completed_at = CURRENT_TIMESTAMP,
              vault_week = ?
          WHERE user_id = ?
        `, currentWeek, id);

        // Award DKP with cap
        const result = await addDkpWithCap(tx, id, vaultDkp, dkpCap);

        // Log transaction
        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, id, result.actualGain, `Weekly Vault completed (+${vaultDkp} DKP${result.wasCapped ? ', capped' : ''})`, req.user.userId);
      });

      io.emit('member_updated', { memberId: parseInt(id) });
      io.emit('dkp_updated', { userId: parseInt(id) });
      res.json({ message: 'Vault completed! DKP awarded.', completed: true, dkpAwarded: vaultDkp });
    }
  } catch (error) {
    console.error('Toggle vault error:', error);
    res.status(500).json({ error: 'Failed to toggle vault status' });
  }
});

// Deactivate member (admin only) - creates farewell record
app.delete('/api/members/:id', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const member = await db.get(`
      SELECT u.*, md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.id = ?
    `, id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const itemsWon = await db.all(`
      SELECT a.item_name, a.item_image, a.item_rarity, a.item_id, a.winning_bid, a.ended_at
      FROM auctions a
      WHERE a.winner_id = ? AND a.status = 'completed' AND a.farewell_data IS NULL
      ORDER BY a.ended_at DESC
    `, id);

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

    await db.run(`
      INSERT INTO auctions (item_name, item_image, item_rarity, status, winning_bid, winner_id, created_by, ended_at, duration_minutes, farewell_data)
      VALUES (?, ?, 'legendary', 'completed', ?, ?, ?, datetime('now'), 0, ?)
    `, `${member.character_name}`, null, member.lifetime_spent || 0, id, req.user.userId, farewellData);

    await db.run('UPDATE users SET is_active = 0 WHERE id = ?', id);

    io.emit('member_removed', { memberId: id });
    io.emit('auction_ended');
    res.json({ message: 'Member deactivated', member: member.character_name });
  } catch (error) {
    console.error('Deactivate member error:', error);
    res.status(500).json({ error: 'Failed to deactivate member' });
  }
});

// Create new member (admin or officer)
app.post('/api/members', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { username, password, characterName, characterClass, spec, raidRole, role, initialDkp } = req.body;

    if (!username || !password || !characterName || !characterClass) {
      return res.status(400).json({ error: 'Username, password, character name and class are required' });
    }

    const existing = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const validRole = ['admin', 'officer', 'raider'].includes(role) ? role : 'raider';
    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : 'DPS';

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.run(`
      INSERT INTO users (username, password, character_name, character_class, spec, raid_role, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, username, hashedPassword, characterName, characterClass, spec || null, validRaidRole, validRole);

    const dkp = parseInt(initialDkp) || 0;
    await db.run(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained)
      VALUES (?, ?, ?)
    `, result.lastInsertRowid, dkp, dkp);

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
// CHARACTER ROUTES (multi-character system)
// ============================================

// Get current user's characters
app.get('/api/characters', authenticateToken, async (req, res) => {
  try {
    const characters = await db.all(
      'SELECT * FROM characters WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC',
      req.user.userId
    );

    res.json(characters.map(c => ({
      id: c.id,
      characterName: c.character_name,
      characterClass: c.character_class,
      spec: c.spec,
      raidRole: c.raid_role,
      isPrimary: !!c.is_primary,
      createdAt: c.created_at
    })));
  } catch (error) {
    console.error('Get characters error:', error);
    res.status(500).json({ error: 'Failed to get characters' });
  }
});

// Create new character
app.post('/api/characters', authenticateToken, async (req, res) => {
  try {
    const { characterName, characterClass, spec, raidRole } = req.body;
    const userId = req.user.userId;

    if (!characterName || !characterClass) {
      return res.status(400).json({ error: 'Character name and class are required' });
    }

    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : 'DPS';

    const existing = await db.all('SELECT id FROM characters WHERE user_id = ?', userId);
    const isPrimary = existing.length === 0 ? 1 : 0;

    const result = await db.run(
      'INSERT INTO characters (user_id, character_name, character_class, spec, raid_role, is_primary) VALUES (?, ?, ?, ?, ?, ?)',
      userId, characterName, characterClass, spec || null, validRaidRole, isPrimary
    );

    if (isPrimary) {
      await db.run(
        'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        characterName, characterClass, spec || null, validRaidRole, userId
      );
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      characterName,
      characterClass,
      spec: spec || null,
      raidRole: validRaidRole,
      isPrimary: !!isPrimary
    });
  } catch (error) {
    console.error('Create character error:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// Update character
app.put('/api/characters/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { characterName, characterClass, spec, raidRole } = req.body;
    const userId = req.user.userId;

    const character = await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const newName = characterName || character.character_name;
    const newClass = characterClass || character.character_class;
    const newSpec = spec !== undefined ? (spec || null) : character.spec;
    const newRole = raidRole && ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : character.raid_role;

    await db.run(
      'UPDATE characters SET character_name = ?, character_class = ?, spec = ?, raid_role = ? WHERE id = ?',
      newName, newClass, newSpec, newRole, id
    );

    if (character.is_primary) {
      await db.run(
        'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        newName, newClass, newSpec, newRole, userId
      );
    }

    res.json({ message: 'Character updated' });
  } catch (error) {
    console.error('Update character error:', error);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// Delete character
app.delete('/api/characters/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const character = await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const charCount = await db.get('SELECT COUNT(*) as count FROM characters WHERE user_id = ?', userId);
    if (charCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete your only character' });
    }

    if (character.is_primary) {
      return res.status(400).json({ error: 'Cannot delete primary character. Set another as primary first.' });
    }

    await db.run('DELETE FROM characters WHERE id = ?', id);
    res.json({ message: 'Character deleted' });
  } catch (error) {
    console.error('Delete character error:', error);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

// Set character as primary
app.put('/api/characters/:id/primary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const character = await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await db.run('UPDATE characters SET is_primary = 0 WHERE user_id = ?', userId);
    await db.run('UPDATE characters SET is_primary = 1 WHERE id = ?', id);

    await db.run(
      'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      character.character_name, character.character_class, character.spec, character.raid_role, userId
    );

    io.emit('member_updated', { memberId: userId });
    res.json({ message: 'Primary character updated' });
  } catch (error) {
    console.error('Set primary character error:', error);
    res.status(500).json({ error: 'Failed to set primary character' });
  }
});

// ============================================
// DKP ROUTES
// ============================================

// Adjust DKP for single member (officer+)
app.post('/api/dkp/adjust', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'Missing userId or amount' });
    }

    const currentDkp = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    if (!currentDkp) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get DKP cap
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    let newDkp;
    let actualAmount = amount;

    if (amount > 0) {
      // Apply cap when adding DKP
      newDkp = Math.min(currentDkp.current_dkp + amount, dkpCap);
      actualAmount = newDkp - currentDkp.current_dkp;

      await db.run(`
        UPDATE member_dkp
        SET current_dkp = ?, lifetime_gained = lifetime_gained + ?
        WHERE user_id = ?
      `, newDkp, actualAmount, userId);
    } else {
      // No cap on removal
      newDkp = Math.max(0, currentDkp.current_dkp + amount);
      await db.run(`
        UPDATE member_dkp SET current_dkp = ? WHERE user_id = ?
      `, newDkp, userId);
    }

    await db.run(`
      INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
      VALUES (?, ?, ?, ?)
    `, userId, amount, reason || 'Manual adjustment', req.user.userId);

    io.emit('dkp_updated', { userId, newDkp, amount });
    res.json({ message: 'DKP adjusted', newDkp });
  } catch (error) {
    console.error('Adjust DKP error:', error);
    res.status(500).json({ error: 'Failed to adjust DKP' });
  }
});

// Bulk DKP adjustment (raid attendance, etc.)
app.post('/api/dkp/bulk-adjust', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userIds, amount, reason } = req.body;

    if (!userIds || !Array.isArray(userIds) || amount === undefined) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Get DKP cap
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    await db.transaction(async (tx) => {
      for (const userId of userIds) {
        if (amount > 0) {
          // Use cap-aware function for positive amounts
          await addDkpWithCap(tx, userId, amount, dkpCap);
        } else {
          // No cap for negative amounts
          await tx.run(`
            UPDATE member_dkp
            SET current_dkp = MAX(0, current_dkp + ?)
            WHERE user_id = ?
          `, amount, userId);
        }

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, userId, amount, reason || 'Bulk adjustment', req.user.userId);
      }
    });

    io.emit('dkp_bulk_updated', { userIds, amount });
    res.json({ message: `DKP adjusted for ${userIds.length} members` });
  } catch (error) {
    console.error('Bulk adjust error:', error);
    res.status(500).json({ error: 'Failed to bulk adjust DKP' });
  }
});

// Apply DKP decay (admin only)
app.post('/api/dkp/decay', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { percentage } = req.body;

    if (!percentage || percentage <= 0 || percentage > 100) {
      return res.status(400).json({ error: 'Invalid decay percentage' });
    }

    const multiplier = 1 - (percentage / 100);

    await db.run(`
      UPDATE member_dkp
      SET current_dkp = CAST(current_dkp * ? AS INTEGER)
    `, multiplier);

    await db.run(`
      INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
      SELECT user_id, -CAST(current_dkp * ? AS INTEGER), ?, ?
      FROM member_dkp
    `, percentage / 100, `DKP Decay ${percentage}%`, req.user.userId);

    io.emit('dkp_decay_applied', { percentage });
    res.json({ message: `${percentage}% DKP decay applied` });
  } catch (error) {
    console.error('DKP decay error:', error);
    res.status(500).json({ error: 'Failed to apply DKP decay' });
  }
});

// Get DKP history for a user
app.get('/api/dkp/history/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const dkpStats = await db.get(`
      SELECT current_dkp, lifetime_gained, lifetime_spent, last_decay_at
      FROM member_dkp
      WHERE user_id = ?
    `, userId);

    const history = await db.all(`
      SELECT dt.*, u.character_name, u.username,
             a.item_name AS auction_item_name, a.item_image AS auction_item_image,
             a.item_rarity AS auction_item_rarity, a.item_id AS auction_item_id
      FROM dkp_transactions dt
      LEFT JOIN users u ON dt.performed_by = u.id
      LEFT JOIN auctions a ON dt.auction_id = a.id
      WHERE dt.user_id = ?
      ORDER BY dt.created_at DESC
      LIMIT ?
    `, userId, limit);

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
        createdAt: h.created_at,
        auctionItem: h.auction_item_name ? {
          name: h.auction_item_name,
          image: h.auction_item_image,
          rarity: h.auction_item_rarity,
          itemId: h.auction_item_id
        } : null
      }))
    });
  } catch (error) {
    console.error('DKP history error:', error);
    res.status(500).json({ error: 'Failed to get DKP history' });
  }
});

// ============================================
// CALENDAR ROUTES
// ============================================

// Helper: Get raid dates for the next N weeks
async function getRaidDates(weeks = 2) {
  const raidDays = await db.all(`
    SELECT day_of_week, day_name, raid_time
    FROM raid_days
    WHERE is_active = 1
    ORDER BY day_of_week
  `);

  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const jsDay = date.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;

    const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
    if (raidDay) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const raidTimeStr = raidDay.raid_time || '21:00';
      const [raidH, raidM] = raidTimeStr.split(':').map(Number);
      const raidStart = new Date(date);
      raidStart.setHours(raidH, raidM, 0, 0);
      const cutoff = new Date(raidStart.getTime() - 8 * 60 * 60 * 1000);
      const cutoffH = String(cutoff.getHours()).padStart(2, '0');
      const cutoffM = String(cutoff.getMinutes()).padStart(2, '0');

      dates.push({
        date: dateStr,
        dayOfWeek: dbDay,
        dayName: raidDay.day_name,
        raidTime: raidTimeStr,
        cutoffTime: `${cutoffH}:${cutoffM}`,
        isLocked: new Date() > cutoff
      });
    }
  }

  return dates;
}

// Get configured raid days
app.get('/api/calendar/raid-days', authenticateToken, async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    const raidDays = await db.all(`
      SELECT day_of_week, day_name, is_active, raid_time
      FROM raid_days
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY day_of_week
    `);

    res.json(raidDays);
  } catch (error) {
    console.error('Get raid days error:', error);
    res.status(500).json({ error: 'Failed to get raid days' });
  }
});

// Update raid days configuration (admin only)
app.put('/api/calendar/raid-days', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { days } = req.body;

    if (!days || !Array.isArray(days)) {
      return res.status(400).json({ error: 'days array required' });
    }

    await db.run('UPDATE raid_days SET is_active = 0');

    const dayNames = {
      1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
      5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
    };

    for (const day of days) {
      await db.run(`
        INSERT INTO raid_days (day_of_week, day_name, is_active, raid_time)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(day_of_week) DO UPDATE SET
          day_name = excluded.day_name,
          is_active = 1,
          raid_time = excluded.raid_time
      `, day.dayOfWeek, day.dayName || dayNames[day.dayOfWeek], day.raidTime || '20:00');
    }

    res.json({ message: 'Raid days updated' });
  } catch (error) {
    console.error('Update raid days error:', error);
    res.status(500).json({ error: 'Failed to update raid days' });
  }
});

// Get upcoming raid dates for next 2 weeks
app.get('/api/calendar/dates', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 2;
    const dates = await getRaidDates(Math.min(weeks, 4));
    res.json(dates);
  } catch (error) {
    console.error('Get calendar dates error:', error);
    res.status(500).json({ error: 'Failed to get calendar dates' });
  }
});

// Get user's signups for upcoming dates
app.get('/api/calendar/my-signups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const weeks = parseInt(req.query.weeks) || 2;

    const raidDates = await getRaidDates(weeks);
    const dateStrings = raidDates.map(d => d.date);

    if (dateStrings.length === 0) {
      return res.json({ dates: [] });
    }

    const placeholders = dateStrings.map(() => '?').join(',');
    const signups = await db.all(`
      SELECT raid_date, status, notes, dkp_awarded, updated_at
      FROM member_availability
      WHERE user_id = ? AND raid_date IN (${placeholders})
    `, userId, ...dateStrings);

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
  } catch (error) {
    console.error('Get my signups error:', error);
    res.status(500).json({ error: 'Failed to get signups' });
  }
});

// Create/update signup for a specific date
app.post('/api/calendar/signup', authenticateToken, async (req, res) => {
  try {
    const { date, status, notes } = req.body;
    const userId = req.user.userId;

    if (!date || !status) {
      return res.status(400).json({ error: 'date and status are required' });
    }

    if (!['confirmed', 'declined', 'tentative'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: confirmed, declined, or tentative' });
    }

    const dateObj = new Date(date + 'T12:00:00');
    const jsDay = dateObj.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;

    const raidDay = await db.get('SELECT * FROM raid_days WHERE day_of_week = ? AND is_active = 1', dbDay);
    if (!raidDay) {
      return res.status(400).json({ error: 'Selected date is not a raid day' });
    }

    const raidTimeStr = raidDay.raid_time || '21:00';
    const [raidH, raidM] = raidTimeStr.split(':').map(Number);
    const raidStart = new Date(dateObj);
    raidStart.setHours(raidH, raidM, 0, 0);
    const cutoff = new Date(raidStart.getTime() - 8 * 60 * 60 * 1000);

    if (new Date() > cutoff) {
      return res.status(400).json({ error: 'Signup deadline has passed (8 hours before raid start)' });
    }

    const existing = await db.get(`
      SELECT id, dkp_awarded FROM member_availability WHERE user_id = ? AND raid_date = ?
    `, userId, date);

    let dkpAwarded = 0;
    const isFirstSignup = !existing;

    if (isFirstSignup) {
      const dkpConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'calendar_dkp_per_day'");
      const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
      const dkpPerDay = parseInt(dkpConfig?.config_value || '1', 10);
      const dkpCap = parseInt(capConfig?.config_value || '250', 10);

      // Get current DKP to check cap
      const currentMember = await db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
      const currentDkp = currentMember?.current_dkp || 0;
      dkpAwarded = Math.min(dkpPerDay, dkpCap - currentDkp);
      dkpAwarded = Math.max(0, dkpAwarded); // Ensure non-negative

      await db.run(`
        INSERT INTO member_availability (user_id, raid_date, status, notes, dkp_awarded)
        VALUES (?, ?, ?, ?, ?)
      `, userId, date, status, notes || null, dkpAwarded);

      if (dkpAwarded > 0) {
        await db.run(`
          UPDATE member_dkp
          SET current_dkp = current_dkp + ?,
              lifetime_gained = lifetime_gained + ?
          WHERE user_id = ?
        `, dkpAwarded, dkpAwarded, userId);

        await db.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, userId, dkpAwarded, `Calendario: registro para ${date}`, userId);

        io.emit('dkp_updated', { userId, amount: dkpAwarded, reason: 'calendar_signup' });
      }
    } else {
      await db.run(`
        UPDATE member_availability
        SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND raid_date = ?
      `, status, notes || null, userId, date);

      dkpAwarded = existing.dkp_awarded;
    }

    res.json({
      message: isFirstSignup ? 'Signup created' : 'Signup updated',
      date,
      status,
      dkpAwarded,
      isFirstSignup
    });
  } catch (error) {
    console.error('Calendar signup error:', error);
    res.status(500).json({ error: 'Failed to save signup' });
  }
});

// Get summary for a specific date (all users)
app.get('/api/calendar/summary/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const isAdmin = ['admin', 'officer'].includes(req.user.role);

    const users = await db.all(`
      SELECT u.id, u.character_name, u.character_class, u.raid_role, u.spec
      FROM users u
      WHERE u.is_active = 1
      ORDER BY u.character_name
    `);

    const signups = await db.all(`
      SELECT user_id, status, notes
      FROM member_availability
      WHERE raid_date = ?
    `, date);

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

    summary.counts = {
      confirmed: summary.confirmed.length,
      declined: summary.declined.length,
      tentative: summary.tentative.length,
      noResponse: summary.noResponse.length,
      total: users.length
    };

    res.json(summary);
  } catch (error) {
    console.error('Calendar summary error:', error);
    res.status(500).json({ error: 'Failed to get calendar summary' });
  }
});

// Get all signups overview (all authenticated users)
app.get('/api/calendar/overview', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 2;
    const raidDates = await getRaidDates(weeks);

    const users = await db.all(`
      SELECT id, character_name, character_class, raid_role, spec
      FROM users
      WHERE is_active = 1
      ORDER BY character_name
    `);

    if (raidDates.length === 0) {
      return res.json({ dates: [], members: [] });
    }

    const dateStrings = raidDates.map(d => d.date);
    const placeholders = dateStrings.map(() => '?').join(',');
    const allSignups = await db.all(`
      SELECT user_id, raid_date, status, notes
      FROM member_availability
      WHERE raid_date IN (${placeholders})
    `, ...dateStrings);

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
  } catch (error) {
    console.error('Calendar overview error:', error);
    res.status(500).json({ error: 'Failed to get calendar overview' });
  }
});

// ============================================
// AUCTION ROUTES
// ============================================

// Get all active auctions
app.get('/api/auctions/active', authenticateToken, async (req, res) => {
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
    console.error('Get active auctions error:', error);
    res.status(500).json({ error: 'Failed to get active auctions' });
  }
});

// Create new auction (officer+)
app.post('/api/auctions', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
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
    `, itemName, itemNameEN || itemName, itemImage || '🎁', itemRarity || 'epic', minBid || 0, req.user.userId, duration, endsAt, itemId || null);

    const auction = await db.get('SELECT * FROM auctions WHERE id = ?', result.lastInsertRowid);

    setTimeout(() => {
      autoCloseAuction(auction.id);
    }, duration * 60 * 1000);

    io.emit('auction_started', auction);
    res.status(201).json(auction);
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({ error: 'Failed to create auction' });
  }
});

// Place bid
app.post('/api/auctions/:auctionId/bid', userLimiter, authenticateToken, async (req, res) => {
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

    const highestBid = await db.get(`
      SELECT MAX(amount) as max_bid FROM auction_bids WHERE auction_id = ?
    `, auctionId);

    if (highestBid && highestBid.max_bid >= amount) {
      return res.status(400).json({ error: 'Bid must be higher than current highest bid' });
    }

    await db.run('DELETE FROM auction_bids WHERE auction_id = ? AND user_id = ?', auctionId, userId);

    await db.run(`
      INSERT INTO auction_bids (auction_id, user_id, amount)
      VALUES (?, ?, ?)
    `, auctionId, userId, amount);

    const user = await db.get('SELECT character_name, character_class FROM users WHERE id = ?', userId);

    io.emit('bid_placed', {
      auctionId,
      userId,
      characterName: user.character_name,
      characterClass: user.character_class,
      amount
    });

    res.json({ message: 'Bid placed successfully' });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// End auction (officer+) - with tie-breaking rolls
app.post('/api/auctions/:auctionId/end', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
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
        console.log(`🎲 Tie detected for auction ${auctionId}: ${topBidders.length} bidders at ${highestAmount} DKP`);

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

        console.log(`🏆 Tie resolved: ${winner.character_name} wins with roll ${winningRoll}`);
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
      ...result
    };

    io.emit('auction_ended', eventData);
    res.json(eventData);
  } catch (error) {
    console.error('End auction error:', error);
    res.status(500).json({ error: 'Failed to end auction' });
  }
});

// Cancel auction (officer+)
app.post('/api/auctions/:auctionId/cancel', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { auctionId } = req.params;

    await db.run(`
      UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'
    `, auctionId);

    io.emit('auction_cancelled', { auctionId });
    res.json({ message: 'Auction cancelled' });
  } catch (error) {
    console.error('Cancel auction error:', error);
    res.status(500).json({ error: 'Failed to cancel auction' });
  }
});

// Cancel ALL active auctions (admin only) - for cleanup
app.post('/api/auctions/cancel-all', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await db.run(`
      UPDATE auctions SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP WHERE status = 'active'
    `);

    io.emit('auctions_cleared', { count: result.changes });
    res.json({ message: `Cancelled ${result.changes} active auctions` });
  } catch (error) {
    console.error('Cancel all auctions error:', error);
    res.status(500).json({ error: 'Failed to cancel auctions' });
  }
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
app.get('/api/auctions/history', authenticateToken, async (req, res) => {
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
        try { entry.farewell = JSON.parse(a.farewell_data); } catch (e) {}
      }
      return entry;
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Auction history error:', error);
    res.status(500).json({ error: 'Failed to get auction history' });
  }
});

// Get rolls for a specific auction
app.get('/api/auctions/:auctionId/rolls', authenticateToken, async (req, res) => {
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
    console.error('Get auction rolls error:', error);
    res.status(500).json({ error: 'Failed to get auction rolls' });
  }
});

// ============================================
// RAID ROUTES
// ============================================

// Create raid event (officer+)
app.post('/api/raids', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { name, scheduledAt, dkpReward } = req.body;

    const result = await db.run(`
      INSERT INTO raids (name, scheduled_at, dkp_reward, created_by)
      VALUES (?, ?, ?, ?)
    `, name, scheduledAt, dkpReward || 10, req.user.userId);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Raid created' });
  } catch (error) {
    console.error('Create raid error:', error);
    res.status(500).json({ error: 'Failed to create raid' });
  }
});

// Record attendance
app.post('/api/raids/:raidId/attendance', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { raidId } = req.params;
    const { attendees } = req.body;

    const raid = await db.get('SELECT * FROM raids WHERE id = ?', raidId);
    if (!raid) {
      return res.status(404).json({ error: 'Raid not found' });
    }

    await db.transaction(async (tx) => {
      for (const userId of attendees) {
        await tx.run('INSERT OR IGNORE INTO raid_attendance (raid_id, user_id) VALUES (?, ?)', raidId, userId);

        await tx.run(`
          UPDATE member_dkp
          SET current_dkp = current_dkp + ?,
              lifetime_gained = lifetime_gained + ?
          WHERE user_id = ?
        `, raid.dkp_reward, raid.dkp_reward, userId);

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
          VALUES (?, ?, ?, ?)
        `, userId, raid.dkp_reward, `Raid attendance: ${raid.name}`, req.user.userId);
      }
    });

    io.emit('attendance_recorded', { raidId, attendees, dkpReward: raid.dkp_reward });
    res.json({ message: `Attendance recorded for ${attendees.length} members` });
  } catch (error) {
    console.error('Record attendance error:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// ============================================
// IMPORT ROUTES
// ============================================

// Import roster from CSV (admin only)
app.post('/api/import/roster', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { members } = req.body;

    if (!members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    let imported = 0;
    const defaultPassword = bcrypt.hashSync('changeme123', 10);

    await db.transaction(async (tx) => {
      for (const member of members) {
        const result = await tx.run(`
          INSERT OR IGNORE INTO users (username, password, character_name, character_class, raid_role, role)
          VALUES (?, ?, ?, ?, ?, 'raider')
        `, member.username || member.characterName.toLowerCase(), defaultPassword, member.characterName, member.characterClass, member.raidRole || 'DPS');

        if (result.changes > 0) {
          await tx.run(`
            INSERT OR IGNORE INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent)
            VALUES (?, ?, ?, 0)
          `, result.lastInsertRowid, member.dkp || 0, member.dkp || 0);
          imported++;
        }
      }
    });

    res.json({ message: `Imported ${imported} members` });
  } catch (error) {
    console.error('Import roster error:', error);
    res.status(500).json({ error: 'Failed to import roster' });
  }
});

// ============================================
// WARCRAFT LOGS ROUTES
// ============================================

// Get DKP configuration
app.get('/api/warcraftlogs/config', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const configs = await db.all('SELECT * FROM dkp_config');

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
  } catch (error) {
    console.error('Get WCL config error:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// Update DKP configuration
app.put('/api/warcraftlogs/config', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { config_key, config_value } = req.body;

    if (!config_key || config_value === undefined) {
      return res.status(400).json({ error: 'config_key and config_value required' });
    }

    await db.run(`
      UPDATE dkp_config
      SET config_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE config_key = ?
    `, config_value, req.user.userId, config_key);

    res.json({ message: 'Configuration updated', config_key, config_value });
  } catch (error) {
    console.error('Update WCL config error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Preview Warcraft Logs report (before confirming DKP assignment)
app.post('/api/warcraftlogs/preview', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
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

    const reportData = await processWarcraftLog(url);

    const raidDKP = 10;

    const defaultServerConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'default_server'");
    const defaultServer = defaultServerConfig?.config_value || 'Unknown';

    const matchResults = [];
    const anomalies = [];

    for (const participant of reportData.participants) {
      // Check ALL characters (main + alts) for matching
      // First check characters table, then fallback to users.character_name (main)
      const user = await db.get(`
        SELECT DISTINCT u.id, u.username, u.character_name, u.character_class, u.server, md.current_dkp,
               COALESCE(c.character_name, u.character_name) as matched_character
        FROM users u
        LEFT JOIN member_dkp md ON u.id = md.user_id
        LEFT JOIN characters c ON u.id = c.user_id AND LOWER(c.character_name) = LOWER(?)
        WHERE u.is_active = 1 AND (
          LOWER(u.character_name) = LOWER(?) OR
          c.id IS NOT NULL
        )
        LIMIT 1
      `, participant.name, participant.name);

      if (user) {
        const serverMatch = !user.server ||
                           user.server.toLowerCase() === participant.server.toLowerCase() ||
                           participant.server === 'Unknown';

        const isAltMatch = user.matched_character &&
                           user.matched_character.toLowerCase() !== user.character_name.toLowerCase();

        matchResults.push({
          wcl_name: participant.name,
          wcl_server: participant.server,
          wcl_class: participant.class,
          matched: true,
          user_id: user.id,
          username: user.username,
          character_name: user.character_name,
          character_class: user.character_class,
          matched_character: user.matched_character || user.character_name,
          is_alt_match: isAltMatch,
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
        duration: Math.floor(reportData.duration / 60000),
        region: reportData.region,
        guildName: reportData.guildName,
        participantCount: reportData.participantCount,
        bossesKilled: reportData.bossesKilled,
        totalBosses: reportData.totalBosses,
        totalAttempts: reportData.totalAttempts,
        bosses: reportData.bosses,
        fights: reportData.fights
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
      can_proceed: true
    });

  } catch (error) {
    console.error('Error previewing Warcraft Log:', error);
    res.status(500).json({
      error: 'Failed to process Warcraft Log'
    });
  }
});

// Confirm and assign DKP from Warcraft Logs report
app.post('/api/warcraftlogs/confirm', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { reportCode, participants } = req.body;

    if (!reportCode || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ error: 'reportCode and participants array required' });
    }

    const alreadyProcessed = await db.get(
      'SELECT * FROM warcraft_logs_processed WHERE report_code = ? AND is_reverted = 0', reportCode
    );

    if (alreadyProcessed) {
      return res.status(409).json({
        error: 'This report has already been processed'
      });
    }

    const matchedParticipants = participants.filter(p => p.matched && p.user_id);

    if (matchedParticipants.length === 0) {
      return res.status(400).json({ error: 'No matched participants to assign DKP' });
    }

    const reportTitle = req.body.reportTitle || `Raid ${reportCode}`;
    const startTime = req.body.startTime || Date.now();
    const endTime = req.body.endTime || Date.now();
    const raidDate = req.body.raidDate || null;

    // Get DKP cap
    const capConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'dkp_cap'");
    const dkpCap = parseInt(capConfig?.config_value || '250', 10);

    const totalDKP = await db.transaction(async (tx) => {
      // Insert the processed report first so we can get its ID for transactions
      const reportResult = await tx.run(`
        INSERT INTO warcraft_logs_processed
        (report_code, report_title, start_time, end_time, region, guild_name, participants_count, dkp_assigned, processed_by, raid_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, reportCode, reportTitle, startTime, endTime, req.body.region || 'Unknown', req.body.guildName || null, matchedParticipants.length, req.user.userId, raidDate);

      const wclReportId = reportResult.lastInsertRowid;
      let totalAssigned = 0;

      for (const participant of matchedParticipants) {
        const dkpAmount = participant.dkp_to_assign;

        // Use cap-aware DKP addition
        const result = await addDkpWithCap(tx, participant.user_id, dkpAmount, dkpCap);

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, wcl_report_id)
          VALUES (?, ?, ?, ?, ?)
        `, participant.user_id, result.actualGain, `Warcraft Logs: ${reportTitle}${result.wasCapped ? ' (capped)' : ''}`, req.user.userId, wclReportId);

        totalAssigned += result.actualGain;

        const newDkpRow = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', participant.user_id);

        io.emit('dkp_updated', {
          userId: participant.user_id,
          newDkp: newDkpRow?.current_dkp || 0,
          amount: dkpAmount
        });
      }

      // Update the total DKP assigned
      await tx.run('UPDATE warcraft_logs_processed SET dkp_assigned = ? WHERE id = ?', totalAssigned, wclReportId);

      return totalAssigned;
    });

    // Process fight statistics for boss tracking (non-blocking)
    const fights = req.body.fights || [];
    if (fights.length > 0) {
      // Build participant map: lowercase character name -> user_id
      const participantUserMap = {};
      for (const p of matchedParticipants) {
        const wclName = p.wcl_name?.toLowerCase();
        const matchedName = p.matched_character?.toLowerCase();
        if (wclName) participantUserMap[wclName] = p.user_id;
        if (matchedName) participantUserMap[matchedName] = p.user_id;
      }

      // Process in background to not delay response
      (async () => {
        try {
          let statsProcessed = 0;
          const processedBosses = [];

          for (const fight of fights) {
            const result = await processFightStats(reportCode, fight, fight.difficulty);
            if (!result.skipped) {
              statsProcessed++;
              processedBosses.push({ bossId: result.bossId, fightId: fight.id, difficulty: fight.difficulty });
            }
          }

          // Fetch and record deaths + performance stats for each boss fight
          if (processedBosses.length > 0) {
            let totalDeathsRecorded = 0;
            let performanceRecorded = 0;

            for (const bossInfo of processedBosses) {
              // Get comprehensive fight stats (damage, healing, damage taken, deaths)
              const fightStats = await getFightStats(reportCode, [bossInfo.fightId]);

              // Record deaths
              if (fightStats.deaths.length > 0) {
                const deathsFormatted = fightStats.deaths.map(d => ({ name: d.name, deaths: d.total }));
                await recordPlayerDeaths(bossInfo.bossId, bossInfo.difficulty, deathsFormatted, participantUserMap);
                totalDeathsRecorded += fightStats.deaths.reduce((sum, d) => sum + d.total, 0);
              }

              // Record performance (damage, healing, damage taken) and update records
              if (fightStats.damage.length > 0 || fightStats.healing.length > 0) {
                await recordPlayerPerformance(
                  bossInfo.bossId,
                  bossInfo.difficulty,
                  fightStats,
                  participantUserMap,
                  reportCode,
                  bossInfo.fightId
                );
                performanceRecorded++;
              }
            }

            if (totalDeathsRecorded > 0) {
              console.log(`💀 Recorded ${totalDeathsRecorded} deaths from ${reportCode}`);
            }
            if (performanceRecorded > 0) {
              console.log(`📈 Recorded performance for ${performanceRecorded} fights from ${reportCode}`);
            }
          }

          if (statsProcessed > 0) {
            console.log(`📊 Boss stats updated: ${statsProcessed} fights from ${reportCode}`);
          }
        } catch (err) {
          console.error('Error processing fight stats:', err);
        }
      })();
    }

    res.json({
      message: 'DKP assigned successfully from Warcraft Logs',
      report_code: reportCode,
      participants_count: matchedParticipants.length,
      total_dkp_assigned: totalDKP
    });

  } catch (error) {
    console.error('Error confirming Warcraft Log:', error);
    res.status(500).json({
      error: 'Failed to assign DKP'
    });
  }
});

// Get history of processed Warcraft Logs reports
app.get('/api/warcraftlogs/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const history = await db.all(`
      SELECT wlp.*, u.character_name as processed_by_name,
             u2.character_name as reverted_by_name
      FROM warcraft_logs_processed wlp
      LEFT JOIN users u ON wlp.processed_by = u.id
      LEFT JOIN users u2 ON wlp.reverted_by = u2.id
      ORDER BY wlp.processed_at DESC
      LIMIT ?
    `, limit);

    res.json(history);
  } catch (error) {
    console.error('WCL history error:', error);
    res.status(500).json({ error: 'Failed to get WCL history' });
  }
});

// Get all DKP transactions for a specific WCL report
app.get('/api/warcraftlogs/report/:code/transactions', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const report = await db.get('SELECT id, report_code, report_title, is_reverted FROM warcraft_logs_processed WHERE report_code = ?', code);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Try by wcl_report_id first, fall back to reason LIKE match
    let transactions = await db.all(`
      SELECT dt.*, u.character_name, u.character_class
      FROM dkp_transactions dt
      LEFT JOIN users u ON dt.user_id = u.id
      WHERE dt.wcl_report_id = ?
      ORDER BY dt.created_at DESC
    `, report.id);

    if (transactions.length === 0) {
      transactions = await db.all(`
        SELECT dt.*, u.character_name, u.character_class
        FROM dkp_transactions dt
        LEFT JOIN users u ON dt.user_id = u.id
        WHERE dt.reason LIKE ?
        ORDER BY dt.created_at DESC
      `, `Warcraft Logs: ${report.report_title}%`);
    }

    res.json({ report, transactions });
  } catch (error) {
    console.error('WCL report transactions error:', error);
    res.status(500).json({ error: 'Failed to get report transactions' });
  }
});

// Revert all DKP from a WCL report (atomic)
app.post('/api/warcraftlogs/revert/:reportCode', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { reportCode } = req.params;

    const report = await db.get(
      'SELECT * FROM warcraft_logs_processed WHERE report_code = ? AND is_reverted = 0',
      reportCode
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found or already reverted' });
    }

    await db.transaction(async (tx) => {
      // Find all transactions linked to this report
      let transactions = await tx.all(
        'SELECT * FROM dkp_transactions WHERE wcl_report_id = ?', report.id
      );

      // Fallback to reason match for legacy records
      if (transactions.length === 0) {
        transactions = await tx.all(
          'SELECT * FROM dkp_transactions WHERE reason LIKE ?',
          `Warcraft Logs: ${report.report_title}%`
        );
      }

      // Create reversal transactions and subtract DKP
      for (const txn of transactions) {
        if (txn.amount <= 0) continue;

        await tx.run(`
          UPDATE member_dkp
          SET current_dkp = current_dkp - ?,
              lifetime_gained = lifetime_gained - ?
          WHERE user_id = ?
        `, txn.amount, txn.amount, txn.user_id);

        await tx.run(`
          INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, wcl_report_id)
          VALUES (?, ?, ?, ?, ?)
        `, txn.user_id, -txn.amount, `Revert: ${report.report_title}`, req.user.userId, report.id);

        const newDkpRow = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', txn.user_id);
        io.emit('dkp_updated', {
          userId: txn.user_id,
          newDkp: newDkpRow?.current_dkp || 0,
          amount: -txn.amount
        });
      }

      // Mark report as reverted
      await tx.run(`
        UPDATE warcraft_logs_processed
        SET is_reverted = 1, reverted_by = ?, reverted_at = datetime('now')
        WHERE id = ?
      `, req.user.userId, report.id);
    });

    res.json({ message: 'DKP reverted successfully', report_code: reportCode });
  } catch (error) {
    console.error('WCL revert error:', error);
    res.status(500).json({ error: 'Failed to revert DKP' });
  }
});

// Auto-detect guild reports for a specific raid date
app.get('/api/warcraftlogs/guild-reports', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date parameter required (YYYY-MM-DD)' });
    }

    // Get guild ID from config
    const guildConfig = await db.get("SELECT config_value FROM dkp_config WHERE config_key = 'wcl_guild_id'");
    if (!guildConfig) {
      return res.status(400).json({ error: 'WCL guild ID not configured. Set wcl_guild_id in DKP config.' });
    }

    const guildId = parseInt(guildConfig.config_value);

    // Search window: raid date 18:00 to next day 06:00 (Europe/Madrid)
    const raidDate = new Date(date + 'T18:00:00+01:00');
    const raidEnd = new Date(date + 'T06:00:00+01:00');
    raidEnd.setDate(raidEnd.getDate() + 1);

    const startTime = raidDate.getTime();
    const endTime = raidEnd.getTime();

    const reports = await getGuildReports(guildId, startTime, endTime);

    // Check which reports are already processed
    for (const report of reports) {
      const processed = await db.get(
        'SELECT id, is_reverted FROM warcraft_logs_processed WHERE report_code = ?',
        report.code
      );
      report.alreadyProcessed = !!processed && !processed.is_reverted;
      report.wasReverted = !!processed && !!processed.is_reverted;
    }

    res.json(reports);
  } catch (error) {
    console.error('Guild reports error:', error);
    res.status(500).json({ error: 'Failed to fetch guild reports' });
  }
});

// Get past raid history with WCL logs
app.get('/api/calendar/history', authenticateToken, async (req, res) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 8, 12); // Max 12 weeks of history
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const raidDays = await db.all('SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1 ORDER BY day_of_week');

    // Collect past raid dates
    const pastDates = [];
    for (let i = 1; i <= weeks * 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const jsDay = d.getDay();
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
      if (raidDay) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        pastDates.push({ date: `${year}-${month}-${day}`, dayName: raidDay.day_name, raidTime: raidDay.raid_time || '21:00' });
      }
    }

    if (pastDates.length === 0) {
      return res.json([]);
    }

    // Get WCL reports linked to these dates
    const dateStrings = pastDates.map(d => d.date);
    const placeholders = dateStrings.map(() => '?').join(',');

    const linkedReports = await db.all(`
      SELECT report_code, report_title, raid_date, dkp_assigned, participants_count, is_reverted
      FROM warcraft_logs_processed
      WHERE raid_date IN (${placeholders})
    `, ...dateStrings);

    // Get attendance counts for each date
    const attendanceCounts = await db.all(`
      SELECT raid_date,
             SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
             SUM(CASE WHEN status = 'tentative' THEN 1 ELSE 0 END) as tentative,
             SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined
      FROM member_availability
      WHERE raid_date IN (${placeholders})
      GROUP BY raid_date
    `, ...dateStrings);

    const enriched = pastDates.map(d => {
      const report = linkedReports.find(r => r.raid_date === d.date && !r.is_reverted);
      const attendance = attendanceCounts.find(a => a.raid_date === d.date);
      return {
        ...d,
        wclReport: report ? {
          code: report.report_code,
          title: report.report_title,
          dkpAssigned: report.dkp_assigned,
          participantsCount: report.participants_count,
        } : null,
        attendance: attendance ? {
          confirmed: attendance.confirmed,
          tentative: attendance.tentative,
          declined: attendance.declined,
        } : null,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Calendar history error:', error);
    res.status(500).json({ error: 'Failed to get raid history' });
  }
});

// Get raid dates enriched with WCL report info
app.get('/api/calendar/dates-with-logs', authenticateToken, async (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks) || 4;
    const raidDates = await getRaidDates(weeks);

    if (raidDates.length === 0) {
      return res.json([]);
    }

    // Also look back 2 weeks for past raid dates
    const pastWeeks = 2;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const raidDays = await db.all('SELECT day_of_week, day_name, raid_time FROM raid_days WHERE is_active = 1 ORDER BY day_of_week');
    const pastDates = [];
    for (let i = pastWeeks * 7; i > 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const jsDay = d.getDay();
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const raidDay = raidDays.find(rd => rd.day_of_week === dbDay);
      if (raidDay) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        pastDates.push({ date: `${year}-${month}-${day}`, dayName: raidDay.day_name, raidTime: raidDay.raid_time, isPast: true });
      }
    }

    const allDates = [...pastDates, ...raidDates.map(d => ({ ...d, isPast: false }))];

    // Get all WCL reports linked to these dates
    const allDateStrings = allDates.map(d => d.date);
    const placeholders = allDateStrings.map(() => '?').join(',');

    const linkedReports = allDateStrings.length > 0 ? await db.all(`
      SELECT report_code, report_title, raid_date, dkp_assigned, participants_count, is_reverted
      FROM warcraft_logs_processed
      WHERE raid_date IN (${placeholders})
    `, ...allDateStrings) : [];

    const enriched = allDates.map(d => {
      const report = linkedReports.find(r => r.raid_date === d.date && !r.is_reverted);
      return {
        ...d,
        wclReport: report ? {
          code: report.report_code,
          title: report.report_title,
          dkpAssigned: report.dkp_assigned,
          participantsCount: report.participants_count,
        } : null,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Dates with logs error:', error);
    res.status(500).json({ error: 'Failed to get dates with logs' });
  }
});

// ============================================
// BOSS STATISTICS ENDPOINTS
// ============================================

// Get all zones with bosses (current + legacy)
app.get('/api/bosses', authenticateToken, async (req, res) => {
  try {
    const data = await getAllZonesWithBosses();
    res.json(data);
  } catch (error) {
    console.error('Get bosses error:', error);
    res.status(500).json({ error: 'Failed to get boss data' });
  }
});

// Get detailed stats for a specific boss
app.get('/api/bosses/:bossId', authenticateToken, async (req, res) => {
  try {
    const { bossId } = req.params;
    const data = await getBossDetails(parseInt(bossId));

    if (!data) {
      return res.status(404).json({ error: 'Boss not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get boss details error:', error);
    res.status(500).json({ error: 'Failed to get boss details' });
  }
});

// Reseed raid data from static definitions (admin only)
app.post('/api/bosses/sync', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    await seedRaidData();
    res.json({ message: 'Raid data synced successfully' });
  } catch (error) {
    console.error('Sync raid data error:', error);
    res.status(500).json({ error: 'Failed to sync raid data' });
  }
});

// Mark a zone as legacy or current (admin only)
app.put('/api/bosses/zones/:zoneId/legacy', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { isLegacy } = req.body;

    await setZoneLegacy(parseInt(zoneId), isLegacy);
    res.json({ message: `Zone marked as ${isLegacy ? 'legacy' : 'current'}` });
  } catch (error) {
    console.error('Set zone legacy error:', error);
    res.status(500).json({ error: 'Failed to update zone status' });
  }
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

(async () => {
  await initDatabase();
  await seedRaidData();
  await scheduleExistingAuctions();

  server.listen(PORT, () => {
    console.log('==========================================');
    console.log('  DKP Backend Server - BUILD v3.0 Turso');
    console.log('==========================================');
    console.log(`🎮 DKP Server running on port ${PORT}`);
    console.log(`📡 WebSocket ready for real-time updates`);
  });
})();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

export { app, io };
