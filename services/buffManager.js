/**
 * Global Buff Manager
 * Manages random buffs that are synchronized across all connected clients via SSE
 */

import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:BuffManager');

// Connected SSE clients
const clients = new Map();

// Active buffs (memberId -> { buff, expiresAt, casterName })
const activeBuffs = new Map();

// Buff definitions - using role + spec filtering for accuracy
// casterRole: required role to cast this buff (null = any role)
// casterSpecs: if set, caster's spec must be one of these (overrides casterRole for multi-spec classes)
const BUFFS = [
  // Raid-wide lust effects (any role can cast)
  { id: 'bloodlust', name: 'Bloodlust', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg', classes: ['Shaman'], casterRole: null, type: 'self', raidWide: true },
  { id: 'timewarp', name: 'Time Warp', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_mage_timewarp.jpg', classes: ['Mage'], casterRole: null, type: 'self', raidWide: true },

  // Healer externals (Healer role required)
  { id: 'powerinfusion', name: 'Power Infusion', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_powerinfusion.jpg', classes: ['Priest'], casterRole: null, type: 'external' },
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
  { id: 'darkSoul', name: 'Dark Soul', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_warlock_demonsoul.jpg', classes: ['Warlock'], casterRole: 'DPS', type: 'self' },
  { id: 'summonDarkglare', name: 'Summon Darkglare', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_beholderwarlock.jpg', classes: ['Warlock'], casterSpecs: ['Affliction'], type: 'self' },
  { id: 'summonInfernal', name: 'Summon Infernal', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_summoninfernal.jpg', classes: ['Warlock'], casterSpecs: ['Destruction'], type: 'self' },
  { id: 'summonDemonic', name: 'Demonic Tyrant', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/inv_summondemonictyrant.jpg', classes: ['Warlock'], casterSpecs: ['Demonology'], type: 'self' },
  // Monk DPS (Windwalker only)
  { id: 'stormEarthFire', name: 'Storm, Earth, and Fire', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_giftofthewild.jpg', classes: ['Monk'], casterSpecs: ['Windwalker'], type: 'self' },
  { id: 'invokeXuen', name: 'Invoke Xuen', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_summontigerstatue.jpg', classes: ['Monk'], casterSpecs: ['Windwalker'], type: 'self' },
  // Demon Hunter DPS
  { id: 'metamorphosis', name: 'Metamorphosis', duration: 24, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_demonhunter_metamorphasisdps.jpg', classes: ['Demon Hunter'], casterSpecs: ['Havoc'], type: 'self' },
  { id: 'theHunt', name: 'The Hunt', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_ardenweald_demonhunter.jpg', classes: ['Demon Hunter'], casterRole: 'DPS', type: 'self' },
  // Evoker DPS
  { id: 'dragonrage', name: 'Dragonrage', duration: 18, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_evoker_dragonrage.jpg', classes: ['Evoker'], casterSpecs: ['Devastation'], type: 'self' },

  // --- Shadow Priest ---
  // Dark Ascension: ~1.5min CD, major Shadow DPS CD
  { id: 'darkAscension', name: 'Dark Ascension', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_priest_darkascension.jpg', classes: ['Priest'], casterSpecs: ['Shadow'], type: 'self' },
  // Desperate Prayer: 1.5min CD, self-heal/defensive for any Priest spec
  { id: 'desperatePrayer', name: 'Desperate Prayer', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_desperateprayer.jpg', classes: ['Priest'], casterRole: null, type: 'self' },

  // --- Shaman DPS CDs ---
  // Feral Spirit: 2.5min CD, Enhancement wolves
  { id: 'feralSpirit', name: 'Feral Spirit', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_shaman_feralspirit.jpg', classes: ['Shaman'], casterSpecs: ['Enhancement'], type: 'self' },
  // Ascendance: ~3min CD, shared by all Shaman specs (different effects per spec)
  { id: 'ascendance', name: 'Ascendance', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_shaman_ascendance.jpg', classes: ['Shaman'], casterRole: null, type: 'self' },
  // Stormkeeper: ~1.5min CD, Elemental burst enabler
  { id: 'stormkeeper', name: 'Stormkeeper', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_shaman_stormkeeper.jpg', classes: ['Shaman'], casterSpecs: ['Elemental'], type: 'self' },
  // Astral Shift: 1.5min CD, defensive for any Shaman spec
  { id: 'astralShift', name: 'Astral Shift', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_shaman_astralshift.jpg', classes: ['Shaman'], casterRole: null, type: 'self' },

  // --- Mistweaver Monk ---
  // Invoke Chi-Ji: 3min CD, major healing CD
  { id: 'invokeChiJi', name: 'Invoke Chi-Ji', duration: 25, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_summonredcranestatue.jpg', classes: ['Monk'], casterSpecs: ['Mistweaver'], type: 'self' },
  // Revival: 3min CD, raid-wide heal / dispel
  { id: 'revival', name: 'Revival', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_revival.jpg', classes: ['Monk'], casterSpecs: ['Mistweaver'], type: 'self' },
  // Fortifying Brew: 6min CD, defensive for any Monk spec
  { id: 'fortifyingBrew', name: 'Fortifying Brew', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_monk_fortifyingale_new.jpg', classes: ['Monk'], casterRole: null, type: 'self' },

  // --- Blood Death Knight defensives ---
  // Vampiric Blood: 1.5min CD, major tank survival CD
  { id: 'vampiricBlood', name: 'Vampiric Blood', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_deathknight_vampiricblood.jpg', classes: ['Death Knight'], casterSpecs: ['Blood'], type: 'self' },
  // Icebound Fortitude: 3min CD, defensive for any DK spec
  { id: 'iceboundFortitude', name: 'Icebound Fortitude', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_iceboundfortitude.jpg', classes: ['Death Knight'], casterRole: null, type: 'self' },

  // --- Warlock defensive ---
  // Unending Resolve: 3min CD, major defensive for any Warlock spec
  { id: 'unendingResolve', name: 'Unending Resolve', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_warlock_unendingresolution.jpg', classes: ['Warlock'], casterRole: null, type: 'self' },

  // ─── WARRIOR ──────────────────────────────────────────────────────────────
  // Rallying Cry: 10min CD, raid-wide +10% HP bonus
  { id: 'rallyingCry', name: 'Rallying Cry', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_rallyingcry.jpg', classes: ['Warrior'], casterRole: null, type: 'self', raidWide: true },
  // Shield Wall: 4min CD, Protection Warrior major defensive
  { id: 'shieldWall', name: 'Shield Wall', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_shieldwall.jpg', classes: ['Warrior'], casterSpecs: ['Protection Warrior'], type: 'self' },
  // Last Stand: 3min CD, Protection Warrior HP boost
  { id: 'lastStand', name: 'Last Stand', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_laststand.jpg', classes: ['Warrior'], casterSpecs: ['Protection Warrior'], type: 'self' },
  // Die by the Sword: 2min CD, Arms Warrior parry/defensive
  { id: 'dieByTheSword', name: 'Die by the Sword', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_warrior_diebythesword.jpg', classes: ['Warrior'], casterSpecs: ['Arms'], type: 'self' },

  // ─── DRUID ────────────────────────────────────────────────────────────────
  // Survival Instincts: 3min CD, Feral / Guardian defensive
  { id: 'survivalInstincts', name: 'Survival Instincts', duration: 6, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_druid_survivalinstincts.jpg', classes: ['Druid'], casterSpecs: ['Feral', 'Guardian'], type: 'self' },
  // Tranquility: 3min CD, Restoration Druid raid-wide channel heal
  { id: 'tranquility', name: 'Tranquility', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_nature_tranquility.jpg', classes: ['Druid'], casterSpecs: ['Restoration Druid'], type: 'self' },
  // Convoke the Spirits: 2min CD, any Druid burst
  { id: 'convokeTheSpirits', name: 'Convoke the Spirits', duration: 4, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_druid_convoke.jpg', classes: ['Druid'], casterRole: null, type: 'self' },

  // ─── PALADIN ──────────────────────────────────────────────────────────────
  // Divine Shield: 5min CD, any Paladin full immunity ("bubble")
  { id: 'divineShield', name: 'Divine Shield', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_divineprotection.jpg', classes: ['Paladin'], casterRole: null, type: 'self' },
  // Lay on Hands: 10min CD, any Paladin external emergency heal on Tank
  { id: 'layOnHands', name: 'Lay on Hands', duration: 5, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_layonhands.jpg', classes: ['Paladin'], casterRole: null, type: 'external', targetRoles: ['Tank'] },
  // Ardent Defender: 2min CD, Protection Paladin emergency survival
  { id: 'ardentDefender', name: 'Ardent Defender', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_holy_ardentdefender.jpg', classes: ['Paladin'], casterSpecs: ['Protection Paladin'], type: 'self' },

  // ─── MAGE ─────────────────────────────────────────────────────────────────
  // Ice Block: 4min CD, any Mage full immunity
  { id: 'iceBlock', name: 'Ice Block', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_mage_iceblock.jpg', classes: ['Mage'], casterRole: null, type: 'self' },

  // ─── ROGUE ────────────────────────────────────────────────────────────────
  // Evasion: 2min CD, any Rogue dodge burst
  { id: 'evasion', name: 'Evasion', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_rogue_evasion.jpg', classes: ['Rogue'], casterRole: null, type: 'self' },
  // Cloak of Shadows: 2min CD, any Rogue magic immunity
  { id: 'cloakOfShadows', name: 'Cloak of Shadows', duration: 5, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_nethercloak.jpg', classes: ['Rogue'], casterRole: null, type: 'self' },

  // ─── HUNTER ───────────────────────────────────────────────────────────────
  // Survival of the Fittest: 2min CD, any Hunter damage reduction
  { id: 'survivalOfTheFittest', name: 'Survival of the Fittest', duration: 6, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_hunter_survivalofthefittest.jpg', classes: ['Hunter'], casterRole: null, type: 'self' },
  // Exhilaration: 1.5min CD, any Hunter self-heal burst
  { id: 'exhilaration', name: 'Exhilaration', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_hunter_onewithnature.jpg', classes: ['Hunter'], casterRole: null, type: 'self' },

  // ─── MONK — BREWMASTER ────────────────────────────────────────────────────
  // Invoke Niuzao, the Black Ox: 3min CD, Brewmaster tank summon
  { id: 'invokeNiuzao', name: 'Invoke Niuzao, the Black Ox', duration: 25, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_monk_brewmaster_spec.jpg', classes: ['Monk'], casterSpecs: ['Brewmaster'], type: 'self' },

  // ─── DEMON HUNTER — VENGEANCE ─────────────────────────────────────────────
  // Metamorphosis (tank): 3min CD, Vengeance major defensive CD
  { id: 'metamorphosisTank', name: 'Metamorphosis', duration: 30, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_demonhunter_metamorphasis.jpg', classes: ['Demon Hunter'], casterSpecs: ['Vengeance'], type: 'self' },
  // Fiery Brand: 1.5min CD, Vengeance single-target tank defensive
  { id: 'fieryBrand', name: 'Fiery Brand', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_demonhunter_fierybrand.jpg', classes: ['Demon Hunter'], casterSpecs: ['Vengeance'], type: 'self' },

  // ─── EVOKER — PRESERVATION ────────────────────────────────────────────────
  // Rewind: 2min CD, Preservation major healing CD (reverses damage dealt)
  { id: 'rewind', name: 'Rewind', duration: 5, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_evoker_rewind.jpg', classes: ['Evoker'], casterSpecs: ['Preservation'], type: 'self' },
  // Stasis: 1.5min CD, Preservation healing storage
  { id: 'stasis', name: 'Stasis', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_evoker_stasis.jpg', classes: ['Evoker'], casterSpecs: ['Preservation'], type: 'self' },

  // ─── EVOKER — AUGMENTATION ────────────────────────────────────────────────
  // Breath of Eons: 2min CD, Augmentation major support CD (buffs nearby allies)
  { id: 'breathOfEons', name: 'Breath of Eons', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/large/ability_evoker_breathofeons.jpg', classes: ['Evoker'], casterSpecs: ['Augmentation'], type: 'self' },

  // ─── DEATH KNIGHT ─────────────────────────────────────────────────────────
  // Army of the Dead: 8min CD, any DK — dramatic undead army summon
  { id: 'armyOfTheDead', name: 'Army of the Dead', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_armyofthedead.jpg', classes: ['Death Knight'], casterRole: null, type: 'self' },
];

// Buff interval timer
let buffIntervalId = null;
let members = [];

/**
 * Start the buff manager - begins randomly applying buffs
 */
export function startBuffManager(db) {
  if (buffIntervalId) return; // Already running

  log.info('Starting global buff manager...');

  let lastMemberRefresh = 0;
  const MEMBER_REFRESH_INTERVAL = 5 * 60 * 1000; // Refresh members every 5 minutes

  // Apply a random buff every 30-90 seconds
  const applyNextBuff = async () => {
    // Only refresh members periodically, not every buff
    if (Date.now() - lastMemberRefresh > MEMBER_REFRESH_INTERVAL) {
      await refreshMembers(db);
      lastMemberRefresh = Date.now();
    }
    if (members.length > 0) {
      applyRandomBuff();
    }
    // Schedule next buff
    const nextDelay = 5000 + Math.random() * 25000; // 5-30 seconds
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
    log.info('Stopped global buff manager');
  }
}

/**
 * Refresh the member list from database
 */
async function refreshMembers(db) {
  try {
    members = await db.all(`
      SELECT u.id, u.username, u.character_name, u.character_class,
             u.spec, u.raid_role as raidRole
      FROM users u
      WHERE u.is_active = 1 AND u.character_name IS NOT NULL AND u.character_class IS NOT NULL
    `);
    log.info(`Buff manager: ${members.length} active members loaded`);
  } catch (err) {
    log.error('Error refreshing members for buff manager', err);
    members = [];
  }
}

/**
 * Apply a random buff to a random eligible member
 */
function applyRandomBuff() {
  if (members.length === 0) {
    log.info('Buff manager: No members available');
    return;
  }

  // Pick a random caster
  const caster = members[Math.floor(Math.random() * members.length)];
  if (!caster.character_class) {
    log.info(`Buff manager: Caster ${caster.character_name} has no class`);
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

  const MAX_BUFFS_PER_PLAYER = 3;

  const buffEntry = {
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
  };

  // Track which targets actually got a new buff (for cleanup scheduling)
  const newTargets = [];

  for (const targetId of targets) {
    const existing = activeBuffs.get(targetId) || [];

    // If this exact buff is already active, renew expiry instead of stacking
    const dupIdx = existing.findIndex(b => b.buff.id === buff.id);
    if (dupIdx !== -1) {
      const renewed = [...existing];
      renewed[dupIdx] = buffEntry;
      activeBuffs.set(targetId, renewed);
      newTargets.push(targetId);
      continue;
    }

    // Respect per-player cap — drop oldest if at limit
    const capped = existing.length >= MAX_BUFFS_PER_PLAYER
      ? existing.slice(existing.length - (MAX_BUFFS_PER_PLAYER - 1))
      : existing;

    activeBuffs.set(targetId, [...capped, buffEntry]);
    newTargets.push(targetId);
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

  log.info(`${caster.character_name} cast ${buff.name}${buff.raidWide ? ' (RAID-WIDE)' : ''} on ${targets.length} target(s)`);

  // Schedule buff expiration cleanup — remove only this specific buff entry
  setTimeout(() => {
    for (const targetId of newTargets) {
      const current = activeBuffs.get(targetId);
      if (!current) continue;
      const remaining = current.filter(b => !(b.buff.id === buff.id && b.expiresAt === expiresAt));
      if (remaining.length === 0) {
        activeBuffs.delete(targetId);
      } else {
        activeBuffs.set(targetId, remaining);
      }
    }
  }, buff.duration * 1000);
}

/**
 * Register a new SSE client
 */
export function registerClient(clientId, res) {
  clients.set(clientId, res);
  log.info(`SSE client connected: ${clientId} (total: ${clients.size})`);

  // Send current active buffs to the new client
  const currentBuffs = {};
  const now = Date.now();
  for (const [memberId, buffs] of activeBuffs.entries()) {
    const active = buffs.filter(b => b.expiresAt > now);
    if (active.length > 0) {
      currentBuffs[memberId] = active;
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
  log.info(`SSE client disconnected: ${clientId} (total: ${clients.size})`);
}

/**
 * Send event to a specific client
 */
function sendToClient(clientId, data) {
  const client = clients.get(clientId);
  if (client) {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      log.error(`SSE write error for client ${clientId}`, error);
      clients.delete(clientId);
    }
  }
}

/**
 * Broadcast event to all connected clients
 */
function broadcast(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const [clientId, client] of clients) {
    try {
      client.write(message);
    } catch (error) {
      log.error(`SSE broadcast error for client ${clientId}`, error);
      clients.delete(clientId);
    }
  }
}

/**
 * Get current active buffs (for API)
 */
export function getActiveBuffs() {
  const result = {};
  const now = Date.now();
  for (const [memberId, buffs] of activeBuffs.entries()) {
    const active = buffs.filter(b => b.expiresAt > now);
    if (active.length > 0) {
      result[memberId] = active;
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
