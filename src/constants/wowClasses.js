// World of Warcraft Classes and Specializations
// Icons from https://wow.zamimg.com/images/wow/icons/medium/

export const WOW_CLASSES = {
  'Death Knight': {
    icon: 'classicon_deathknight',
    specs: {
      'Blood': { role: 'Tank', icon: 'spell_deathknight_bloodpresence' },
      'Frost': { role: 'DPS', icon: 'spell_deathknight_frostpresence' },
      'Unholy': { role: 'DPS', icon: 'spell_deathknight_unholypresence' }
    }
  },
  'Demon Hunter': {
    icon: 'classicon_demonhunter',
    specs: {
      'Havoc': { role: 'DPS', icon: 'ability_demonhunter_specdps' },
      'Vengeance': { role: 'Tank', icon: 'ability_demonhunter_spectank' }
    }
  },
  'Druid': {
    icon: 'classicon_druid',
    specs: {
      'Balance': { role: 'DPS', icon: 'spell_nature_starfall' },
      'Feral': { role: 'DPS', icon: 'ability_druid_catform' },
      'Guardian': { role: 'Tank', icon: 'ability_racial_bearform' },
      'Restoration': { role: 'Healer', icon: 'spell_nature_healingtouch' }
    }
  },
  'Evoker': {
    icon: 'classicon_evoker',
    specs: {
      'Devastation': { role: 'DPS', icon: 'classicon_evoker_devastation' },
      'Preservation': { role: 'Healer', icon: 'classicon_evoker_preservation' },
      'Augmentation': { role: 'DPS', icon: 'classicon_evoker_augmentation' }
    }
  },
  'Hunter': {
    icon: 'classicon_hunter',
    specs: {
      'Beast Mastery': { role: 'DPS', icon: 'ability_hunter_bestialdiscipline' },
      'Marksmanship': { role: 'DPS', icon: 'ability_hunter_focusedaim' },
      'Survival': { role: 'DPS', icon: 'ability_hunter_camouflage' }
    }
  },
  'Mage': {
    icon: 'classicon_mage',
    specs: {
      'Arcane': { role: 'DPS', icon: 'spell_holy_magicalsentry' },
      'Fire': { role: 'DPS', icon: 'spell_fire_firebolt02' },
      'Frost': { role: 'DPS', icon: 'spell_frost_frostbolt02' }
    }
  },
  'Monk': {
    icon: 'classicon_monk',
    specs: {
      'Brewmaster': { role: 'Tank', icon: 'spell_monk_brewmaster_spec' },
      'Mistweaver': { role: 'Healer', icon: 'spell_monk_mistweaver_spec' },
      'Windwalker': { role: 'DPS', icon: 'spell_monk_windwalker_spec' }
    }
  },
  'Paladin': {
    icon: 'classicon_paladin',
    specs: {
      'Holy': { role: 'Healer', icon: 'spell_holy_holybolt' },
      'Protection': { role: 'Tank', icon: 'ability_paladin_shieldofthetemplar' },
      'Retribution': { role: 'DPS', icon: 'spell_holy_auraoflight' }
    }
  },
  'Priest': {
    icon: 'classicon_priest',
    specs: {
      'Discipline': { role: 'Healer', icon: 'spell_holy_powerwordshield' },
      'Holy': { role: 'Healer', icon: 'spell_holy_guardianspirit' },
      'Shadow': { role: 'DPS', icon: 'spell_shadow_shadowwordpain' }
    }
  },
  'Rogue': {
    icon: 'classicon_rogue',
    specs: {
      'Assassination': { role: 'DPS', icon: 'ability_rogue_deadlybrew' },
      'Outlaw': { role: 'DPS', icon: 'ability_rogue_waylay' },
      'Subtlety': { role: 'DPS', icon: 'ability_stealth' }
    }
  },
  'Shaman': {
    icon: 'classicon_shaman',
    specs: {
      'Elemental': { role: 'DPS', icon: 'spell_nature_lightning' },
      'Enhancement': { role: 'DPS', icon: 'spell_shaman_improvedstormstrike' },
      'Restoration': { role: 'Healer', icon: 'spell_nature_magicimmunity' }
    }
  },
  'Warlock': {
    icon: 'classicon_warlock',
    specs: {
      'Affliction': { role: 'DPS', icon: 'spell_shadow_deathcoil' },
      'Demonology': { role: 'DPS', icon: 'spell_shadow_metamorphosis' },
      'Destruction': { role: 'DPS', icon: 'spell_shadow_rainoffire' }
    }
  },
  'Warrior': {
    icon: 'classicon_warrior',
    specs: {
      'Arms': { role: 'DPS', icon: 'ability_warrior_savageblow' },
      'Fury': { role: 'DPS', icon: 'ability_warrior_innerrage' },
      'Protection': { role: 'Tank', icon: 'ability_warrior_defensivestance' }
    }
  }
};

export const ROLE_ICONS = {
  'Tank': 'inv_shield_06',
  'Healer': 'spell_holy_flashheal',
  'DPS': 'inv_sword_27'
};

export const getClassColor = (className) => {
  const colors = {
    'Warrior': '#C79C6E',
    'Paladin': '#F58CBA',
    'Hunter': '#ABD473',
    'Rogue': '#FFF569',
    'Priest': '#FFFFFF',
    'Shaman': '#0070DE',
    'Mage': '#40C7EB',
    'Warlock': '#8788EE',
    'Druid': '#FF7D0A',
    'Death Knight': '#C41F3B',
    'Monk': '#00FF96',
    'Demon Hunter': '#A330C9',
    'Evoker': '#33937F'
  };
  return colors[className] || '#FFFFFF';
};

export const getWowheadIcon = (iconName) => {
  return `https://wow.zamimg.com/images/wow/icons/medium/${iconName}.jpg`;
};
