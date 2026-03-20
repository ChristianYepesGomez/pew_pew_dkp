import { describe, it, expect } from 'vitest';
import { evaluateVault, isInGracePeriod } from '../lib/vaultRules.js';
import { parseVaultSlot, parseCharacterVault } from '../services/wowaudit.js';

// ── parseVaultSlot ──────────────────────────────────────────────

describe('parseVaultSlot', () => {
  it('parses numeric ilvl', () => {
    const slot = parseVaultSlot(259);
    expect(slot.filled).toBe(true);
    expect(slot.ilvl).toBe(259);
  });

  it('parses string ilvl', () => {
    const slot = parseVaultSlot('272');
    expect(slot.filled).toBe(true);
    expect(slot.ilvl).toBe(272);
  });

  it('returns not filled for empty values', () => {
    expect(parseVaultSlot(null).filled).toBe(false);
    expect(parseVaultSlot('').filled).toBe(false);
    expect(parseVaultSlot('-').filled).toBe(false);
    expect(parseVaultSlot(0).filled).toBe(false);
    expect(parseVaultSlot('0').filled).toBe(false);
  });
});

// ── parseCharacterVault ─────────────────────────────────────────

describe('parseCharacterVault', () => {
  it('parses 9 slots with correct categories', () => {
    // Raid(3), Dungeon(3), World(3)
    const slots = [259, 259, 259, 272, 272, 272, 0, 0, 0];
    const vault = parseCharacterVault(slots);

    expect(vault.filledCount).toBe(6);
    expect(vault.raidSlots).toHaveLength(3);
    expect(vault.dungeonSlots).toHaveLength(3);
    expect(vault.worldSlots).toHaveLength(3);

    vault.raidSlots.forEach(s => {
      expect(s.category).toBe('raid');
      expect(s.ilvl).toBe(259);
    });
    vault.dungeonSlots.forEach(s => {
      expect(s.category).toBe('dungeon');
      expect(s.ilvl).toBe(272);
    });
    vault.worldSlots.forEach(s => {
      expect(s.filled).toBe(false);
    });
  });

  it('handles all empty slots', () => {
    const vault = parseCharacterVault([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(vault.filledCount).toBe(0);
  });

  it('handles real WoWAudit data (Brewzlee: no raid, 1 dungeon, 3 world)', () => {
    const vault = parseCharacterVault(['', '', '', 256, '', '', 259, 259, 237]);
    expect(vault.filledCount).toBe(4);
    expect(vault.raidSlots.filter(s => s.filled)).toHaveLength(0);
    expect(vault.dungeonSlots.filter(s => s.filled)).toHaveLength(1);
    expect(vault.worldSlots.filter(s => s.filled)).toHaveLength(3);
  });

  it('handles real WoWAudit data (Zoiladiabla: no raid, 2 dungeon, 3 world)', () => {
    const vault = parseCharacterVault(['', '', '', 256, 256, '', 259, 259, 259]);
    expect(vault.filledCount).toBe(5);
    expect(vault.dungeonSlots.filter(s => s.filled)).toHaveLength(2);
    expect(vault.worldSlots.filter(s => s.filled)).toHaveLength(3);
  });
});

// ── isInGracePeriod ─────────────────────────────────────────────

describe('isInGracePeriod', () => {
  it('returns true during grace period', () => {
    expect(isInGracePeriod('2026-03-18', 2, new Date('2026-03-25'))).toBe(true);
  });

  it('returns false after grace period', () => {
    expect(isInGracePeriod('2026-03-18', 2, new Date('2026-04-02'))).toBe(false);
  });

  it('returns true on the last day of grace', () => {
    expect(isInGracePeriod('2026-03-18', 2, new Date('2026-03-31'))).toBe(true);
  });

  it('returns false on grace end date', () => {
    expect(isInGracePeriod('2026-03-18', 2, new Date('2026-04-01'))).toBe(false);
  });

  it('returns false with 0 grace weeks', () => {
    expect(isInGracePeriod('2026-03-18', 0, new Date('2026-03-18'))).toBe(false);
  });

  it('returns false with invalid date', () => {
    expect(isInGracePeriod('invalid', 2, new Date())).toBe(false);
  });
});

// ── evaluateVault (grace period) ────────────────────────────────
// Raid slots NEVER count. Need 3 dungeon/world slots >= 259 (Hero).

describe('evaluateVault — grace period', () => {
  const config = {
    seasonStart: '2026-03-18',
    graceWeeks: 2,
    minSlots: 3,
    graceMinIlvl: 259,
    normalMinIlvl: 272,
  };
  const graceDate = new Date('2026-03-25');

  it('qualifies with 3 hero dungeon slots (raid ignored)', () => {
    const vault = parseCharacterVault([0, 0, 0, 259, 259, 259, 0, 0, 0]);
    const result = evaluateVault(vault, config, graceDate);
    expect(result.qualifies).toBe(true);
    expect(result.details.mode).toBe('grace');
  });

  it('qualifies with 3 hero world slots (raid ignored)', () => {
    const vault = parseCharacterVault([0, 0, 0, 0, 0, 0, 259, 259, 259]);
    const result = evaluateVault(vault, config, graceDate);
    expect(result.qualifies).toBe(true);
  });

  it('qualifies with mix of dungeon + world', () => {
    const vault = parseCharacterVault([0, 0, 0, 259, 259, 0, 0, 0, 259]);
    const result = evaluateVault(vault, config, graceDate);
    expect(result.qualifies).toBe(true);
  });

  it('does NOT count raid slots even if high ilvl', () => {
    // 3 myth raid slots but 0 dungeon/world — should fail
    const vault = parseCharacterVault([272, 272, 272, 0, 0, 0, 0, 0, 0]);
    const result = evaluateVault(vault, config, graceDate);
    expect(result.qualifies).toBe(false);
    expect(result.reason).toContain('0/3');
  });

  it('does NOT qualify with only 2 non-raid slots', () => {
    const vault = parseCharacterVault([259, 259, 259, 259, 259, 0, 0, 0, 0]);
    const result = evaluateVault(vault, config, graceDate);
    expect(result.qualifies).toBe(false);
    expect(result.reason).toContain('2/3');
  });

  it('does NOT qualify with slots below min ilvl (246 < 259)', () => {
    const vault = parseCharacterVault([0, 0, 0, 246, 246, 246, 0, 0, 0]);
    const result = evaluateVault(vault, config, graceDate);
    expect(result.qualifies).toBe(false);
  });

  it('qualifies with myth ilvl (above hero minimum)', () => {
    const vault = parseCharacterVault([0, 0, 0, 272, 272, 272, 0, 0, 0]);
    const result = evaluateVault(vault, config, graceDate);
    expect(result.qualifies).toBe(true);
  });

  it('real case: Brewzlee — 1 dungeon (256) + 3 world (259,259,237) = 2 qualifying, NOT enough', () => {
    const vault = parseCharacterVault(['', '', '', 256, '', '', 259, 259, 237]);
    const result = evaluateVault(vault, config, graceDate);
    // 259, 259 qualify (>= 259). 256 and 237 don't. Total qualifying = 2
    expect(result.qualifies).toBe(false);
  });

  it('real case: Zoiladiabla — 2 dungeon (256,256) + 3 world (259,259,259) = 3 qualifying, passes', () => {
    const vault = parseCharacterVault(['', '', '', 256, 256, '', 259, 259, 259]);
    const result = evaluateVault(vault, config, graceDate);
    // 259, 259, 259 qualify. 256, 256 don't. Total qualifying = 3
    expect(result.qualifies).toBe(true);
  });
});

// ── evaluateVault (normal period) ───────────────────────────────
// Raid slots NEVER count. Need 3 dungeon/world slots >= 272 (Myth).

describe('evaluateVault — normal period', () => {
  const config = {
    seasonStart: '2026-03-18',
    graceWeeks: 2,
    minSlots: 3,
    graceMinIlvl: 259,
    normalMinIlvl: 272,
  };
  const normalDate = new Date('2026-04-15');

  it('qualifies with 3 myth dungeon slots', () => {
    const vault = parseCharacterVault([0, 0, 0, 272, 272, 272, 0, 0, 0]);
    const result = evaluateVault(vault, config, normalDate);
    expect(result.qualifies).toBe(true);
    expect(result.details.mode).toBe('normal');
  });

  it('does NOT count raid slots even with myth ilvl', () => {
    const vault = parseCharacterVault([272, 272, 272, 0, 0, 0, 0, 0, 0]);
    const result = evaluateVault(vault, config, normalDate);
    expect(result.qualifies).toBe(false);
  });

  it('does NOT qualify with 3 hero slots (needs myth ilvl 272+)', () => {
    const vault = parseCharacterVault([0, 0, 0, 259, 259, 259, 0, 0, 0]);
    const result = evaluateVault(vault, config, normalDate);
    expect(result.qualifies).toBe(false);
    expect(result.reason).toContain('272');
  });

  it('does NOT qualify with only 2 myth non-raid slots', () => {
    const vault = parseCharacterVault([0, 0, 0, 272, 272, 0, 0, 0, 0]);
    const result = evaluateVault(vault, config, normalDate);
    expect(result.qualifies).toBe(false);
    expect(result.reason).toContain('2/3');
  });

  it('qualifies with mix of dungeon + world myth slots', () => {
    const vault = parseCharacterVault([0, 0, 0, 0, 272, 0, 0, 272, 272]);
    const result = evaluateVault(vault, config, normalDate);
    expect(result.qualifies).toBe(true);
  });

  it('does NOT qualify with all empty', () => {
    const vault = parseCharacterVault([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const result = evaluateVault(vault, config, normalDate);
    expect(result.qualifies).toBe(false);
  });

  it('qualifies with 6 myth non-raid slots', () => {
    const vault = parseCharacterVault([0, 0, 0, 280, 280, 280, 275, 275, 275]);
    const result = evaluateVault(vault, config, normalDate);
    expect(result.qualifies).toBe(true);
  });
});
