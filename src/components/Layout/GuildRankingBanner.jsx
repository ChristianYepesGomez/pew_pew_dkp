import { useEffect, useState } from 'react'
import { Globe, Flag, Lightning } from '@phosphor-icons/react'
import { warcraftLogsAPI } from '../../services/api'

const GuildRankingBanner = () => {
  const [ranking, setRanking] = useState(null)

  useEffect(() => {
    let cancelled = false
    warcraftLogsAPI.guildRanking()
      .then(res => { if (!cancelled) setRanking(res.data || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!ranking) return null
  const { world, realm, worldSpeed, realmSpeed } = ranking
  if (!world && !realm && !worldSpeed && !realmSpeed) return null

  const fmt = (n) => typeof n === 'number' && n > 0 ? `#${n.toLocaleString()}` : null

  const items = [
    fmt(world)      && { icon: Globe,     color: '#b1a7d0', label: 'Mundial',  value: fmt(world) },
    fmt(realm)      && { icon: Flag,      color: '#b1a7d0', label: 'Reino',    value: fmt(realm) },
    fmt(worldSpeed) && { icon: Lightning, color: '#ffaf9d', label: 'Speed',    value: fmt(worldSpeed) },
    fmt(realmSpeed) && { icon: Lightning, color: '#ffaf9d', label: 'Speed Rey', value: fmt(realmSpeed) },
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-4 text-[10px] leading-none">
      {items.map(({ icon: Icon, color, label, value }, i) => (
        <span key={i} className="flex items-center gap-1">
          <Icon size={10} style={{ color }} />
          <span style={{ color: 'rgba(177,167,208,0.65)' }}>{label}</span>
          <span className="font-bold text-[#ffeccd]">{value}</span>
        </span>
      ))}
    </div>
  )
}

export default GuildRankingBanner
