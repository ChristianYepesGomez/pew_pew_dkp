import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getCharacterEquipment, getCharacterMedia, isBlizzardOAuthConfigured } from '../services/blizzardAPI.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { validateParams } from '../middleware/validate.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Armory');
const router = Router();

// Get player's loot history (items won from auctions)
router.get('/:userId/loot', authenticateToken, validateParams({ userId: 'integer' }), async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all auctions won by this user
    const loot = await req.db.all(`
      SELECT a.id, a.item_id, a.item_name, a.item_image, a.item_rarity, a.winning_bid, a.ended_at
      FROM auctions a
      WHERE a.winner_id = ? AND a.status = 'completed'
      ORDER BY a.ended_at DESC
    `, userId);

    return success(res, loot.map(item => ({
      id: item.id,
      itemId: item.item_id,
      itemName: item.item_name,
      itemImage: item.item_image,
      itemRarity: item.item_rarity,
      dkpSpent: item.winning_bid,
      wonAt: item.ended_at,
    })));
  } catch (err) {
    log.error('Get loot history error', err);
    return error(res, 'Failed to get loot history', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get character equipment from Blizzard API
router.get('/equipment/:realm/:character', authenticateToken, async (req, res) => {
  try {
    const { realm, character } = req.params;

    if (!isBlizzardOAuthConfigured()) {
      return error(res, 'Blizzard API not configured', 503, ErrorCodes.EXTERNAL_API_ERROR);
    }

    const equipment = await getCharacterEquipment(realm, character);
    if (equipment.error) {
      return error(res, equipment.error, 404, ErrorCodes.NOT_FOUND);
    }

    return success(res, equipment);
  } catch (err) {
    log.error('Get character equipment error', err);
    return error(res, 'Failed to get character equipment', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get character media (avatar/render) from Blizzard API
router.get('/media/:realm/:character', authenticateToken, async (req, res) => {
  try {
    const { realm, character } = req.params;

    if (!isBlizzardOAuthConfigured()) {
      return error(res, 'Blizzard API not configured', 503, ErrorCodes.EXTERNAL_API_ERROR);
    }

    const media = await getCharacterMedia(realm, character);
    if (!media) {
      return error(res, 'Character media not found', 404, ErrorCodes.NOT_FOUND);
    }

    return success(res, media);
  } catch (err) {
    log.error('Get character media error', err);
    return error(res, 'Failed to get character media', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get member profile for armory view
router.get('/:userId/profile', authenticateToken, validateParams({ userId: 'integer' }), async (req, res) => {
  try {
    const { userId } = req.params;

    const member = await req.db.get(`
      SELECT u.id, u.character_name, u.character_class, u.spec, u.raid_role, u.avatar, u.server,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.id = ? AND u.is_active = 1
    `, userId);

    if (!member) {
      return error(res, 'Member not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Count items won
    const lootCount = await req.db.get(
      'SELECT COUNT(*) as count FROM auctions WHERE winner_id = ? AND status = ?',
      userId, 'completed'
    );

    return success(res, {
      id: member.id,
      characterName: member.character_name,
      characterClass: member.character_class,
      spec: member.spec,
      raidRole: member.raid_role,
      avatar: member.avatar,
      server: member.server,
      currentDkp: member.current_dkp || 0,
      lifetimeGained: member.lifetime_gained || 0,
      lifetimeSpent: member.lifetime_spent || 0,
      itemsWon: lootCount?.count || 0,
    });
  } catch (err) {
    log.error('Get armory profile error', err);
    return error(res, 'Failed to get armory profile', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
