// Raid Items Service
// Items stored in DB for instant loading. Refreshed from Blizzard API weekly.

import blizzardAPI from './blizzardAPI.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:RaidItems');

// Seed data — Manaforge Omega (The War Within Season 3), February 2026
// Inserted into raid_items table on first run, then served from DB forever.
const SEED_ITEMS = [
  {id:242394,name_en:"Eradicating Arcanocore",name_es:"Núcleo Arcano erradicador",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_obliterationcannon.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237813,name_en:"Factory-Issue Plexhammer",name_es:"Martillo plex estándar",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_etherealraid_d_02.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237534,name_en:"Singed Sievecuffs",name_es:"Puños tamizados chamuscados",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_cloth_raidmageethereal_d_01.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237533,name_en:"Atomic Phasebelt",name_es:"Cinturón de fase atómico",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_leather_raidmonkethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237523,name_en:"Arcanotech Wrist-Matrix",name_es:"Matriz de muñeca de técnico Arcano",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_mail_raidevokerethereal_d_01.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237551,name_en:"Sterilized Expulsion Boots",name_es:"Botas de expulsión esterilizada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_plate_raiddeathknightethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237736,name_en:"Overclocked Plexhammer",name_es:"Martillo plex sobrecargado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_etherealraid_d_01.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237739,name_en:"Obliteration Beamglaive",name_es:"Guja de haz desintegradora",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_polearm_2h_etherealraid_d_01.jpg",slot:"Two-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237567,name_en:"Logic Gate: Alpha",name_es:"Puerta lógica: alfa",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg",slot:"Finger",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237547,name_en:"Mounted Manacannons",name_es:"Cañones de maná montados",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_cloth_raidpriestethereal_d_01.jpg",slot:"Shoulder",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237525,name_en:"Irradiated Impurity Filter",name_es:"Filtro de impurezas irradiado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_leather_raidmonkethereal_d_01.jpg",slot:"Head",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237543,name_en:"Chambersieve Waistcoat",name_es:"Ceñidor de cámara de filtrado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_mail_raidhunterethereal_d_01.jpg",slot:"Legs",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237528,name_en:"Manaforged Displacement Chassis",name_es:"Chasis de desplazamiento forjado con maná",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_plate_raidwarriorethereal_d_01.jpg",slot:"Chest",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Centinela del plexo",boss_name_en:"Plexus Sentinel",item_level:662},
  {id:237729,name_en:"Prodigious Gene Splicer",name_es:"Rebanador de genes prodigiosos",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_etherealraid_d_01.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:237732,name_en:"Piercing Strandbow",name_es:"Hebrarco perforador",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bow_1h_etherealraid_d_01.jpg",slot:"Ranged",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:237552,name_en:"Deathbound Shoulderpads",name_es:"Hombreras vinculadas a la muerte",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_leather_raidrogueethereal_d_01.jpg",slot:"Shoulder",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:237545,name_en:"Discarded Nutrient Shackles",name_es:"Grilletes de nutrientes desechados",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_plate_raidwarriorethereal_d_01.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:242393,name_en:"Loom'ithar's Living Silk",name_es:"Seda viviente de Loom'ithar",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_astralspinneret.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:242395,name_en:"Astral Antenna",name_es:"Antena astral",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_silkwormsantenna.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:237723,name_en:"Ward of the Weaving-Beast",name_es:"Resguardo de la bestia tejedora",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shield_1h_etherealraid_d_01.jpg",slot:"Shield",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:237524,name_en:"Laced Lair-Steppers",name_es:"Pisaguaridas de encaje",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidmageethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:237522,name_en:"Colossal Lifetether",name_es:"Atadura de vida colosal",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_mail_raidhunterethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Loom'ithar",boss_name_en:"Loom'ithar",item_level:662},
  {id:250104,name_en:"Soulbinder's Nethermantle",name_es:"Manto abisal de vinculador de almas",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_cape_special_soulbinder_d_01.jpg",slot:"Back",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:1},
  {id:242398,name_en:"Naazindhri's Mystic Lash",name_es:"Latigazo místico de Naazindhri",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_soulbinderbossinttrinket.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237738,name_en:"Unbound Training Claws",name_es:"Garras de entrenamiento desvinculadas",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_hand_1h_etherealraid_d_01.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237527,name_en:"Frock of Spirit's Reunion",name_es:"Ropaje de reunión de los espíritus",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_robe_cloth_raidwarlockethereal_d_01.jpg",slot:"Chest",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237546,name_en:"Bindings of Lost Essence",name_es:"Ataduras de esencia perdida",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_leather_raiddruidethereal_d_01.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:242391,name_en:"Soulbinder's Embrace",name_es:"Abrazo de vinculador de almas",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_manaforge_tanktrinket1.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237539,name_en:"Deathspindle Talons",name_es:"Garfas de rueca de muerte",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidevokerethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237550,name_en:"Fresh Ethereal Fetters",name_es:"Grilletes de los etéreos frescos",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_plate_raidwarriorethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237568,name_en:"Chrysalis of Sundered Souls",name_es:"Crisálida de almas partidas",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg",slot:"Neck",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237730,name_en:"Voidglass Spire",name_es:"Aguja cristalvacío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_staff_2h_etherealraid_d_02.jpg",slot:"Two-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Vinculadora de almas Naazindhri",boss_name_en:"Soulbinder Naazindhri",item_level:662},
  {id:237570,name_en:"Logic Gate: Omega",name_es:"Puerta lógica: omega",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg",slot:"Finger",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:237726,name_en:"Marvel of Technomancy",name_es:"Maravilla de la tecnomancia",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_staff_2h_etherealraid_d_01.jpg",slot:"Two-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:237538,name_en:"Forgeweaver's Journal Holster",name_es:"Funda del diario del tejeforjas",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_cloth_raidwarlockethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:237526,name_en:"Breached Containment Guards",name_es:"Guardia de contención atravesada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_plate_raiddeathknightethereal_d_01.jpg",slot:"Hands",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:242402,name_en:"Araz's Ritual Forge",name_es:"Forja ritual de Araz",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:237724,name_en:"Iris of the Dark Beyond",name_es:"Iris de la Gran Oscuridad del Más Allá",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_offhand_1h_etherealraid_d_01.jpg",slot:"Off Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:237553,name_en:"Laboratory Test Slippers",name_es:"Zapatillas para pruebas de laboratorio",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raiddruidethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:237529,name_en:"Harvested Attendant's Uniform",name_es:"Uniforme de auxiliar cosechado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_mail_raidhunterethereal_d_01.jpg",slot:"Chest",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:237737,name_en:"Photon Sabre Prime",name_es:"Sable de protones primigenio",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_sword_2h_etherealraid_d_01.jpg",slot:"Two-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Tejeforjas Araz",boss_name_en:"Forgeweaver Araz",item_level:662},
  {id:243305,name_en:"Interloper's Silken Striders",name_es:"Zancos sedosos de intruso",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidpriestethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:243306,name_en:"Interloper's Reinforced Sandals",name_es:"Sandalias reforzadas de intruso",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raidmonkethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:243308,name_en:"Interloper's Chain Boots",name_es:"Botas de anillas de intruso",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidshamanethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:243307,name_en:"Interloper's Plated Sabatons",name_es:"Escarpes de placas de intruso",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_boot.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237569,name_en:"Duskblaze's Desperation",name_es:"Desesperación de Fulgorsombrío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg",slot:"Neck",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237741,name_en:"Event Horizon",name_es:"Horizonte de sucesos",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shield_1h_etherealraid_d_01.jpg",slot:"Shield",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237541,name_en:"Darksorrow's Corrupted Carapace",name_es:"Caparazón corrupto de Penaoscura",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_leather_raiddemonhunterethereal_d_01.jpg",slot:"Chest",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237554,name_en:"Clasp of Furious Freedom",name_es:"Cinto de libertad furiosa",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_mail_raidshamanethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:242401,name_en:"Brand of Ceaseless Ire",name_es:"Marca de ira incesante",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_manaforgetanktrinket3.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:242397,name_en:"Sigil of the Cosmic Hunt",name_es:"Sigilo de la caza cósmica",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237727,name_en:"Collapsing Phaseblades",name_es:"Hojas de fase en colapso",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glaive_1h_etherealraid_d_01.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237549,name_en:"Bloodwrath's Gnarled Claws",name_es:"Garras retorcidas de Sangre Colérica",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_cloth_raidwarlockethereal_d_01.jpg",slot:"Hands",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237561,name_en:"Yoke of Enveloping Hatred",name_es:"Yugo de odio envolvente",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_bracer.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Los cazaalmas",boss_name_en:"The Soul Hunters",item_level:662},
  {id:237733,name_en:"Lacerated Current Caster",name_es:"Lanzacorrientes lacerado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_crossbow_2h_etherealraid_d_01.jpg",slot:"Ranged",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:237742,name_en:"Fractillus' Last Breath",name_es:"Último aliento de Fractillus",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_offhand_1h_etherealraid_d_02.jpg",slot:"Off Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:237536,name_en:"Bite of the Astral Wastes",name_es:"Mordisco de los páramos astrales",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_mail_raidshamanethereal_d_01.jpg",slot:"Head",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:237530,name_en:"Shrapnel-Fused Legguards",name_es:"Musleras imbuidas de metralla",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_plate_raiddeathknightethereal_d_01.jpg",slot:"Legs",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:242392,name_en:"Diamantine Voidcore",name_es:"Núcleo de Vacío diamantino",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:242396,name_en:"Unyielding Netherprism",name_es:"Prisma abisal implacable",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_voidprism.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:237728,name_en:"Voidglass Kris",name_es:"Kris cristalvacío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_etherealraid_d_02.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:237558,name_en:"Conjoined Glass Bracers",name_es:"Brazales de vidrio fusionado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_cloth_raidpriestethereal_d_01.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:237565,name_en:"Kinetic Dunerunners",name_es:"Corredunas cinético",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raiddemonhunterethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Fractillus",boss_name_en:"Fractillus",item_level:662},
  {id:242403,name_en:"Perfidious Projector",name_es:"Proyector pérfido",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_11_0_etherealraid_communicator_color4.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237734,name_en:"Oath-Breaker's Recompense",name_es:"Recompensa de rompevotos",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_axe_1h_etherealraid_d_01.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237548,name_en:"Twilight Tyrant's Veil",name_es:"Velo de tirano crepuscular",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_cloth_raidpriestethereal_d_01.jpg",slot:"Head",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237531,name_en:"Elite Shadowguard Legwraps",name_es:"Perneras de guardia de las Sombras de élite",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_leather_raidmonkethereal_d_01.jpg",slot:"Legs",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237544,name_en:"Royal Voidscale Gauntlets",name_es:"Guanteletes de escamas del Vacío reales",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_mail_raidevokerethereal_d_01.jpg",slot:"Hands",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237532,name_en:"Beacons of False Righteousness",name_es:"Balizas de falsa rectitud",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_shoulder.jpg",slot:"Shoulder",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:242406,name_en:"Salhadaar's Folly",name_es:"Insensatez de Salhadaar",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg",slot:"Neck",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:242400,name_en:"Nexus-King's Command",name_es:"Orden del rey-nexo",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_oathbindersauthority.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237740,name_en:"Vengeful Netherspike",name_es:"Pincho abisal vengativo",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_etherealraid_d_02.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237556,name_en:"Sandals of Scarred Servitude",name_es:"Sandalias de servidumbre marcada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidwarlockethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237557,name_en:"Reaper's Dreadbelt",name_es:"Cinturón aterrador de segador",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_leather_raidrogueethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237555,name_en:"Pactbound Vambraces",name_es:"Avambrazos vinculados a un pacto",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_mail_raidshamanethereal_d_01.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237564,name_en:"Darkrider Sabatons",name_es:"Escarpes de jinete oscuro",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_plate_raidwarriorethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:237735,name_en:"Voidglass Sovereign's Blade",name_es:"Hoja de soberano cristalvacío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_sword_1h_etherealraid_d_01.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:243365,name_en:"Maw of the Void",name_es:"Fauces del Vacío",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_2h_etherealking_d_01.jpg",slot:"Two-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Rey-nexo Salhadaar",boss_name_en:"Nexus-King Salhadaar",item_level:662},
  {id:242404,name_en:"All-Devouring Nucleus",name_es:"Núcleo del Devoratodo",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_omnidpstrinket.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:242405,name_en:"Band of the Shattered Soul",name_es:"Banda del alma destrozada",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg",slot:"Finger",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237731,name_en:"Ergospheric Cudgel",name_es:"Cayada ergoesférica",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_etherealraid_d_02.jpg",slot:"One-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237559,name_en:"Singularity Cincture",name_es:"Ceñidor de singularidad",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_cloth_raidpriestethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237562,name_en:"Time-Compressed Wristguards",name_es:"Guardamuñecas comprimidos por el tiempo",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_leather_raiddemonhunterethereal_d_01.jpg",slot:"Wrist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237560,name_en:"Greaves of Shattered Space",name_es:"Grebas de espacio destrozado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidhunterethereal_d_01.jpg",slot:"Feet",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237535,name_en:"Artoshion's Abyssal Stare",name_es:"Mirada abisal de Artoshion",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_helm.jpg",slot:"Head",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:242399,name_en:"Screams of a Forgotten Sky",name_es:"Alaridos de un cielo olvidado",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_blobofswirlingvoid_terra.jpg",slot:"Trinket",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237725,name_en:"Supermassive Starcrusher",name_es:"Aplastaestrellas supermasivo",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_2h_etherealraid_d_01.jpg",slot:"Two-Hand",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237542,name_en:"Stellar Navigation Slacks",name_es:"Pantalones de navegación estelar",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_cloth_raidmageethereal_d_01.jpg",slot:"Legs",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237540,name_en:"Winged Gamma Handlers",name_es:"Manipuladores gamma alados",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_leather_raiddruidethereal_d_01.jpg",slot:"Hands",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237537,name_en:"Claws of Failed Resistance",name_es:"Garras de resistencia fallida",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_mail_raidshamanethereal_d_01.jpg",slot:"Shoulder",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
  {id:237563,name_en:"Ultradense Fission Girdle",name_es:"Faja de fisión ultradensa",rarity:"epic",icon:"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_plate_raiddeathknightethereal_d_01.jpg",slot:"Waist",raid_name:"Forja de Maná Omega",raid_name_en:"Manaforge Omega",boss_name:"Dimensius el Devoratodo",boss_name_en:"Dimensius, the All-Devouring",item_level:662},
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
    return [{ id: 1302, name: 'Manaforge Omega', expansion: 'The War Within' }];
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
