import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { getCharacterEquipment, getCharacterMedia, isBlizzardOAuthConfigured } from '../services/blizzardAPI.js';

const router = Router();

// Get player's loot history (items won from auctions)
router.get('/:userId/loot', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all auctions won by this user
    const loot = await db.all(`
      SELECT a.id, a.item_id, a.item_name, a.item_image, a.item_rarity, a.winning_bid, a.ended_at
      FROM auctions a
      WHERE a.winner_id = ? AND a.status = 'completed'
      ORDER BY a.ended_at DESC
    `, userId);

    res.json(loot.map(item => ({
      id: item.id,
      itemId: item.item_id,
      itemName: item.item_name,
      itemImage: item.item_image,
      itemRarity: item.item_rarity,
      dkpSpent: item.winning_bid,
      wonAt: item.ended_at,
    })));
  } catch (error) {
    console.error('Get loot history error:', error);
    res.status(500).json({ error: 'Failed to get loot history' });
  }
});

// Get character equipment from Blizzard API
router.get('/equipment/:realm/:character', authenticateToken, async (req, res) => {
  try {
    const { realm, character } = req.params;

    if (!isBlizzardOAuthConfigured()) {
      return res.status(503).json({ error: 'Blizzard API not configured' });
    }

    const equipment = await getCharacterEquipment(realm, character);
    if (equipment.error) {
      return res.status(404).json({ error: equipment.error });
    }

    res.json(equipment);
  } catch (error) {
    console.error('Get character equipment error:', error);
    res.status(500).json({ error: 'Failed to get character equipment' });
  }
});

// Get character media (avatar/render) from Blizzard API
router.get('/media/:realm/:character', authenticateToken, async (req, res) => {
  try {
    const { realm, character } = req.params;

    if (!isBlizzardOAuthConfigured()) {
      return res.status(503).json({ error: 'Blizzard API not configured' });
    }

    const media = await getCharacterMedia(realm, character);
    if (!media) {
      return res.status(404).json({ error: 'Character media not found' });
    }

    res.json(media);
  } catch (error) {
    console.error('Get character media error:', error);
    res.status(500).json({ error: 'Failed to get character media' });
  }
});

// Get member profile for armory view
router.get('/:userId/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const member = await db.get(`
      SELECT u.id, u.character_name, u.character_class, u.spec, u.raid_role, u.avatar, u.server,
             md.current_dkp, md.lifetime_gained, md.lifetime_spent
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.id = ? AND u.is_active = 1
    `, userId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Count items won
    const lootCount = await db.get(
      'SELECT COUNT(*) as count FROM auctions WHERE winner_id = ? AND status = ?',
      userId, 'completed'
    );

    res.json({
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
  } catch (error) {
    console.error('Get armory profile error:', error);
    res.status(500).json({ error: 'Failed to get armory profile' });
  }
});

export default router;
