import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request, setupTestDb, cleanupTestDb, createTestUser } from './helpers.js';

describe('Characters endpoints', () => {
  let user;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();
    user = await createTestUser({ role: 'raider' });
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  // ── GET /api/characters ─────────────────────────

  describe('GET /api/characters', () => {
    it('returns 401 without auth', async () => {
      const res = await request.get('/api/characters');

      expect(res.status).toBe(401);
    });

    it('returns empty array for new user', async () => {
      const res = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── POST /api/characters ────────────────────────

  describe('POST /api/characters', () => {
    it('creates first character as auto-primary', async () => {
      const res = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          characterName: 'Testchar',
          characterClass: 'Warrior',
          spec: 'Arms',
          raidRole: 'DPS',
          realm: 'Ragnaros',
          realmSlug: 'ragnaros',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        characterName: 'Testchar',
        characterClass: 'Warrior',
        spec: 'Arms',
        raidRole: 'DPS',
        realm: 'Ragnaros',
        realmSlug: 'ragnaros',
        isPrimary: true,
      });
      expect(res.body.id).toBeDefined();
    });

    it('validates required fields (characterName, characterClass)', async () => {
      const res = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ spec: 'Fire' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('defaults raidRole to DPS if invalid', async () => {
      const res = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          characterName: 'Defaultrole',
          characterClass: 'Mage',
          raidRole: 'InvalidRole',
        });

      expect(res.status).toBe(201);
      expect(res.body.raidRole).toBe('DPS');
    });

    it('second character is NOT primary', async () => {
      const res = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          characterName: 'Altchar',
          characterClass: 'Priest',
          spec: 'Holy',
          raidRole: 'Healer',
        });

      expect(res.status).toBe(201);
      expect(res.body.isPrimary).toBe(false);
    });

    it('same name updates existing character', async () => {
      const res = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          characterName: 'Altchar',
          characterClass: 'Priest',
          spec: 'Shadow',
          raidRole: 'DPS',
          realm: 'Ragnaros',
          realmSlug: 'ragnaros',
        });

      expect(res.status).toBe(201);
      expect(res.body.spec).toBe('Shadow');
      expect(res.body.raidRole).toBe('DPS');

      // Verify no duplicate was created - user should still have exactly 3 characters
      // (Testchar, Defaultrole, Altchar)
      const listRes = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${user.token}`);

      const altchars = listRes.body.filter(c => c.characterName === 'Altchar');
      expect(altchars).toHaveLength(1);
      expect(altchars[0].spec).toBe('Shadow');
    });
  });

  // ── GET /api/characters (populated) ─────────────

  describe('GET /api/characters (populated)', () => {
    it('returns all user characters with correct fields', async () => {
      const res = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      // Primary character should be first (ORDER BY is_primary DESC)
      expect(res.body[0].isPrimary).toBe(true);
      expect(res.body[0].characterName).toBe('Testchar');

      // Verify shape of each character
      for (const char of res.body) {
        expect(char).toHaveProperty('id');
        expect(char).toHaveProperty('characterName');
        expect(char).toHaveProperty('characterClass');
        expect(char).toHaveProperty('spec');
        expect(char).toHaveProperty('raidRole');
        expect(char).toHaveProperty('isPrimary');
        expect(char).toHaveProperty('createdAt');
      }
    });
  });

  // ── PUT /api/characters/:id ─────────────────────

  describe('PUT /api/characters/:id', () => {
    let charId;

    beforeAll(async () => {
      // Get the primary character ID for this user
      const res = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${user.token}`);
      charId = res.body.find(c => c.isPrimary).id;
    });

    it('updates character fields', async () => {
      const res = await request
        .put(`/api/characters/${charId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          characterName: 'RenamedChar',
          spec: 'Fury',
          raidRole: 'Tank',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Character updated');

      // Verify the update
      const listRes = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${user.token}`);
      const updated = listRes.body.find(c => c.id === charId);
      expect(updated.characterName).toBe('RenamedChar');
      expect(updated.spec).toBe('Fury');
      expect(updated.raidRole).toBe('Tank');
    });

    it('returns 404 for other user\'s character', async () => {
      const otherUser = await createTestUser({ role: 'raider' });

      const res = await request
        .put(`/api/characters/${charId}`)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .send({ characterName: 'Hacked' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('validates character ID (NaN -> 400)', async () => {
      const res = await request
        .put('/api/characters/notanumber')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ characterName: 'Whatever' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid character ID');
    });
  });

  // ── DELETE /api/characters/:id ──────────────────

  describe('DELETE /api/characters/:id', () => {
    let primaryId;
    let nonPrimaryId;

    beforeAll(async () => {
      const res = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${user.token}`);
      primaryId = res.body.find(c => c.isPrimary).id;
      nonPrimaryId = res.body.find(c => !c.isPrimary).id;
    });

    it('can\'t delete primary character (400)', async () => {
      const res = await request
        .delete(`/api/characters/${primaryId}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('primary');
    });

    it('can delete non-primary character', async () => {
      const res = await request
        .delete(`/api/characters/${nonPrimaryId}`)
        .set('Authorization', `Bearer ${user.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Character deleted');

      // Verify it's gone
      const listRes = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${user.token}`);
      const found = listRes.body.find(c => c.id === nonPrimaryId);
      expect(found).toBeUndefined();
    });

    it('can\'t delete only character (400)', async () => {
      // Create a fresh user with exactly one character
      const singleCharUser = await createTestUser({ role: 'raider' });

      // Create their only character
      const createRes = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${singleCharUser.token}`)
        .send({ characterName: 'OnlyOne', characterClass: 'Rogue' });

      const onlyCharId = createRes.body.id;

      const res = await request
        .delete(`/api/characters/${onlyCharId}`)
        .set('Authorization', `Bearer ${singleCharUser.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('only character');
    });
  });

  // ── PUT /api/characters/:id/primary ─────────────

  describe('PUT /api/characters/:id/primary', () => {
    let setUser;
    let primaryCharId;
    let altCharId;

    beforeAll(async () => {
      setUser = await createTestUser({ role: 'raider' });

      // Create primary character
      const primary = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${setUser.token}`)
        .send({
          characterName: 'MainChar',
          characterClass: 'Paladin',
          spec: 'Retribution',
          raidRole: 'DPS',
          realm: 'Ragnaros',
          realmSlug: 'ragnaros',
        });
      primaryCharId = primary.body.id;

      // Create alt
      const alt = await request
        .post('/api/characters')
        .set('Authorization', `Bearer ${setUser.token}`)
        .send({
          characterName: 'AltChar',
          characterClass: 'Druid',
          spec: 'Restoration',
          raidRole: 'Healer',
          realm: 'Ragnaros',
          realmSlug: 'ragnaros',
        });
      altCharId = alt.body.id;
    });

    it('sets new primary and updates user profile', async () => {
      const res = await request
        .put(`/api/characters/${altCharId}/primary`)
        .set('Authorization', `Bearer ${setUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Primary character updated');

      // Verify the alt is now primary
      const listRes = await request
        .get('/api/characters')
        .set('Authorization', `Bearer ${setUser.token}`);

      const altChar = listRes.body.find(c => c.id === altCharId);
      expect(altChar.isPrimary).toBe(true);

      // Verify the old primary is no longer primary
      const oldPrimary = listRes.body.find(c => c.id === primaryCharId);
      expect(oldPrimary.isPrimary).toBe(false);

      // Verify user profile was updated via /auth/me
      const meRes = await request
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${setUser.token}`);

      expect(meRes.body.characterName).toBe('AltChar');
      expect(meRes.body.characterClass).toBe('Druid');
    });

    it('returns 404 for non-existent character', async () => {
      const res = await request
        .put('/api/characters/999999/primary')
        .set('Authorization', `Bearer ${setUser.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });
});
