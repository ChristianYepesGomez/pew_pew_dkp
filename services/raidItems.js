// Raid Items Service
// Uses Blizzard API for real data with static fallback
// When API is unavailable or credentials not configured, falls back to static data

import blizzardAPI from './blizzardAPI.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Service:RaidItems');

// Static fallback data - Sourced from Blizzard API cache (February 2026)
// Real item IDs and icons from Manaforge Omega (The War Within Season 3)
const STATIC_FALLBACK_ITEMS = [
  // Plexus Sentinel / Centinela del plexo
  {"id":242394,"name":{"en":"Eradicating Arcanocore","es":"Núcleo Arcano erradicador"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_obliterationcannon.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237813,"name":{"en":"Factory-Issue Plexhammer","es":"Martillo plex estándar"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_etherealraid_d_02.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237534,"name":{"en":"Singed Sievecuffs","es":"Puños tamizados chamuscados"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_cloth_raidmageethereal_d_01.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237533,"name":{"en":"Atomic Phasebelt","es":"Cinturón de fase atómico"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_leather_raidmonkethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237523,"name":{"en":"Arcanotech Wrist-Matrix","es":"Matriz de muñeca de técnico Arcano"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_mail_raidevokerethereal_d_01.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237551,"name":{"en":"Sterilized Expulsion Boots","es":"Botas de expulsión esterilizada"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_plate_raiddeathknightethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237736,"name":{"en":"Overclocked Plexhammer","es":"Martillo plex sobrecargado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_etherealraid_d_01.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237739,"name":{"en":"Obliteration Beamglaive","es":"Guja de haz desintegradora"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_polearm_2h_etherealraid_d_01.jpg","slot":"Two-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237567,"name":{"en":"Logic Gate: Alpha","es":"Puerta lógica: alfa"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_gold.jpg","slot":"Finger","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237547,"name":{"en":"Mounted Manacannons","es":"Cañones de maná montados"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_cloth_raidpriestethereal_d_01.jpg","slot":"Shoulder","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237525,"name":{"en":"Irradiated Impurity Filter","es":"Filtro de impurezas irradiado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_leather_raidmonkethereal_d_01.jpg","slot":"Head","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237543,"name":{"en":"Chambersieve Waistcoat","es":"Ceñidor de cámara de filtrado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_mail_raidhunterethereal_d_01.jpg","slot":"Legs","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  {"id":237528,"name":{"en":"Manaforged Displacement Chassis","es":"Chasis de desplazamiento forjado con maná"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_plate_raidwarriorethereal_d_01.jpg","slot":"Chest","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Centinela del plexo","bossEn":"Plexus Sentinel","itemLevel":662},
  // Loom'ithar / Loom'ithar
  {"id":237729,"name":{"en":"Prodigious Gene Splicer","es":"Rebanador de genes prodigiosos"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_etherealraid_d_01.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":237732,"name":{"en":"Piercing Strandbow","es":"Hebrarco perforador"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bow_1h_etherealraid_d_01.jpg","slot":"Ranged","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":237552,"name":{"en":"Deathbound Shoulderpads","es":"Hombreras vinculadas a la muerte"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_leather_raidrogueethereal_d_01.jpg","slot":"Shoulder","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":237545,"name":{"en":"Discarded Nutrient Shackles","es":"Grilletes de nutrientes desechados"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_plate_raidwarriorethereal_d_01.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":242393,"name":{"en":"Loom'ithar's Living Silk","es":"Seda viviente de Loom'ithar"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_astralspinneret.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":242395,"name":{"en":"Astral Antenna","es":"Antena astral"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_silkwormsantenna.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":237723,"name":{"en":"Ward of the Weaving-Beast","es":"Resguardo de la bestia tejedora"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_shield_1h_etherealraid_d_01.jpg","slot":"Shield","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":237524,"name":{"en":"Laced Lair-Steppers","es":"Pisaguaridas de encaje"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidmageethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  {"id":237522,"name":{"en":"Colossal Lifetether","es":"Atadura de vida colosal"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_mail_raidhunterethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Loom'ithar","bossEn":"Loom'ithar","itemLevel":662},
  // Soulbinder Naazindhri / Vinculadora de almas Naazindhri
  {"id":250104,"name":{"en":"Soulbinder's Nethermantle","es":"Manto abisal de vinculador de almas"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_cape_special_soulbinder_d_01.jpg","slot":"Back","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":1},
  {"id":242398,"name":{"en":"Naazindhri's Mystic Lash","es":"Latigazo místico de Naazindhri"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_soulbinderbossinttrinket.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":237738,"name":{"en":"Unbound Training Claws","es":"Garras de entrenamiento desvinculadas"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_hand_1h_etherealraid_d_01.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":237527,"name":{"en":"Frock of Spirit's Reunion","es":"Ropaje de reunión de los espíritus"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_robe_cloth_raidwarlockethereal_d_01.jpg","slot":"Chest","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":237546,"name":{"en":"Bindings of Lost Essence","es":"Ataduras de esencia perdida"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_leather_raiddruidethereal_d_01.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":242391,"name":{"en":"Soulbinder's Embrace","es":"Abrazo de vinculador de almas"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_manaforge_tanktrinket1.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":237539,"name":{"en":"Deathspindle Talons","es":"Garfas de rueca de muerte"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidevokerethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":237550,"name":{"en":"Fresh Ethereal Fetters","es":"Grilletes de los etéreos frescos"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_plate_raidwarriorethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":237568,"name":{"en":"Chrysalis of Sundered Souls","es":"Crisálida de almas partidas"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_necklace01_etherealnontechnologicalstyle_gold.jpg","slot":"Neck","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  {"id":237730,"name":{"en":"Voidglass Spire","es":"Aguja cristalvacío"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_staff_2h_etherealraid_d_02.jpg","slot":"Two-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Vinculadora de almas Naazindhri","bossEn":"Soulbinder Naazindhri","itemLevel":662},
  // Forgeweaver Araz / Tejeforjas Araz
  {"id":237570,"name":{"en":"Logic Gate: Omega","es":"Puerta lógica: omega"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_ring03_etherealtechnomancerstyle_terra.jpg","slot":"Finger","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":237726,"name":{"en":"Marvel of Technomancy","es":"Maravilla de la tecnomancia"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_staff_2h_etherealraid_d_01.jpg","slot":"Two-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":237538,"name":{"en":"Forgeweaver's Journal Holster","es":"Funda del diario del tejeforjas"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_cloth_raidwarlockethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":237526,"name":{"en":"Breached Containment Guards","es":"Guardia de contención atravesada"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_plate_raiddeathknightethereal_d_01.jpg","slot":"Hands","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":242402,"name":{"en":"Araz's Ritual Forge","es":"Forja ritual de Araz"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_trinkettechnomancer_ritualengine.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":237724,"name":{"en":"Iris of the Dark Beyond","es":"Iris de la Gran Oscuridad del Más Allá"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_offhand_1h_etherealraid_d_01.jpg","slot":"Off Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":237553,"name":{"en":"Laboratory Test Slippers","es":"Zapatillas para pruebas de laboratorio"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raiddruidethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":237529,"name":{"en":"Harvested Attendant's Uniform","es":"Uniforme de auxiliar cosechado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_mail_raidhunterethereal_d_01.jpg","slot":"Chest","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  {"id":237737,"name":{"en":"Photon Sabre Prime","es":"Sable de protones primigenio"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_sword_2h_etherealraid_d_01.jpg","slot":"Two-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Tejeforjas Araz","bossEn":"Forgeweaver Araz","itemLevel":662},
  // The Soul Hunters / Los cazaalmas
  {"id":243305,"name":{"en":"Interloper's Silken Striders","es":"Zancos sedosos de intruso"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidpriestethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":243306,"name":{"en":"Interloper's Reinforced Sandals","es":"Sandalias reforzadas de intruso"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raidmonkethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":243308,"name":{"en":"Interloper's Chain Boots","es":"Botas de anillas de intruso"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidshamanethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":243307,"name":{"en":"Interloper's Plated Sabatons","es":"Escarpes de placas de intruso"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_boot.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":237569,"name":{"en":"Duskblaze's Desperation","es":"Desesperación de Fulgorsombrío"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_necklace03_etherealtechnomancerstyle_gold.jpg","slot":"Neck","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":237741,"name":{"en":"Event Horizon","es":"Horizonte de sucesos"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_shield_1h_etherealraid_d_01.jpg","slot":"Shield","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":237541,"name":{"en":"Darksorrow's Corrupted Carapace","es":"Caparazón corrupto de Penaoscura"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_chest_leather_raiddemonhunterethereal_d_01.jpg","slot":"Chest","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":237554,"name":{"en":"Clasp of Furious Freedom","es":"Cinto de libertad furiosa"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_mail_raidshamanethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":242401,"name":{"en":"Brand of Ceaseless Ire","es":"Marca de ira incesante"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_manaforgetanktrinket3.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":242397,"name":{"en":"Sigil of the Cosmic Hunt","es":"Sigilo de la caza cósmica"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_agidpsancientkareshirelic.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":237727,"name":{"en":"Collapsing Phaseblades","es":"Hojas de fase en colapso"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_glaive_1h_etherealraid_d_01.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":237549,"name":{"en":"Bloodwrath's Gnarled Claws","es":"Garras retorcidas de Sangre Colérica"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_cloth_raidwarlockethereal_d_01.jpg","slot":"Hands","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  {"id":237561,"name":{"en":"Yoke of Enveloping Hatred","es":"Yugo de odio envolvente"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_bracer.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Los cazaalmas","bossEn":"The Soul Hunters","itemLevel":662},
  // Fractillus / Fractillus
  {"id":237733,"name":{"en":"Lacerated Current Caster","es":"Lanzacorrientes lacerado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_crossbow_2h_etherealraid_d_01.jpg","slot":"Ranged","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":237742,"name":{"en":"Fractillus' Last Breath","es":"Último aliento de Fractillus"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_offhand_1h_etherealraid_d_02.jpg","slot":"Off Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":237536,"name":{"en":"Bite of the Astral Wastes","es":"Mordisco de los páramos astrales"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_mail_raidshamanethereal_d_01.jpg","slot":"Head","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":237530,"name":{"en":"Shrapnel-Fused Legguards","es":"Musleras imbuidas de metralla"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_plate_raiddeathknightethereal_d_01.jpg","slot":"Legs","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":242392,"name":{"en":"Diamantine Voidcore","es":"Núcleo de Vacío diamantino"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_intdps_ancientkareshirelic.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":242396,"name":{"en":"Unyielding Netherprism","es":"Prisma abisal implacable"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_voidprism.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":237728,"name":{"en":"Voidglass Kris","es":"Kris cristalvacío"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_etherealraid_d_02.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":237558,"name":{"en":"Conjoined Glass Bracers","es":"Brazales de vidrio fusionado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_cloth_raidpriestethereal_d_01.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  {"id":237565,"name":{"en":"Kinetic Dunerunners","es":"Corredunas cinético"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_leather_raiddemonhunterethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Fractillus","bossEn":"Fractillus","itemLevel":662},
  // Nexus-King Salhadaar / Rey-nexo Salhadaar
  {"id":242403,"name":{"en":"Perfidious Projector","es":"Proyector pérfido"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_11_0_etherealraid_communicator_color4.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237734,"name":{"en":"Oath-Breaker's Recompense","es":"Recompensa de rompevotos"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_axe_1h_etherealraid_d_01.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237548,"name":{"en":"Twilight Tyrant's Veil","es":"Velo de tirano crepuscular"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_helm_cloth_raidpriestethereal_d_01.jpg","slot":"Head","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237531,"name":{"en":"Elite Shadowguard Legwraps","es":"Perneras de guardia de las Sombras de élite"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_leather_raidmonkethereal_d_01.jpg","slot":"Legs","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237544,"name":{"en":"Royal Voidscale Gauntlets","es":"Guanteletes de escamas del Vacío reales"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_mail_raidevokerethereal_d_01.jpg","slot":"Hands","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237532,"name":{"en":"Beacons of False Righteousness","es":"Balizas de falsa rectitud"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_shoulder.jpg","slot":"Shoulder","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":242406,"name":{"en":"Salhadaar's Folly","es":"Insensatez de Salhadaar"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_necklace02_etherealribbonorrunestyle_gold.jpg","slot":"Neck","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":242400,"name":{"en":"Nexus-King's Command","es":"Orden del rey-nexo"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_oathbindersauthority.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237740,"name":{"en":"Vengeful Netherspike","es":"Pincho abisal vengativo"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_knife_1h_etherealraid_d_02.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237556,"name":{"en":"Sandals of Scarred Servitude","es":"Sandalias de servidumbre marcada"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_cloth_raidwarlockethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237557,"name":{"en":"Reaper's Dreadbelt","es":"Cinturón aterrador de segador"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_leather_raidrogueethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237555,"name":{"en":"Pactbound Vambraces","es":"Avambrazos vinculados a un pacto"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_mail_raidshamanethereal_d_01.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237564,"name":{"en":"Darkrider Sabatons","es":"Escarpes de jinete oscuro"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_plate_raidwarriorethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":237735,"name":{"en":"Voidglass Sovereign's Blade","es":"Hoja de soberano cristalvacío"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_sword_1h_etherealraid_d_01.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  {"id":243365,"name":{"en":"Maw of the Void","es":"Fauces del Vacío"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_2h_etherealking_d_01.jpg","slot":"Two-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Rey-nexo Salhadaar","bossEn":"Nexus-King Salhadaar","itemLevel":662},
  // Dimensius, the All-Devouring / Dimensius el Devoratodo
  {"id":242404,"name":{"en":"All-Devouring Nucleus","es":"Núcleo del Devoratodo"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_omnidpstrinket.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":242405,"name":{"en":"Band of the Shattered Soul","es":"Banda del alma destrozada"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_ring02_etherealribbonorrunestyle_gold.jpg","slot":"Finger","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237731,"name":{"en":"Ergospheric Cudgel","es":"Cayada ergoesférica"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_1h_etherealraid_d_02.jpg","slot":"One-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237559,"name":{"en":"Singularity Cincture","es":"Ceñidor de singularidad"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_cloth_raidpriestethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237562,"name":{"en":"Time-Compressed Wristguards","es":"Guardamuñecas comprimidos por el tiempo"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_bracer_leather_raiddemonhunterethereal_d_01.jpg","slot":"Wrist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237560,"name":{"en":"Greaves of Shattered Space","es":"Grebas de espacio destrozado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_boot_mail_raidhunterethereal_d_01.jpg","slot":"Feet","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237535,"name":{"en":"Artoshion's Abyssal Stare","es":"Mirada abisal de Artoshion"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_plate_raidpaladinethereal_d_01_helm.jpg","slot":"Head","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":242399,"name":{"en":"Screams of a Forgotten Sky","es":"Alaridos de un cielo olvidado"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_112_raidtrinkets_blobofswirlingvoid_terra.jpg","slot":"Trinket","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237725,"name":{"en":"Supermassive Starcrusher","es":"Aplastaestrellas supermasivo"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_mace_2h_etherealraid_d_01.jpg","slot":"Two-Hand","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237542,"name":{"en":"Stellar Navigation Slacks","es":"Pantalones de navegación estelar"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_pant_cloth_raidmageethereal_d_01.jpg","slot":"Legs","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237540,"name":{"en":"Winged Gamma Handlers","es":"Manipuladores gamma alados"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_glove_leather_raiddruidethereal_d_01.jpg","slot":"Hands","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237537,"name":{"en":"Claws of Failed Resistance","es":"Garras de resistencia fallida"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_shoulder_mail_raidshamanethereal_d_01.jpg","slot":"Shoulder","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
  {"id":237563,"name":{"en":"Ultradense Fission Girdle","es":"Faja de fisión ultradensa"},"rarity":"epic","icon":"https://render.worldofwarcraft.com/eu/icons/56/inv_belt_plate_raiddeathknightethereal_d_01.jpg","slot":"Waist","raid":"Forja de Maná Omega","raidEn":"Manaforge Omega","boss":"Dimensius el Devoratodo","bossEn":"Dimensius, the All-Devouring","itemLevel":662},
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
        log.info(`Loaded ${apiItems.length} items from Blizzard API`);
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
  log.info('Using static fallback data for raid items');
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
  searchItems,
  getItemsByRaid,
  refreshFromAPI,
  getAvailableRaids,
  setCurrentRaids,
  isAPIConfigured,
  getDataSourceStatus,
};
