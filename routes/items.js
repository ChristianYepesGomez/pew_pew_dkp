import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getAllRaidItems, searchItems, getItemsByRaid, refreshFromAPI, getAvailableRaids, getDataSourceStatus, isAPIConfigured } from '../services/raidItems.js';
import { getAllDungeonItems } from '../services/dungeonItems.js';
import { getPopularItems } from '../services/itemPopularity.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Items');
const router = Router();

// Get all raid items
router.get('/raid-items', authenticateToken, async (req, res) => {
  try {
    const items = await getAllRaidItems(req.db);
    return success(res, { items });
  } catch (err) {
    log.error('Error fetching raid items', err);
    return error(res, 'Failed to fetch raid items', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Search raid items
router.get('/raid-items/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q || '';
    const items = query ? await searchItems(req.db, query) : await getAllRaidItems(req.db);
    return success(res, { items });
  } catch (err) {
    log.error('Error searching raid items', err);
    return error(res, 'Failed to search raid items', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get raid items data source status (before :raidName to avoid param matching)
router.get('/raid-items/status', authenticateToken, authorizeRole(['admin', 'officer']), async (req, res) => {
  return success(res, await getDataSourceStatus(req.db));
});

// Get items by raid
router.get('/raid-items/:raidName', authenticateToken, async (req, res) => {
  try {
    const { raidName } = req.params;
    const items = await getItemsByRaid(req.db, raidName);
    return success(res, { items });
  } catch (err) {
    log.error('Error fetching raid items by raid', err);
    return error(res, 'Failed to fetch raid items', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get available raids
router.get('/raids-list', authenticateToken, async (req, res) => {
  try {
    const raids = await getAvailableRaids();
    return success(res, { raids });
  } catch (err) {
    log.error('Error fetching raids list', err);
    return error(res, 'Failed to fetch raids list', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Force refresh raid items from Blizzard API
router.post('/raid-items/refresh', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    if (!isAPIConfigured()) {
      return error(res, 'Blizzard API not configured. Set BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET environment variables.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await refreshFromAPI(req.db);
    if (result.success) {
      return success(res, null, `Successfully refreshed ${result.count} items from Blizzard API`);
    } else {
      return error(res, result.error, 500, ErrorCodes.EXTERNAL_API_ERROR);
    }
  } catch (err) {
    log.error('Error refreshing raid items', err);
    return error(res, 'Failed to refresh raid items from API', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Get M+ dungeon items
router.get('/dungeon-items', authenticateToken, async (req, res) => {
  try {
    const items = await getAllDungeonItems();
    return success(res, { items, count: items.length });
  } catch (err) {
    log.error('Error fetching dungeon items', err);
    return success(res, { items: [], count: 0 });
  }
});

// Get all items (raid + M+) combined
router.get('/all-items', authenticateToken, async (req, res) => {
  try {
    const [raidItems, dungeonItems] = await Promise.all([
      getAllRaidItems(req.db),
      getAllDungeonItems().catch(err => {
        log.warn('Dungeon items fetch failed: ' + err.message);
        return [];
      }),
    ]);

    const tagged = [
      ...(raidItems || []).map(i => ({ ...i, sourceType: i.sourceType || 'raid' })),
      ...(dungeonItems || []),
    ];

    // Cache in browser for 30 min; serve stale up to 5 min extra while revalidating
    res.set('Cache-Control', 'private, max-age=1800, stale-while-revalidate=300');
    return success(res, { items: tagged, count: tagged.length });
  } catch (err) {
    log.error('Error fetching all items', err);
    return error(res, 'Failed to fetch items', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── Item Popularity ──

// Get popular items for a class/spec/slot
router.get('/item-popularity', authenticateToken, async (req, res) => {
  try {
    const { class: className, spec, slot, content } = req.query;
    if (!className) return error(res, 'class parameter required', 400, ErrorCodes.VALIDATION_ERROR);
    const items = await getPopularItems(req.db, String(className), spec ? String(spec) : null, content ? String(content) : 'raid', slot ? String(slot) : null);
    return success(res, items);
  } catch (err) {
    log.error('Error fetching item popularity', err);
    return error(res, 'Failed to fetch item popularity', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
