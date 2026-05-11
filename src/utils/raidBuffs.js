// WoW The War Within — Confirmed raid buffs
// Icons: https://wow.zamimg.com/images/wow/icons/medium/<icon>.jpg

export const RAID_BUFFS = [
  {
    id: 'hunters_mark',
    name: "Marca del Cazador",
    effect: '+3% daño recibido',
    icon: 'ability_hunter_markedfordeath',
    classes: ['Hunter'],
    specs: null,
  },
  {
    id: 'power_word_fortitude',
    name: 'Resistencia',
    effect: '+5% Stamina',
    icon: 'spell_holy_wordfortitude',
    classes: ['Priest'],
    specs: null,
  },
  {
    id: 'battle_shout',
    name: 'Grito de Batalla',
    effect: '+5% Attack Power',
    icon: 'ability_warrior_battleshout',
    classes: ['Warrior'],
    specs: null,
  },
  {
    id: 'arcane_intellect',
    name: 'Intelecto Arcano',
    effect: '+3% Intelecto',
    icon: 'spell_holy_magicalsentry',
    classes: ['Mage'],
    specs: null,
  },
  {
    id: 'mark_of_the_wild',
    name: 'Marca de la Naturaleza',
    effect: '+3% Versatilidad',
    icon: 'ability_druid_markofthewild',
    classes: ['Druid'],
    specs: null,
  },
  {
    id: 'devotion_aura',
    name: 'Aura de Devoción',
    effect: '-3% daño recibido',
    icon: 'spell_holy_devotionaura',
    classes: ['Paladin'],
    specs: null,
  },
  {
    id: 'mystic_touch',
    name: 'Toque Místico',
    effect: '+5% daño físico a mobs',
    icon: 'ability_monk_jab',
    classes: ['Monk'],
    specs: null,
  },
  {
    id: 'chaos_brand',
    name: 'Marca del Caos',
    effect: '+3% daño mágico a mobs',
    icon: 'ability_demonhunter_chaosbrand',
    classes: ['Demon Hunter'],
    specs: null,
  },
  {
    id: 'skyfury',
    name: 'Skyfury',
    effect: '+2% Maestría',
    icon: 'ability_shaman_skyfury',
    classes: ['Shaman'],
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
