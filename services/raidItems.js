// Raid Items Service
// Items stored in DB for instant loading. Refreshed from Blizzard API weekly.

import blizzardAPI from './blizzardAPI.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:RaidItems');


// Seed data — Midnight Season 1, March 2026
// Inserted into raid_items table on first run, then served from DB forever.
const SEED_ITEMS = [
  {id:249283,name_en:"Belo'melorn, the Shattered Talon",name_es:"Belo'melorn, la Garfa Destrozada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_raidmidnight_d_02.jpg",slot:"One-Hand",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249284,name_en:"Belo'ren's Swift Talon",name_es:"Garfa presta de Belo'ren",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249377,name_en:"Darkstrider Treads",name_es:"Botines de Zancadaoscura",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidhuntermidnight_d_01.jpg",slot:"Feet",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249328,name_en:"Echoing Void Mantle",name_es:"Manto del Vacío resonante",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_cloth_raidmagemidnight_d_01.jpg",slot:"Shoulder",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249307,name_en:"Emberborn Grasps",name_es:"Garras ascuanatas",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_plate_raidpaladinmidnight_d_01.jpg",slot:"Hands",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249324,name_en:"Eternal Flame Scaleguards",name_es:"Guardaescamas de llama eterna",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_mail_raidhuntermidnight_d_01.jpg",slot:"Legs",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249322,name_en:"Radiant Clutchtender's Jerkin",name_es:"Chaleco de cuidadoras radiante",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_leather_raidmonkmidnight_d_01.jpg",slot:"Chest",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249806,name_en:"Radiant Plume",name_es:"Pluma radiante",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_dualityphoenix_holy_feather.jpg",slot:"Trinket",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249919,name_en:"Sin'dorei Band of Hope",name_es:"Sortija de esperanza sin'dorei",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_jewelry_silvermoonelf_ring_red1.jpg",slot:"Finger",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249921,name_en:"Thalassian Dawnguard",name_es:"Guardialba thalassiana",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shield_1h_raidmidnight_d_01.jpg",slot:"Shield",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249807,name_en:"The Eternal Egg",name_es:"El huevo eterno",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_darkwell_tank2_phoenixegg.jpg",slot:"Trinket",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:260235,name_en:"Umbral Plume",name_es:"Pluma umbría",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_dualityphoenix_void_feather.jpg",slot:"Trinket",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249376,name_en:"Whisper-Inscribed Sash",name_es:"Fajín inscrito con susurros",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_cloth_raidmagemidnight_d_01.jpg",slot:"Waist",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"Belo'ren, Hijo de Al'ar",boss_name_en:"Belo'ren, Child of Al'ar",item_level:197},
  {id:249296,name_en:"Alah'endal, the Dawnsong",name_es:"Alah'endal, el Son del Alba",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_axe_2h_raidmidnight_d_01.jpg",slot:"Two-Hand",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:250247,name_en:"Amulet of the Abyssal Hymn",name_es:"Amuleto del himno abisal",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_jewelry_devouringhost_necklace_bronze2.jpg",slot:"Neck",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249286,name_en:"Brazier of the Dissonant Dirge",name_es:"Blandón del réquiem disonante",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_staff_2h_raidmidnight_d_02.jpg",slot:"Two-Hand",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249915,name_en:"Extinction Guards",name_es:"Guardias de extinción",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raiddeathknightmidnight_d_01_pant.jpg",slot:"Legs",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249920,name_en:"Eye of Midnight",name_es:"Ojo de medianoche",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_jewelry_devouringhost_ring_bronze.jpg",slot:"Finger",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249811,name_en:"Light of the Cosmic Crescendo",name_es:"Luz del crescendo cósmico",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_darkwelle_healer3_cosmiccrescendo.jpg",slot:"Trinket",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:260408,name_en:"Lightless Lament",name_es:"Lamento lóbrego",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glaive_1h_darknaaru_d_01.jpg",slot:"One-Hand",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249913,name_en:"Mask of Darkest Intent",name_es:"Máscara de la intención más oscura",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_leather_raidroguemidnight_d_01.jpg",slot:"Head",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249914,name_en:"Oblivion Guise",name_es:"Disfraz de olvido",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_mail_raidshamanmidnight_d_01.jpg",slot:"Head",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249912,name_en:"Robes of Endless Oblivion",name_es:"Togas de olvido sin fin",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_cloth_raidwarlockmidnight_d_01.jpg",slot:"Chest",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249810,name_en:"Shadow of the Empyrean Requiem",name_es:"Sombra del réquiem empíreo",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_darkwell_intdps2.jpg",slot:"Trinket",raid_name:"Marcha a Quel'Danas",raid_name_en:"March on Quel'Danas",boss_name:"L'ura",boss_name_en:"Midnight Falls",item_level:197},
  {id:249278,name_en:"Alnscorned Spire",name_es:"Aguja de los despreciados por Aln",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_staff_2h_raidmidnight_d_01.jpg",slot:"Two-Hand",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:249373,name_en:"Dream-Scorched Striders",name_es:"Zancos agostados por el Sueño",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidmagemidnight_d_01.jpg",slot:"Feet",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:249343,name_en:"Gaze of the Alnseer",name_es:"Mirada del Alnvidente",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_dreamrift_gazeofthealnseer.jpg",slot:"Trinket",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:249381,name_en:"Greaves of the Unformed",name_es:"Grebas de los sin forma",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_plate_raidwarriormidnight_d_01.jpg",slot:"Feet",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:249374,name_en:"Scorn-Scarred Shul'ka's Belt",name_es:"Cinturón de shul'ka marcado por el desprecio",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_leather_raidmonkmidnight_d_01.jpg",slot:"Waist",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:249371,name_en:"Scornbane Waistguard",name_es:"Guardarrenes de perdición del desprecio",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_mail_raidhuntermidnight_d_01.jpg",slot:"Waist",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:249922,name_en:"Tome of Alnscorned Regret",name_es:"Tomo de remordimiento de los despreciados por Aln",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_offhand_1h_raidmidnight_d_01.jpg",slot:"Off Hand",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:249805,name_en:"Undreamt God's Oozing Vestige",name_es:"Vestigio rezumante del Dios Inconcebible",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_dreamrift_physdps2_umdreamtgodsoozingvestige.jpg",slot:"Trinket",raid_name:"La Falla Onírica",raid_name_en:"The Dreamrift",boss_name:"Chimaerus, El Dios Inconcebible",boss_name_en:"Chimaerus the Undreamt God",item_level:197},
  {id:260423,name_en:"Arator's Swift Remembrance",name_es:"Recuerdo presto de Arator",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_sword_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249382,name_en:"Canopy Walker's Footwraps",name_es:"Borceguíes de caminante arbóreo",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raiddruidmidnight_d_01.jpg",slot:"Feet",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249368,name_en:"Eternal Voidsong Chain",name_es:"Cadena de Canto del Vacío eterna",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_jewelry_silvermoonelf_necklace_blue1.jpg",slot:"Neck",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249329,name_en:"Gaze of the Unrestrained",name_es:"Mirada de los desatados",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_cloth_raidwarlockmidnight_d_01.jpg",slot:"Head",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249380,name_en:"Hate-Tied Waistchain",name_es:"Cadena para la cintura atada por el odio",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raiddeathknightmidnight_d_01_belt.jpg",slot:"Waist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249809,name_en:"Locus-Walker's Ribbon",name_es:"Cinta del Peregrino",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_int2_locuswalkerslastribbon.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249312,name_en:"Nightblade's Pantaloons",name_es:"Bombachos de hoja de la noche",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_leather_raidroguemidnight_d_01.jpg",slot:"Legs",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249345,name_en:"Ranger-Captain's Iridescent Insignia",name_es:"Insignia iridiscente de capitán forestal",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_agidps_rangercaptainsinsignia.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249288,name_en:"Ranger-Captain's Lethal Recurve",name_es:"Arco corvo letal de capitana forestal",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bow_1h_raidmidnight_d_01.jpg",slot:"Ranged",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249309,name_en:"Sunbound Breastplate",name_es:"Coraza vinculada al sol",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_plate_raidpaladinmidnight_d_01.jpg",slot:"Chest",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249295,name_en:"Turalyon's False Echo",name_es:"Eco falso de Turalyon",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249325,name_en:"Untethered Berserker's Grips",name_es:"Mandiletes de rabiosa desvinculada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_mail_raidhuntermidnight_d_01.jpg",slot:"Hands",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Corona del cosmos",boss_name_en:"Crown of the Cosmos",item_level:197},
  {id:249281,name_en:"Blade of the Final Twilight",name_es:"Hoja del Crepúsculo final",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_sword_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249316,name_en:"Crown of the Fractured Tyrant",name_es:"Corona del tirano fracturado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raiddeathknightmidnight_d_01_helm.jpg",slot:"Head",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249308,name_en:"Despotic Raiment",name_es:"Vestiduras despóticas",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_robe_cloth_raidpriestmidnight_d_01.jpg",slot:"Chest",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249304,name_en:"Fallen King's Cuffs",name_es:"Puños del Rey Caído",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_mail_raidshamanmidnight_d_01.jpg",slot:"Wrist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249337,name_en:"Ribbon of Coiled Malice",name_es:"Cinta de malicia en espiral",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_jewelry_devouringhost_necklace_bronze.jpg",slot:"Neck",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249298,name_en:"Tormentor's Bladed Fists",name_es:"Puños con filo de atormentador",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_hand_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249314,name_en:"Twisted Twilight Sash",name_es:"Fajín Crepuscular retorcido",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_leather_raiddemonhuntermidnight_d_01.jpg",slot:"Waist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249341,name_en:"Volatile Void Suffuser",name_es:"Impregnador de Vacío volátil",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_healer1_volatilevoidsuffuser.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249340,name_en:"Wraps of Cosmic Madness",name_es:"Envolturas de locura cósmica",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_intdps1_wrapsofcosmicmadness.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Rey caído Salhadaar",boss_name_en:"Fallen-King Salhadaar",item_level:197},
  {id:249275,name_en:"Bulwark of Noble Resolve",name_es:"Baluarte de resolución noble",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shield_1h_raidmidnight_d_01.jpg",slot:"Shield",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249306,name_en:"Devouring Night's Visage",name_es:"Rostro de noche de la Devoración",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_leather_raiddemonhuntermidnight_d_01.jpg",slot:"Head",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249319,name_en:"Endless March Waistwrap",name_es:"Ajustador de marcha infinita",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_cloth_raidpriestmidnight_d_01.jpg",slot:"Waist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249335,name_en:"Imperator's Banner",name_es:"Estandarte del imperador",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raiddeathknightmidnight_d_01_cape.jpg",slot:"Back",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249323,name_en:"Leggings of the Devouring Advance",name_es:"Leotardos del avance de la Devoración",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_cloth_raidmagemidnight_d_01.jpg",slot:"Legs",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249344,name_en:"Light Company Guidon",name_es:"Guion de la Compañía de la Luz",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_physdps1_armyoflightbanner.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249326,name_en:"Light's March Bracers",name_es:"Brazales de marcha de la Luz",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_plate_raidwarriormidnight_d_01.jpg",slot:"Wrist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249313,name_en:"Light-Judged Spaulders",name_es:"Bufas juzgadas por la Luz",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_plate_raidpaladinmidnight_d_01.jpg",slot:"Shoulder",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249310,name_en:"Robes of the Voidbound",name_es:"Togas de los ligados al Vacío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_robe_mail_raidshamanmidnight_d_01.jpg",slot:"Chest",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249320,name_en:"Sabatons of Obscurement",name_es:"Escarpes de oscurecimiento",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidevokermidnight_d_01.jpg",slot:"Feet",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249279,name_en:"Sunstrike Rifle",name_es:"Rifle de Golpe Solar",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_firearm_2h_raidmidnight_d_01.jpg",slot:"Ranged",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249334,name_en:"Void-Claimed Shinkickers",name_es:"Pateaespinillas reclamadas por el Vacío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raiddemonhuntermidnight_d_01.jpg",slot:"Feet",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249293,name_en:"Weight of Command",name_es:"Peso del mando",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_raidmidnight_d_02.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Imperador Averzian",boss_name_en:"Imperator Averzian",item_level:197},
  {id:249277,name_en:"Bellamy's Final Judgement",name_es:"Juicio final de Bellamy",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_2h_raidmidnight_d_01.jpg",slot:"Two-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249294,name_en:"Blade of the Blind Verdict",name_es:"Hoja del veredicto ciego",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_sword_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249333,name_en:"Blooming Barklight Spaulders",name_es:"Bufas de luz cortical floreciente",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_leather_raiddruidmidnight_d_01.jpg",slot:"Shoulder",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249369,name_en:"Bond of Light",name_es:"Vínculo de la Luz",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_jewelry_silvermoonelf_ring_blue1.jpg",slot:"Finger",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249311,name_en:"Lightblood Greaves",name_es:"Grebas de Sangreluz",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_plate_raidpaladinmidnight_d_01.jpg",slot:"Legs",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249808,name_en:"Litany of Lightblind Wrath",name_es:"Letanía de cólera ciega a la Luz",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_healer2_litanyoflightblindwrath.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249303,name_en:"Waistcord of the Judged",name_es:"Ceñidor del sentenciado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_mail_raidevokermidnight_d_01.jpg",slot:"Waist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249330,name_en:"War Chaplain's Grips",name_es:"Mandiletes de capellana de guerra",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_cloth_raidwarlockmidnight_d_01.jpg",slot:"Hands",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vanguardia Cegada por la Luz",boss_name_en:"Lightblinded Vanguard",item_level:197},
  {id:249287,name_en:"Clutchmates' Caress",name_es:"Caricia de compañeros de nido",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249370,name_en:"Draconic Nullcape",name_es:"Manteo dracónico de la nada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_cape_plate_raidpaladinmidnight_d_01.jpg",slot:"Back",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249280,name_en:"Emblazoned Sunglaive",name_es:"Guja solar blasonada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glaive_1h_raidmidnight_d_01.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249331,name_en:"Ezzorak's Gloombind",name_es:"Vinculapenumbra de Ezzorak",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_plate_raidwarriormidnight_d_01.jpg",slot:"Waist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249339,name_en:"Gloom-Spattered Dreadscale",name_es:"Aterraescama salpicada de penumbra",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_tank1_smolderinggloomscale.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249318,name_en:"Nullwalker's Dread Epaulettes",name_es:"Charreteras del pavor de caminante de la nada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_mail_raidevokermidnight_d_01.jpg",slot:"Shoulder",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249305,name_en:"Slippers of the Midnight Flame",name_es:"Zapatillas de la llama de medianoche",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidwarlockmidnight_d_01.jpg",slot:"Feet",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249321,name_en:"Vaelgor's Fearsome Grasp",name_es:"Garra temible de Vaelgor",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_leather_raiddruidmidnight_d_01.jpg",slot:"Hands",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249346,name_en:"Vaelgor's Final Stare",name_es:"Mirada final de Vaelgor",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_int1_voiddragoneye.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vaelgor y Ezzorak",boss_name_en:"Vaelgor & Ezzorak",item_level:197},
  {id:249317,name_en:"Frenzy's Rebuke",name_es:"Reprimenda de frenesí",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_mail_raidevokermidnight_d_01.jpg",slot:"Head",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249276,name_en:"Grimoire of the Eternal Light",name_es:"Grimorio de la Luz eterna",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_offhand_1h_raidmidnight_d_01.jpg",slot:"Off Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249342,name_en:"Heart of Ancient Hunger",name_es:"Corazón de hambre ancestral",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_trinket_raid_voidspire_strdps_hearthofancienthunger.jpg",slot:"Trinket",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249925,name_en:"Hungering Victory",name_es:"Victoria hambrienta",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_raidmidnight_d_02.jpg",slot:"One-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249302,name_en:"Inescapable Reach",name_es:"Alcance ineludible",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_polearm_2h_raidmidnight_d_01.jpg",slot:"Two-Hand",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249332,name_en:"Parasite Stompers",name_es:"Apisonadoras parasitarias",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_plate_raidpaladinmidnight_d_01.jpg",slot:"Feet",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249336,name_en:"Signet of the Starved Beast",name_es:"Sello de la bestia famélica",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_12_jewelry_devouringhost_ring_silver2.jpg",slot:"Finger",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249327,name_en:"Void-Skinned Bracers",name_es:"Brazales de piel de Vacío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_leather_raidroguemidnight_d_01.jpg",slot:"Wrist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197},
  {id:249315,name_en:"Voracious Wristwraps",name_es:"Cubremuñecas voraces",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_cloth_raidpriestmidnight_d_01.jpg",slot:"Wrist",raid_name:"La Aguja del Vacío",raid_name_en:"The Voidspire",boss_name:"Vorasius",boss_name_en:"Vorasius",item_level:197}
];


// Map DB row → API response shape (what frontend expects)
function rowToItem(row) {
  return {
    id: row.id,
    name: { en: row.name_en, es: row.name_es || row.name_en },
    rarity: row.rarity,
    icon: row.icon,
    slot: row.slot,
    raid: row.raid_name,
    raidEn: row.raid_name_en,
    boss: row.boss_name,
    bossEn: row.boss_name_en,
    itemLevel: row.item_level,
  };
}

// Seed raid_items table if empty (first run)
export async function seedRaidItems(targetDb) {
  const count = await targetDb.get('SELECT COUNT(*) as count FROM raid_items');
  if (count.count > 0) {
    log.info(`Raid items: ${count.count} items in DB`);
    return;
  }

  log.info(`Seeding ${SEED_ITEMS.length} raid items into database...`);
  for (const item of SEED_ITEMS) {
    await targetDb.run(
      `INSERT OR IGNORE INTO raid_items (id, name_en, name_es, rarity, icon, slot, raid_name, raid_name_en, boss_name, boss_name_en, item_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id, item.name_en, item.name_es, item.rarity, item.icon, item.slot,
      item.raid_name, item.raid_name_en, item.boss_name, item.boss_name_en, item.item_level
    );
  }
  log.info(`Seeded ${SEED_ITEMS.length} raid items`);
}

// Get all raid items from DB — instant, no API calls
export async function getAllRaidItems(targetDb) {
  const rows = await targetDb.all('SELECT * FROM raid_items ORDER BY boss_name, name_es');
  return rows.map(rowToItem);
}

// Search items in DB
export async function searchItems(targetDb, query) {
  const rows = await targetDb.all(
    `SELECT * FROM raid_items
     WHERE name_en LIKE ? OR name_es LIKE ? OR boss_name LIKE ? OR raid_name LIKE ?
     ORDER BY boss_name, name_es`,
    `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`
  );
  return rows.map(rowToItem);
}

// Get items by raid name
export async function getItemsByRaid(targetDb, raidName) {
  const rows = await targetDb.all('SELECT * FROM raid_items WHERE raid_name = ? ORDER BY boss_name, name_es', raidName);
  return rows.map(rowToItem);
}

// Force refresh from Blizzard API → upsert into DB
export async function refreshFromAPI(targetDb) {
  try {
    const apiItems = await blizzardAPI.refreshCache();
    if (!apiItems || apiItems.length === 0) {
      return { success: false, error: 'No items returned from API' };
    }

    for (const item of apiItems) {
      await targetDb.run(
        `INSERT OR REPLACE INTO raid_items (id, name_en, name_es, rarity, icon, slot, raid_name, raid_name_en, boss_name, boss_name_en, item_level, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        item.id, item.name?.en || item.name, item.name?.es || item.name,
        item.rarity, item.icon, item.slot,
        item.raid, item.raidEn || item.raid, item.boss, item.bossEn || item.boss,
        item.itemLevel
      );
    }

    log.info(`Refreshed ${apiItems.length} raid items from Blizzard API into DB`);
    return { success: true, count: apiItems.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get available raids from API
export async function getAvailableRaids() {
  try {
    return await blizzardAPI.getAvailableRaids();
  } catch (error) {
    log.warn('Failed to get available raids: ' + error.message);
    return [
      { id: 1307, name: 'The Voidspire',       expansion: 'Midnight', season: 1 },
      { id: 1314, name: 'The Dreamrift',        expansion: 'Midnight', season: 1 },
      { id: 1308, name: "March on Quel'Danas",  expansion: 'Midnight', season: 1 },
    ];
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
export async function getDataSourceStatus(targetDb) {
  const count = await targetDb.get('SELECT COUNT(*) as count FROM raid_items');
  const lastUpdated = await targetDb.get('SELECT MAX(updated_at) as last FROM raid_items');
  return {
    apiConfigured: isAPIConfigured(),
    itemCount: count.count,
    lastUpdated: lastUpdated?.last || null,
  };
}

// Schedule weekly Blizzard API refresh (called once at startup)
let refreshInterval = null;

export function scheduleItemRefresh(targetDb) {
  if (refreshInterval) return;

  const REFRESH_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  refreshInterval = setInterval(async () => {
    try {
      const result = await refreshFromAPI(targetDb);
      if (result.success) {
        log.info(`Weekly raid items refresh: ${result.count} items`);
      }
    } catch (err) {
      log.warn('Weekly raid items refresh error: ' + err.message);
    }
  }, REFRESH_MS);
  refreshInterval.unref();
  log.info('Raid items weekly refresh scheduled');
}

export default {
  seedRaidItems,
  getAllRaidItems,
  searchItems,
  getItemsByRaid,
  refreshFromAPI,
  getAvailableRaids,
  setCurrentRaids,
  isAPIConfigured,
  getDataSourceStatus,
  scheduleItemRefresh,
};
