/**
 * MRT (Method Raid Tools) Note Formatter
 *
 * Generates text in MRT note format from CD assignments.
 * MRT syntax reference:
 *   {spell:ID}       → spell icon
 *   {H}...{/H}       → healer-only section
 *   {D}...{/D}       → DPS-only section
 *   {T}...{/T}       → tank-only section
 *   |cffRRGGBB....|r → colored text
 */

const CATEGORY_ROLE_TAG = {
  healing:   'H',
  defensive: null,  // no role tag — visible to everyone
  interrupt: 'D',
};

/**
 * Format MM:SS from seconds
 * @param {number} seconds
 * @returns {string} e.g. "1:30" or "0:45"
 */
function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Generate a full MRT note from a list of events with their assignments.
 *
 * @param {Array} events - Array of { event_label, timestamp_seconds, assignments: [{ cd_name, spell_id, character_name, category }] }
 * @param {string} bossName - Boss name for the note header
 * @param {string} difficulty - Difficulty string (e.g. "Mythic")
 * @returns {string} MRT-formatted note text
 */
export function generateMrtNote(events, bossName, difficulty) {
  if (!events || events.length === 0) return '';

  const lines = [];
  lines.push(`|cffFFD700${bossName} — ${difficulty}|r`);
  lines.push('');

  // Sort events by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  for (const event of sorted) {
    if (!event.assignments || event.assignments.length === 0) continue;

    const ts = formatTimestamp(event.timestamp_seconds);
    lines.push(`|cffa0a0a0${ts} — ${event.event_label}|r`);

    // Group assignments by category so we can apply role tags
    const byCategory = {};
    for (const a of event.assignments) {
      const cat = a.category || 'defensive';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(a);
    }

    for (const [category, assigns] of Object.entries(byCategory)) {
      const roleTag = CATEGORY_ROLE_TAG[category];
      const parts = assigns.map(a => `{spell:${a.spell_id}} ${a.character_name}`).join('  ');

      if (roleTag) {
        lines.push(`{${roleTag}} ${parts} {/${roleTag}}`);
      } else {
        lines.push(parts);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
