import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { userLimiter } from '../lib/rateLimiters.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:Characters');
const router = Router();

// Get current user's characters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const characters = await req.db.all(
      `SELECT id, character_name, character_class, spec, raid_role, realm, realm_slug, is_primary, created_at
       FROM characters WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC`,
      req.user.userId
    );

    return success(res, characters.map(c => ({
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
  } catch (err) {
    log.error('Get characters error', err);
    return error(res, 'Failed to get characters', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Create new character
router.post('/', userLimiter, authenticateToken, async (req, res) => {
  try {
    const { characterName, characterClass, spec, raidRole, realm, realmSlug } = req.body;
    const userId = req.user.userId;

    if (!characterName || !characterClass) {
      return error(res, 'Character name and class are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const validRaidRole = ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : 'DPS';

    const existing = await req.db.all('SELECT id FROM characters WHERE user_id = ?', userId);
    const isPrimary = existing.length === 0 ? 1 : 0;

    // Check if character with same name exists (for Blizzard import update)
    const existingChar = await req.db.get(
      'SELECT id FROM characters WHERE user_id = ? AND LOWER(character_name) = LOWER(?)',
      userId, characterName
    );

    let charId;
    if (existingChar) {
      // Update existing character with realm info
      await req.db.run(
        'UPDATE characters SET character_class = ?, spec = ?, raid_role = ?, realm = ?, realm_slug = ? WHERE id = ?',
        characterClass, spec || null, validRaidRole, realm || null, realmSlug || null, existingChar.id
      );
      charId = existingChar.id;
    } else {
      const result = await req.db.run(
        'INSERT INTO characters (user_id, character_name, character_class, spec, raid_role, is_primary, realm, realm_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        userId, characterName, characterClass, spec || null, validRaidRole, isPrimary, realm || null, realmSlug || null
      );
      charId = result.lastInsertRowid;
    }

    if (isPrimary || existingChar) {
      // Update user's main character info including server
      const char = await req.db.get('SELECT is_primary FROM characters WHERE id = ?', charId);
      if (char?.is_primary) {
        await req.db.run(
          'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, server = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          characterName, characterClass, spec || null, validRaidRole, realmSlug || null, userId
        );
      }
    }

    // Read actual is_primary from the character record for accurate response
    const charRecord = await req.db.get('SELECT is_primary FROM characters WHERE id = ?', charId);

    return success(res, {
      id: charId,
      characterName,
      characterClass,
      spec: spec || null,
      raidRole: validRaidRole,
      realm: realm || null,
      realmSlug: realmSlug || null,
      isPrimary: !!charRecord?.is_primary
    }, null, 201);
  } catch (err) {
    log.error('Create character error', err);
    return error(res, 'Failed to create character', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Update character
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid character ID', 400, ErrorCodes.VALIDATION_ERROR);

    const { characterName, characterClass, spec, raidRole } = req.body;
    const userId = req.user.userId;

    const character = await req.db.get(
      'SELECT id, character_name, character_class, spec, raid_role, is_primary FROM characters WHERE id = ? AND user_id = ?', id, userId
    );
    if (!character) {
      return error(res, 'Character not found', 404, ErrorCodes.NOT_FOUND);
    }

    const newName = characterName || character.character_name;
    const newClass = characterClass || character.character_class;
    const newSpec = spec !== undefined ? (spec || null) : character.spec;
    const newRole = raidRole && ['Tank', 'Healer', 'DPS'].includes(raidRole) ? raidRole : character.raid_role;

    await req.db.run(
      'UPDATE characters SET character_name = ?, character_class = ?, spec = ?, raid_role = ? WHERE id = ?',
      newName, newClass, newSpec, newRole, id
    );

    if (character.is_primary) {
      await req.db.run(
        'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        newName, newClass, newSpec, newRole, userId
      );
    }

    return success(res, null, 'Character updated');
  } catch (err) {
    log.error('Update character error', err);
    return error(res, 'Failed to update character', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Delete character
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid character ID', 400, ErrorCodes.VALIDATION_ERROR);

    const userId = req.user.userId;

    const character = await req.db.get(
      'SELECT id, is_primary FROM characters WHERE id = ? AND user_id = ?', id, userId
    );
    if (!character) {
      return error(res, 'Character not found', 404, ErrorCodes.NOT_FOUND);
    }

    const charCount = await req.db.get('SELECT COUNT(*) as count FROM characters WHERE user_id = ?', userId);
    if (charCount.count <= 1) {
      return error(res, 'Cannot delete your only character', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (character.is_primary) {
      return error(res, 'Cannot delete primary character. Set another as primary first.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await req.db.run('DELETE FROM characters WHERE id = ?', id);
    return success(res, null, 'Character deleted');
  } catch (err) {
    log.error('Delete character error', err);
    return error(res, 'Failed to delete character', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Set character as primary
router.put('/:id/primary', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return error(res, 'Invalid character ID', 400, ErrorCodes.VALIDATION_ERROR);

    const userId = req.user.userId;

    const character = await req.db.get(
      'SELECT id, character_name, character_class, spec, raid_role, realm_slug FROM characters WHERE id = ? AND user_id = ?', id, userId
    );
    if (!character) {
      return error(res, 'Character not found', 404, ErrorCodes.NOT_FOUND);
    }

    await req.db.run('UPDATE characters SET is_primary = 0 WHERE user_id = ?', userId);
    await req.db.run('UPDATE characters SET is_primary = 1 WHERE id = ?', id);

    await req.db.run(
      'UPDATE users SET character_name = ?, character_class = ?, spec = ?, raid_role = ?, server = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      character.character_name, character.character_class, character.spec, character.raid_role, character.realm_slug, userId
    );

    req.app.get('io').emit('member_updated', { memberId: userId });
    return success(res, null, 'Primary character updated');
  } catch (err) {
    log.error('Set primary character error', err);
    return error(res, 'Failed to set primary character', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
