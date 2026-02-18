import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { analyticsAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import {
  Crosshair, Heart, Skull, Shield, Lightning, Drop,
  CircleNotch, UsersThree,
} from '@phosphor-icons/react'

const DIFFICULTY_COLORS = {
  Mythic: '#ff8000',
  Heroic: '#a335ee',
  Normal: '#1eff00',
  LFR: '#0070dd',
}

// Gold / Silver / Bronze
const POSITION_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']

// WoW-style number formatting: 125348 → "125.3K", 1234567 → "1.23M"
const fmtWow = (n) => {
  if (!n || isNaN(n)) return '—'
  const v = Number(n)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(Math.round(v))
}

const LeaderboardCard = ({ title, Icon, color, entries, format, badge }) => (
  <div className="rounded-xl border border-lavender-20/20 bg-indigo/30 p-5">
    <h4 className="text-sm text-lavender mb-4 inline-flex items-center gap-2">
      <Icon size={16} style={{ color }} />
      {title}
      {badge && <span className="text-xs text-lavender/40 ml-1">({badge})</span>}
    </h4>
    {entries?.length > 0 ? (
      <div className="space-y-3">
        {entries.map((entry, i) => (
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
            <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color }}>
              {format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-lavender/40 text-sm text-center py-4">—</p>
    )}
  </div>
)

const AnalyticsTab = () => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [myPerformance, setMyPerformance] = useState(null)
  const [leaderboards, setLeaderboards] = useState(null)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        const [perfRes, lbRes] = await Promise.all([
          analyticsAPI.getMyPerformance().catch(() => ({ data: null })),
          analyticsAPI.getGuildLeaderboards().catch(() => ({ data: null })),
        ])
        setMyPerformance(perfRes.data)
        setLeaderboards(lbRes.data)
      } catch (err) {
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <CircleNotch size={36} className="animate-spin text-coral" />
      </div>
    )
  }

  const myBosses = myPerformance?.bossBreakdown || []

  const LEADERBOARDS = [
    {
      key: 'topDps',
      title: t('analytics_top_dps'),
      Icon: Crosshair,
      color: '#ef4444',
      format: (v) => `${fmtWow(v)} DPS`,
      badge: t('analytics_avg'),
    },
    {
      key: 'topHps',
      title: t('analytics_top_hps'),
      Icon: Heart,
      color: '#22c55e',
      format: (v) => `${fmtWow(v)} HPS`,
      badge: t('analytics_avg'),
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
      format: (v) => `${fmtWow(v)}/fight`,
      badge: t('analytics_excl_tanks'),
    },
    {
      // Health potions: currently tracks "Algari Healing Potion" (TWW).
      // TODO Midnight: add new healing potion name to CONSUMABLE_PATTERNS.healthPotion in warcraftlogs.js
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
  ]

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
          {LEADERBOARDS.map(({ key, title, Icon, color, format, badge }) => (
            <LeaderboardCard
              key={key}
              title={title}
              Icon={Icon}
              color={color}
              entries={leaderboards?.[key] || []}
              format={format}
              badge={badge}
            />
          ))}
        </div>
      </div>

      {/* My Performance — boss table (no title) */}
      {myBosses.length > 0 && (
        <div className="rounded-xl border border-lavender-20/20 bg-indigo/30 p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-lavender/60 uppercase tracking-wider border-b border-lavender-20/20">
                  <th className="text-left pb-3 font-semibold pr-4">Boss</th>
                  <th className="text-center pb-3 font-semibold w-16">{t('analytics_fights')}</th>
                  <th className="text-center pb-3 font-semibold w-24">
                    {t('analytics_kills')} / {t('analytics_wipes')}
                  </th>
                  <th className="text-center pb-3 font-semibold w-20">{t('analytics_deaths')}</th>
                  <th className="text-right pb-3 font-semibold w-28">Best</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lavender-20/10">
                {myBosses.map((boss, i) => (
                  <tr key={i} className="hover:bg-lavender-12/5 transition-colors">
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold text-white">{boss.bossName}</span>
                      <span
                        className="ml-2 text-xs"
                        style={{ color: DIFFICULTY_COLORS[boss.difficulty], opacity: 0.8 }}
                      >
                        ({boss.difficulty?.[0]})
                      </span>
                    </td>
                    <td className="text-center text-lavender py-2.5 tabular-nums">{boss.fights}</td>
                    <td className="text-center py-2.5 tabular-nums">
                      {boss.guildKills != null ? (
                        <>
                          <span className="text-green-400 font-bold">{boss.guildKills}</span>
                          <span className="text-lavender/40 mx-1">/</span>
                          <span className="text-red-400">{boss.guildWipes}</span>
                        </>
                      ) : (
                        <span className="text-lavender/30">—</span>
                      )}
                    </td>
                    <td className="text-center py-2.5 tabular-nums">
                      <span className={`font-bold ${boss.deaths > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {boss.deaths}
                      </span>
                    </td>
                    <td className="text-right py-2.5 tabular-nums">
                      {boss.bestWipePercent != null ? (
                        <span className="text-yellow-400 font-bold text-xs">{fmtWipePct(boss.bestWipePercent)}</span>
                      ) : (
                        <span className="text-lavender/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsTab
