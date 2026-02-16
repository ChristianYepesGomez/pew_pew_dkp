import { LootSystem } from './base.js';
import { addDkpWithCap, getCachedConfig } from '../helpers.js';

/**
 * DKP loot system — the existing auction-based system.
 * Priority = current DKP balance. Items awarded via auction bidding.
 */
export class DKPSystem extends LootSystem {
  constructor(db) {
    super(db);
  }

  async getPlayerPriority(userId) {
    const row = await this.db.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
    return row?.current_dkp || 0;
  }

  async awardItem(itemId, userId, context = {}) {
    const { amount, itemName, performedBy, auctionId } = context;
    await this.db.transaction(async (tx) => {
      await tx.run(`
        UPDATE member_dkp
        SET current_dkp = current_dkp - ?,
            lifetime_spent = lifetime_spent + ?
        WHERE user_id = ?
      `, amount, amount, userId);

      await tx.run(`
        INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, auction_id)
        VALUES (?, ?, ?, ?, ?)
      `, userId, -amount, `Won auction: ${itemName}`, performedBy, auctionId);
    });
  }

  async getLeaderboard() {
    return await this.db.all(`
      SELECT md.user_id, u.character_name, u.character_class, u.spec,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM member_dkp md
      JOIN users u ON md.user_id = u.id
      WHERE u.is_active = 1
      ORDER BY md.current_dkp DESC
    `);
  }

  async applyDecay(percentage, performedBy) {
    const multiplier = 1 - (percentage / 100);

    await this.db.transaction(async (tx) => {
      const members = await tx.all('SELECT user_id, current_dkp FROM member_dkp WHERE current_dkp > 0');

      await tx.run(`
        UPDATE member_dkp
        SET current_dkp = CAST(current_dkp * ? AS INTEGER),
            last_decay_at = CURRENT_TIMESTAMP
      `, multiplier);

      for (const member of members) {
        const decayAmount = Math.floor(member.current_dkp * (percentage / 100));
        if (decayAmount > 0) {
          await tx.run(`
            INSERT INTO dkp_transactions (user_id, amount, reason, performed_by)
            VALUES (?, ?, ?, ?)
          `, member.user_id, -decayAmount, `DKP Decay ${percentage}%`, performedBy);
        }
      }
    });
  }

  async getHistory(userId, limit = 50) {
    return await this.db.all(`
      SELECT dt.*, u.character_name, u.username,
             a.item_name AS auction_item_name, a.item_image AS auction_item_image,
             a.item_rarity AS auction_item_rarity, a.item_id AS auction_item_id
      FROM dkp_transactions dt
      LEFT JOIN users u ON dt.performed_by = u.id
      LEFT JOIN auctions a ON dt.auction_id = a.id
      WHERE dt.user_id = ?
      ORDER BY dt.created_at DESC
      LIMIT ?
    `, userId, limit);
  }

  /**
   * Award EP-equivalent (DKP) from a WCL import, respecting the DKP cap.
   */
  async awardFromRaid(tx, userId, amount) {
    const capValue = parseInt(await getCachedConfig(this.db, 'dkp_cap', '250'), 10);
    return await addDkpWithCap(tx, userId, amount, capValue);
  }
}
