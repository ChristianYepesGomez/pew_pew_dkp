/**
 * Global Buff Manager
 * Manages random buffs that are synchronized across all connected clients via SSE
 */

import { db } from '../database.js';

// Connected SSE clients
const clients = new Map();

// Active buffs (memberId -> { buff, expiresAt, casterName })
const activeBuffs = new Map();

// Spec to expected role mapping - used for validation
const SPEC_ROLES = {
  // Warrior
  'Arms': 'DPS', 'Fury': 'DPS', 'Protection Warrior': 'Tank',
  // Paladin
  'Holy Paladin': 'Healer', 'Protection Paladin': 'Tank', 'Retribution': 'DPS',
  // Hunter (all DPS)
  'Beast Mastery': 'DPS', 'Marksmanship': 'DPS', 'Survival': 'DPS',
  // Rogue (all DPS)
  'Assassination': 'DPS', 'Outlaw': 'DPS', 'Subtlety': 'DPS',
  // Priest
  'Discipline': 'Healer', 'Holy Priest': 'Healer', 'Shadow': 'DPS',
  // Shaman
  'Elemental': 'DPS', 'Enhancement': 'DPS', 'Restoration Shaman': 'Healer',
  // Mage (all DPS)
  'Arcane': 'DPS', 'Fire': 'DPS', 'Frost Mage': 'DPS',
  // Warlock (all DPS)
  'Affliction': 'DPS', 'Demonology': 'DPS', 'Destruction': 'DPS',
  // Druid
  'Balance': 'DPS', 'Feral': 'DPS', 'Guardian': 'Tank', 'Restoration Druid': 'Healer',
  // Death Knight
  'Blood': 'Tank', 'Frost DK': 'DPS', 'Unholy': 'DPS',
  // Monk
  'Brewmaster': 'Tank', 'Mistweaver': 'Healer', 'Windwalker': 'DPS',
  // Demon Hunter
  'Havoc': 'DPS', 'Vengeance': 'Tank',
  // Evoker
  'Devastation': 'DPS', 'Preservation': 'Healer', 'Augmentation': 'DPS',
};

// Buff definitions - using role + spec filtering for accuracy
// casterRole: required role to cast this buff (null = any role)
// casterSpecs: if set, caster's spec must be one of these (overrides casterRole for multi-spec classes)
const BUFFS = [
  // Raid-wide lust effects (any role can cast)
  { id: 'bloodlust', name: 'Bloodlust', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg', classes: ['Shaman'], casterRole: null, type: 'self', raidWide: true },
  { id: 'timewarp', name: 'Time Warp', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_mage_timewarp.jpg', classes: ['Mage'], casterRole: null, type: 'self', raidWide: true },

  // Healer externals (Healer role required)
  { id: 'powerinfusion', name: 'Power Infusion', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_powerinfusion.jpg', classes: ['Priest'], casterRole: 'Healer', type: 'external' },
  { id: 'innervate', name: 'Innervate', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_lightning.jpg', classes: ['Druid'], casterSpecs: ['Restoration Druid'], type: 'external', targetRoles: ['Healer'] },
  { id: 'painsuppression', name: 'Pain Suppression', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_painsupression.jpg', classes: ['Priest'], casterSpecs: ['Discipline'], type: 'external', targetRoles: ['Tank'] },
  { id: 'ironbark', name: 'Ironbark', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_druid_ironbark.jpg', classes: ['Druid'], casterSpecs: ['Restoration Druid'], type: 'external', targetRoles: ['Tank'] },
  { id: 'guardiansSpirit', name: "Guardian Spirit", duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_guardianspirit.jpg', classes: ['Priest'], casterSpecs: ['Holy Priest'], type: 'external', targetRoles: ['Tank'] },
  { id: 'lifeCocoon', name: 'Life Cocoon', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_chicocoon.jpg', classes: ['Monk'], casterSpecs: ['Mistweaver'], type: 'external', targetRoles: ['Tank'] },

  // Paladin externals (any Paladin can cast)
  { id: 'blessingofprotection', name: 'Blessing of Protection', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_sealofprotection.jpg', classes: ['Paladin'], casterRole: null, type: 'external' },
  { id: 'blessingofsacrifice', name: 'Blessing of Sacrifice', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_sealofsacrifice.jpg', classes: ['Paladin'], casterRole: null, type: 'external', targetRoles: ['Tank'] },

  // Tank cooldowns
  { id: 'dancingRuneWeapon', name: 'Dancing Rune Weapon', duration: 16, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_sword_07.jpg', classes: ['Death Knight'], casterSpecs: ['Blood'], type: 'self' },
  { id: 'seraphim', name: 'Seraphim', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_paladin_seraphim.jpg', classes: ['Paladin'], casterSpecs: ['Protection Paladin'], type: 'self' },

  // DPS cooldowns - spec-specific
  // Mage (each spec has its own CD)
  { id: 'icyveins', name: 'Icy Veins', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_frost_coldhearted.jpg', classes: ['Mage'], casterSpecs: ['Frost Mage'], type: 'self' },
  { id: 'combustion', name: 'Combustion', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_fire_sealoffire.jpg', classes: ['Mage'], casterSpecs: ['Fire'], type: 'self' },
  { id: 'arcanePower', name: 'Arcane Power', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_lightning.jpg', classes: ['Mage'], casterSpecs: ['Arcane'], type: 'self' },
  // Rogue (each spec has its own CD)
  { id: 'adrenalineRush', name: 'Adrenaline Rush', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_shadowworddominate.jpg', classes: ['Rogue'], casterSpecs: ['Outlaw'], type: 'self' },
  { id: 'vendetta', name: 'Vendetta', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_rogue_deadliness.jpg', classes: ['Rogue'], casterSpecs: ['Assassination'], type: 'self' },
  { id: 'shadowBlades', name: 'Shadow Blades', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_knife_1h_grimbatolraid_d_03.jpg', classes: ['Rogue'], casterSpecs: ['Subtlety'], type: 'self' },
  // Druid DPS (spec-specific)
  { id: 'berserk', name: 'Berserk', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_druid_berserk.jpg', classes: ['Druid'], casterSpecs: ['Feral'], type: 'self' },
  { id: 'celestialAlignment', name: 'Celestial Alignment', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_natureguardian.jpg', classes: ['Druid'], casterSpecs: ['Balance'], type: 'self' },
  { id: 'incarnation', name: 'Incarnation', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_druid_incarnation.jpg', classes: ['Druid'], casterSpecs: ['Balance', 'Feral', 'Guardian', 'Restoration Druid'], type: 'self' },
  // Warrior DPS (shared across Arms/Fury)
  { id: 'recklessness', name: 'Recklessness', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_criticalstrike.jpg', classes: ['Warrior'], casterSpecs: ['Arms', 'Fury'], type: 'self' },
  { id: 'avatar', name: 'Avatar', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/warrior_talent_icon_avatar.jpg', classes: ['Warrior'], casterRole: null, type: 'self' },
  // Death Knight DPS (spec-specific)
  { id: 'pillarofFrost', name: 'Pillar of Frost', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_deathknight_pillaroffrost.jpg', classes: ['Death Knight'], casterSpecs: ['Frost DK'], type: 'self' },
  { id: 'unholyAssault', name: 'Unholy Assault', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_unholyfrenzy.jpg', classes: ['Death Knight'], casterSpecs: ['Unholy'], type: 'self' },
  // Hunter (spec-specific)
  { id: 'aspectoftheWild', name: 'Aspect of the Wild', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_protectionformnature.jpg', classes: ['Hunter'], casterSpecs: ['Beast Mastery'], type: 'self' },
  { id: 'trueshot', name: 'Trueshot', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_trueshot.jpg', classes: ['Hunter'], casterSpecs: ['Marksmanship'], type: 'self' },
  { id: 'coordinated', name: 'Coordinated Assault', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_coordinatedassault.jpg', classes: ['Hunter'], casterSpecs: ['Survival'], type: 'self' },
  // Paladin (Avenging Wrath is shared across all specs)
  { id: 'avengingWrath', name: 'Avenging Wrath', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_avenginewrath.jpg', classes: ['Paladin'], casterRole: null, type: 'self' },
  // Warlock (spec-specific summons)
  { id: 'darkSoul', name: 'Dark Soul', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/warlock_darksoultorment.jpg', classes: ['Warlock'], casterRole: 'DPS', type: 'self' },
  { id: 'summonDarkglare', name: 'Summon Darkglare', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_beholderwarlock.jpg', classes: ['Warlock'], casterSpecs: ['Affliction'], type: 'self' },
  { id: 'summonInfernal', name: 'Summon Infernal', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_summoninfernal.jpg', classes: ['Warlock'], casterSpecs: ['Destruction'], type: 'self' },
  { id: 'summonDemonic', name: 'Demonic Tyrant', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_demonictyrant.jpg', classes: ['Warlock'], casterSpecs: ['Demonology'], type: 'self' },
  // Monk DPS (Windwalker only)
  { id: 'stormEarthFire', name: 'Storm, Earth, and Fire', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_giftofthewild.jpg', classes: ['Monk'], casterSpecs: ['Windwalker'], type: 'self' },
  { id: 'invokeXuen', name: 'Invoke Xuen', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_summontigerstatue.jpg', classes: ['Monk'], casterSpecs: ['Windwalker'], type: 'self' },
  // Demon Hunter DPS
  { id: 'metamorphosis', name: 'Metamorphosis', duration: 24, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_demonhunter_metamorphasisdps.jpg', classes: ['Demon Hunter'], casterSpecs: ['Havoc'], type: 'self' },
  { id: 'theHunt', name: 'The Hunt', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_ardenweald_demonhunter.jpg', classes: ['Demon Hunter'], casterRole: 'DPS', type: 'self' },
  // Evoker DPS
  { id: 'dragonrage', name: 'Dragonrage', duration: 18, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_evoker_dragonrage.jpg', classes: ['Evoker'], casterSpecs: ['Devastation'], type: 'self' },
];

// Buff interval timer
let buffIntervalId = null;
let members = [];

/**
 * Start the buff manager - begins randomly applying buffs
 */
export function startBuffManager() {
  if (buffIntervalId) return; // Already running

  console.log('🎮 Starting global buff manager...');

  let lastMemberRefresh = 0;
  const MEMBER_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh members every 5 minutes

  // Apply a random buff every 30-90 seconds
  const applyNextBuff = async () => {
    // Only refresh members periodically, not every buff
    if (Date.now() - lastMemberRefresh > MEMBER_REFRESH_INTERVAL) {
      await refreshMembers();
      lastMemberRefresh = Date.now();
    }
    if (members.length > 0) {
      applyRandomBuff();
    }
    // Schedule next buff
    const nextDelay = 30000 + Math.random() * 60000; // 30-90 seconds
    buffIntervalId = setTimeout(applyNextBuff, nextDelay);
  };

  // Start after initial delay
  buffIntervalId = setTimeout(applyNextBuff, 10000); // First buff after 10s
}

/**
 * Stop the buff manager
 */
export function stopBuffManager() {
  if (buffIntervalId) {
    clearTimeout(buffIntervalId);
    buffIntervalId = null;
    console.log('🛑 Stopped global buff manager');
  }
}

/**
 * Refresh the member list from database
 */
async function refreshMembers() {
  try {
    members = await db.all(`
      SELECT u.id, u.username, u.character_name, u.character_class,
             u.spec, u.raid_role as raidRole
      FROM users u
      WHERE u.is_active = 1 AND u.character_name IS NOT NULL AND u.character_class IS NOT NULL
    `);
    console.log(`📊 Buff manager: ${members.length} active members loaded`);
  } catch (err) {
    console.error('Error refreshing members for buff manager:', err);
    members = [];
  }
}

/**
 * Apply a random buff to a random eligible member
 */
function applyRandomBuff() {
  if (members.length === 0) {
    console.log('⚠️ Buff manager: No members available');
    return;
  }

  // Pick a random caster
  const caster = members[Math.floor(Math.random() * members.length)];
  if (!caster.character_class) {
    console.log(`⚠️ Buff manager: Caster ${caster.character_name} has no class`);
    return;
  }

  // Find buffs this class, role, AND spec can cast
  const availableBuffs = BUFFS.filter(b => {
    // Must match class
    if (!b.classes.includes(caster.character_class)) return false;
    // If casterSpecs is specified, must match the caster's spec (most precise filter)
    if (b.casterSpecs) {
      if (!caster.spec || !b.casterSpecs.includes(caster.spec)) return false;
    }
    // Otherwise fall back to role check: if casterRole is specified, must match
    else if (b.casterRole !== null) {
      if (!caster.raidRole || caster.raidRole !== b.casterRole) return false;
    }
    return true;
  });

  if (availableBuffs.length === 0) {
    // Silently skip - not all class/role combos have buffs defined
    return;
  }

  // Pick a random buff
  const buff = availableBuffs[Math.floor(Math.random() * availableBuffs.length)];

  // Determine target(s)
  let targets = [];

  if (buff.raidWide) {
    // Raid-wide buff applies to everyone
    targets = members.map(m => m.id);
  } else if (buff.type === 'self') {
    // Self-cast buff only on caster
    targets = [caster.id];
  } else {
    // External buff - find valid target
    let validTargets = members.filter(m => m.id !== caster.id);

    // Filter by role if specified
    if (buff.targetRoles && buff.targetRoles.length > 0) {
      validTargets = validTargets.filter(m => buff.targetRoles.includes(m.raidRole));
    }

    if (validTargets.length === 0) return;

    const target = validTargets[Math.floor(Math.random() * validTargets.length)];
    targets = [target.id];
  }

  const expiresAt = Date.now() + buff.duration * 1000;

  const isSelfCast = buff.type === 'self' && !buff.raidWide;

  // Store active buffs
  for (const targetId of targets) {
    activeBuffs.set(targetId, {
      buff: {
        id: buff.id,
        name: buff.name,
        icon: buff.icon,
        duration: buff.duration,
        raidWide: buff.raidWide,
      },
      expiresAt,
      casterName: caster.character_name,
      casterId: caster.id,
      isSelfCast,
    });
  }

  // Broadcast to all clients
  const event = {
    type: 'buff_applied',
    targets,
    buff: {
      id: buff.id,
      name: buff.name,
      icon: buff.icon,
      duration: buff.duration,
      raidWide: buff.raidWide,
    },
    casterName: caster.character_name,
    casterId: caster.id,
    isSelfCast,
    expiresAt,
  };

  broadcast(event);

  console.log(`🌟 ${caster.character_name} cast ${buff.name}${buff.raidWide ? ' (RAID-WIDE)' : ''} on ${targets.length} target(s)`);

  // Schedule buff expiration cleanup
  setTimeout(() => {
    for (const targetId of targets) {
      const current = activeBuffs.get(targetId);
      if (current && current.expiresAt === expiresAt) {
        activeBuffs.delete(targetId);
      }
    }
  }, buff.duration * 1000);
}

/**
 * Register a new SSE client
 */
export function registerClient(clientId, res) {
  clients.set(clientId, res);
  console.log(`📡 SSE client connected: ${clientId} (total: ${clients.size})`);

  // Send current active buffs to the new client
  const currentBuffs = {};
  const now = Date.now();
  for (const [memberId, data] of activeBuffs.entries()) {
    if (data.expiresAt > now) {
      currentBuffs[memberId] = data;
    }
  }

  if (Object.keys(currentBuffs).length > 0) {
    sendToClient(clientId, {
      type: 'sync',
      activeBuffs: currentBuffs,
    });
  }
}

/**
 * Unregister an SSE client
 */
export function unregisterClient(clientId) {
  clients.delete(clientId);
  console.log(`📡 SSE client disconnected: ${clientId} (total: ${clients.size})`);
}

/**
 * Send event to a specific client
 */
function sendToClient(clientId, data) {
  const client = clients.get(clientId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

/**
 * Broadcast event to all connected clients
 */
function broadcast(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const [, client] of clients) {
    client.write(message);
  }
}

/**
 * Get current active buffs (for API)
 */
export function getActiveBuffs() {
  const result = {};
  const now = Date.now();
  for (const [memberId, data] of activeBuffs.entries()) {
    if (data.expiresAt > now) {
      result[memberId] = data;
    }
  }
  return result;
}

export default {
  startBuffManager,
  stopBuffManager,
  registerClient,
  unregisterClient,
  getActiveBuffs,
};
