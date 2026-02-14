import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getAllRaidItems, searchItems, getItemsByRaid, refreshFromAPI, getAvailableRaids, getDataSourceStatus, isAPIConfigured } from '../services/raidItems.js';
import { getAllDungeonItems } from '../services/dungeonItems.js';
import { getPopularItems } from '../services/itemPopularity.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Items');
const router = Router();

// Get all raid items
router.get('/raid-items', authenticateToken, async (req, res) => {
  try {
    const items = await getAllRaidItems();
    res.json({ items });
  } catch (error) {
    log.error('Error fetching raid items', error);
    res.status(500).json({ error: 'Failed to fetch raid items' });
  }
});

// Search raid items
router.get('/raid-items/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q || '';
    const items = query ? await searchItems(query) : await getAllRaidItems();
    res.json({ items });
  } catch (error) {
    log.error('Error searching raid items', error);
    res.status(500).json({ error: 'Failed to search raid items' });
  }
});

// Get items by raid
router.get('/raid-items/:raidName', authenticateToken, async (req, res) => {
  try {
    const { raidName } = req.params;
    const items = await getItemsByRaid(raidName);
    res.json({ items });
  } catch (error) {
    log.error('Error fetching raid items by raid', error);
    res.status(500).json({ error: 'Failed to fetch raid items' });
  }
});

// Get available raids
router.get('/raids-list', authenticateToken, async (req, res) => {
  try {
    const raids = await getAvailableRaids();
    res.json({ raids });
  } catch (error) {
    log.error('Error fetching raids list', error);
    res.status(500).json({ error: 'Failed to fetch raids list' });
  }
});

// Get raid items data source status
router.get('/raid-items/status', authenticateToken, authorizeRole(['admin', 'officer']), (req, res) => {
  res.json(getDataSourceStatus());
});

// Force refresh raid items from Blizzard API
router.post('/raid-items/refresh', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    if (!isAPIConfigured()) {
      return res.status(400).json({
        error: 'Blizzard API not configured. Set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET environment variables.'
      });
    }

    const result = await refreshFromAPI();
    if (result.success) {
      res.json({ message: `Successfully refreshed ${result.count} items from Blizzard API` });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    log.error('Error refreshing raid items', error);
    res.status(500).json({ error: 'Failed to refresh raid items from API' });
  }
});

// Get M+ dungeon items
router.get('/dungeon-items', authenticateToken, async (req, res) => {
  try {
    const items = await getAllDungeonItems();
    res.json({ items, count: items.length });
  } catch (error) {
    log.error('Error fetching dungeon items', error);
    res.json({ items: [], count: 0 });
  }
});

// Get all items (raid + M+) combined
// Raid items load fast; dungeon items may take time on first fetch (returns empty until cached)
router.get('/all-items', authenticateToken, async (req, res) => {
  try {
    const [raidItems, dungeonItems] = await Promise.all([
      getAllRaidItems(),
      getAllDungeonItems().catch(err => {
        console.warn('Dungeon items fetch failed:', err.message);
        return [];
      }),
    ]);

    const tagged = [
      ...(raidItems || []).map(i => ({ ...i, sourceType: i.sourceType || 'raid' })),
      ...(dungeonItems || []),
    ];

    res.json({ items: tagged, count: tagged.length });
  } catch (error) {
    log.error('Error fetching all items', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// ── Item Popularity ──

// Get popular items for a class/spec/slot
router.get('/item-popularity', authenticateToken, async (req, res) => {
  try {
    const { class: className, spec, slot, content } = req.query;
    if (!className) return res.status(400).json({ error: 'class parameter required' });
    const items = await getPopularItems(className, spec || null, content || 'raid', slot || null);
    res.json(items);
  } catch (error) {
    log.error('Error fetching item popularity', error);
    res.status(500).json({ error: 'Failed to fetch item popularity' });
  }
});

export default router;
