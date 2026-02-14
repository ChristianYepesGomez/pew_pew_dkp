import { db } from '../../database.js';

/**
 * Resolve a Discord user to a DKP user.
 * Returns the user row or null if not linked.
 */
export async function resolveUser(discordId) {
  return db.get(`
    SELECT u.id, u.username, u.character_name, u.character_class, u.role, u.spec, u.raid_role,
           md.current_dkp, md.lifetime_gained, md.lifetime_spent
    FROM users u
    LEFT JOIN member_dkp md ON u.id = md.user_id
    WHERE u.discord_id = ? AND u.is_active = 1
  `, discordId);
}

/**
 * Check if a DKP user has one of the required roles.
 */
export function hasRole(user, requiredRoles) {
  return requiredRoles.includes(user.role);
}

/**
 * Format a user object from the DB row returned by resolveUser.
 */
export function formatUser(row) {
  return {
    id: row.id,
    username: row.username,
    characterName: row.character_name,
    characterClass: row.character_class,
    role: row.role,
    spec: row.spec,
    raidRole: row.raid_role,
    currentDkp: row.current_dkp || 0,
    lifetimeGained: row.lifetime_gained || 0,
    lifetimeSpent: row.lifetime_spent || 0,
  };
}
