import { useEffect, useState } from 'react'
import { Globe, Flag, Lightning } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { warcraftLogsAPI } from '../../services/api'

/**
 * Small banner with the guild's WCL ranking (world / realm / speed).
 *
 * Lives above the tab nav. Fetches once on mount; the backend caches the
 * response for 1h so the hit is effectively free on subsequent page loads.
 *
 * Renders nothing while loading, on error, or if WCL returned no rank data
 * — we don't want an empty placeholder pushing the header around.
 */
const GuildRankingBanner = () => {
  const { t } = useLanguage()
  const [ranking, setRanking] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    warcraftLogsAPI
      .guildRanking()
      .then((res) => {
        if (cancelled) return
        setRanking(res.data || null)
      })
      .catch(() => {
        if (cancelled) return
        // Silent fail — the banner is a nice-to-have, not critical UI.
        setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error || !ranking) return null

  const { world, realm, worldSpeed } = ranking
  // If WCL returned no usable rank numbers at all, hide the banner entirely.
  if (!world && !realm && !worldSpeed) return null

  const formatRank = (n) => (typeof n === 'number' && n > 0 ? `#${n.toLocaleString()}` : '—')

  return (
    <div
      className="w-full flex items-center justify-center gap-5 text-xs"
      style={{ background: '#0f0b20', padding: '6px 12px' }}
      aria-label={t('ranking_label')}
    >
      <span className="text-[#b1a7d0] font-semibold uppercase tracking-wider opacity-80">
        {t('ranking_label')}
      </span>

      {world > 0 && (
        <span className="flex items-center gap-1.5">
          <Globe size={14} className="text-[#b1a7d0]" weight="regular" />
          <span className="text-[#b1a7d0]">{t('ranking_world')}</span>
          <span className="text-[#ffeccd] font-bold">{formatRank(world)}</span>
        </span>
      )}

      {realm > 0 && (
        <span className="flex items-center gap-1.5">
          <Flag size={14} className="text-[#b1a7d0]" weight="regular" />
          <span className="text-[#b1a7d0]">{t('ranking_realm')}</span>
          <span className="text-[#ffeccd] font-bold">{formatRank(realm)}</span>
        </span>
      )}

      {worldSpeed > 0 && (
        <span className="flex items-center gap-1.5 pl-3">
          <Lightning size={14} className="text-[#ffaf9d]" weight="fill" />
          <span className="text-[#b1a7d0]">{t('ranking_speed')}</span>
          <span className="text-[#ffeccd] font-bold">{formatRank(worldSpeed)}</span>
        </span>
      )}
    </div>
  )
}

export default GuildRankingBanner
