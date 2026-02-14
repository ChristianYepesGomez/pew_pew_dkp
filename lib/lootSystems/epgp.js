import { LootSystem } from './base.js';

/**
 * EPGP loot system.
 *
 * - EP (Effort Points): gained from raid attendance, boss kills
 * - GP (Gear Points): charged when receiving loot (based on item tier/slot)
 * - Priority = EP / max(GP, 1): ratio determines loot priority
 * - Decay: both EP and GP decay weekly (typically 10-20%)
 */

export class EPGPSystem extends LootSystem {
  constructor(db) {
    super(db);
  }

  async getPlayerPriority(userId) {
    const row = await this.db.get('SELECT effort_points, gear_points FROM member_epgp WHERE user_id = ?', userId);
    if (!row) return 0;
    return row.effort_points / Math.max(row.gear_points, 1);
  }

  async awardItem(itemId, userId, context = {}) {
    const { gpCost, itemName, performedBy, reason } = context;

    await this.db.transaction(async (tx) => {
      // Charge GP
      await tx.run(`
        UPDATE member_epgp
        SET gear_points = gear_points + ?
        WHERE user_id = ?
      `, gpCost, userId);

      // Log transaction
      await tx.run(`
        INSERT INTO epgp_transactions (user_id, type, ep_change, gp_change, reason, item_id)
        VALUES (?, 'gp_spend', 0, ?, ?, ?)
      `, userId, gpCost, reason || `Received: ${itemName}`, itemId || null);
    });
  }

  async getLeaderboard() {
    return await this.db.all(`
      SELECT me.user_id, u.character_name, u.character_class, u.spec,
             me.effort_points, me.gear_points,
             ROUND(me.effort_points * 1.0 / MAX(me.gear_points, 1), 2) as priority
      FROM member_epgp me
      JOIN users u ON me.user_id = u.id
      WHERE u.is_active = 1
      ORDER BY priority DESC
    `);
  }

  async applyDecay(percentage, performedBy) {
    const multiplier = 1 - (percentage / 100);

    await this.db.transaction(async (tx) => {
      const members = await tx.all('SELECT user_id, effort_points, gear_points FROM member_epgp WHERE effort_points > 0 OR gear_points > 0');

      // Apply decay to both EP and GP
      await tx.run(`
        UPDATE member_epgp
        SET effort_points = ROUND(effort_points * ?, 2),
            gear_points = ROUND(gear_points * ?, 2)
      `, multiplier, multiplier);

      // Log decay transactions
      for (const member of members) {
        const epDecay = member.effort_points - (member.effort_points * multiplier);
        const gpDecay = member.gear_points - (member.gear_points * multiplier);

        if (epDecay > 0.01 || gpDecay > 0.01) {
          await tx.run(`
            INSERT INTO epgp_transactions (user_id, type, ep_change, gp_change, reason)
            VALUES (?, 'decay', ?, ?, ?)
          `, member.user_id,
            -Math.round(epDecay * 100) / 100,
            -Math.round(gpDecay * 100) / 100,
            `EPGP Decay ${percentage}%`
          );
        }
      }
    });
  }

  async getHistory(userId, limit = 50) {
    return await this.db.all(`
      SELECT * FROM epgp_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, userId, limit);
  }

  /**
   * Award EP to a user (raid attendance, boss kill, etc.)
   */
  async awardEP(userId, amount, reason, performedBy = null) {
    await this.db.transaction(async (tx) => {
      // Ensure member_epgp row exists
      await tx.run(`
        INSERT OR IGNORE INTO member_epgp (user_id, effort_points, gear_points)
        VALUES (?, 0, 0)
      `, userId);

      await tx.run(`
        UPDATE member_epgp
        SET effort_points = effort_points + ?
        WHERE user_id = ?
      `, amount, userId);

      await tx.run(`
        INSERT INTO epgp_transactions (user_id, type, ep_change, gp_change, reason)
        VALUES (?, 'ep_gain', ?, 0, ?)
      `, userId, amount, reason);
    });
  }

  /**
   * Bulk-award EP to multiple users in a single transaction.
   */
  async bulkAwardEP(userIds, amount, reason) {
    await this.db.transaction(async (tx) => {
      for (const userId of userIds) {
        await tx.run(`
          INSERT OR IGNORE INTO member_epgp (user_id, effort_points, gear_points)
          VALUES (?, 0, 0)
        `, userId);

        await tx.run(`
          UPDATE member_epgp
          SET effort_points = effort_points + ?
          WHERE user_id = ?
        `, amount, userId);

        await tx.run(`
          INSERT INTO epgp_transactions (user_id, type, ep_change, gp_change, reason)
          VALUES (?, 'ep_gain', ?, 0, ?)
        `, userId, amount, reason);
      }
    });
  }

  /**
   * Charge GP when a player receives loot.
   */
  async chargeGP(userId, gpAmount, reason, itemId = null) {
    await this.db.transaction(async (tx) => {
      await tx.run(`
        INSERT OR IGNORE INTO member_epgp (user_id, effort_points, gear_points)
        VALUES (?, 0, 0)
      `, userId);

      await tx.run(`
        UPDATE member_epgp
        SET gear_points = gear_points + ?
        WHERE user_id = ?
      `, gpAmount, userId);

      await tx.run(`
        INSERT INTO epgp_transactions (user_id, type, ep_change, gp_change, reason, item_id)
        VALUES (?, 'gp_spend', 0, ?, ?, ?)
      `, userId, gpAmount, reason, itemId);
    });
  }

  /**
   * Get GP item values table.
   */
  async getItemValues() {
    return await this.db.all('SELECT * FROM epgp_item_values ORDER BY gp_value DESC');
  }

  /**
   * Update a GP item value.
   */
  async updateItemValue(id, gpValue) {
    await this.db.run('UPDATE epgp_item_values SET gp_value = ? WHERE id = ?', gpValue, id);
    return await this.db.get('SELECT * FROM epgp_item_values WHERE id = ?', id);
  }

  /**
   * Get GP value for an item based on its quality and slot.
   */
  async getGPValueForItem(itemQuality, slotType) {
    const row = await this.db.get(
      'SELECT gp_value FROM epgp_item_values WHERE item_quality = ? AND slot_type = ?',
      itemQuality, slotType
    );
    // Default fallback values by quality
    if (row) return row.gp_value;
    const defaults = { legendary: 120, epic: 80, rare: 50 };
    return defaults[itemQuality] || 60;
  }

  /**
   * Award EP from a WCL raid import. Returns { actualGain } for compatibility.
   */
  async awardFromRaid(tx, userId, amount) {
    await tx.run(`
      INSERT OR IGNORE INTO member_epgp (user_id, effort_points, gear_points)
      VALUES (?, 0, 0)
    `, userId);

    await tx.run(`
      UPDATE member_epgp
      SET effort_points = effort_points + ?
      WHERE user_id = ?
    `, amount, userId);

    return { actualGain: amount, wasCapped: false };
  }
}
