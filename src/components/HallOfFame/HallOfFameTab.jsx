import { useState } from 'react'
import { Trophy, Sword, Skull, CurrencyCircleDollar, CalendarBlank, Scroll } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { useHallOfFame } from '../../hooks/useQueries'
import { hallOfFameAPI } from '../../services/api'
import SectionHeader from '../ui/SectionHeader'
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
        <div className="flex items-center justify-center gap-3">
          <Trophy size={34} className="text-amber-400" weight="fill" />
          <h2 className="text-2xl font-bold text-coral">{t('hall_of_fame_title')}</h2>
          <Trophy size={34} className="text-amber-400" weight="fill" />
        </div>
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
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <SurfaceCard
      className="cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-coral/40 hover:scale-[1.01]"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Avatar or class icon */}
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

          {/* Dates */}
          <div className="flex items-center gap-3 mt-1 text-xs text-lavender/70">
            {legend.joinDate && (
              <span className="flex items-center gap-1">
                <CalendarBlank size={12} />
                {formatDate(legend.joinDate)}
              </span>
            )}
            {legend.leaveDate && (
              <>
                <span>→</span>
                <span>{formatDate(legend.leaveDate)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        <StatBadge
          icon={Sword}
          value={legend.totalRaids}
          label={t('hof_raids')}
          color="text-coral"
        />
        <StatBadge
          icon={Skull}
          value={legend.totalBossKills}
          label={t('hof_boss_kills')}
          color="text-teal"
        />
        <StatBadge
          icon={CurrencyCircleDollar}
          value={legend.lifetimeDkpGained}
          label={t('hof_dkp_earned')}
          color="text-amber-400"
        />
        <StatBadge
          icon={CurrencyCircleDollar}
          value={legend.lifetimeDkpSpent}
          label={t('hof_dkp_spent')}
          color="text-lavender"
        />
      </div>

      {/* Tribute preview */}
      {legend.tribute && (
        <p className="mt-3 text-sm text-cream/70 italic line-clamp-2 border-t border-lavender/10 pt-3">
          "{legend.tribute}"
        </p>
      )}
    </SurfaceCard>
  )
}

const StatBadge = ({ icon: Icon, value, label, color }) => (
  <div className="text-center">
    <Icon size={16} className={`mx-auto mb-0.5 ${color}`} />
    <p className="text-cream font-bold text-sm">{value ?? 0}</p>
    <p className="text-lavender/60 text-[10px] leading-tight">{label}</p>
  </div>
)

export default HallOfFameTab
