import { Router } from 'express';
import { db } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Route:Characters');
const router = Router();

// Get current user's characters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const characters = await db.all(
      'SELECT * FROM characters WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC',
      req.user.userId
    );

    res.json(characters.map(c => ({
      id: c.id,
      characterName: c.character_name,
      characterClass: c.character_class,
      spec: c.spec,
      raidRole: c.raid_role,
      realm: c.realm,
      realmSlug: c.realm_slug,
      isPrimary: !!c.is_primary,
      createdAt: c.created_at
    })));
  } catch (error) {
    log.error('Get characters error', error);
    res.status(500).json({ error: 'Failed to get characters' });
  }
});

// Create new character
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { characterName, characterClass, spec, raidRole, realm, realmSlug } = req.body;
    const userId = req.user.userId;

    if (!characterName || !characterClass) {
      return res.status(400).json({ error: 'Character name and class are required' });
    }

    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : 'DPS';

    const existing = await db.all('SELECT id FROM characters WHERE user_id = ?', userId);
    const isPrimary = existing.length === 0 ? 1 : 0;

    // Check if character with same name exists (for Blizzard import update)
    const existingChar = await db.get(
      'SELECT id FROM characters WHERE user_id = ? AND LOWER(character_name) = LOWER(?)',
      userId, characterName
    );

    let charId;
    if (existingChar) {
      // Update existing character with realm info
      await db.run(
        'UPDATE characters SET character_class = ?, spec = ?, raid_role = ?, realm = ?, realm_slug = ? WHERE id = ?',
        characterClass, spec || null, validRaidRole, realm || null, realmSlug || null, existingChar.id
      );
      charId = existingChar.id;
    } else {
      const result = await db.run(
        'INSERT INTO characters (user_id, character_name, character_class, spec, raid_role, is_primary, realm, realm_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        userId, characterName, characterClass, spec || null, validRaidRole, isPrimary, realm || null, realmSlug || null
      );
      charId = result.lastInsertRowid;
    }

    if (isPrimary || existingChar) {
      // Update user's main character info including server
      const char = await db.get('SELECT is_primary FROM characters WHERE id = ?', charId);
      if (char?.is_primary) {
        await db.run(
          'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, server = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          characterName, characterClass, spec || null, validRaidRole, realmSlug || null, userId
        );
      }
    }

    // Read actual is_primary from the character record for accurate response
    const charRecord = await db.get('SELECT is_primary FROM characters WHERE id = ?', charId);

    res.status(201).json({
      id: charId,
      characterName,
      characterClass,
      spec: spec || null,
      raidRole: validRaidRole,
      realm: realm || null,
      realmSlug: realmSlug || null,
      isPrimary: !!charRecord?.is_primary
    });
  } catch (error) {
    log.error('Create character error', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// Update character
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid character ID' });

    const { characterName, characterClass, spec, raidRole } = req.body;
    const userId = req.user.userId;

    const character = await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const newName = characterName || character.character_name;
    const newClass = characterClass || character.character_class;
    const newSpec = spec !== undefined ? (spec || null) : character.spec;
    const newRole = raidRole && ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : character.raid_role;

    await db.run(
      'UPDATE characters SET character_name = ?, character_class = ?, spec = ?, raid_role = ? WHERE id = ?',
      newName, newClass, newSpec, newRole, id
    );

    if (character.is_primary) {
      await db.run(
        'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        newName, newClass, newSpec, newRole, userId
      );
    }

    res.json({ message: 'Character updated' });
  } catch (error) {
    log.error('Update character error', error);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// Delete character
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid character ID' });

    const userId = req.user.userId;

    const character = await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const charCount = await db.get('SELECT COUNT(*) as count FROM characters WHERE user_id = ?', userId);
    if (charCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete your only character' });
    }

    if (character.is_primary) {
      return res.status(400).json({ error: 'Cannot delete primary character. Set another as primary first.' });
    }

    await db.run('DELETE FROM characters WHERE id = ?', id);
    res.json({ message: 'Character deleted' });
  } catch (error) {
    log.error('Delete character error', error);
    res.status(500).json({ error: 'Failed to delete character' });
  }
});

// Set character as primary
router.put('/:id/primary', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid character ID' });

    const userId = req.user.userId;

    const character = await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await db.run('UPDATE characters SET is_primary = 0 WHERE user_id = ?', userId);
    await db.run('UPDATE characters SET is_primary = 1 WHERE id = ?', id);

    await db.run(
      'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, server = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      character.character_name, character.character_class, character.spec, character.raid_role, character.realm_slug, userId
    );

    req.app.get('io').emit('member_updated', { memberId: userId });
    res.json({ message: 'Primary character updated' });
  } catch (error) {
    log.error('Set primary character error', error);
    res.status(500).json({ error: 'Failed to set primary character' });
  }
});

export default router;
