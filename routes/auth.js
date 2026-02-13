import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { authLimiter } from '../lib/rateLimiters.js';
import { isValidEmail } from '../lib/helpers.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { JWT_SECRET, FRONTEND_URL } from '../lib/config.js';

const router = Router();

// Login
router.post('/login', authLimiter, async (req, res) => {
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
router.post('/register', authLimiter, async (req, res) => {
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

    const userId = userResult.lastInsertRowid;

    // Create member_dkp entry with default DPS role
    await db.run(`
      INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent, role)
      VALUES (?, 0, 0, 0, 'DPS')
    `, userId);

    console.log(`New user registered: ${username} (email: ${email})`);

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
router.post('/forgot-password', authLimiter, async (req, res) => {
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

    const resetUrl = `${FRONTEND_URL.split(',')[0].trim().replace(/\/+$/, '')}/reset-password/${resetToken}`;

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
router.post('/reset-password', authLimiter, async (req, res) => {
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
    } catch (_err) {
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
router.post('/change-password', authenticateToken, async (req, res) => {
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
router.post('/admin-reset-password', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
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
router.get('/me', authenticateToken, async (req, res) => {
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
router.put('/profile', authenticateToken, async (req, res) => {
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
      req.app.get('io').emit('member_updated', { memberId: userId });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
