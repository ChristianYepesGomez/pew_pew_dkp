/**
 * Vault Rules Engine
 *
 * Evaluates Great Vault slots against configurable ilvl thresholds.
 * Only dungeon and world slots count — raid slots are ignored.
 * Two modes:
 *   - Grace period (first N weeks of season): N non-raid slots >= grace ilvl (Hero tier)
 *   - Normal period: N non-raid slots >= normal ilvl (Myth tier)
 */

/**
 * Determine if we're in the grace period based on season start date and grace weeks.
 *
 * @param {string} seasonStart - ISO date string (e.g. '2026-03-18')
 * @param {number} graceWeeks - Number of weeks grace period lasts
 * @param {Date} [now] - Current date (for testing)
 * @returns {boolean}
 */
export function isInGracePeriod(seasonStart, graceWeeks, now = new Date()) {
  if (!seasonStart || graceWeeks <= 0) return false;
  const start = new Date(seasonStart);
  if (isNaN(start.getTime())) return false;

  const graceEnd = new Date(start);
  graceEnd.setDate(graceEnd.getDate() + graceWeeks * 7);

  return now < graceEnd;
}

/**
 * Check if a slot meets the minimum ilvl requirement.
 */
function meetsMinIlvl(slot, minIlvl) {
  return slot.filled && slot.ilvl !== null && slot.ilvl >= minIlvl;
}

/**
 * Evaluate a character's vault against the current rules.
 * Raid slots are always excluded — only dungeon and world slots count.
 *
 * @param {object} vault - Parsed vault from parseCharacterVault()
 * @param {object} config - Vault config from DB
 * @param {Date} [now] - Current date (for testing)
 * @returns {{ qualifies: boolean, reason: string, details: object }}
 */
export function evaluateVault(vault, config, now = new Date()) {
  const inGrace = isInGracePeriod(config.seasonStart, config.graceWeeks, now);
  const minSlots = config.minSlots;
  const minIlvl = inGrace ? config.graceMinIlvl : config.normalMinIlvl;
  const mode = inGrace ? 'grace' : 'normal';

  // Only dungeon + world slots count — raid slots excluded
  const nonRaidSlots = [...vault.dungeonSlots, ...vault.worldSlots];
  const qualifyingSlots = nonRaidSlots.filter(s => meetsMinIlvl(s, minIlvl));

  const qualifies = qualifyingSlots.length >= minSlots;

  const details = {
    mode,
    minIlvl,
    nonRaidSlots: {
      required: minSlots,
      qualifying: qualifyingSlots.length,
      ok: qualifies,
      slots: nonRaidSlots.map(formatSlotDetail),
    },
    raidSlots: {
      ignored: true,
      slots: vault.raidSlots.map(formatSlotDetail),
    },
  };

  const reason = qualifies
    ? `Vault completo${inGrace ? ' (grace period)' : ''}`
    : `Solo ${qualifyingSlots.length}/${minSlots} slots de dungeon/world con ilvl ${minIlvl}+`;

  return { qualifies, reason, details };
}

function formatSlotDetail(slot) {
  return {
    index: slot.index,
    category: slot.category,
    filled: slot.filled,
    ilvl: slot.ilvl,
  };
}
