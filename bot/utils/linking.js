import crypto from 'crypto';
import { db } from '../../database.js';

const CODE_TTL_MINUTES = 10;

/**
 * Generate a 6-digit link code for a Discord user to bind to a DKP account.
 * Stores the code in `discord_link_codes` with a TTL.
 */
export async function generateLinkCode(discordId, discordUsername, dkpUsername) {
  // Check if the DKP username exists
  const user = await db.get(
    'SELECT id, discord_id FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 1',
    dkpUsername
  );

  if (!user) {
    return { error: `No active user found with username "${dkpUsername}".` };
  }

  if (user.discord_id) {
    return { error: 'This account is already linked to a Discord account.' };
  }

  // Check if this Discord account is already linked to someone
  const existing = await db.get('SELECT id FROM users WHERE discord_id = ?', discordId);
  if (existing) {
    return { error: 'Your Discord account is already linked to a DKP account.' };
  }

  // Clean up expired codes
  await db.run("DELETE FROM discord_link_codes WHERE expires_at < datetime('now')");

  // Generate a 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  // Remove any existing pending codes for this Discord user
  await db.run('DELETE FROM discord_link_codes WHERE discord_id = ?', discordId);

  await db.run(
    'INSERT INTO discord_link_codes (discord_id, discord_username, username, code, expires_at) VALUES (?, ?, ?, ?, ?)',
    discordId, discordUsername, dkpUsername, code, expiresAt
  );

  return { code, expiresInMinutes: CODE_TTL_MINUTES };
}

/**
 * Verify a link code entered on the web UI and bind the Discord account.
 * Returns { success, error, discordUsername }.
 */
export async function verifyLinkCode(userId, code) {
  // Clean up expired codes
  await db.run("DELETE FROM discord_link_codes WHERE expires_at < datetime('now')");

  const user = await db.get('SELECT username FROM users WHERE id = ?', userId);
  if (!user) return { error: 'User not found.' };

  const linkEntry = await db.get(
    "SELECT * FROM discord_link_codes WHERE code = ? AND LOWER(username) = LOWER(?) AND expires_at > datetime('now')",
    code, user.username
  );

  if (!linkEntry) {
    return { error: 'Invalid or expired link code.' };
  }

  // Bind the Discord account
  await db.run('UPDATE users SET discord_id = ? WHERE id = ?', linkEntry.discord_id, userId);

  // Clean up used code
  await db.run('DELETE FROM discord_link_codes WHERE id = ?', linkEntry.id);

  return { success: true, discordUsername: linkEntry.discord_username };
}
