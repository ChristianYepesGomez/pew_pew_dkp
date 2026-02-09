import { useLanguage } from '../../hooks/useLanguage'
import { Scroll, Microscope, Skull } from '@phosphor-icons/react'

const ReportLinks = ({ reportCode, characterName = null }) => {
  const { t } = useLanguage()
  if (!reportCode) return null

  const links = [
    {
      href: `https://www.warcraftlogs.com/reports/${reportCode}`,
      Icon: Scroll,
      label: 'WCL',
      color: 'text-orange-400 hover:text-orange-300',
    },
  ]

  if (characterName) {
    links.push({
      href: `https://wowanalyzer.com/report/${reportCode}/${encodeURIComponent(characterName)}`,
      Icon: Microscope,
      label: 'Analyze',
      color: 'text-blue-400 hover:text-blue-300',
    })
  }

  links.push({
    href: `https://www.wipefest.gg/report/${reportCode}`,
    Icon: Skull,
    label: 'Wipefest',
    color: 'text-red-400 hover:text-red-300',
  })

  return (
    <div className="flex items-center gap-1.5">
      {links.map(link => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${link.color} bg-lavender-12/30 hover:bg-lavender-12/50 transition-all`}
          title={link.label}
        >
          <link.Icon size={14} />
          <span className="hidden sm:inline">{link.label}</span>
        </a>
      ))}
    </div>
  )
}

export default ReportLinks
