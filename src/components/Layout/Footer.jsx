import { useAuth } from '../../hooks/useAuth'

const GENERAL_SITES = [
  { name: 'Warcraft Logs', url: 'https://www.warcraftlogs.com', favicon: 'warcraftlogs.com' },
  { name: 'Wowhead', url: 'https://www.wowhead.com', favicon: 'wowhead.com' },
  { name: 'Raider.IO', url: 'https://raider.io', favicon: 'raider.io' },
  { name: 'Icy Veins', url: 'https://www.icy-veins.com/wow', favicon: 'icy-veins.com' },
  { name: 'Method', url: 'https://www.method.gg/guides', favicon: 'method.gg' },
  { name: 'Archon', url: 'https://www.archon.gg', favicon: 'archon.gg' },
  { name: 'Murlok.IO', url: 'https://murlok.io', favicon: 'murlok.io' },
  { name: 'WoWAnalyzer', url: 'https://wowanalyzer.com', favicon: 'wowanalyzer.com' },
  { name: 'Raidbots', url: 'https://www.raidbots.com', favicon: 'raidbots.com' },
  { name: 'Bloodmallet', url: 'https://bloodmallet.com', favicon: 'bloodmallet.com' },
  { name: 'Wago.io', url: 'https://wago.io', favicon: 'wago.io' },
  { name: 'Lorrgs — top parse cooldown timings', url: 'https://lorrgs.io', favicon: 'lorrgs.io' },
]

// Verified active class-specific sites (2025-2026).
// Classes without a dedicated site (Warrior, Rogue, Priest, Warlock, DK, DH, Evoker)
// rely on Icy Veins / Method in the general list.
const CLASS_SITES = {
  'Mage':    { name: 'Mage Hub — Toegrinder', url: 'https://mage-hub.com', favicon: 'mage-hub.com' },
  'Paladin': { name: 'WingsIsUp — Holy Paladin', url: 'https://wingsisup.com', favicon: 'wingsisup.com' },
  'Monk':    { name: 'Peak of Serenity — Monk', url: 'https://www.peakofserenity.com', favicon: 'peakofserenity.com' },
  'Druid':   { name: 'Dreamgrove — Druid', url: 'https://dreamgrove.gg', favicon: 'dreamgrove.gg' },
  'Shaman':  { name: 'StormEarthandLava — Shaman', url: 'https://www.stormearthandlava.com', favicon: 'stormearthandlava.com' },
  'Hunter':  { name: 'Warcraft Hunters Union', url: 'https://warcrafthuntersunion.com', favicon: 'warcrafthuntersunion.com' },
}

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

const Footer = () => {
  const { user } = useAuth()
  const classSite = CLASS_SITES[user?.characterClass]
  const sites = classSite ? [...GENERAL_SITES, classSite] : GENERAL_SITES

  return (
    <footer className="mx-auto w-full max-w-[960px] pb-8">
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {sites.map(site => (
          <SiteIcon key={site.name} {...site} />
        ))}
      </div>
    </footer>
  )
}

export default Footer
