// External buff icons shown on DPS/HPS leaderboard entries.
// Mirrors how WarcraftLogs surfaces Power Infusion, Innervate, etc. in their ranking columns.
const BUFF_ICON_MAP = {
  power_infusion: { icon: 'spell_holy_powerinfusion', label: 'Power Infusion' },
  innervate:      { icon: 'spell_nature_lightning',   label: 'Innervate' },
  bloodlust:      { icon: 'spell_nature_bloodlust',   label: 'Heroism / Bloodlust' },
}

/**
 * Renders small WoW ability icons for any external buffs detected during a fight.
 * Only shown on DPS and HPS stat entries — not deaths, damage taken, potions, etc.
 *
 * @param {string|object|null} buffsJson - JSON string or parsed object from external_buffs_json DB column
 */
const ExternalBuffBadge = ({ buffsJson }) => {
  if (!buffsJson) return null

  let buffs
  try {
    buffs = typeof buffsJson === 'string' ? JSON.parse(buffsJson) : buffsJson
  } catch {
    return null
  }

  const entries = Object.entries(buffs).filter(([, count]) => count > 0)
  if (!entries.length) return null

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {entries.map(([key, count]) => {
        const def = BUFF_ICON_MAP[key]
        if (!def) return null
        return (
          <div
            key={key}
            className="relative inline-flex"
            title={count > 1 ? `${def.label} ×${count}` : def.label}
          >
            <img
              src={`https://wow.zamimg.com/images/wow/icons/small/${def.icon}.jpg`}
              alt={def.label}
              className="w-4 h-4 rounded-sm opacity-90"
            />
            {count > 1 && (
              <span
                className="absolute -bottom-0.5 -right-1 text-[9px] font-bold leading-none"
                style={{ color: '#ffd700', textShadow: '0 0 2px #000' }}
              >
                {count}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ExternalBuffBadge
