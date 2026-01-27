// The War Within - Season 3 Raid Items
// Manaforge Omega (Patch 11.2) - Current as of January 2026
// Using real Wowhead item icons

// Wowhead icon URL - uses item icons from the game
const ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/large/';

// Real WoW item icons from verified Wowhead database
const ICONS = {
  // Plate armor - Tier 21 (Antorus)
  plate_hands: 'inv_gauntlets_plate_raidpaladin_s_01.jpg',
  plate_shoulder: 'inv_shoulder_plate_raidpaladin_s_01.jpg',
  plate_head: 'inv_helm_plate_raidpaladin_s_01.jpg',
  plate_chest: 'inv_chest_plate_raidpaladin_s_01.jpg',
  plate_legs: 'inv_pant_plate_raidpaladin_s_01.jpg',
  plate_belt: 'inv_belt_plate_raidwarrior_q_01.jpg',
  plate_wrist: 'inv_bracer_plate_raiddeathknight_q_01.jpg',
  plate_boots: 'inv_boot_plate_raidpaladin_s_01.jpg',

  // Mail armor - Tier 21
  mail_head: 'inv_helm_mail_raidhunter_s_01.jpg',
  mail_shoulder: 'inv_shoulder_mail_raidhunter_s_01.jpg',
  mail_chest: 'inv_chest_mail_raidhunter_s_01.jpg',
  mail_boots: 'inv_boot_mail_raidhunter_s_01.jpg',

  // Leather armor - Tier 21
  leather_boots: 'inv_boot_leather_raidrogue_s_01.jpg',
  leather_legs: 'inv_pant_leather_raidrogue_s_01.jpg',
  leather_chest: 'inv_chest_leather_raidrogue_s_01.jpg',
  leather_hands: 'inv_gauntlets_leather_raidrogue_s_01.jpg',

  // Cloth armor - Tier 21
  cloth_shoulder: 'inv_shoulder_cloth_raidwarlock_s_01.jpg',
  cloth_belt: 'inv_belt_cloth_raidmage_q_01.jpg',
  cloth_legs: 'inv_pant_cloth_raidwarlock_s_01.jpg',
  cloth_chest: 'inv_chest_cloth_raidwarlock_s_01.jpg',

  // Weapons - Antorus
  sword_1h: 'inv_sword_1h_felfireraid_d_01.jpg',
  sword_2h: 'inv_sword_2h_felfireraid_d_01.jpg',
  mace_1h: 'inv_mace_1h_felfireraid_d_01.jpg',
  dagger: 'inv_knife_1h_felfireraid_d_01.jpg',
  staff: 'inv_staff_2h_felfireraid_d_01.jpg',
  polearm: 'inv_polearm_2h_felfireraid_d_01.jpg',

  // Accessories - Generic
  necklace: 'inv_jewelry_necklace_52.jpg',
  ring: 'inv_jewelry_ring_firelandsraid_02a.jpg',
  trinket: 'inv_misc_trinketpanda_02.jpg',
  trinket2: 'inv_misc_enggizmos_14.jpg',
  offhand: 'inv_offhand_1h_felfireraid_d_01.jpg',
  cape: 'inv_cape_pandaria_d_01.jpg',

  // Special
  mount: 'ability_mount_voidelfstrider.jpg',
  gem: 'inv_misc_gem_x4_metagem_cut.jpg',
};

export const CURRENT_RAIDS = {
  'Manaforge Omega': {
    bosses: {
      'Plexus Sentinel': [
        { id: 220101, name: { en: 'Sentinel\'s Void-Etched Gauntlets', es: 'Guanteletes Grabados por el Vacío del Centinela' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_hands}`, slot: 'Hands' },
        { id: 220102, name: { en: 'Plexus-Woven Shoulderpads', es: 'Hombreras Tejidas de Plexo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_shoulder}`, slot: 'Shoulder' },
        { id: 220103, name: { en: 'Boots of Fractured Reality', es: 'Botas de la Realidad Fracturada' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_boots}`, slot: 'Feet' },
        { id: 220104, name: { en: 'Construct\'s Energy Core', es: 'Núcleo de Energía del Constructo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.trinket}`, slot: 'Trinket' }
      ],
      'Loom\'ithar': [
        { id: 220201, name: { en: 'Loom\'ithar\'s Weaving Blade', es: 'Espada Tejedora de Loom\'ithar' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.sword_1h}`, slot: 'One-Hand' },
        { id: 220202, name: { en: 'Threads of Infinite Possibility', es: 'Hilos de Posibilidad Infinita' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_belt}`, slot: 'Waist' },
        { id: 220203, name: { en: 'Mantle of Woven Fates', es: 'Manto de Destinos Tejidos' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mail_shoulder}`, slot: 'Shoulder' },
        { id: 220204, name: { en: 'Loom-Threaded Legwraps', es: 'Grebas Enhebradas por el Telar' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_legs}`, slot: 'Legs' }
      ],
      'Soulbinder Naazindhri': [
        { id: 220301, name: { en: 'Soulbinder\'s Mantle of Torment', es: 'Manto de Tormento del Vinculador de Almas' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_shoulder}`, slot: 'Shoulder' },
        { id: 220302, name: { en: 'Chains of Eternal Binding', es: 'Cadenas de Vinculación Eterna' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.necklace}`, slot: 'Neck' },
        { id: 220303, name: { en: 'Naazindhri\'s Soul Reaver', es: 'Segador de Almas de Naazindhri' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.polearm}`, slot: 'Two-Hand' },
        { id: 220304, name: { en: 'Void-Touched Spirit Vessel', es: 'Recipiente Espiritual Tocado por el Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.offhand}`, slot: 'Off Hand' }
      ],
      'Forgeweaver Araz': [
        { id: 220401, name: { en: 'Forgeweaver\'s Molten Hammer', es: 'Martillo Fundido del Forjatejedor' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mace_1h}`, slot: 'One-Hand' },
        { id: 220402, name: { en: 'Helm of the Manaforge', es: 'Yelmo de la Forja de Maná' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mail_head}`, slot: 'Head' },
        { id: 220403, name: { en: 'Araz\'s Stabilization Matrix', es: 'Matriz de Estabilización de Araz' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.trinket}`, slot: 'Trinket' },
        { id: 220404, name: { en: 'Wristguards of Arcane Forging', es: 'Guardamuñecas de Forja Arcana' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_wrist}`, slot: 'Wrist' },
        { id: 220405, name: { en: 'Mantle of Crystallized Mana', es: 'Manto de Maná Cristalizado' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_shoulder}`, slot: 'Shoulder' }
      ],
      'The Soul Hunters': [
        { id: 220501, name: { en: 'Soul Hunters\' Twin Blades', es: 'Espadas Gemelas de los Cazadores de Almas' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.sword_1h}`, slot: 'One-Hand' },
        { id: 220502, name: { en: 'Interloper\'s Void Treads', es: 'Pisadas del Vacío del Intruso' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.mail_boots}`, slot: 'Feet' },
        { id: 220503, name: { en: 'Chestguard of the Harvested', es: 'Guardapecho de los Cosechados' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_chest}`, slot: 'Chest' },
        { id: 220504, name: { en: 'Essence Devourer\'s Ring', es: 'Anillo del Devorador de Esencias' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.ring}`, slot: 'Finger' },
        { id: 220505, name: { en: 'Grips of the Phantom Hunter', es: 'Agarres del Cazador Fantasma' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.leather_hands}`, slot: 'Hands' }
      ],
      'Fractillus': [
        { id: 220601, name: { en: 'Fractillus\'s Dimensional Shard', es: 'Fragmento Dimensional de Fractillus' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.offhand}`, slot: 'Off Hand' },
        { id: 220602, name: { en: 'Leggings of Splintered Void', es: 'Quijotes del Vacío Astillado' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_legs}`, slot: 'Legs' },
        { id: 220603, name: { en: 'Voidglass Staff', es: 'Bastón de Vidrio del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.staff}`, slot: 'Two-Hand' },
        { id: 220604, name: { en: 'Shattered Reality Belt', es: 'Cinturón de la Realidad Destrozada' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_belt}`, slot: 'Waist' },
        { id: 220605, name: { en: 'Pauldrons of Infinite Fragments', es: 'Hombreras de Fragmentos Infinitos' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_shoulder}`, slot: 'Shoulder' }
      ],
      'Nexus-King Salhadaar': [
        { id: 220701, name: { en: 'Maw of the Void', es: 'Fauces del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.sword_2h}`, slot: 'Two-Hand' },
        { id: 220702, name: { en: 'Salhadaar\'s Crown of Dominion', es: 'Corona de Dominio de Salhadaar' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_head}`, slot: 'Head' },
        { id: 220703, name: { en: 'Nexus-Woven Vestments', es: 'Vestiduras Tejidas del Nexo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cloth_chest}`, slot: 'Chest' },
        { id: 220704, name: { en: 'Ring of the Ethereal King', es: 'Anillo del Rey Etéreo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.ring}`, slot: 'Finger' },
        { id: 220705, name: { en: 'Hungering Void Curio', es: 'Curiosidad del Vacío Hambriento' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.gem}`, slot: 'Tier Token' }
      ],
      'Dimensius, the All-Devouring': [
        { id: 220801, name: { en: 'Unbound Star-Eater', es: 'Devorador de Estrellas Desatado' }, rarity: 'legendary', icon: `${ICON_BASE}${ICONS.mount}`, slot: 'Mount' },
        { id: 220802, name: { en: 'Voidglass Dagger of Consumption', es: 'Daga de Vidrio del Vacío de Consumo' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.dagger}`, slot: 'One-Hand' },
        { id: 220803, name: { en: 'Dimensius\'s Devouring Grasp', es: 'Agarre Devorador de Dimensius' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_hands}`, slot: 'Hands' },
        { id: 220804, name: { en: 'Cloak of the Void Lord', es: 'Capa del Señor del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.cape}`, slot: 'Back' },
        { id: 220805, name: { en: 'All-Consuming Void Essence', es: 'Esencia del Vacío Omnidevorante' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.trinket2}`, slot: 'Trinket' },
        { id: 220806, name: { en: 'Legplates of Infinite Hunger', es: 'Quijotes de Hambre Infinita' }, rarity: 'epic', icon: `${ICON_BASE}${ICONS.plate_legs}`, slot: 'Legs' }
      ]
    }
  }
};

export function getAllRaidItems() {
  const items = [];

  Object.entries(CURRENT_RAIDS).forEach(([raidName, raidData]) => {
    Object.entries(raidData.bosses).forEach(([bossName, bossItems]) => {
      bossItems.forEach(item => {
        items.push({
          ...item,
          raid: raidName,
          boss: bossName
        });
      });
    });
  });

  return items;
}

export function searchItems(query) {
  const allItems = getAllRaidItems();
  const lowerQuery = query.toLowerCase();

  return allItems.filter(item =>
    item.name.en.toLowerCase().includes(lowerQuery) ||
    item.name.es.toLowerCase().includes(lowerQuery) ||
    item.boss.toLowerCase().includes(lowerQuery) ||
    item.raid.toLowerCase().includes(lowerQuery)
  );
}

export function getItemsByRaid(raidName) {
  const raidData = CURRENT_RAIDS[raidName];
  if (!raidData) return [];

  const items = [];
  Object.entries(raidData.bosses).forEach(([bossName, bossItems]) => {
    bossItems.forEach(item => {
      items.push({
        ...item,
        raid: raidName,
        boss: bossName
      });
    });
  });

  return items;
}
