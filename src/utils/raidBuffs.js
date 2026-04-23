// WoW The War Within — Raid buffs & debuffs
// Source: Warcraft Wiki, Icy Veins, Wowhead (verified April 2026)
// Icons: https://wow.zamimg.com/images/wow/icons/medium/<icon>.jpg

export const RAID_BUFFS = [
  {
    id: 'battle_shout',
    name: 'Battle Shout',
    effect: '+5% Attack Power',
    icon: 'ability_warrior_battleshout',
    classes: ['Warrior'],
    specs: null, // any spec
    category: 'stat',
  },
  {
    id: 'arcane_intellect',
    name: 'Arcane Intellect',
    effect: '+3% Intellect',
    icon: 'spell_holy_magicalsentry',
    classes: ['Mage'],
    specs: null,
    category: 'stat',
  },
  {
    id: 'power_word_fortitude',
    name: 'PW: Fortitude',
    effect: '+5% Stamina',
    icon: 'spell_holy_wordfortitude',
    classes: ['Priest'],
    specs: null,
    category: 'stat',
  },
  {
    id: 'mark_of_the_wild',
    name: 'Mark of the Wild',
    effect: '+3% Versatility',
    icon: 'spell_nature_regeneration',
    classes: ['Druid'],
    specs: null,
    category: 'stat',
  },
  {
    id: 'skyfury',
    name: 'Skyfury',
    effect: '+2% Mastery',
    icon: 'ability_shaman_skyfury',
    classes: ['Shaman'],
    specs: null,
    category: 'stat',
  },
  {
    id: 'devotion_aura',
    name: 'Devotion Aura',
    effect: '-3% dmg taken',
    icon: 'spell_holy_devotionaura',
    classes: ['Paladin'],
    specs: null,
    category: 'defensive',
  },
  {
    id: 'mystic_touch',
    name: 'Mystic Touch',
    effect: '+5% Phys dmg',
    icon: 'ability_monk_jab',
    classes: ['Monk'],
    specs: null,
    category: 'amp',
  },
  {
    id: 'chaos_brand',
    name: 'Chaos Brand',
    effect: '+3% Magic dmg',
    icon: 'ability_demonhunter_chaosbrand',
    classes: ['Demon Hunter'],
    specs: null,
    category: 'amp',
  },
  {
    id: 'hunters_mark',
    name: "Hunter's Mark",
    effect: '+3% dmg taken',
    icon: 'ability_hunter_markedfordeath',
    classes: ['Hunter'],
    specs: null,
    category: 'amp',
  },
  {
    id: 'atrophic_poison',
    name: 'Atrophic Poison',
    effect: '-3% enemy dmg',
    icon: 'ability_rogue_poisons',
    classes: ['Rogue'],
    specs: null,
    category: 'defensive',
  },
  {
    id: 'blessing_of_bronze',
    name: 'Bless. of Bronze',
    effect: 'Movement CDs',
    icon: 'ability_evoker_blessingofthebronze',
    classes: ['Evoker'],
    specs: null,
    category: 'utility',
  },
  {
    id: 'bloodlust',
    name: 'Bloodlust',
    effect: '+30% Haste',
    icon: 'spell_nature_bloodlust',
    // Shaman (any), Mage (any), Evoker (any), Hunter (BM only)
    classes: ['Shaman', 'Mage', 'Evoker'],
    specs: { Hunter: ['Beast Mastery'] },
    category: 'lust',
  },
]

const WOW_ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/medium'

export function getBuffIconUrl(iconName) {
  return `${WOW_ICON_BASE}/${iconName}.jpg`
}

/**
 * Given a list of roster players ({character_class, spec}),
 * returns for each buff: { covered: bool, coveredBy: string[] }
 */
export function checkBuffCoverage(players) {
  return RAID_BUFFS.map((buff) => {
    const coveredBy = players
      .filter((p) => {
        const cls = p.character_class
        if (buff.classes.includes(cls)) {
          // Check spec restriction
          if (buff.specs && buff.specs[cls]) {
            return buff.specs[cls].some(
              (s) => p.spec?.toLowerCase().includes(s.toLowerCase())
            )
          }
          return true
        }
        // spec-specific classes not in main classes list
        if (buff.specs && buff.specs[cls]) {
          return buff.specs[cls].some(
            (s) => p.spec?.toLowerCase().includes(s.toLowerCase())
          )
        }
        return false
      })
      .map((p) => p.character_name)

    return {
      ...buff,
      covered: coveredBy.length > 0,
      coveredBy,
    }
  })
}
