// Class → primary armor type mapping
// Although plate classes CAN equip all armor types, they should only bid on plate
export const CLASS_ARMOR_MAP = {
  'Warrior': 'plate', 'Paladin': 'plate', 'Death Knight': 'plate',
  'Hunter': 'mail', 'Shaman': 'mail', 'Evoker': 'mail',
  'Rogue': 'leather', 'Monk': 'leather', 'Druid': 'leather', 'Demon Hunter': 'leather',
  'Priest': 'cloth', 'Mage': 'cloth', 'Warlock': 'cloth',
};

// Reverse: armor type → classes that use it
const ARMOR_CLASS_MAP = {
  plate: ['Warrior', 'Paladin', 'Death Knight'],
  mail: ['Hunter', 'Shaman', 'Evoker'],
  leather: ['Rogue', 'Monk', 'Druid', 'Demon Hunter'],
  cloth: ['Priest', 'Mage', 'Warlock'],
};

// Slots where armor type restriction applies
const ARMOR_RESTRICTED_SLOTS = new Set([
  'Head', 'Shoulder', 'Chest', 'Wrist', 'Hands', 'Waist', 'Legs', 'Feet',
]);

// Shield: only these classes can equip
const SHIELD_CLASSES = ['Warrior', 'Paladin', 'Shaman'];

// Tier token prefixes → eligible classes (Midnight Season 1)
const TIER_TOKEN_CLASSES = {
  'Voidwoven': ['Priest', 'Mage', 'Warlock'],
  'Alnwoven': ['Priest', 'Mage', 'Warlock'],
  'Voidcured': ['Rogue', 'Monk', 'Druid', 'Demon Hunter'],
  'Alncured': ['Rogue', 'Monk', 'Druid', 'Demon Hunter'],
  'Voidcast': ['Hunter', 'Shaman', 'Evoker'],
  'Alncast': ['Hunter', 'Shaman', 'Evoker'],
  'Voidforged': ['Warrior', 'Paladin', 'Death Knight'],
  'Alnforged': ['Warrior', 'Paladin', 'Death Knight'],
};

/**
 * Derive armor type from icon URL.
 * Blizzard icons follow patterns like: inv_boot_plate_..., inv_chest_cloth_..., etc.
 * Returns 'plate'|'mail'|'leather'|'cloth'|null
 */
export function deriveArmorType(iconUrl) {
  if (!iconUrl) return null;
  const filename = iconUrl.split('/').pop()?.toLowerCase() || '';
  for (const type of ['plate', 'leather', 'mail', 'cloth']) {
    // Match patterns like _plate_, _cloth_ in icon filenames
    if (filename.includes(`_${type}_`) || filename.includes(`_${type}`) || filename.includes(`${type}_`)) {
      // Avoid false positives: "mail" in "chainmail" etc — check for word boundary patterns
      if (type === 'mail' && filename.includes('chainmail')) continue;
      return type;
    }
  }
  return null;
}

/**
 * Get tier token eligible classes from item name.
 * Returns array of class names or null if not a tier token.
 */
function getTierTokenClasses(itemName) {
  if (!itemName) return null;
  for (const [prefix, classes] of Object.entries(TIER_TOKEN_CLASSES)) {
    if (itemName.startsWith(prefix)) return classes;
  }
  return null;
}

/**
 * Compute eligible classes for an item.
 * Returns JSON string of class array, or null (no restriction).
 */
export function getEligibleClasses(itemName, slot, armorType) {
  // Tier tokens: restrict by token group regardless of slot
  const tierClasses = getTierTokenClasses(itemName);
  if (tierClasses) return JSON.stringify(tierClasses);

  // Shield: special restriction
  if (slot === 'Shield') return JSON.stringify(SHIELD_CLASSES);

  // Armor slots: restrict by armor type
  if (ARMOR_RESTRICTED_SLOTS.has(slot) && armorType && ARMOR_CLASS_MAP[armorType]) {
    return JSON.stringify(ARMOR_CLASS_MAP[armorType]);
  }

  // Everything else (trinkets, rings, necks, cloaks, weapons, off-hands): no restriction
  return null;
}

/**
 * Check if a character class can bid on an item with the given eligible_classes.
 * @param {string} characterClass - The bidder's class
 * @param {string|null} eligibleClassesJson - JSON array of eligible classes, or null (no restriction)
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function canBid(characterClass, eligibleClassesJson) {
  if (!eligibleClassesJson) return { allowed: true, reason: null };

  let eligibleClasses;
  try {
    eligibleClasses = JSON.parse(eligibleClassesJson);
  } catch {
    return { allowed: true, reason: null };
  }

  if (!Array.isArray(eligibleClasses) || eligibleClasses.length === 0) {
    return { allowed: true, reason: null };
  }

  if (eligibleClasses.includes(characterClass)) {
    return { allowed: true, reason: null };
  }

  const classList = eligibleClasses.join(', ');
  return {
    allowed: false,
    reason: `Your class (${characterClass}) cannot bid on this item. Eligible: ${classList}`,
  };
}
