import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:Import');
const router = Router();

// Import roster from CSV (admin only)
router.post('/roster', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { members } = req.body;

    if (!members || !Array.isArray(members)) {
      return error(res, 'Invalid data format', 400, ErrorCodes.VALIDATION_ERROR);
    }

    let imported = 0;
    const defaultPassword = bcrypt.hashSync('changeme123', 10);

    await req.db.transaction(async (tx) => {
      for (const member of members) {
        const result = await tx.run(`
          INSERT OR IGNORE INTO users (username, password, character_name, character_class, raid_role, role)
          VALUES (?, ?, ?, ?, ?, 'raider')
        `, member.username || member.characterName.toLowerCase(), defaultPassword, member.characterName, member.characterClass, member.raidRole || 'DPS');

        if (result.changes > 0) {
          await tx.run(`
            INSERT OR IGNORE INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent)
            VALUES (?, ?, ?, 0)
          `, result.lastInsertRowid, member.dkp || 0, member.dkp || 0);
          imported++;
        }
      }
    });

    return success(res, null, `Imported ${imported} members`);
  } catch (err) {
    log.error('Import roster error', err);
    return error(res, 'Failed to import roster', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
