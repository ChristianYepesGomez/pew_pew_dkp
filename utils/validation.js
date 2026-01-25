/**
 * Validation utilities for DKP system
 */

// Valid WoW classes
export const VALID_CLASSES = [
  'Warrior',
  'Paladin',
  'Hunter',
  'Rogue',
  'Priest',
  'Shaman',
  'Mage',
  'Warlock',
  'Druid',
  'Death Knight',
  'Monk',
  'Demon Hunter',
  'Evoker'
];

// Valid raid roles
export const VALID_RAID_ROLES = ['Tank', 'Healer', 'DPS'];

// Valid user roles
export const VALID_USER_ROLES = ['admin', 'officer', 'raider'];

// Item rarities
export const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/**
 * Validate character name
 */
export function isValidCharacterName(name) {
  if (!name || typeof name !== 'string') return false;
  // WoW names: 2-12 characters, letters only, can have one capital at start
  const regex = /^[A-Z][a-z]{1,11}$/;
  return regex.test(name);
}

/**
 * Validate username
 */
export function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  // 3-20 characters, alphanumeric and underscores
  const regex = /^[a-zA-Z0-9_]{3,20}$/;
  return regex.test(username);
}

/**
 * Validate password strength
 */
export function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  // At least 8 characters
  return password.length >= 8;
}

/**
 * Validate DKP amount
 */
export function isValidDkpAmount(amount) {
  if (typeof amount !== 'number') return false;
  // Reasonable DKP range: -10000 to 10000
  return Number.isInteger(amount) && amount >= -10000 && amount <= 10000;
}

/**
 * Validate class name
 */
export function isValidClass(className) {
  return VALID_CLASSES.includes(className);
}

/**
 * Validate raid role
 */
export function isValidRaidRole(role) {
  return VALID_RAID_ROLES.includes(role);
}

/**
 * Validate user role
 */
export function isValidUserRole(role) {
  return VALID_USER_ROLES.includes(role);
}

/**
 * Validate item rarity
 */
export function isValidRarity(rarity) {
  return VALID_RARITIES.includes(rarity);
}

/**
 * Sanitize string input
 */
export function sanitizeString(str, maxLength = 255) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

/**
 * Validate CSV import data
 */
export function validateImportData(members) {
  const errors = [];
  const validMembers = [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const rowErrors = [];

    if (!member.characterName) {
      rowErrors.push('Missing character name');
    }

    if (member.characterClass && !isValidClass(member.characterClass)) {
      rowErrors.push(`Invalid class: ${member.characterClass}`);
    }

    if (member.raidRole && !isValidRaidRole(member.raidRole)) {
      rowErrors.push(`Invalid raid role: ${member.raidRole}`);
    }

    if (member.dkp !== undefined && (typeof member.dkp !== 'number' || member.dkp < 0)) {
      rowErrors.push(`Invalid DKP value: ${member.dkp}`);
    }

    if (rowErrors.length > 0) {
      errors.push({ row: i + 1, errors: rowErrors });
    } else {
      validMembers.push(member);
    }
  }

  return { validMembers, errors };
}
