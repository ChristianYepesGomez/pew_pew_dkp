/**
 * Global Buff Manager
 * Manages random buffs that are synchronized across all connected clients via SSE
 */

import { db } from '../database.js';

// Connected SSE clients
const clients = new Map();

// Active buffs (memberId -> { buff, expiresAt, casterName })
const activeBuffs = new Map();

// Buff definitions (same as frontend, but server-authoritative)
const BUFFS = [
  // Raid-wide lust effects (Horde)
  { id: 'bloodlust', name: 'Bloodlust', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg', classes: ['Shaman'], type: 'self', raidWide: true },
  { id: 'timewarp', name: 'Time Warp', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_mage_timewarp.jpg', classes: ['Mage'], type: 'self', raidWide: true },

  // Short cooldowns - external buffs
  { id: 'powerinfusion', name: 'Power Infusion', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_powerinfusion.jpg', classes: ['Priest'], type: 'external' },
  { id: 'innervate', name: 'Innervate', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_lightning.jpg', classes: ['Druid'], type: 'external', targetRoles: ['Healer'] },

  // Defensive externals
  { id: 'painsuppression', name: 'Pain Suppression', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_painsupression.jpg', classes: ['Priest'], type: 'external', targetRoles: ['Tank'] },
  { id: 'ironbark', name: 'Ironbark', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_druid_ironbark.jpg', classes: ['Druid'], type: 'external', targetRoles: ['Tank'] },
  { id: 'blessingofprotection', name: 'Blessing of Protection', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_sealofprotection.jpg', classes: ['Paladin'], type: 'external' },
  { id: 'blessingofsacrifice', name: 'Blessing of Sacrifice', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_sealofsacrifice.jpg', classes: ['Paladin'], type: 'external', targetRoles: ['Tank'] },
  { id: 'guardiansSpirit', name: "Guardian Spirit", duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_guardianspirit.jpg', classes: ['Priest'], type: 'external', targetRoles: ['Tank'] },
  { id: 'lifeCocoon', name: 'Life Cocoon', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_chicocoon.jpg', classes: ['Monk'], type: 'external', targetRoles: ['Tank'] },

  // Short DPS cooldowns (self-cast, shown on caster)
  { id: 'icyveins', name: 'Icy Veins', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_frost_coldhearted.jpg', classes: ['Mage'], type: 'self' },
  { id: 'combustion', name: 'Combustion', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_fire_sealoffire.jpg', classes: ['Mage'], type: 'self' },
  { id: 'arcanePower', name: 'Arcane Power', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_lightning.jpg', classes: ['Mage'], type: 'self' },
  { id: 'adrenalineRush', name: 'Adrenaline Rush', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_shadowworddominate.jpg', classes: ['Rogue'], type: 'self' },
  { id: 'vendetta', name: 'Vendetta', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_rogue_deadliness.jpg', classes: ['Rogue'], type: 'self' },
  { id: 'berserk', name: 'Berserk', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_druid_berserk.jpg', classes: ['Druid'], type: 'self' },
  { id: 'incarnation', name: 'Incarnation', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_druid_incarnation.jpg', classes: ['Druid'], type: 'self' },
  { id: 'recklessness', name: 'Recklessness', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_criticalstrike.jpg', classes: ['Warrior'], type: 'self' },
  { id: 'avatar', name: 'Avatar', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_avatar.jpg', classes: ['Warrior'], type: 'self' },
  { id: 'pillarofFrost', name: 'Pillar of Frost', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_deathknight_pillaroffrost.jpg', classes: ['Death Knight'], type: 'self' },
  { id: 'unholyAssault', name: 'Unholy Assault', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_unholyfrenzy.jpg', classes: ['Death Knight'], type: 'self' },
  { id: 'aspectoftheWild', name: 'Aspect of the Wild', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_protectionformnature.jpg', classes: ['Hunter'], type: 'self' },
  { id: 'trueshot', name: 'Trueshot', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_trueshot.jpg', classes: ['Hunter'], type: 'self' },
  { id: 'coordinated', name: 'Coordinated Assault', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_coordinatedassault.jpg', classes: ['Hunter'], type: 'self' },
  { id: 'avengingWrath', name: 'Avenging Wrath', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_avenginewrath.jpg', classes: ['Paladin'], type: 'self' },
  { id: 'seraphim', name: 'Seraphim', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_paladin_seraphim.jpg', classes: ['Paladin'], type: 'self' },
  { id: 'darkSoul', name: 'Dark Soul', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/warlock_dark soul.jpg', classes: ['Warlock'], type: 'self' },
  { id: 'summonDarkglare', name: 'Summon Darkglare', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_beholderwarlock.jpg', classes: ['Warlock'], type: 'self' },
  { id: 'stormEarthFire', name: 'Storm, Earth, and Fire', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_giftofthewild.jpg', classes: ['Monk'], type: 'self' },
  { id: 'invokeXuen', name: 'Invoke Xuen', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_summontigerstatue.jpg', classes: ['Monk'], type: 'self' },
  { id: 'metamorphosis', name: 'Metamorphosis', duration: 24, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_demonhunter_metamorphasisdps.jpg', classes: ['Demon Hunter'], type: 'self' },
  { id: 'theHunt', name: 'The Hunt', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_ardenweald_demonhunter.jpg', classes: ['Demon Hunter'], type: 'self' },
  { id: 'dragonrage', name: 'Dragonrage', duration: 18, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_evoker_dragonrage.jpg', classes: ['Evoker'], type: 'self' },
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

  // Apply a random buff every 30-90 seconds
  const applyNextBuff = async () => {
    await refreshMembers();
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
             md.raid_role as raidRole
      FROM users u
      LEFT JOIN member_dkp md ON u.id = md.user_id
      WHERE u.character_name IS NOT NULL
    `);
  } catch (err) {
    console.error('Error refreshing members for buff manager:', err);
    members = [];
  }
}

/**
 * Apply a random buff to a random eligible member
 */
function applyRandomBuff() {
  if (members.length === 0) return;

  // Pick a random caster
  const caster = members[Math.floor(Math.random() * members.length)];
  if (!caster.character_class) return;

  // Find buffs this class can cast
  const availableBuffs = BUFFS.filter(b => b.classes.includes(caster.character_class));
  if (availableBuffs.length === 0) return;

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
