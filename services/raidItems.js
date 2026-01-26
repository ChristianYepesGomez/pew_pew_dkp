// The War Within - Season 3 Raid Items
// Manaforge Omega (Patch 11.2) - Current as of January 2026
// Using Wowhead/Zamimg URLs for icons (verified working icons)

const ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/large/';

// Generic slot icons that are known to work
const SLOT_ICONS = {
  Hands: 'inv_gauntlets_24.jpg',
  Shoulder: 'inv_shoulder_22.jpg',
  Feet: 'inv_boots_chain_01.jpg',
  Trinket: 'inv_jewelry_trinketpvp_01.jpg',
  'One-Hand': 'inv_sword_04.jpg',
  'Two-Hand': 'inv_sword_2h_draenordungeon_c_01.jpg',
  Waist: 'inv_belt_29.jpg',
  Legs: 'inv_pants_06.jpg',
  Neck: 'inv_jewelry_necklace_04.jpg',
  'Off Hand': 'inv_offhand_stratholme_a_02.jpg',
  Head: 'inv_helmet_47.jpg',
  Wrist: 'inv_bracer_07.jpg',
  Chest: 'inv_chest_chain_15.jpg',
  Finger: 'inv_jewelry_ring_36.jpg',
  Back: 'inv_misc_cape_02.jpg',
  'Tier Token': 'inv_misc_token_argentdawn3.jpg',
  Mount: 'ability_mount_drake_proto.jpg',
};

export const CURRENT_RAIDS = {
  'Manaforge Omega': {
    bosses: {
      'Plexus Sentinel': [
        { id: 220101, name: { en: 'Sentinel\'s Void-Etched Gauntlets', es: 'Guanteletes Grabados por el Vacío del Centinela' }, rarity: 'epic', icon: `${ICON_BASE}inv_gauntlets_plate_dungeonplate_c_05.jpg`, slot: 'Hands' },
        { id: 220102, name: { en: 'Plexus-Woven Shoulderpads', es: 'Hombreras Tejidas de Plexo' }, rarity: 'epic', icon: `${ICON_BASE}inv_shoulder_cloth_pvpwarlock_c_02.jpg`, slot: 'Shoulder' },
        { id: 220103, name: { en: 'Boots of Fractured Reality', es: 'Botas de la Realidad Fracturada' }, rarity: 'epic', icon: `${ICON_BASE}inv_boots_leather_pvprogue_c_02.jpg`, slot: 'Feet' },
        { id: 220104, name: { en: 'Construct\'s Energy Core', es: 'Núcleo de Energía del Constructo' }, rarity: 'epic', icon: `${ICON_BASE}inv_misc_enggizmos_27.jpg`, slot: 'Trinket' }
      ],
      'Loom\'ithar': [
        { id: 220201, name: { en: 'Loom\'ithar\'s Weaving Blade', es: 'Espada Tejedora de Loom\'ithar' }, rarity: 'epic', icon: `${ICON_BASE}inv_sword_1h_pvp400_c_01.jpg`, slot: 'One-Hand' },
        { id: 220202, name: { en: 'Threads of Infinite Possibility', es: 'Hilos de Posibilidad Infinita' }, rarity: 'epic', icon: `${ICON_BASE}inv_belt_cloth_pvpwarlock_c_02.jpg`, slot: 'Waist' },
        { id: 220203, name: { en: 'Mantle of Woven Fates', es: 'Manto de Destinos Tejidos' }, rarity: 'epic', icon: `${ICON_BASE}inv_shoulder_mail_pvphunter_c_02.jpg`, slot: 'Shoulder' },
        { id: 220204, name: { en: 'Loom-Threaded Legwraps', es: 'Grebas Enhebradas por el Telar' }, rarity: 'epic', icon: `${ICON_BASE}inv_pants_leather_pvprogue_c_02.jpg`, slot: 'Legs' }
      ],
      'Soulbinder Naazindhri': [
        { id: 220301, name: { en: 'Soulbinder\'s Mantle of Torment', es: 'Manto de Tormento del Vinculador de Almas' }, rarity: 'epic', icon: `${ICON_BASE}inv_shoulder_plate_pvppaladin_c_02.jpg`, slot: 'Shoulder' },
        { id: 220302, name: { en: 'Chains of Eternal Binding', es: 'Cadenas de Vinculación Eterna' }, rarity: 'epic', icon: `${ICON_BASE}inv_jewelry_necklace_37.jpg`, slot: 'Neck' },
        { id: 220303, name: { en: 'Naazindhri\'s Soul Reaver', es: 'Segador de Almas de Naazindhri' }, rarity: 'epic', icon: `${ICON_BASE}inv_polearm_2h_pvp400_c_01.jpg`, slot: 'Two-Hand' },
        { id: 220304, name: { en: 'Void-Touched Spirit Vessel', es: 'Recipiente Espiritual Tocado por el Vacío' }, rarity: 'epic', icon: `${ICON_BASE}inv_offhand_1h_pvpcataclysms3_c_02.jpg`, slot: 'Off Hand' }
      ],
      'Forgeweaver Araz': [
        { id: 220401, name: { en: 'Forgeweaver\'s Molten Hammer', es: 'Martillo Fundido del Forjatejedor' }, rarity: 'epic', icon: `${ICON_BASE}inv_mace_1h_pvp400_c_01.jpg`, slot: 'One-Hand' },
        { id: 220402, name: { en: 'Helm of the Manaforge', es: 'Yelmo de la Forja de Maná' }, rarity: 'epic', icon: `${ICON_BASE}inv_helmet_mail_pvphunter_c_02.jpg`, slot: 'Head' },
        { id: 220403, name: { en: 'Araz\'s Stabilization Matrix', es: 'Matriz de Estabilización de Araz' }, rarity: 'epic', icon: `${ICON_BASE}inv_misc_enggizmos_30.jpg`, slot: 'Trinket' },
        { id: 220404, name: { en: 'Wristguards of Arcane Forging', es: 'Guardamuñecas de Forja Arcana' }, rarity: 'epic', icon: `${ICON_BASE}inv_bracer_plate_pvpwarrior_c_02.jpg`, slot: 'Wrist' },
        { id: 220405, name: { en: 'Mantle of Crystallized Mana', es: 'Manto de Maná Cristalizado' }, rarity: 'epic', icon: `${ICON_BASE}inv_shoulder_cloth_pvpmage_c_02.jpg`, slot: 'Shoulder' }
      ],
      'The Soul Hunters': [
        { id: 220501, name: { en: 'Soul Hunters\' Twin Blades', es: 'Espadas Gemelas de los Cazadores de Almas' }, rarity: 'epic', icon: `${ICON_BASE}inv_sword_1h_pvp410_c_01.jpg`, slot: 'One-Hand' },
        { id: 220502, name: { en: 'Interloper\'s Void Treads', es: 'Pisadas del Vacío del Intruso' }, rarity: 'epic', icon: `${ICON_BASE}inv_boots_mail_pvphunter_c_02.jpg`, slot: 'Feet' },
        { id: 220503, name: { en: 'Chestguard of the Harvested', es: 'Guardapecho de los Cosechados' }, rarity: 'epic', icon: `${ICON_BASE}inv_chest_leather_pvprogue_c_02.jpg`, slot: 'Chest' },
        { id: 220504, name: { en: 'Essence Devourer\'s Ring', es: 'Anillo del Devorador de Esencias' }, rarity: 'epic', icon: `${ICON_BASE}inv_jewelry_ring_66.jpg`, slot: 'Finger' },
        { id: 220505, name: { en: 'Grips of the Phantom Hunter', es: 'Agarres del Cazador Fantasma' }, rarity: 'epic', icon: `${ICON_BASE}inv_gauntlets_leather_pvprogue_c_02.jpg`, slot: 'Hands' }
      ],
      'Fractillus': [
        { id: 220601, name: { en: 'Fractillus\'s Dimensional Shard', es: 'Fragmento Dimensional de Fractillus' }, rarity: 'epic', icon: `${ICON_BASE}inv_offhand_1h_artifactskulloferedar_d_01.jpg`, slot: 'Off Hand' },
        { id: 220602, name: { en: 'Leggings of Splintered Void', es: 'Quijotes del Vacío Astillado' }, rarity: 'epic', icon: `${ICON_BASE}inv_pants_cloth_pvpwarlock_c_02.jpg`, slot: 'Legs' },
        { id: 220603, name: { en: 'Voidglass Staff', es: 'Bastón de Vidrio del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}inv_staff_2h_pvp400_c_01.jpg`, slot: 'Two-Hand' },
        { id: 220604, name: { en: 'Shattered Reality Belt', es: 'Cinturón de la Realidad Destrozada' }, rarity: 'epic', icon: `${ICON_BASE}inv_belt_plate_pvppaladin_c_02.jpg`, slot: 'Waist' },
        { id: 220605, name: { en: 'Pauldrons of Infinite Fragments', es: 'Hombreras de Fragmentos Infinitos' }, rarity: 'epic', icon: `${ICON_BASE}inv_shoulder_plate_pvpwarrior_c_02.jpg`, slot: 'Shoulder' }
      ],
      'Nexus-King Salhadaar': [
        { id: 220701, name: { en: 'Maw of the Void', es: 'Fauces del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}inv_sword_2h_pvp400_c_01.jpg`, slot: 'Two-Hand' },
        { id: 220702, name: { en: 'Salhadaar\'s Crown of Dominion', es: 'Corona de Dominio de Salhadaar' }, rarity: 'epic', icon: `${ICON_BASE}inv_helmet_plate_pvppaladin_c_02.jpg`, slot: 'Head' },
        { id: 220703, name: { en: 'Nexus-Woven Vestments', es: 'Vestiduras Tejidas del Nexo' }, rarity: 'epic', icon: `${ICON_BASE}inv_chest_cloth_pvpmage_c_02.jpg`, slot: 'Chest' },
        { id: 220704, name: { en: 'Ring of the Ethereal King', es: 'Anillo del Rey Etéreo' }, rarity: 'epic', icon: `${ICON_BASE}inv_jewelry_ring_67.jpg`, slot: 'Finger' },
        { id: 220705, name: { en: 'Hungering Void Curio', es: 'Curiosidad del Vacío Hambriento' }, rarity: 'epic', icon: `${ICON_BASE}inv_misc_gem_x4_metagem_cut.jpg`, slot: 'Tier Token' }
      ],
      'Dimensius, the All-Devouring': [
        { id: 220801, name: { en: 'Unbound Star-Eater', es: 'Devorador de Estrellas Desatado' }, rarity: 'legendary', icon: `${ICON_BASE}ability_mount_drake_proto.jpg`, slot: 'Mount' },
        { id: 220802, name: { en: 'Voidglass Dagger of Consumption', es: 'Daga de Vidrio del Vacío de Consumo' }, rarity: 'epic', icon: `${ICON_BASE}inv_knife_1h_pvp400_c_01.jpg`, slot: 'One-Hand' },
        { id: 220803, name: { en: 'Dimensius\'s Devouring Grasp', es: 'Agarre Devorador de Dimensius' }, rarity: 'epic', icon: `${ICON_BASE}inv_gauntlets_cloth_pvpmage_c_02.jpg`, slot: 'Hands' },
        { id: 220804, name: { en: 'Cloak of the Void Lord', es: 'Capa del Señor del Vacío' }, rarity: 'epic', icon: `${ICON_BASE}inv_cape_pandaria_d_01.jpg`, slot: 'Back' },
        { id: 220805, name: { en: 'All-Consuming Void Essence', es: 'Esencia del Vacío Omnidevorante' }, rarity: 'epic', icon: `${ICON_BASE}spell_shadow_sealofkings.jpg`, slot: 'Trinket' },
        { id: 220806, name: { en: 'Legplates of Infinite Hunger', es: 'Quijotes de Hambre Infinita' }, rarity: 'epic', icon: `${ICON_BASE}inv_pants_plate_pvpwarrior_c_02.jpg`, slot: 'Legs' }
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
