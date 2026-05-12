import { useEffect, useState } from 'react'
import { Globe, Flag, Lightning } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { warcraftLogsAPI } from '../../services/api'

const GuildRankingBanner = () => {
  const { t } = useLanguage()
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
    fmt(world)      && { icon: Globe,     color: '#b1a7d0', label: t('ranking_world'),       value: fmt(world) },
    fmt(realm)      && { icon: Flag,      color: '#b1a7d0', label: t('ranking_realm'),       value: fmt(realm) },
    fmt(worldSpeed) && { icon: Lightning, color: '#ffaf9d', label: t('ranking_speed_world'), value: fmt(worldSpeed) },
    fmt(realmSpeed) && { icon: Lightning, color: '#ffaf9d', label: t('ranking_speed_realm'), value: fmt(realmSpeed) },
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-4 text-[10px] leading-none mb-0.5">
      {items.map(({ icon: Icon, color, label, value }, i) => (
        <span key={i} className="flex items-center gap-1">
          <Icon size={10} style={{ color }} />
          <span className="text-[#b1a7d0] opacity-60">{label}</span>
          <span className="font-bold text-[#ffeccd]">{value}</span>
        </span>
      ))}
    </div>
  )
}

export default GuildRankingBanner
