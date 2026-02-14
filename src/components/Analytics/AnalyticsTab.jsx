import { useState, useMemo } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { useAuth } from '../../hooks/useAuth'
import { useAnalytics } from '../../hooks/useQueries'
import { CLASS_COLORS, DIFFICULTY_COLORS } from '../../utils/constants'
import ReportLinks from './ReportLinks'
import PerformanceModal from './PerformanceModal'
import { AnalyticsSkeleton } from '../ui/Skeleton'

const PERIOD_OPTIONS = [
  { value: 4, label: '4w' },
  { value: 8, label: '8w' },
  { value: 12, label: '12w' },
]

const SUPERLATIVE_CONFIG = [
  { key: 'top_dps', icon: 'fa-crosshairs', color: '#ef4444', format: (v) => `${(v / 1000).toFixed(1)}K` },
  { key: 'top_hps', icon: 'fa-heart', color: '#22c55e', format: (v) => `${(v / 1000).toFixed(1)}K` },
  { key: 'most_deaths', icon: 'fa-skull', color: '#9ca3af', format: (v) => v },
  { key: 'most_fights', icon: 'fa-swords', color: '#3b82f6', format: (v) => v },
  { key: 'most_damage_taken', icon: 'fa-shield-alt', color: '#f59e0b', format: (v) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return v
  }},
]

const AnalyticsTab = () => {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [period, setPeriod] = useState(8)
  const [showPerformanceModal, setShowPerformanceModal] = useState(false)

  const { data: analyticsData, isLoading: loading } = useAnalytics(period)
  const economy = analyticsData?.economy ?? null
  const attendance = analyticsData?.attendance ?? null
  const superlatives = analyticsData?.superlatives ?? null
  const progression = analyticsData?.progression ?? []
  const myPerformance = analyticsData?.myPerformance ?? null
  const guildInsights = analyticsData?.guildInsights ?? null

  // Attendance ranking sorted by %
  const attendanceRanking = useMemo(() => {
    if (!attendance?.members || !attendance.totalRaidDays) return []
    return attendance.members
      .map(m => ({
        ...m,
        pct: attendance.totalRaidDays > 0
          ? Math.round((m.confirmed / attendance.totalRaidDays) * 100)
          : 0,
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [attendance])

  if (loading) {
    return <AnalyticsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-cinzel text-lg text-white m-0">
          <i className="fas fa-chart-line mr-2 text-midnight-glow"></i>{t('analytics_title')}
        </h3>
        <div className="flex bg-midnight-deepblue rounded-lg border border-midnight-bright-purple border-opacity-30 overflow-hidden">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-4 py-1.5 text-sm transition-all ${
                period === opt.value ? 'bg-midnight-purple text-white' : 'text-midnight-silver hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ROW 1: My Performance + Guild Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Performance */}
        {myPerformance && (
          <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-cinzel text-sm text-midnight-silver m-0">
                <i className="fas fa-user-chart mr-2 text-blue-400"></i>{t('analytics_my_performance')}
              </h4>
              {myPerformance.totalFights > 0 && (
                <button
                  onClick={() => setShowPerformanceModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-midnight-purple bg-opacity-40 text-midnight-glow border border-midnight-bright-purple border-opacity-30 hover:bg-opacity-60 transition-all"
                >
                  <i className="fas fa-chart-bar mr-1"></i>{t('perf_detailed_analysis')}
                </button>
              )}
            </div>
            {/* Overview stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                <p className="text-2xl font-bold text-blue-400 m-0">{myPerformance.totalFights}</p>
                <p className="text-xs text-midnight-silver m-0">{t('analytics_fights')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                <p className="text-2xl font-bold text-red-400 m-0">{myPerformance.totalDeaths}</p>
                <p className="text-xs text-midnight-silver m-0">{t('analytics_deaths')}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                <p className={`text-2xl font-bold m-0 ${myPerformance.deathsPerFight <= 0.3 ? 'text-green-400' : myPerformance.deathsPerFight <= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {myPerformance.deathsPerFight?.toFixed(2)}
                </p>
                <p className="text-xs text-midnight-silver m-0">{t('analytics_deaths_per_fight')}</p>
              </div>
            </div>
            {/* Boss breakdown */}
            {myPerformance.bossBreakdown?.length > 0 && (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto mb-4">
                <p className="text-xs text-midnight-silver mb-2 font-semibold uppercase tracking-wider">{t('analytics_per_boss')}</p>
                {myPerformance.bossBreakdown.map((boss, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-midnight-purple bg-opacity-10 text-xs">
                    <span className="font-bold text-white flex-1 min-w-0 truncate">
                      {boss.bossName}
                      <span className="ml-1 opacity-50" style={{ color: DIFFICULTY_COLORS[boss.difficulty] }}>({boss.difficulty?.[0]})</span>
                    </span>
                    <span className="text-blue-400 flex-shrink-0">{boss.fights}F</span>
                    <span className="text-red-400 flex-shrink-0">{boss.deaths}D</span>
                    {boss.bestDps > 0 && (
                      <span className="text-green-400 flex-shrink-0">{(boss.bestDps / 1000).toFixed(1)}K</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Recent reports */}
            {myPerformance.recentReports?.length > 0 && (
              <div>
                <p className="text-xs text-midnight-silver mb-2 font-semibold uppercase tracking-wider">{t('analytics_recent_reports')}</p>
                <div className="space-y-1.5">
                  {myPerformance.recentReports.slice(0, 5).map((report, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-midnight-purple bg-opacity-10">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white m-0 truncate">{report.title}</p>
                        <p className="text-[10px] text-midnight-silver m-0">{new Date(report.date).toLocaleDateString()}</p>
                      </div>
                      <ReportLinks reportCode={report.code} characterName={user?.character_name} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {myPerformance.totalFights === 0 && (
              <p className="text-midnight-silver text-sm text-center py-4">{t('analytics_no_data')}</p>
            )}
          </div>
        )}

        {/* Guild Insights */}
        {guildInsights && (
          <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
            <h4 className="font-cinzel text-sm text-midnight-silver mb-4">
              <i className="fas fa-users-cog mr-2 text-purple-400"></i>{t('analytics_guild_insights')}
            </h4>
            {/* Raid Health */}
            {guildInsights.raidHealth && (
              <div className="mb-4">
                <p className="text-xs text-midnight-silver mb-2 font-semibold uppercase tracking-wider">{t('analytics_raid_health')}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                    <p className="text-2xl font-bold text-green-400 m-0">{guildInsights.raidHealth.totalKills}</p>
                    <p className="text-xs text-midnight-silver m-0">{t('analytics_kills')}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                    <p className="text-2xl font-bold text-red-400 m-0">{guildInsights.raidHealth.totalWipes}</p>
                    <p className="text-xs text-midnight-silver m-0">{t('analytics_wipes')}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                    <p className={`text-2xl font-bold m-0 ${guildInsights.raidHealth.killRate >= 0.6 ? 'text-green-400' : guildInsights.raidHealth.killRate >= 0.3 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {Math.round(guildInsights.raidHealth.killRate * 100)}%
                    </p>
                    <p className="text-xs text-midnight-silver m-0">{t('analytics_kill_rate')}</p>
                  </div>
                </div>
              </div>
            )}
            {/* Top Performers */}
            {guildInsights.topPerformers?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-midnight-silver mb-2 font-semibold uppercase tracking-wider">
                  <i className="fas fa-medal mr-1 text-yellow-400"></i>{t('analytics_top_performers')}
                </p>
                <div className="space-y-1">
                  {guildInsights.topPerformers.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-midnight-silver">{i + 1}.</span>
                      <span className="font-bold" style={{ color: CLASS_COLORS[p.class] || '#fff' }}>{p.name}</span>
                      <span className="text-green-400 ml-auto">{(p.avgDps / 1000).toFixed(1)}K avg</span>
                      <span className="text-midnight-silver">{p.fights}F</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Death Leaders */}
            {guildInsights.deathLeaders?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-midnight-silver mb-2 font-semibold uppercase tracking-wider">
                  <i className="fas fa-skull mr-1 text-red-400"></i>{t('analytics_death_leaders')}
                </p>
                <div className="space-y-1">
                  {guildInsights.deathLeaders.slice(0, 5).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-midnight-silver">{i + 1}.</span>
                      <span className="font-bold" style={{ color: CLASS_COLORS[d.class] || '#fff' }}>{d.name}</span>
                      <span className="text-red-400 ml-auto">{d.totalDeaths}D</span>
                      <span className="text-midnight-silver">{d.deathsPerFight?.toFixed(2)}/F</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Recent Reports */}
            {guildInsights.recentReports?.length > 0 && (
              <div>
                <p className="text-xs text-midnight-silver mb-2 font-semibold uppercase tracking-wider">{t('analytics_recent_reports')}</p>
                <div className="space-y-1.5">
                  {guildInsights.recentReports.slice(0, 3).map((report, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-midnight-purple bg-opacity-10">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white m-0 truncate">{report.title}</p>
                        <p className="text-[10px] text-midnight-silver m-0">{new Date(report.date).toLocaleDateString()}</p>
                      </div>
                      <ReportLinks reportCode={report.code} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ROW 2: Guild Records + Raid Progression */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guild Records */}
        <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
          <h4 className="font-cinzel text-sm text-midnight-silver mb-4">
            <i className="fas fa-trophy mr-2 text-yellow-400"></i>{t('analytics_guild_records')}
          </h4>
          {superlatives ? (
            <div className="space-y-3">
              {SUPERLATIVE_CONFIG.map(({ key, icon, color, format }) => {
                const entry = superlatives[key]
                if (!entry) return null
                return (
                  <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-midnight-purple bg-opacity-15 border border-midnight-bright-purple border-opacity-10">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                      <i className={`fas ${icon}`} style={{ color }}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-midnight-silver m-0">{t(`analytics_${key}`)}</p>
                      <p className="text-sm font-bold m-0" style={{ color: CLASS_COLORS[entry.character_class] || '#fff' }}>
                        {entry.character_name}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold m-0" style={{ color }}>{format(entry.value)}</p>
                      {entry.boss_name && (
                        <p className="text-xs text-midnight-silver m-0 truncate max-w-[120px]">
                          {entry.boss_name}
                          {entry.difficulty && <span className="ml-1 opacity-60" style={{ color: DIFFICULTY_COLORS[entry.difficulty] }}>({entry.difficulty[0]})</span>}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              {Object.keys(superlatives).length === 0 && (
                <p className="text-midnight-silver text-sm text-center py-4">{t('analytics_no_data')}</p>
              )}
            </div>
          ) : (
            <p className="text-midnight-silver text-sm text-center py-8">{t('analytics_no_data')}</p>
          )}
        </div>

        {/* Raid Progression */}
        <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
          <h4 className="font-cinzel text-sm text-midnight-silver mb-4">
            <i className="fas fa-dungeon mr-2 text-orange-400"></i>{t('analytics_progression')}
          </h4>
          {progression.length > 0 ? (
            <div className="space-y-6">
              {progression.map(diff => (
                <div key={diff.difficulty}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm" style={{ color: DIFFICULTY_COLORS[diff.difficulty] || '#fff' }}>
                      {diff.difficulty}
                    </span>
                    <span className="text-sm" style={{ color: DIFFICULTY_COLORS[diff.difficulty] || '#fff' }}>
                      {diff.bosses_killed}/{diff.boss_count}
                    </span>
                  </div>
                  <div className="h-3 bg-midnight-purple bg-opacity-30 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(diff.bosses_killed / diff.boss_count) * 100}%`,
                        backgroundColor: DIFFICULTY_COLORS[diff.difficulty] || '#fff',
                      }}
                    ></div>
                  </div>
                  <div className="space-y-1">
                    {diff.bosses.map((boss, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <i className={`fas ${boss.total_kills > 0 ? 'fa-skull-crossbones text-green-400' : 'fa-times text-red-400'} w-4 text-center`}></i>
                        <span className={boss.total_kills > 0 ? 'text-white' : 'text-midnight-silver'}>
                          {boss.boss_name}
                        </span>
                        {boss.total_kills === 0 && boss.total_wipes > 0 && (
                          <span className="text-red-400 ml-auto text-xs">{boss.total_wipes}W</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-midnight-silver text-sm text-center py-8">{t('analytics_no_data')}</p>
          )}
        </div>
      </div>

      {/* ROW 3: Economy + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economy Cards */}
        <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
          <h4 className="font-cinzel text-sm text-midnight-silver mb-4">
            <i className="fas fa-coins mr-2 text-yellow-400"></i>{t('analytics_economy')}
          </h4>
          {economy && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                  <p className="text-2xl font-bold text-yellow-400 m-0">{Math.round(economy.total_circulation)}</p>
                  <p className="text-xs text-midnight-silver m-0">{t('analytics_total_dkp')}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                  <p className="text-2xl font-bold text-green-400 m-0">{Math.round(economy.avg_dkp)}</p>
                  <p className="text-xs text-midnight-silver m-0">{t('analytics_avg_dkp')}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-midnight-purple bg-opacity-20">
                  <p className="text-2xl font-bold text-blue-400 m-0">{economy.member_count}</p>
                  <p className="text-xs text-midnight-silver m-0">{t('analytics_members')}</p>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-midnight-silver">
                <span><i className="fas fa-arrow-up text-green-400 mr-1"></i>{t('analytics_this_week')}: +{economy.gained_this_week}</span>
                <span><i className="fas fa-arrow-down text-red-400 mr-1"></i>{t('analytics_spent_week')}: -{economy.spent_this_week}</span>
              </div>
              {/* Top 5 */}
              {economy.topMembers?.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-midnight-silver mb-2">{t('analytics_top_dkp')}</p>
                  {economy.topMembers.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-xs text-midnight-silver">{i + 1}.</span>
                      <span style={{ color: CLASS_COLORS[m.character_class] || '#fff' }}>{m.character_name}</span>
                      <span className="text-yellow-400 ml-auto font-bold">{m.current_dkp}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Attendance Ranking */}
        <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
          <h4 className="font-cinzel text-sm text-midnight-silver mb-4">
            <i className="fas fa-calendar-check mr-2 text-green-400"></i>{t('analytics_attendance')}
            {attendance && <span className="text-xs ml-2 opacity-60">({attendance.totalRaidDays} {t('analytics_raid_days')})</span>}
          </h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {attendanceRanking.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="w-5 text-xs text-midnight-silver flex-shrink-0">{i + 1}.</span>
                <span
                  className="text-sm flex-shrink-0 min-w-[100px] truncate"
                  style={{ color: CLASS_COLORS[m.character_class] || '#fff' }}
                >
                  {m.character_name}
                </span>
                <div className="flex-1 h-4 bg-midnight-purple bg-opacity-30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${m.pct}%`,
                      backgroundColor: m.pct >= 80 ? '#22c55e' : m.pct >= 50 ? '#eab308' : '#ef4444',
                    }}
                  ></div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 w-12 text-right ${
                  m.pct >= 80 ? 'text-green-400' : m.pct >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {m.pct}%
                </span>
              </div>
            ))}
            {attendanceRanking.length === 0 && (
              <p className="text-midnight-silver text-sm text-center py-4">{t('analytics_no_data')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Performance Analysis Modal */}
      {showPerformanceModal && (
        <PerformanceModal onClose={() => setShowPerformanceModal(false)} />
      )}
    </div>
  )
}

export default AnalyticsTab
