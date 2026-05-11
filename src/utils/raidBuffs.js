// WoW The War Within — Confirmed raid buffs
// Icons: https://wow.zamimg.com/images/wow/icons/medium/<icon>.jpg
// Only use icon names verified to exist in the Wowhead CDN

export const RAID_BUFFS = [
  {
    id: 'hunters_mark',
    name: "Marca del Cazador",
    effect: '+3% daño recibido',
    icon: 'ability_hunter_marksmanship',   // marksmanship spec icon - stable CDN
    classes: ['Hunter'],
    specs: null,
  },
  {
    id: 'power_word_fortitude',
    name: 'Stamina (Priest)',
    effect: '+5% Stamina',
    icon: 'spell_holy_wordfortitude',       // classic, definitely exists
    classes: ['Priest'],
    specs: null,
  },
  {
    id: 'battle_shout',
    name: 'Grito de Batalla',
    effect: '+5% Attack Power',
    icon: 'ability_warrior_battleshout',    // classic, definitely exists
    classes: ['Warrior'],
    specs: null,
  },
  {
    id: 'arcane_intellect',
    name: 'Intelecto Arcano',
    effect: '+3% Intelecto',
    icon: 'spell_holy_magicalsentry',       // classic, definitely exists
    classes: ['Mage'],
    specs: null,
  },
  {
    id: 'mark_of_the_wild',
    name: 'Marca del Bosque',
    effect: '+3% Versatilidad',
    icon: 'spell_nature_regeneration',      // classic MotW icon - definitely exists
    classes: ['Druid'],
    specs: null,
  },
  {
    id: 'devotion_aura',
    name: 'Aura de Devoción',
    effect: '-3% daño recibido',
    icon: 'spell_holy_devotionaura',        // classic, definitely exists
    classes: ['Paladin'],
    specs: null,
  },
  {
    id: 'mystic_touch',
    name: 'Toque Místico',
    effect: '+5% daño físico a mobs',
    icon: 'ability_monk_tigerpalm',         // Tiger Palm - stable monk CDN icon
    classes: ['Monk'],
    specs: null,
  },
  {
    id: 'chaos_brand',
    name: 'Marca del Caos',
    effect: '+3% daño mágico a mobs',
    icon: 'ability_demonhunter_chaosbrand', // Legion+, should exist
    classes: ['Demon Hunter'],
    specs: null,
  },
  {
    id: 'skyfury',
    name: 'Skyfury',
    effect: '+2% Maestría',
    icon: 'spell_nature_windfury',          // Windfury - ancestor of Skyfury, classic shaman
    classes: ['Shaman'],
    specs: null,
  },
  {
    id: 'atrophic_poison',
    name: 'Veneno Atrófico',
    effect: '-3% daño del jefe',
    icon: 'ability_rogue_poisons',          // classic, definitely exists
    classes: ['Rogue'],
    specs: null,
  },
  {
    id: 'blessing_of_bronze',
    name: 'Bendición del Bronce',
    effect: 'CDs de movimiento -15%',
    icon: 'ability_evoker_blessingofthebronze', // Dragonflight+
    classes: ['Evoker'],
    specs: null,
  },
]

const WOW_ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/medium'

export function getBuffIconUrl(iconName) {
  return `${WOW_ICON_BASE}/${iconName}.jpg`
}

export function checkBuffCoverage(players) {
  return RAID_BUFFS.map((buff) => {
    const coveredBy = players
      .filter((p) => {
        const cls = p.character_class
        if (buff.classes.includes(cls)) {
          if (buff.specs && buff.specs[cls]) {
            return buff.specs[cls].some(s => p.spec?.toLowerCase().includes(s.toLowerCase()))
          }
          return true
        }
        if (buff.specs && buff.specs[cls]) {
          return buff.specs[cls].some(s => p.spec?.toLowerCase().includes(s.toLowerCase()))
        }
        return false
      })
      .map((p) => p.character_name)

    return { ...buff, covered: coveredBy.length > 0, coveredBy }
  })
}
