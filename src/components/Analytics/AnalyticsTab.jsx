import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { analyticsAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import {
  Crosshair, Heart, Skull, Shield, Lightning, Drop,
  CircleNotch, UsersThree, Trophy, Sparkle, Flask, Calendar,
} from '@phosphor-icons/react'
import LeaderboardModal from './LeaderboardModal'
import ExternalBuffBadge from './ExternalBuffBadge'

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
  if (pct >= 100) return '#e268a8' // Artifact
  if (pct >= 99)  return '#ff8000' // Legendary
  if (pct >= 95)  return '#a335ee' // Epic
  if (pct >= 75)  return '#0070dd' // Rare
  if (pct >= 50)  return '#1eff00' // Uncommon
  return '#9d9d9d'                 // Common
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
  const [loading, setLoading] = useState(true)
  const [myPerformance, setMyPerformance] = useState(null)
  const [leaderboards, setLeaderboards] = useState(null)
  const [openModal, setOpenModal] = useState(null) // key of the open leaderboard modal

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
      key: 'topAttendance',
      title: t('analytics_top_attendance'),
      Icon: Calendar,
      color: '#34d399',
      format: (v) => String(v),
      badge: t('analytics_raid_attendance'),
    },
    {
      key: 'topPercentile',
      title: t('analytics_top_percentile'),
      Icon: Trophy,
      color: '#e268a8',
      format: (v) => `${Math.round(v)}%`,
      valueColorFn: wclColor,
      // extraFn builds "BossName · 15 Feb" shown in the "Ver más" modal
      extraFn: (entry) => {
        if (!entry.boss_name && !entry.fight_date) return null
        const parts = []
        if (entry.boss_name) parts.push(entry.boss_name)
        if (entry.fight_date) {
          const d = new Date(entry.fight_date + 'T00:00:00')
          parts.push(d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))
        }
        return parts.join(' · ')
      },
      badge: t('analytics_best_log'),
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
