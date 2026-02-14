import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter, userLimiter } from '../lib/rateLimiters.js';
import { LootCouncilSystem } from '../lib/lootSystems/lootCouncil.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:LootCouncil');
const router = Router();

// Create a loot decision (officer+)
router.post('/decisions', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const { itemId, itemName, raidId, bossName } = req.body;

    if (!itemName) {
      return error(res, 'itemName is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const lc = new LootCouncilSystem(req.db);
    const decision = await lc.createDecision({
      itemId,
      itemName,
      raidId,
      bossName,
      createdBy: req.user.userId,
    });

    req.app.get('io').emit('loot_decision_created', decision);
    return success(res, decision, null, 201);
  } catch (err) {
    log.error('Create loot decision error', err);
    return error(res, 'Failed to create loot decision', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get active (open) decisions
router.get('/decisions/active', authenticateToken, async (req, res) => {
  try {
    const lc = new LootCouncilSystem(req.db);
    const decisions = await lc.getActiveDecisions();
    return success(res, decisions);
  } catch (err) {
    log.error('Get active decisions error', err);
    return error(res, 'Failed to get active decisions', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Raider responds with interest for a decision
router.post('/decisions/:id/respond', userLimiter, authenticateToken, async (req, res) => {
  try {
    const decisionId = parseInt(req.params.id, 10);
    if (isNaN(decisionId)) return error(res, 'Invalid decision ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { response, note } = req.body;
    if (!response) {
      return error(res, 'response is required (bis, upgrade, minor, offspec, pass)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify decision exists and is open
    const decision = await req.db.get('SELECT id, status FROM loot_decisions WHERE id = ?', decisionId);
    if (!decision) return error(res, 'Decision not found', 404, ErrorCodes.NOT_FOUND);
    if (decision.status !== 'open') return error(res, 'Decision is no longer open', 400, ErrorCodes.VALIDATION_ERROR);

    const lc = new LootCouncilSystem(req.db);
    const result = await lc.respond(decisionId, req.user.userId, response, note);

    const user = await req.db.get('SELECT character_name, character_class FROM users WHERE id = ?', req.user.userId);
    const eventData = { ...result, characterName: user?.character_name, characterClass: user?.character_class };

    req.app.get('io').emit('loot_response', eventData);
    return success(res, result);
  } catch (err) {
    if (err.message === 'INVALID_RESPONSE') {
      return error(res, 'Invalid response. Must be: bis, upgrade, minor, offspec, or pass', 400, ErrorCodes.VALIDATION_ERROR);
    }
    log.error('Loot response error', err);
    return error(res, 'Failed to submit response', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Officer votes on a candidate (officer+)
router.post('/decisions/:id/vote', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const decisionId = parseInt(req.params.id, 10);
    if (isNaN(decisionId)) return error(res, 'Invalid decision ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { candidateId, vote } = req.body;
    if (!candidateId || !vote) {
      return error(res, 'candidateId and vote are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify decision exists and is open
    const decision = await req.db.get('SELECT id, status FROM loot_decisions WHERE id = ?', decisionId);
    if (!decision) return error(res, 'Decision not found', 404, ErrorCodes.NOT_FOUND);
    if (decision.status !== 'open') return error(res, 'Decision is no longer open', 400, ErrorCodes.VALIDATION_ERROR);

    const lc = new LootCouncilSystem(req.db);
    const result = await lc.vote(decisionId, req.user.userId, candidateId, vote);

    req.app.get('io').emit('loot_voted', result);
    return success(res, result);
  } catch (err) {
    if (err.message === 'INVALID_VOTE') {
      return error(res, 'Invalid vote. Must be: approve or reject', 400, ErrorCodes.VALIDATION_ERROR);
    }
    log.error('Loot vote error', err);
    return error(res, 'Failed to submit vote', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Award item to winner (officer+)
router.post('/decisions/:id/award', adminLimiter, authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  try {
    const decisionId = parseInt(req.params.id, 10);
    if (isNaN(decisionId)) return error(res, 'Invalid decision ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { winnerId, reason } = req.body;
    if (!winnerId) {
      return error(res, 'winnerId is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify decision exists and is open
    const decision = await req.db.get('SELECT * FROM loot_decisions WHERE id = ?', decisionId);
    if (!decision) return error(res, 'Decision not found', 404, ErrorCodes.NOT_FOUND);
    if (decision.status !== 'open') return error(res, 'Decision is no longer open', 400, ErrorCodes.VALIDATION_ERROR);

    // Verify winner has responded (or allow override)
    const winnerResponse = await req.db.get(
      'SELECT response FROM loot_responses WHERE decision_id = ? AND user_id = ?',
      decisionId, winnerId
    );

    const lc = new LootCouncilSystem(req.db);
    await lc.awardItem(decision.item_id, winnerId, {
      decisionId,
      decidedBy: req.user.userId,
      reason: reason || (winnerResponse ? `Response: ${winnerResponse.response}` : 'Officer decision'),
    });

    const winner = await req.db.get('SELECT character_name, character_class FROM users WHERE id = ?', winnerId);
    const decidedByUser = await req.db.get('SELECT character_name FROM users WHERE id = ?', req.user.userId);

    const eventData = {
      decisionId,
      itemName: decision.item_name,
      itemId: decision.item_id,
      winnerId,
      winnerName: winner?.character_name,
      winnerClass: winner?.character_class,
      decidedBy: req.user.userId,
      decidedByName: decidedByUser?.character_name,
      reason: reason || null,
    };

    req.app.get('io').emit('loot_awarded', eventData);
    return success(res, eventData);
  } catch (err) {
    log.error('Award loot error', err);
    return error(res, 'Failed to award item', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get loot decision history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit)) || 50;
    const lc = new LootCouncilSystem(req.db);
    const history = await lc.getDecisionHistory(limit);
    return success(res, history);
  } catch (err) {
    log.error('Loot history error', err);
    return error(res, 'Failed to get loot history', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
