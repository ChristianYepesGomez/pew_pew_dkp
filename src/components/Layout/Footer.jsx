const GENERAL_SITES = [
  { name: 'Warcraft Logs', url: 'https://www.warcraftlogs.com', favicon: 'warcraftlogs.com' },
  { name: 'Wowhead', url: 'https://www.wowhead.com', favicon: 'wowhead.com' },
  { name: 'Raider.IO', url: 'https://raider.io', favicon: 'raider.io' },
  { name: 'Icy Veins', url: 'https://www.icy-veins.com/wow', favicon: 'icy-veins.com' },
  { name: 'Maxroll', url: 'https://maxroll.gg/wow', favicon: 'maxroll.gg' },
  { name: 'Archon', url: 'https://www.archon.gg', favicon: 'archon.gg' },
  { name: 'Murlok.IO', url: 'https://murlok.io', favicon: 'murlok.io' },
  { name: 'WoWAnalyzer', url: 'https://wowanalyzer.com', favicon: 'wowanalyzer.com' },
  { name: 'Raidbots', url: 'https://www.raidbots.com', favicon: 'raidbots.com' },
  { name: 'Bloodmallet', url: 'https://bloodmallet.com', favicon: 'bloodmallet.com' },
  { name: 'Wago.io', url: 'https://wago.io', favicon: 'wago.io' },
]

// Class-specific sites — verified active as of early 2026
// Altered Time (Mage), Ravenholdt (Rogue), Skyhold (Warrior), Petopia (Hunter): connection refused — excluded
const CLASS_SITES = [
  { name: 'WingsIsUp — Holy Paladin', url: 'https://wingsisup.com', favicon: 'wingsisup.com', label: 'Paladin' },
  { name: 'Peak of Serenity — Monk', url: 'https://www.peakofserenity.com', favicon: 'peakofserenity.com', label: 'Monk' },
  { name: 'Dreamgrove — Druid', url: 'https://dreamgrove.gg', favicon: 'dreamgrove.gg', label: 'Druida' },
  { name: 'StormEarthandLava — Elemental Shaman', url: 'https://www.stormearthandlava.com', favicon: 'stormearthandlava.com', label: 'Shamán' },
]

const SiteIcon = ({ name, url, favicon }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    title={name}
    className="group flex items-center justify-center w-9 h-9 rounded-full bg-lavender-12 transition-all hover:bg-lavender-20 hover:scale-110"
  >
    <img
      src={`https://www.google.com/s2/favicons?domain=${favicon}&sz=32`}
      alt={name}
      width={18}
      height={18}
      className="rounded-sm opacity-60 group-hover:opacity-100 transition-opacity"
    />
  </a>
)

const Footer = () => (
  <footer className="mx-auto w-full max-w-[960px] pb-8">
    <div className="flex flex-col items-center gap-3">
      {/* General tools */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {GENERAL_SITES.map(site => (
          <SiteIcon key={site.name} {...site} />
        ))}
      </div>

      {/* Class-specific divider */}
      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-px bg-lavender-20/30" />
        <span className="text-[10px] text-lavender/25 uppercase tracking-widest">por clase</span>
        <div className="flex-1 h-px bg-lavender-20/30" />
      </div>

      {/* Class-specific sites */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {CLASS_SITES.map(site => (
          <div key={site.name} className="flex flex-col items-center gap-1">
            <SiteIcon {...site} />
            <span className="text-[9px] text-lavender/25 uppercase tracking-wide">{site.label}</span>
          </div>
        ))}
      </div>
    </div>
  </footer>
)

export default Footer
