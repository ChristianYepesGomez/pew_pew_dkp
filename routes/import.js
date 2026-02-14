import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Import');
const router = Router();

// Import roster from CSV (admin only)
router.post('/roster', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { members } = req.body;

    if (!members || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    let imported = 0;
    const defaultPassword = bcrypt.hashSync('changeme123', 10);

    await db.transaction(async (tx) => {
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

    res.json({ message: `Imported ${imported} members` });
  } catch (error) {
    log.error('Import roster error', error);
    res.status(500).json({ error: 'Failed to import roster' });
  }
});

export default router;
