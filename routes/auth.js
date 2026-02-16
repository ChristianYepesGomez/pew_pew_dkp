import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticateToken, authorizeRole, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { platformDb } from '../platformDb.js';
import express from 'express';
import { authLimiter, forgotPasswordLimiter } from '../lib/rateLimiters.js';
import { isValidEmail } from '../lib/helpers.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { JWT_SECRET, FRONTEND_URL } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { hashToken } from '../lib/encryption.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:Auth');
const router = Router();

// Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await req.db.get(`
      SELECT u.id, u.username, u.password, u.character_name, u.character_class, u.role,
             md.current_dkp
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE LOWER(u.username) = LOWER(?) AND u.is_active = 1
    `, username);

    if (!user) {
      return error(res, 'Invalid credentials', 401, ErrorCodes.UNAUTHORIZED);
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return error(res, 'Invalid credentials', 401, ErrorCodes.UNAUTHORIZED);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store hashed refresh token in DB with a new token family
    await req.db.run(
      'INSERT INTO refresh_tokens (user_id, token, token_family, expires_at) VALUES (?, ?, ?, ?)',
      user.id, hashToken(refreshToken), crypto.randomUUID(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );

    return success(res, {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        characterName: user.character_name,
        characterClass: user.character_class,
        role: user.role,
        currentDkp: user.current_dkp || 0
      }
    });

  } catch (err) {
    log.error('Login error', err);
    return error(res, 'Login failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Register a new account (public, rate-limited)
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validate required fields - only username, password, and email required
    if (!username || !password || !email) {
      return error(res, 'Username, password, and email are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (username.length < 3) {
      return error(res, 'Username must be at least 3 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (password.length < 6) {
      return error(res, 'Password must be at least 6 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!isValidEmail(email)) {
      return error(res, 'Invalid email format', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if username already exists
    const existingUser = await req.db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', username.trim());
    if (existingUser) {
      return error(res, 'Username already taken', 409, ErrorCodes.ALREADY_EXISTS);
    }

    // Check if email already exists
    const existingEmail = await req.db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', email.trim());
    if (existingEmail) {
      return error(res, 'Email already in use', 409, ErrorCodes.ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user without character - character will be added later via Blizzard import
    const userResult = await req.db.run(`
      INSERT INTO users (username, password, role, email)
      VALUES (?, ?, 'raider', ?)
    `, username.trim(), hashedPassword, email.trim());

    const userId = userResult.lastInsertRowid;

    // Create member_dkp entry with default DPS role
    await req.db.run(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent, role)
      VALUES (?, 0, 0, 0, 'DPS')
    `, userId);

    log.info(`New user registered: ${username} (email: ${email})`);

    // Issue tokens on registration so user is immediately logged in
    const newUser = { id: userId, username: username.trim(), role: 'raider' };
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    await req.db.run(
      'INSERT INTO refresh_tokens (user_id, token, token_family, expires_at) VALUES (?, ?, ?, ?)',
      userId, hashToken(refreshToken), crypto.randomUUID(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );

    return success(res, {
      userId: userId,
      token: accessToken,
      refreshToken
    }, 'Account created successfully', 201);

  } catch (err) {
    log.error('Registration error', err);
    return error(res, 'Registration failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Request password reset - searches by username or email
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { usernameOrEmail } = req.body;

    if (!usernameOrEmail) {
      return error(res, 'Username or email required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const user = await req.db.get(`
      SELECT id, username, email FROM users
      WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND is_active = 1
    `, usernameOrEmail, usernameOrEmail);

    if (!user) {
      return error(res, 'User not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (!user.email) {
      return error(res, 'No email configured for this user. Contact an administrator.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await req.db.run(`
      UPDATE users SET reset_token = ?, reset_token_expires = datetime('now', '+1 hour')
      WHERE id = ?
    `, resetToken, user.id);

    const resetUrl = `${FRONTEND_URL.split(',')[0].trim().replace(/\/+$/, '')}/reset-password/${resetToken}`;

    const emailSent = await sendPasswordResetEmail(user.email, user.username, resetUrl);

    if (!emailSent) {
      log.info(`Password reset link for ${user.username}: ${resetUrl}`);
    }

    return success(res, {
      ...((!emailSent || process.env.NODE_ENV !== 'production') && { resetToken })
    }, emailSent ? 'Password reset link sent to your email' : 'Email not configured. Check server console for reset link.');

  } catch (err) {
    log.error('Forgot password error', err);
    return error(res, 'Request failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Reset password with token
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return error(res, 'Token and password required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'password_reset') {
        return error(res, 'Invalid reset token', 400, ErrorCodes.INVALID_TOKEN);
      }
    } catch (_err) {
      return error(res, 'Invalid or expired reset token', 400, ErrorCodes.INVALID_TOKEN);
    }

    const user = await req.db.get(`
      SELECT id FROM users
      WHERE id = ? AND reset_token = ? AND reset_token_expires > datetime('now')
    `, decoded.userId, token);

    if (!user) {
      return error(res, 'Invalid or expired reset token', 400, ErrorCodes.INVALID_TOKEN);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await req.db.run(`
      UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL
      WHERE id = ?
    `, hashedPassword, user.id);

    return success(res, null, 'Password reset successfully');

  } catch (err) {
    log.error('Reset password error', err);
    return error(res, 'Password reset failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Change own password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return error(res, 'Current and new password required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (newPassword.length < 6) {
      return error(res, 'Password must be at least 6 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const user = await req.db.get('SELECT id, password FROM users WHERE id = ?', userId);
    if (!user) {
      return error(res, 'User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return error(res, 'Current password is incorrect', 401, ErrorCodes.UNAUTHORIZED);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await req.db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', hashedPassword, userId);

    return success(res, null, 'Password updated successfully');

  } catch (err) {
    log.error('Change password error', err);
    return error(res, 'Failed to change password', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Reset password for another user (Admin/Officer only)
router.post('/admin-reset-password', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return error(res, 'User ID and new password required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (newPassword.length < 6) {
      return error(res, 'Password must be at least 6 characters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const user = await req.db.get('SELECT id, character_name FROM users WHERE id = ?', userId);
    if (!user) {
      return error(res, 'User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await req.db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', hashedPassword, userId);

    return success(res, null, `Password reset successfully for ${user.character_name}`);

  } catch (err) {
    log.error('Reset password error', err);
    return error(res, 'Failed to reset password', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await req.db.get(`
      SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.spec, u.raid_role, u.email, u.avatar,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.id = ?
    `, req.user.userId);

    if (!user) {
      return error(res, 'User not found', 404, ErrorCodes.NOT_FOUND);
    }

    return success(res, {
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
  } catch (err) {
    log.error('Get user error', err);
    return error(res, 'Failed to get user info', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Update own profile (email, password, avatar) — 5mb limit for avatar uploads
router.put('/profile', express.json({ limit: '5mb' }), authenticateToken, async (req, res) => {
  try {
    const { email, currentPassword, newPassword, avatar } = req.body;
    const userId = req.user.userId;

    // Handle email update
    if (email !== undefined) {
      if (email !== null && email !== '' && !isValidEmail(email)) {
        return error(res, 'Invalid email format', 400, ErrorCodes.VALIDATION_ERROR);
      }
      await req.db.run(
        'UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        email || null, userId
      );
    }

    // Handle password change
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return error(res, 'New password must be at least 6 characters', 400, ErrorCodes.VALIDATION_ERROR);
      }

      // Verify current password
      const user = await req.db.get('SELECT password FROM users WHERE id = ?', userId);
      if (!user) {
        return error(res, 'User not found', 404, ErrorCodes.NOT_FOUND);
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return error(res, 'Current password is incorrect', 400, ErrorCodes.VALIDATION_ERROR);
      }

      // Hash and save new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await req.db.run(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        hashedPassword, userId
      );
    }

    // Handle avatar upload (Base64 image, max 500KB)
    if (avatar !== undefined) {
      if (avatar === null || avatar === '') {
        // Remove avatar
        await req.db.run('UPDATE users SET avatar = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', userId);
      } else {
        // Validate Base64 image
        const base64Pattern = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;
        if (!base64Pattern.test(avatar)) {
          return error(res, 'Invalid image format. Use JPEG, PNG, WebP, or GIF.', 400, ErrorCodes.VALIDATION_ERROR);
        }
        // Check size (roughly 500KB limit for Base64)
        if (avatar.length > 700000) {
          return error(res, 'Image too large. Maximum 500KB allowed.', 400, ErrorCodes.VALIDATION_ERROR);
        }
        await req.db.run('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', avatar, userId);
      }
      // Notify clients to refresh member list (avatar changed)
      req.app.get('io').emit('member_updated', { memberId: userId });
    }

    return success(res, null, 'Profile updated successfully');
  } catch (err) {
    log.error('Update profile error', err);
    return error(res, 'Failed to update profile', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Refresh token rotation
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, 'Refresh token required', 400, ErrorCodes.VALIDATION_ERROR);

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) return error(res, 'Invalid refresh token', 401, ErrorCodes.INVALID_TOKEN);

    const storedToken = await req.db.get(
      'SELECT id, user_id, token_family, used, expires_at FROM refresh_tokens WHERE token = ?', hashToken(refreshToken)
    );
    if (!storedToken) return error(res, 'Token not found', 401, ErrorCodes.INVALID_TOKEN);

    // Replay detection: if token already used, revoke entire family
    if (storedToken.used) {
      await req.db.run('DELETE FROM refresh_tokens WHERE token_family = ?', storedToken.token_family);
      log.warn('Refresh token replay detected', { userId: storedToken.user_id, family: storedToken.token_family });
      return error(res, 'Token compromised, please login again', 401, ErrorCodes.INVALID_TOKEN);
    }

    // Check expiry
    if (new Date(storedToken.expires_at) < new Date()) {
      await req.db.run('DELETE FROM refresh_tokens WHERE id = ?', storedToken.id);
      return error(res, 'Refresh token expired', 401, ErrorCodes.TOKEN_EXPIRED);
    }

    // Mark old token as used
    await req.db.run('UPDATE refresh_tokens SET used = 1 WHERE id = ?', storedToken.id);

    // Get user data for new tokens
    const user = await req.db.get('SELECT id, username, role FROM users WHERE id = ?', storedToken.user_id);
    if (!user) return error(res, 'User not found', 401, ErrorCodes.UNAUTHORIZED);

    // Issue new token pair (same family for rotation tracking)
    const guildId = decoded.guildId || null;
    const newAccessToken = generateAccessToken(user, guildId);
    const newRefreshToken = generateRefreshToken(user, guildId);

    await req.db.run(
      'INSERT INTO refresh_tokens (user_id, token, token_family, expires_at) VALUES (?, ?, ?, ?)',
      user.id, hashToken(newRefreshToken), storedToken.token_family, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    );

    return success(res, { token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    log.error('Token refresh failed', err);
    return error(res, 'Token refresh failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Logout (revoke refresh token family)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const stored = await req.db.get('SELECT token_family FROM refresh_tokens WHERE token = ?', hashToken(refreshToken));
      if (stored) {
        await req.db.run('DELETE FROM refresh_tokens WHERE token_family = ?', stored.token_family);
      }
    }
    return success(res, null, 'Logged out successfully');
  } catch (err) {
    log.error('Logout failed', err);
    return error(res, 'Logout failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── Discord Account Linking ─────────────────────────────────────────
// User enters a code from the Discord bot to link their account
router.post('/discord-link', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return error(res, 'Link code is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { verifyLinkCode } = await import('../bot/utils/linking.js');
    const result = await verifyLinkCode(req.user.userId, code);

    if (result.error) {
      return error(res, result.error, 400, ErrorCodes.VALIDATION_ERROR);
    }

    return success(res, {
      discordUsername: result.discordUsername,
    }, 'Discord account linked successfully');
  } catch (err) {
    log.error('Discord link error', err);
    return error(res, 'Failed to link Discord account', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get Discord link status
router.get('/discord-status', authenticateToken, async (req, res) => {
  try {
    const user = await req.db.get('SELECT discord_id FROM users WHERE id = ?', req.user.userId);
    return success(res, { linked: !!user?.discord_id, discordId: user?.discord_id || null });
  } catch (err) {
    log.error('Discord status error', err);
    return error(res, 'Failed to get Discord status', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Unlink Discord account
router.delete('/discord-link', authenticateToken, async (req, res) => {
  try {
    await req.db.run('UPDATE users SET discord_id = NULL WHERE id = ?', req.user.userId);
    return success(res, null, 'Discord account unlinked');
  } catch (err) {
    log.error('Discord unlink error', err);
    return error(res, 'Failed to unlink Discord account', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── Multi-Tenancy: Guild Management ─────────────────────────────────

// List guilds the current user belongs to
router.get('/guilds', authenticateToken, async (req, res) => {
  try {
    const userId = String(req.user.userId);
    const memberships = await platformDb.all(`
      SELECT g.id, g.name, g.slug, g.realm, g.region, g.plan, gm.role, gm.character_name
      FROM guild_memberships gm
      JOIN guilds g ON gm.guild_id = g.id
      WHERE gm.user_id = ?
      ORDER BY gm.joined_at
    `, userId);

    return success(res, { guilds: memberships });
  } catch (err) {
    log.error('List guilds error', err);
    return error(res, 'Failed to list guilds', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Switch to a different guild — returns new tokens scoped to the guild
router.post('/switch-guild', authenticateToken, async (req, res) => {
  try {
    const { guildId } = req.body;
    if (!guildId) return error(res, 'guildId is required', 400, ErrorCodes.VALIDATION_ERROR);

    const userId = String(req.user.userId);
    const membership = await platformDb.get(
      'SELECT role FROM guild_memberships WHERE user_id = ? AND guild_id = ?', userId, guildId
    );
    if (!membership) return error(res, 'Not a member of this guild', 403, ErrorCodes.FORBIDDEN);

    const user = await req.db.get('SELECT id, username, role FROM users WHERE id = ?', req.user.userId);
    if (!user) return error(res, 'User not found in guild', 404, ErrorCodes.NOT_FOUND);

    const accessToken = generateAccessToken(user, guildId);
    const refreshToken = generateRefreshToken(user, guildId);

    return success(res, { token: accessToken, refreshToken, guildId });
  } catch (err) {
    log.error('Switch guild error', err);
    return error(res, 'Failed to switch guild', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
