import { useState } from 'react'
import { CalendarBlank, Scroll } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { useHallOfFame } from '../../hooks/useQueries'
import SurfaceCard from '../ui/SurfaceCard'
import { Skeleton } from '../ui/Skeleton'
import CLASS_COLORS from '../../utils/classColors'
import HallOfFameDetail from './HallOfFameDetail'

const HallOfFameTab = () => {
  const { t } = useLanguage()
  const { data: legends = [], isLoading } = useHallOfFame()
  const [selectedId, setSelectedId] = useState(null)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-coral">{t('hall_of_fame_title')}</h2>
        <p className="text-lavender text-sm">{t('hall_of_fame_subtitle')}</p>
      </div>

      {legends.length === 0 ? (
        <SurfaceCard className="text-center py-16">
          <Scroll size={64} className="mx-auto text-lavender/40 mb-4" />
          <p className="text-cream text-lg font-semibold">{t('hall_of_fame_empty')}</p>
          <p className="text-lavender text-sm mt-1">{t('hall_of_fame_empty_desc')}</p>
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {legends.map((legend) => (
            <LegendCard
              key={legend.id}
              legend={legend}
              t={t}
              onClick={() => setSelectedId(legend.id)}
            />
          ))}
        </div>
      )}

      {selectedId && (
        <HallOfFameDetail
          entryId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

const LegendCard = ({ legend, t, onClick }) => {
  const classColor = CLASS_COLORS[legend.characterClass] || '#ffffff'

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    })
  }

  const fromDate = formatDate(legend.joinDate)
  const untilDate = formatDate(legend.leaveDate)

  return (
    <SurfaceCard
      className="cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-coral/40 hover:scale-[1.01]"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border-2"
          style={{ borderColor: classColor, backgroundColor: `${classColor}15` }}
        >
          {legend.avatar ? (
            <img
              src={legend.avatar}
              alt={legend.characterName}
              className="w-full h-full rounded-xl object-cover"
            />
          ) : (
            <span className="text-xl font-bold" style={{ color: classColor }}>
              {legend.characterName?.[0]?.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold truncate" style={{ color: classColor }}>
            {legend.characterName}
          </h3>
          <p className="text-lavender text-xs">
            {legend.spec && `${legend.spec} `}
            {legend.characterClass}
            {legend.raidRole && ` · ${legend.raidRole}`}
          </p>

          {(fromDate || untilDate) && (
            <div className="flex items-center gap-1 mt-1 text-xs text-lavender/70">
              <CalendarBlank size={12} />
              {fromDate && <span>{t('hof_from')} {fromDate}</span>}
              {untilDate && <span> {t('hof_until')} {untilDate}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Stats row — data only, no icons */}
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div>
          <p className="text-cream font-bold text-sm">{legend.totalBossKills ?? 0}</p>
          <p className="text-lavender/60 text-[10px] leading-tight">{t('hof_boss_kills')}</p>
        </div>
        <div>
          <p className="text-cream font-bold text-sm">{legend.lifetimeDkpGained ?? 0}</p>
          <p className="text-lavender/60 text-[10px] leading-tight">{t('hof_dkp_earned')}</p>
        </div>
        <div>
          <p className="text-cream font-bold text-sm">{legend.lifetimeDkpSpent ?? 0}</p>
          <p className="text-lavender/60 text-[10px] leading-tight">{t('hof_dkp_spent')}</p>
        </div>
      </div>

      {legend.tribute && (
        <p className="mt-3 text-sm text-cream/70 italic line-clamp-2 border-t border-lavender/10 pt-3">
          &ldquo;{legend.tribute}&rdquo;
        </p>
      )}
    </SurfaceCard>
  )
}

export default HallOfFameTab
