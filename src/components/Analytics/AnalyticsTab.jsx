import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '../../hooks/useLanguage'
import { analyticsAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import {
  Crosshair, Heart, Skull, Shield, Lightning, Drop, DropHalf,
  UsersThree, Sparkle, Flask, Calendar, FirstAidKit,
} from '@phosphor-icons/react'
import { AnalyticsSkeleton } from '../ui/Skeleton'
import LeaderboardModal from './LeaderboardModal'
import ExternalBuffBadge from './ExternalBuffBadge'
import PercentileMatrix from './PercentileMatrix'

const DIFFICULTY_COLORS = {
  Mythic: '#ff8000',
  Heroic: '#a335ee',
  Normal: '#1eff00',
  LFR: '#0070dd',
}

// Gold / Silver / Bronze
const POSITION_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']

// WCL percentile tier colors (mirrors warcraftlogs.com color scheme)
const wclColor = (pct) => {
  if (pct >= 100) return '#e5cc80' // Gold
  if (pct >= 99)  return '#e268a8' // Pink
  if (pct >= 95)  return '#ff8000' // Orange
  if (pct >= 75)  return '#a335ee' // Purple
  if (pct >= 50)  return '#0070ff' // Blue
  if (pct >= 25)  return '#1eff00' // Green
  return '#666666'                 // Gray
}

// WoW-style number formatting: 125348 → "125.3K", 1234567 → "1.23M"
const fmtWow = (n) => {
  if (!n || isNaN(n)) return '—'
  const v = Number(n)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(Math.round(v))
}

const LeaderboardCard = ({ cardKey, title, Icon, color, entries, format, valueColorFn, badge, showBuffs, onSeeMore }) => {
  const { t } = useLanguage()
  const top3 = entries.slice(0, 3)

  return (
    <div className="rounded-xl border border-lavender-20/20 bg-indigo/30 p-5 flex flex-col">
      <h4 className="text-sm text-lavender mb-4 inline-flex items-center gap-2">
        <Icon size={16} style={{ color }} />
        {title}
        {badge && <span className="text-xs text-lavender/40 ml-1">({badge})</span>}
      </h4>
      {top3.length > 0 ? (
        <div className="space-y-3 flex-1">
          {top3.map((entry, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="text-sm font-bold w-5 flex-shrink-0 text-center"
                style={{ color: POSITION_COLORS[i] }}
              >
                {i + 1}
              </span>
              <span
                className="text-sm font-semibold flex-1 min-w-0 truncate"
                style={{ color: CLASS_COLORS[entry.character_class] || '#fff' }}
              >
                {entry.character_name}
              </span>
              {showBuffs && <ExternalBuffBadge buffsJson={entry.external_buffs_json} />}
              {(entry.report_code && entry.fight_id) ? (
                <a
                  href={`https://www.warcraftlogs.com/reports/${entry.report_code}#fight=${entry.fight_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold tabular-nums flex-shrink-0 hover:opacity-75 transition-opacity hover:underline underline-offset-2"
                  style={{ color: valueColorFn ? valueColorFn(entry.value) : color }}
                >
                  {format(entry.value)}
                </a>
              ) : (
                <span
                  className="text-sm font-bold tabular-nums flex-shrink-0"
                  style={{ color: valueColorFn ? valueColorFn(entry.value) : color }}
                >
                  {format(entry.value)}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-lavender/40 text-sm text-center py-4 flex-1">—</p>
      )}
      {entries.length > 0 && (
        <button
          onClick={() => onSeeMore(cardKey)}
          className="mt-4 text-xs text-lavender/50 hover:text-lavender transition-colors self-end"
        >
          {t('analytics_see_more')} →
        </button>
      )}
    </div>
  )
}

const AnalyticsTab = () => {
  const { t } = useLanguage()
  const [openModal, setOpenModal] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'tab'],
    queryFn: async () => {
      const [perfRes, lbRes] = await Promise.all([
        analyticsAPI.getMyPerformance().catch(() => ({ data: null })),
        analyticsAPI.getGuildLeaderboards().catch(() => ({ data: null })),
      ])
      return { myPerformance: perfRes.data, leaderboards: lbRes.data }
    },
  })

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  const { myPerformance, leaderboards } = data || {}

  const myBosses = myPerformance?.bossBreakdown || []

  const LEADERBOARDS = [
    {
      key: 'topDps',
      title: t('analytics_top_dps'),
      Icon: Crosshair,
      color: '#ef4444',
      format: (v) => `${fmtWow(v)} DPS`,
      badge: t('analytics_best_log'),
      showBuffs: true,
    },
    {
      key: 'topHps',
      title: t('analytics_top_hps'),
      Icon: Heart,
      color: '#22c55e',
      format: (v) => `${fmtWow(v)} HPS`,
      badge: t('analytics_best_log'),
      showBuffs: true,
    },
    {
      key: 'topDeaths',
      title: t('analytics_most_deaths'),
      Icon: Skull,
      color: '#9ca3af',
      format: (v) => String(v),
      badge: null,
    },
    {
      key: 'topDamageTaken',
      title: t('analytics_most_damage_taken'),
      Icon: Shield,
      color: '#f97316',
      format: (v) => fmtWow(v),
      badge: t('analytics_excl_tanks'),
    },
    {
      key: 'topPotions',
      title: t('analytics_health_pots'),
      Icon: Drop,
      color: '#a855f7',
      format: (v) => String(v),
      badge: null,
    },
    {
      key: 'topInterrupts',
      title: t('analytics_interrupts'),
      Icon: Lightning,
      color: '#3b82f6',
      format: (v) => String(v),
      badge: null,
    },
    {
      key: 'topDispels',
      title: t('analytics_top_dispels'),
      Icon: Sparkle,
      color: '#38bdf8',
      format: (v) => String(v),
      badge: null,
    },
    {
      key: 'topCombatPotions',
      title: t('analytics_top_combat_potions'),
      Icon: Flask,
      color: '#f59e0b',
      format: (v) => String(v),
      badge: null,
    },
    {
      key: 'topHealthstones',
      title: t('analytics_top_healthstones'),
      Icon: FirstAidKit,
      color: '#22c55e',
      format: (v) => String(v),
      badge: null,
    },
    {
      key: 'topManaPotions',
      title: t('analytics_top_mana_potions'),
      Icon: DropHalf,
      color: '#6366f1',
      format: (v) => String(v),
      badge: null,
    },
    {
      key: 'topAttendance',
      title: t('analytics_top_attendance'),
      Icon: Calendar,
      color: '#34d399',
      format: (v) => String(v),
      badge: t('analytics_raid_attendance'),
    },
  ]

  const activeLeaderboard = LEADERBOARDS.find((lb) => lb.key === openModal)

  const fmtWipePct = (pct) => {
    if (pct == null) return '—'
    return pct.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
  }

  return (
    <div className="space-y-8">
      {/* Guild Leaderboards */}
      <div>
        <h3 className="text-lg text-white mb-4 inline-flex items-center gap-2">
          <UsersThree size={20} className="text-coral" />
          {t('analytics_leaderboards')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LEADERBOARDS.map(({ key, title, Icon, color, format, valueColorFn, badge, showBuffs }) => (
            <LeaderboardCard
              key={key}
              cardKey={key}
              title={title}
              Icon={Icon}
              color={color}
              entries={leaderboards?.[key] || []}
              format={format}
              valueColorFn={valueColorFn}
              badge={badge}
              showBuffs={showBuffs}
              onSeeMore={setOpenModal}
            />
          ))}
        </div>
      </div>

      {/* WCL-style Percentile Matrix — players × bosses */}
      <PercentileMatrix />

      {/* Top-10 modal */}
      {openModal && activeLeaderboard && (
        <LeaderboardModal
          title={activeLeaderboard.title}
          Icon={activeLeaderboard.Icon}
          color={activeLeaderboard.color}
          entries={(leaderboards?.[openModal] || []).map((e) => ({
            ...e,
            extra: activeLeaderboard.extraFn ? activeLeaderboard.extraFn(e) : undefined,
            url: (e.report_code && e.fight_id)
              ? `https://www.warcraftlogs.com/reports/${e.report_code}#fight=${e.fight_id}`
              : undefined,
          }))}
          format={activeLeaderboard.format}
          valueColorFn={activeLeaderboard.valueColorFn}
          badge={activeLeaderboard.badge}
          showBuffs={activeLeaderboard.showBuffs}
          onClose={() => setOpenModal(null)}
        />
      )}
    </div>
  )
}

export default AnalyticsTab
