import { LootSystem } from './base.js';

/**
 * Loot Council system — officers vote, loot master assigns items.
 *
 * Flow:
 *   1. Officer creates a loot_decision for a dropped item
 *   2. Raiders respond with interest (bis, upgrade, minor, offspec, pass)
 *   3. Officers vote (approve/reject per candidate)
 *   4. Loot master awards the item to a winner
 *
 * Priority is advisory — based on response weight + vote count.
 */

const RESPONSE_WEIGHT = {
  bis: 5,
  upgrade: 4,
  minor: 3,
  offspec: 2,
  pass: 0,
};

export class LootCouncilSystem extends LootSystem {
  constructor(db) {
    super(db);
  }

  async getPlayerPriority(userId) {
    // In LC, priority is advisory: count of items received (fewer = higher priority)
    const row = await this.db.get(`
      SELECT COUNT(*) as items_received
      FROM loot_decisions
      WHERE winner_id = ? AND status = 'decided'
    `, userId);
    // Invert: fewer items = higher priority
    return -(row?.items_received || 0);
  }

  async awardItem(itemId, userId, context = {}) {
    const { decisionId, decidedBy, reason } = context;

    await this.db.transaction(async (tx) => {
      await tx.run(`
        UPDATE loot_decisions
        SET status = 'decided', winner_id = ?, decided_by = ?, reason = ?,
            decided_at = datetime('now')
        WHERE id = ?
      `, userId, decidedBy, reason || null, decisionId);
    });
  }

  async getLeaderboard() {
    // Leaderboard: show items received per player
    return await this.db.all(`
      SELECT u.id as user_id, u.character_name, u.character_class, u.spec,
             COUNT(ld.id) as items_received,
             MAX(ld.decided_at) as last_received_at
      FROM users u
      LEFT JOIN loot_decisions ld ON ld.winner_id = u.id AND ld.status = 'decided'
      WHERE u.is_active = 1
      GROUP BY u.id
      ORDER BY items_received ASC, u.character_name ASC
    `);
  }

  async applyDecay(_percentage, _performedBy) {
    // Loot Council has no currency to decay — no-op
  }

  async getHistory(userId, limit = 50) {
    return await this.db.all(`
      SELECT ld.id, ld.item_id, ld.item_name, ld.raid_id, ld.boss_name,
             ld.status, ld.reason, ld.created_at, ld.decided_at,
             w.character_name as winner_name, w.character_class as winner_class,
             d.character_name as decided_by_name
      FROM loot_decisions ld
      LEFT JOIN users w ON ld.winner_id = w.id
      LEFT JOIN users d ON ld.decided_by = d.id
      WHERE ld.winner_id = ? AND ld.status = 'decided'
      ORDER BY ld.decided_at DESC
      LIMIT ?
    `, userId, limit);
  }

  /**
   * Create a new loot decision for an item drop.
   */
  async createDecision({ itemId, itemName, raidId, bossName, createdBy }) {
    const result = await this.db.run(`
      INSERT INTO loot_decisions (item_id, item_name, raid_id, boss_name, status, created_by)
      VALUES (?, ?, ?, ?, 'open', ?)
    `, itemId || null, itemName, raidId || null, bossName || null, createdBy);

    return await this.db.get('SELECT * FROM loot_decisions WHERE id = ?', result.lastInsertRowid);
  }

  /**
   * Get all active (open) decisions.
   */
  async getActiveDecisions() {
    const decisions = await this.db.all(`
      SELECT ld.*, u.character_name as created_by_name
      FROM loot_decisions ld
      LEFT JOIN users u ON ld.created_by = u.id
      WHERE ld.status = 'open'
      ORDER BY ld.created_at DESC
    `);

    if (decisions.length === 0) return [];

    // Batch-load responses and votes
    const decisionIds = decisions.map(d => d.id);
    const ph = decisionIds.map(() => '?').join(',');

    const responses = await this.db.all(`
      SELECT lr.*, u.character_name, u.character_class, u.spec
      FROM loot_responses lr
      JOIN users u ON lr.user_id = u.id
      WHERE lr.decision_id IN (${ph})
      ORDER BY lr.created_at ASC
    `, ...decisionIds);

    const votes = await this.db.all(`
      SELECT lv.*, u.character_name as voter_name
      FROM loot_votes lv
      JOIN users u ON lv.voter_id = u.id
      WHERE lv.decision_id IN (${ph})
    `, ...decisionIds);

    const responsesByDecision = new Map();
    for (const r of responses) {
      if (!responsesByDecision.has(r.decision_id)) responsesByDecision.set(r.decision_id, []);
      responsesByDecision.get(r.decision_id).push(r);
    }

    const votesByDecision = new Map();
    for (const v of votes) {
      if (!votesByDecision.has(v.decision_id)) votesByDecision.set(v.decision_id, []);
      votesByDecision.get(v.decision_id).push(v);
    }

    return decisions.map(d => ({
      ...d,
      responses: (responsesByDecision.get(d.id) || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        characterName: r.character_name,
        characterClass: r.character_class,
        spec: r.spec,
        response: r.response,
        note: r.note,
        weight: RESPONSE_WEIGHT[r.response] || 0,
        createdAt: r.created_at,
      })),
      votes: (votesByDecision.get(d.id) || []).map(v => ({
        id: v.id,
        voterId: v.voter_id,
        voterName: v.voter_name,
        candidateId: v.candidate_id,
        vote: v.vote,
        createdAt: v.created_at,
      })),
    }));
  }

  /**
   * Raider responds with interest for a decision.
   */
  async respond(decisionId, userId, response, note = null) {
    const validResponses = ['bis', 'upgrade', 'minor', 'offspec', 'pass'];
    if (!validResponses.includes(response)) {
      throw new Error('INVALID_RESPONSE');
    }

    // Upsert: replace if already responded
    await this.db.run('DELETE FROM loot_responses WHERE decision_id = ? AND user_id = ?', decisionId, userId);
    const result = await this.db.run(`
      INSERT INTO loot_responses (decision_id, user_id, response, note)
      VALUES (?, ?, ?, ?)
    `, decisionId, userId, response, note);

    return { id: result.lastInsertRowid, decisionId, userId, response, note };
  }

  /**
   * Officer votes on a candidate for a decision.
   */
  async vote(decisionId, voterId, candidateId, vote) {
    const validVotes = ['approve', 'reject'];
    if (!validVotes.includes(vote)) {
      throw new Error('INVALID_VOTE');
    }

    // Upsert: replace previous vote for same candidate
    await this.db.run('DELETE FROM loot_votes WHERE decision_id = ? AND voter_id = ? AND candidate_id = ?', decisionId, voterId, candidateId);
    const result = await this.db.run(`
      INSERT INTO loot_votes (decision_id, voter_id, candidate_id, vote)
      VALUES (?, ?, ?, ?)
    `, decisionId, voterId, candidateId, vote);

    return { id: result.lastInsertRowid, decisionId, voterId, candidateId, vote };
  }

  /**
   * Get decision history (completed/cancelled).
   */
  async getDecisionHistory(limit = 50) {
    return await this.db.all(`
      SELECT ld.*,
             w.character_name as winner_name, w.character_class as winner_class,
             d.character_name as decided_by_name,
             c.character_name as created_by_name
      FROM loot_decisions ld
      LEFT JOIN users w ON ld.winner_id = w.id
      LEFT JOIN users d ON ld.decided_by = d.id
      LEFT JOIN users c ON ld.created_by = c.id
      WHERE ld.status IN ('decided', 'cancelled')
      ORDER BY ld.decided_at DESC
      LIMIT ?
    `, limit);
  }

  /**
   * In LC mode, WCL import still awards DKP (used as secondary for offspec auctions).
   */
  async awardFromRaid(tx, userId, amount) {
    const { addDkpWithCap, getCachedConfig } = await import('../helpers.js');
    const capValue = parseInt(await getCachedConfig(this.db, 'dkp_cap', '250'), 10);
    return await addDkpWithCap(tx, userId, amount, capValue);
  }
}
