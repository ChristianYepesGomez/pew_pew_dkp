// Raid Items Service
// Uses Blizzard API for real data with static fallback
// When API is unavailable or credentials not configured, falls back to static data

import blizzardAPI from './blizzardAPI.js';

// Static fallback data - Last updated: January 2026
// This is used when Blizzard API is unavailable
const ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/large/';

const ICONS = {
  plate_hands: 'inv_gauntlets_plate_raidpaladin_s_01.jpg',
  plate_shoulder: 'inv_shoulder_plate_raidpaladin_s_01.jpg',
  plate_head: 'inv_helm_plate_raidpaladin_s_01.jpg',
  plate_chest: 'inv_chest_plate_raidpaladin_s_01.jpg',
  plate_legs: 'inv_pant_plate_raidpaladin_s_01.jpg',
  plate_belt: 'inv_belt_plate_raidwarrior_q_01.jpg',
  plate_wrist: 'inv_bracer_plate_raiddeathknight_q_01.jpg',
  plate_boots: 'inv_boot_plate_raidpaladin_s_01.jpg',
  mail_head: 'inv_helm_mail_raidhunter_s_01.jpg',
  mail_shoulder: 'inv_shoulder_mail_raidhunter_s_01.jpg',
  mail_chest: 'inv_chest_mail_raidhunter_s_01.jpg',
  mail_boots: 'inv_boot_mail_raidhunter_s_01.jpg',
  leather_boots: 'inv_boot_leather_raidrogue_s_01.jpg',
  leather_legs: 'inv_pant_leather_raidrogue_s_01.jpg',
  leather_chest: 'inv_chest_leather_raidrogue_s_01.jpg',
  leather_hands: 'inv_gauntlets_leather_raidrogue_s_01.jpg',
  cloth_shoulder: 'inv_shoulder_cloth_raidwarlock_s_01.jpg',
  cloth_belt: 'inv_belt_cloth_raidmage_q_01.jpg',
  cloth_legs: 'inv_pant_cloth_raidwarlock_s_01.jpg',
  cloth_chest: 'inv_chest_cloth_raidwarlock_s_01.jpg',
  sword_1h: 'inv_sword_1h_felfireraid_d_01.jpg',
  sword_2h: 'inv_sword_2h_felfireraid_d_01.jpg',
  mace_1h: 'inv_mace_1h_felfireraid_d_01.jpg',
  dagger: 'inv_knife_1h_felfireraid_d_01.jpg',
  staff: 'inv_staff_2h_felfireraid_d_01.jpg',
  polearm: 'inv_polearm_2h_felfireraid_d_01.jpg',
  necklace: 'inv_jewelry_necklace_52.jpg',
  ring: 'inv_jewelry_ring_firelandsraid_02a.jpg',
  trinket: 'inv_misc_trinketpanda_02.jpg',
  trinket2: 'inv_misc_enggizmos_14.jpg',
  offhand: 'inv_offhand_1h_felfireraid_d_01.jpg',
  cape: 'inv_cape_pandaria_d_01.jpg',
  mount: 'ability_mount_voidelfstrider.jpg',
  gem: 'inv_misc_gem_x4_metagem_cut.jpg',
};

// Static fallback data for when API is unavailable
const STATIC_FALLBACK_ITEMS = [
  // Plexus Sentinel
  { id: 220101, name: { en: 'Sentinel\'s Void-Etched Gauntlets', es: 'Guanteletes Grabados por el Vacío del Centinela' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_hands}`, slot: 'Hands', raid: 'Manaforge Omega', boss: 'Plexus Sentinel' },
  { id: 220102, name: { en: 'Plexus-Woven Shoulderpads', es: 'Hombreras Tejidas de Plexo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_shoulder}`, slot: 'Shoulder', raid: 'Manaforge Omega', boss: 'Plexus Sentinel' },
  { id: 220103, name: { en: 'Boots of Fractured Reality', es: 'Botas de la Realidad Fracturada' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_boots}`, slot: 'Feet', raid: 'Manaforge Omega', boss: 'Plexus Sentinel' },
  { id: 220104, name: { en: 'Construct\'s Energy Core', es: 'Núcleo de Energía del Constructo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.trinket}`, slot: 'Trinket', raid: 'Manaforge Omega', boss: 'Plexus Sentinel' },
  // Loom'ithar
  { id: 220201, name: { en: 'Loom\'ithar\'s Weaving Blade', es: 'Espada Tejedora de Loom\'ithar' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.sword_1h}`, slot: 'One-Hand', raid: 'Manaforge Omega', boss: 'Loom\'ithar' },
  { id: 220202, name: { en: 'Threads of Infinite Possibility', es: 'Hilos de Posibilidad Infinita' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_belt}`, slot: 'Waist', raid: 'Manaforge Omega', boss: 'Loom\'ithar' },
  { id: 220203, name: { en: 'Mantle of Woven Fates', es: 'Manto de Destinos Tejidos' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mail_shoulder}`, slot: 'Shoulder', raid: 'Manaforge Omega', boss: 'Loom\'ithar' },
  { id: 220204, name: { en: 'Loom-Threaded Legwraps', es: 'Grebas Enhebradas por el Telar' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_legs}`, slot: 'Legs', raid: 'Manaforge Omega', boss: 'Loom\'ithar' },
  // Soulbinder Naazindhri
  { id: 220301, name: { en: 'Soulbinder\'s Mantle of Torment', es: 'Manto de Tormento del Vinculador de Almas' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_shoulder}`, slot: 'Shoulder', raid: 'Manaforge Omega', boss: 'Soulbinder Naazindhri' },
  { id: 220302, name: { en: 'Chains of Eternal Binding', es: 'Cadenas de Vinculación Eterna' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.necklace}`, slot: 'Neck', raid: 'Manaforge Omega', boss: 'Soulbinder Naazindhri' },
  { id: 220303, name: { en: 'Naazindhri\'s Soul Reaver', es: 'Segador de Almas de Naazindhri' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.polearm}`, slot: 'Two-Hand', raid: 'Manaforge Omega', boss: 'Soulbinder Naazindhri' },
  { id: 220304, name: { en: 'Void-Touched Spirit Vessel', es: 'Recipiente Espiritual Tocado por el Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.offhand}`, slot: 'Off Hand', raid: 'Manaforge Omega', boss: 'Soulbinder Naazindhri' },
  // Forgeweaver Araz
  { id: 220401, name: { en: 'Forgeweaver\'s Molten Hammer', es: 'Martillo Fundido del Forjatejedor' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mace_1h}`, slot: 'One-Hand', raid: 'Manaforge Omega', boss: 'Forgeweaver Araz' },
  { id: 220402, name: { en: 'Helm of the Manaforge', es: 'Yelmo de la Forja de Maná' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mail_head}`, slot: 'Head', raid: 'Manaforge Omega', boss: 'Forgeweaver Araz' },
  { id: 220403, name: { en: 'Araz\'s Stabilization Matrix', es: 'Matriz de Estabilización de Araz' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.trinket}`, slot: 'Trinket', raid: 'Manaforge Omega', boss: 'Forgeweaver Araz' },
  { id: 220404, name: { en: 'Wristguards of Arcane Forging', es: 'Guardamuñecas de Forja Arcana' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_wrist}`, slot: 'Wrist', raid: 'Manaforge Omega', boss: 'Forgeweaver Araz' },
  { id: 220405, name: { en: 'Mantle of Crystallized Mana', es: 'Manto de Maná Cristalizado' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_shoulder}`, slot: 'Shoulder', raid: 'Manaforge Omega', boss: 'Forgeweaver Araz' },
  // The Soul Hunters
  { id: 220501, name: { en: 'Soul Hunters\' Twin Blades', es: 'Espadas Gemelas de los Cazadores de Almas' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.sword_1h}`, slot: 'One-Hand', raid: 'Manaforge Omega', boss: 'The Soul Hunters' },
  { id: 220502, name: { en: 'Interloper\'s Void Treads', es: 'Pisadas del Vacío del Intruso' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mail_boots}`, slot: 'Feet', raid: 'Manaforge Omega', boss: 'The Soul Hunters' },
  { id: 220503, name: { en: 'Chestguard of the Harvested', es: 'Guardapecho de los Cosechados' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_chest}`, slot: 'Chest', raid: 'Manaforge Omega', boss: 'The Soul Hunters' },
  { id: 220504, name: { en: 'Essence Devourer\'s Ring', es: 'Anillo del Devorador de Esencias' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.ring}`, slot: 'Finger', raid: 'Manaforge Omega', boss: 'The Soul Hunters' },
  { id: 220505, name: { en: 'Grips of the Phantom Hunter', es: 'Agarres del Cazador Fantasma' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_hands}`, slot: 'Hands', raid: 'Manaforge Omega', boss: 'The Soul Hunters' },
  // Fractillus
  { id: 220601, name: { en: 'Fractillus\'s Dimensional Shard', es: 'Fragmento Dimensional de Fractillus' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.offhand}`, slot: 'Off Hand', raid: 'Manaforge Omega', boss: 'Fractillus' },
  { id: 220602, name: { en: 'Leggings of Splintered Void', es: 'Quijotes del Vacío Astillado' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_legs}`, slot: 'Legs', raid: 'Manaforge Omega', boss: 'Fractillus' },
  { id: 220603, name: { en: 'Voidglass Staff', es: 'Bastón de Vidrio del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.staff}`, slot: 'Two-Hand', raid: 'Manaforge Omega', boss: 'Fractillus' },
  { id: 220604, name: { en: 'Shattered Reality Belt', es: 'Cinturón de la Realidad Destrozada' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_belt}`, slot: 'Waist', raid: 'Manaforge Omega', boss: 'Fractillus' },
  { id: 220605, name: { en: 'Pauldrons of Infinite Fragments', es: 'Hombreras de Fragmentos Infinitos' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_shoulder}`, slot: 'Shoulder', raid: 'Manaforge Omega', boss: 'Fractillus' },
  // Nexus-King Salhadaar
  { id: 220701, name: { en: 'Maw of the Void', es: 'Fauces del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.sword_2h}`, slot: 'Two-Hand', raid: 'Manaforge Omega', boss: 'Nexus-King Salhadaar' },
  { id: 220702, name: { en: 'Salhadaar\'s Crown of Dominion', es: 'Corona de Dominio de Salhadaar' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_head}`, slot: 'Head', raid: 'Manaforge Omega', boss: 'Nexus-King Salhadaar' },
  { id: 220703, name: { en: 'Nexus-Woven Vestments', es: 'Vestiduras Tejidas del Nexo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_chest}`, slot: 'Chest', raid: 'Manaforge Omega', boss: 'Nexus-King Salhadaar' },
  { id: 220704, name: { en: 'Ring of the Ethereal King', es: 'Anillo del Rey Etéreo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.ring}`, slot: 'Finger', raid: 'Manaforge Omega', boss: 'Nexus-King Salhadaar' },
  { id: 220705, name: { en: 'Hungering Void Curio', es: 'Curiosidad del Vacío Hambriento' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.gem}`, slot: 'Tier Token', raid: 'Manaforge Omega', boss: 'Nexus-King Salhadaar' },
  // Dimensius, the All-Devouring
  { id: 220801, name: { en: 'Unbound Star-Eater', es: 'Devorador de Estrellas Desatado' }, rarity: 'legendary', icon: `${ICON_BASE}${ICONS.mount}`, slot: 'Mount', raid: 'Manaforge Omega', boss: 'Dimensius, the All-Devouring' },
  { id: 220802, name: { en: 'Voidglass Dagger of Consumption', es: 'Daga de Vidrio del Vacío de Consumo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.dagger}`, slot: 'One-Hand', raid: 'Manaforge Omega', boss: 'Dimensius, the All-Devouring' },
  { id: 220803, name: { en: 'Dimensius\'s Devouring Grasp', es: 'Agarre Devorador de Dimensius' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_hands}`, slot: 'Hands', raid: 'Manaforge Omega', boss: 'Dimensius, the All-Devouring' },
  { id: 220804, name: { en: 'Cloak of the Void Lord', es: 'Capa del Señor del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cape}`, slot: 'Back', raid: 'Manaforge Omega', boss: 'Dimensius, the All-Devouring' },
  { id: 220805, name: { en: 'All-Consuming Void Essence', es: 'Esencia del Vacío Omnidevorante' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.trinket2}`, slot: 'Trinket', raid: 'Manaforge Omega', boss: 'Dimensius, the All-Devouring' },
  { id: 220806, name: { en: 'Legplates of Infinite Hunger', es: 'Quijotes de Hambre Infinita' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_legs}`, slot: 'Legs', raid: 'Manaforge Omega', boss: 'Dimensius, the All-Devouring' },
];

// In-memory cache for API items
let cachedApiItems = null;
let lastApiCheck = 0;
const API_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Get all raid items - tries API first, falls back to static data
export async function getAllRaidItems() {
  // Try API if enough time has passed since last check
  if (Date.now() - lastApiCheck > API_CHECK_INTERVAL) {
    lastApiCheck = Date.now();

    try {
      const apiItems = await blizzardAPI.getCurrentRaidItems();
      if (apiItems && apiItems.length > 0) {
        cachedApiItems = apiItems;
        console.log(`Loaded ${apiItems.length} items from Blizzard API`);
        return apiItems;
      }
    } catch (error) {
      console.warn('Failed to fetch from Blizzard API, using fallback:', error.message);
    }
  }

  // Return cached API items if available
  if (cachedApiItems && cachedApiItems.length > 0) {
    return cachedApiItems;
  }

  // Fall back to static data
  console.log('Using static fallback data for raid items');
  return STATIC_FALLBACK_ITEMS;
}

// Synchronous version for backwards compatibility
export function getAllRaidItemsSync() {
  if (cachedApiItems && cachedApiItems.length > 0) {
    return cachedApiItems;
  }
  return STATIC_FALLBACK_ITEMS;
}

// Search items
export async function searchItems(query) {
  const allItems = await getAllRaidItems();
  const lowerQuery = query.toLowerCase();

  return allItems.filter(item =>
    item.name.en?.toLowerCase().includes(lowerQuery) ||
    item.name.es?.toLowerCase().includes(lowerQuery) ||
    item.boss?.toLowerCase().includes(lowerQuery) ||
    item.raid?.toLowerCase().includes(lowerQuery)
  );
}

// Get items by raid
export async function getItemsByRaid(raidName) {
  const allItems = await getAllRaidItems();
  return allItems.filter(item => item.raid === raidName);
}

// Get items by boss
export async function getItemsByBoss(bossName) {
  const allItems = await getAllRaidItems();
  return allItems.filter(item => item.boss === bossName);
}

// Force refresh from API
export async function refreshFromAPI() {
  try {
    const apiItems = await blizzardAPI.refreshCache();
    if (apiItems && apiItems.length > 0) {
      cachedApiItems = apiItems;
      lastApiCheck = Date.now();
      return { success: true, count: apiItems.length };
    }
    return { success: false, error: 'No items returned from API' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get available raids from API
export async function getAvailableRaids() {
  try {
    return await blizzardAPI.getAvailableRaids();
  } catch (error) {
    console.warn('Failed to get available raids:', error.message);
    // Return current raids from static data
    return [{ id: 1296, name: 'Manaforge Omega', expansion: 'The War Within' }];
  }
}

// Update raid configuration
export function setCurrentRaids(raids) {
  blizzardAPI.setCurrentRaids(raids);
}

// Check if API is configured
export function isAPIConfigured() {
  return !!(process.env.BLIZZARD_CLIENT_ID && process.env.BLIZZARD_CLIENT_SECRET);
}

// Get data source status
export function getDataSourceStatus() {
  return {
    apiConfigured: isAPIConfigured(),
    usingApiData: cachedApiItems !== null && cachedApiItems.length > 0,
    itemCount: (cachedApiItems || STATIC_FALLBACK_ITEMS).length,
    lastApiCheck: lastApiCheck ? new Date(lastApiCheck).toISOString() : null,
  };
}

export default {
  getAllRaidItems,
  getAllRaidItemsSync,
  searchItems,
  getItemsByRaid,
  getItemsByBoss,
  refreshFromAPI,
  getAvailableRaids,
  setCurrentRaids,
  isAPIConfigured,
  getDataSourceStatus,
};
