/**
 * Base class for loot distribution systems.
 * Each system implements its own priority, awarding, leaderboard, decay, and history.
 */
export class LootSystem {
  constructor(db, config = {}) {
    this.db = db;
    this.config = config;
  }

  /** Get a player's priority value (higher = more priority)
   * @param {number} _userId
   * @returns {Promise<number>}
   */
  async getPlayerPriority(_userId) {
    throw new Error('Not implemented');
  }

  /** Award an item to a player, recording the transaction */
  async awardItem(_itemId, _userId, _context) {
    throw new Error('Not implemented');
  }

  /** Get the leaderboard/standings for this system */
  async getLeaderboard() {
    throw new Error('Not implemented');
  }

  /** Apply periodic decay (percentage-based) */
  async applyDecay(_percentage, _performedBy) {
    throw new Error('Not implemented');
  }

  /** Get transaction/decision history for a user */
  async getHistory(_userId, _limit) {
    throw new Error('Not implemented');
  }
}
