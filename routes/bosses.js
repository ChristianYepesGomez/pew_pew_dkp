import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { adminLimiter } from '../lib/rateLimiters.js';
import { getAllZonesWithBosses, getBossDetails, seedRaidData, setZoneLegacy } from '../services/raids.js';

const router = Router();

// Get all zones with bosses (current + legacy)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const data = await getAllZonesWithBosses();
    res.json(data);
  } catch (error) {
    console.error('Get bosses error:', error);
    res.status(500).json({ error: 'Failed to get boss data' });
  }
});

// DEBUG: Check raw boss_statistics data
router.get('/debug/stats', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const stats = await db.all('SELECT * FROM boss_statistics ORDER BY boss_id');
    const bosses = await db.all('SELECT id, wcl_encounter_id, name FROM wcl_bosses ORDER BY id');
    const processed = await db.all('SELECT * FROM boss_stats_processed ORDER BY id DESC LIMIT 20');
    res.json({
      boss_statistics: stats,
      wcl_bosses: bosses,
      recent_processed: processed,
      counts: {
        stats: stats.length,
        bosses: bosses.length,
        processed: processed.length
      }
    });
  } catch (error) {
    console.error('Debug stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed stats for a specific boss
router.get('/:bossId', authenticateToken, async (req, res) => {
  try {
    const bossId = parseInt(req.params.bossId, 10);
    if (isNaN(bossId)) return res.status(400).json({ error: 'Invalid boss ID' });

    const { difficulty } = req.query;
    const data = await getBossDetails(bossId, difficulty || null);

    if (!data) {
      return res.status(404).json({ error: 'Boss not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Get boss details error:', error);
    res.status(500).json({ error: 'Failed to get boss details' });
  }
});

// Reseed raid data from static definitions (admin only)
router.post('/sync', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    await seedRaidData();
    res.json({ message: 'Raid data synced successfully' });
  } catch (error) {
    console.error('Sync raid data error:', error);
    res.status(500).json({ error: 'Failed to sync raid data' });
  }
});

// Mark a zone as legacy or current (admin only)
router.put('/zones/:zoneId/legacy', adminLimiter, authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const zoneId = parseInt(req.params.zoneId, 10);
    if (isNaN(zoneId)) return res.status(400).json({ error: 'Invalid zone ID' });

    const { isLegacy } = req.body;

    await setZoneLegacy(zoneId, isLegacy);
    res.json({ message: `Zone marked as ${isLegacy ? 'legacy' : 'current'}` });
  } catch (error) {
    console.error('Set zone legacy error:', error);
    res.status(500).json({ error: 'Failed to update zone status' });
  }
});

export default router;
