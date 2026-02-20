const SITES = [
  { name: 'Warcraft Logs', url: 'https://www.warcraftlogs.com', favicon: 'warcraftlogs.com' },
  { name: 'Wowhead', url: 'https://www.wowhead.com', favicon: 'wowhead.com' },
  { name: 'Raider.IO', url: 'https://raider.io', favicon: 'raider.io' },
  { name: 'Archon', url: 'https://www.archon.gg', favicon: 'archon.gg' },
  { name: 'Murlok.IO', url: 'https://murlok.io', favicon: 'murlok.io' },
  { name: 'Wowutils (Viserio)', url: 'https://wowutils.com', favicon: 'wowutils.com' },
  { name: 'WoWAnalyzer', url: 'https://wowanalyzer.com', favicon: 'wowanalyzer.com' },
  { name: 'WoW Audit', url: 'https://wowaudit.com', favicon: 'wowaudit.com' },
]

const Footer = () => (
  <footer className="mx-auto w-full max-w-[960px] pb-8">
    <div className="flex flex-wrap items-center justify-center gap-4">
      {SITES.map(site => (
        <a
          key={site.name}
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          title={site.name}
          className="group flex items-center justify-center w-10 h-10 rounded-full bg-lavender-12 transition-all hover:bg-lavender-20 hover:scale-110"
        >
          <img
            src={`https://www.google.com/s2/favicons?domain=${site.favicon}&sz=32`}
            alt={site.name}
            width={20}
            height={20}
            className="rounded-sm opacity-70 group-hover:opacity-100 transition-opacity"
          />
        </a>
      ))}
    </div>
  </footer>
)

export default Footer
