import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { analyticsAPI } from '../../services/api'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import {
  CheckCircle, Info, Warning, XCircle,
  Shield, Flask, ChartLine, Wrench,
  CircleNotch, ChartBar, X,
} from '@phosphor-icons/react'

const DIFFICULTY_COLORS = {
  Mythic: '#ff8000', Heroic: '#a335ee', Normal: '#1eff00', LFR: '#0070dd',
}

const SEVERITY_STYLES = {
  positive: { bg: 'bg-green-900/20', border: 'border-green-500/30', Icon: CheckCircle, color: 'text-green-400' },
  info: { bg: 'bg-blue-900/20', border: 'border-blue-500/30', Icon: Info, color: 'text-blue-400' },
  warning: { bg: 'bg-yellow-900/20', border: 'border-yellow-500/30', Icon: Warning, color: 'text-yellow-400' },
  critical: { bg: 'bg-red-900/20', border: 'border-red-500/30', Icon: XCircle, color: 'text-red-400' },
}

const CATEGORY_STYLES = {
  survivability: { Icon: Shield, color: 'text-red-400', label: 'perf_category_survivability' },
  consumables: { Icon: Flask, color: 'text-green-400', label: 'perf_category_consumables' },
  performance: { Icon: ChartLine, color: 'text-blue-400', label: 'perf_category_performance' },
  utility: { Icon: Wrench, color: 'text-purple-400', label: 'perf_category_utility' },
}

const PERIOD_OPTIONS = [
  { value: 4, label: '4s' },
  { value: 8, label: '8s' },
  { value: 12, label: '12s' },
  { value: 52, label: '' }, // "All" — filled with translation
]

const TABS = ['overview', 'bosses', 'trends', 'recommendations']

const PerformanceModal = ({ onClose }) => {
  const { t, lang } = useLanguage()
  const [activeTab, setActiveTab] = useState('overview')
  const [weeks, setWeeks] = useState(8)
  const [selectedBoss, setSelectedBoss] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await analyticsAPI.getMyPerformanceDetail(weeks)
        setData(res.data)
        // Auto-select first boss
        if (res.data?.bossBreakdown?.length > 0 && !selectedBoss) {
          setSelectedBoss(res.data.bossBreakdown[0])
        }
      } catch (err) {
        console.error('Failed to load performance detail:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weeks])

  const tabLabels = {
    overview: t('perf_overview'),
    bosses: t('perf_bosses'),
    trends: t('perf_trends'),
    recommendations: t('perf_recommendations'),
  }

  // Radar data for overview
  const radarData = useMemo(() => {
    if (!data?.summary) return []
    const s = data.summary
    return [
      { axis: 'DPS', value: Math.min(s.dpsVsMedianPct || 0, 150), max: 150 },
      { axis: lang === 'es' ? 'Supervivencia' : 'Survival', value: Math.max(0, 100 - (s.deathRate || 0) * 100), max: 100 },
      { axis: lang === 'es' ? 'Consumibles' : 'Consumables', value: s.consumableScore || 0, max: 100 },
      { axis: lang === 'es' ? 'Utilidad' : 'Utility', value: Math.min((s.avgInterrupts || 0) * 25, 100), max: 100 },
      { axis: lang === 'es' ? 'Consistencia' : 'Consistency', value: s.dpsVsMedianPct > 0 ? Math.min(s.dpsVsMedianPct, 100) : 50, max: 100 },
    ]
  }, [data, lang])

  // Boss-specific fight data for the boss DPS chart
  const bossFightData = useMemo(() => {
    if (!data?.recentFights || !selectedBoss) return []
    return data.recentFights
      .filter(f => f.boss === selectedBoss.bossName && f.difficulty === selectedBoss.difficulty)
      .reverse()
      .map((f, i) => ({
        attempt: i + 1,
        dps: Math.round(f.dps),
        date: f.date,
        deaths: f.deaths,
      }))
  }, [data, selectedBoss])

  // Grouped recommendations by category
  const groupedTips = useMemo(() => {
    if (!data?.recommendations) return {}
    const groups = {}
    for (const tip of data.recommendations) {
      if (!groups[tip.category]) groups[tip.category] = []
      groups[tip.category].push(tip)
    }
    return groups
  }, [data])

  const formatDps = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v)
  const formatDmg = (v) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return v
  }

  const renderOverview = () => {
    if (!data?.summary) return null
    const s = data.summary
    return (
      <div className="space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('perf_avg_dps')} value={formatDps(s.avgDps)} color="text-blue-400" />
          <StatCard label={t('perf_deaths_per_fight')} value={s.deathRate.toFixed(2)} color={s.deathRate <= 0.3 ? 'text-green-400' : s.deathRate <= 0.6 ? 'text-yellow-400' : 'text-red-400'} />
          <StatCard label={t('perf_consumable_score')} value={`${s.consumableScore}`} subValue="/100" color={s.consumableScore >= 70 ? 'text-green-400' : s.consumableScore >= 40 ? 'text-yellow-400' : 'text-red-400'} />
          <StatCard label={t('perf_damage_vs_median')} value={`${s.dpsVsMedianPct.toFixed(0)}%`} color={s.dpsVsMedianPct >= 100 ? 'text-green-400' : s.dpsVsMedianPct >= 80 ? 'text-yellow-400' : 'text-red-400'} />
        </div>

        {/* Radar + top tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Radar chart */}
          <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
            <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider">
              {lang === 'es' ? 'Perfil de Rendimiento' : 'Performance Profile'}
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#4a3a6b" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 3 recommendations */}
          <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
            <p className="text-xs text-lavender mb-3 font-semibold uppercase tracking-wider">
              {lang === 'es' ? 'Recomendaciones Principales' : 'Top Recommendations'}
            </p>
            <div className="space-y-2">
              {(data.recommendations || [])
                .filter(r => r.severity !== 'positive')
                .slice(0, 3)
                .map((tip, i) => {
                  const sev = SEVERITY_STYLES[tip.severity] || SEVERITY_STYLES.info
                  return (
                    <div key={i} className={`p-2.5 rounded-lg ${sev.bg} border ${sev.border} text-xs flex items-start gap-1.5`}>
                      <sev.Icon size={14} className={`${sev.color} flex-shrink-0 mt-0.5`} />
                      <span className="text-white/90">{lang === 'es' ? tip.message : tip.messageEn}</span>
                    </div>
                  )
                })}
              {(data.recommendations || []).filter(r => r.severity !== 'positive').length === 0 && (
                <div className="p-2.5 rounded-lg bg-green-900/20 border border-green-500/30 text-xs flex items-start gap-1.5">
                  <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/90">{lang === 'es' ? 'Todo se ve bien. Sigue así.' : 'Everything looks good. Keep it up.'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Consumable breakdown */}
        <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
          <p className="text-xs text-lavender mb-3 font-semibold uppercase tracking-wider">
            {t('perf_category_consumables')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ConsumableBar label={lang === 'es' ? 'Poción de vida' : 'Health Potion'} pct={s.healthPotionRate} />
            <ConsumableBar label="Healthstone" pct={s.healthstoneRate} />
            <ConsumableBar label={lang === 'es' ? 'Poción de combate' : 'Combat Potion'} pct={s.combatPotionRate} />
            <ConsumableBar label="Flask" pct={s.avgFlaskUptime} />
            <ConsumableBar label={lang === 'es' ? 'Comida' : 'Food'} pct={s.foodRate} />
            <ConsumableBar label="Augment Rune" pct={s.augmentRate} />
          </div>
        </div>
      </div>
    )
  }

  const renderBosses = () => {
    if (!data?.bossBreakdown?.length) {
      return <p className="text-lavender text-sm text-center py-8">{t('perf_no_data')}</p>
    }
    return (
      <div className="space-y-4">
        {/* Boss selector */}
        <div className="flex flex-wrap gap-2">
          {data.bossBreakdown.map((boss, i) => (
            <button
              key={i}
              onClick={() => setSelectedBoss(boss)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                selectedBoss?.bossName === boss.bossName && selectedBoss?.difficulty === boss.difficulty
                  ? 'bg-lavender-12/50 border-lavender-20/50 text-white'
                  : 'bg-lavender-12/15 border-lavender-20/15 text-lavender hover:text-white'
              }`}
            >
              {boss.bossName}
              <span className="ml-1 opacity-60" style={{ color: DIFFICULTY_COLORS[boss.difficulty] }}>({boss.difficulty?.[0]})</span>
            </button>
          ))}
        </div>

        {selectedBoss && (
          <>
            {/* Boss stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('perf_fights')} value={selectedBoss.fights} color="text-blue-400" />
              <StatCard label={t('perf_deaths_per_fight')} value={selectedBoss.deathRate.toFixed(2)} color={selectedBoss.deathRate <= 0.3 ? 'text-green-400' : 'text-red-400'} />
              <StatCard label={t('perf_avg')} value={formatDps(selectedBoss.avgDps)} subValue="DPS" color="text-blue-400" />
              <StatCard label={t('perf_best')} value={formatDps(selectedBoss.bestDps)} subValue="DPS" color="text-green-400" />
            </div>

            {/* DPS over attempts chart */}
            {bossFightData.length > 1 && (
              <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
                <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider">
                  DPS {lang === 'es' ? 'por intento' : 'per attempt'}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bossFightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4a3a6b33" />
                    <XAxis dataKey="attempt" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => formatDps(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1235', border: '1px solid #4a3a6b', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={v => `${lang === 'es' ? 'Intento' : 'Attempt'} #${v}`}
                      formatter={(v, name) => [formatDps(v), 'DPS']}
                    />
                    <Line type="monotone" dataKey="dps" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Boss consumable rates */}
            <div className="grid grid-cols-3 gap-3">
              <ConsumableBar label={lang === 'es' ? 'Poción vida' : 'Health Pot'} pct={selectedBoss.healthPotionRate} />
              <ConsumableBar label="Healthstone" pct={selectedBoss.healthstoneRate} />
              <ConsumableBar label={lang === 'es' ? 'Poción combate' : 'Combat Pot'} pct={selectedBoss.combatPotionRate} />
            </div>

            {/* vs raid median */}
            <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
              <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider">{t('perf_vs_median')}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-lavender w-8">{lang === 'es' ? 'Tú' : 'You'}</span>
                <div className="flex-1 h-5 bg-lavender-12/30 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(selectedBoss.dpsVsMedian || 0, 150)}%`,
                      maxWidth: '100%',
                      backgroundColor: selectedBoss.dpsVsMedian >= 100 ? '#22c55e' : selectedBoss.dpsVsMedian >= 80 ? '#eab308' : '#ef4444',
                    }}
                  ></div>
                  <span className="absolute right-2 top-0.5 text-[10px] text-white font-bold">{(selectedBoss.dpsVsMedian || 0).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderTrends = () => {
    const trends = data?.weeklyTrends || []
    if (trends.length < 2) {
      return <p className="text-lavender text-sm text-center py-8">{t('perf_no_data')}</p>
    }

    const chartData = trends.map(w => ({
      week: w.weekStart?.slice(5), // MM-DD
      dps: Math.round(w.avgDps),
      deaths: parseFloat(w.avgDeaths?.toFixed(2)),
      consumables: Math.round(w.consumableScore || 0),
      fights: w.fights,
    }))

    return (
      <div className="space-y-4">
        {/* DPS trend */}
        <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
          <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider">{t('perf_dps_trend')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="dpsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a3a6b33" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => formatDps(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1235', border: '1px solid #4a3a6b', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [formatDps(v), 'DPS']}
              />
              <Area type="monotone" dataKey="dps" stroke="#60a5fa" fill="url(#dpsFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Deaths trend */}
        <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
          <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider">{t('perf_death_trend')}</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a3a6b33" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1235', border: '1px solid #4a3a6b', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [v, lang === 'es' ? 'Muertes/pelea' : 'Deaths/fight']}
              />
              <Bar dataKey="deaths" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Consumable trend */}
        <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
          <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider">{t('perf_consumable_trend')}</p>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a3a6b33" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1235', border: '1px solid #4a3a6b', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v}`, 'Score']}
              />
              <Line type="monotone" dataKey="consumables" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly summary table */}
        <div className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
          <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider">{t('perf_weekly_summary')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-lavender border-b border-lavender-20/20">
                  <th className="text-left pb-2">{lang === 'es' ? 'Semana' : 'Week'}</th>
                  <th className="text-right pb-2">{t('perf_fights')}</th>
                  <th className="text-right pb-2">DPS</th>
                  <th className="text-right pb-2">{lang === 'es' ? 'Muertes' : 'Deaths'}</th>
                  <th className="text-right pb-2">{lang === 'es' ? 'Consumibles' : 'Consumables'}</th>
                </tr>
              </thead>
              <tbody>
                {trends.slice().reverse().map((w, i) => (
                  <tr key={i} className="border-b border-lavender-20/10">
                    <td className="py-1.5 text-white">{w.weekStart?.slice(5)}</td>
                    <td className="py-1.5 text-right text-lavender">{w.fights}</td>
                    <td className="py-1.5 text-right text-blue-400">
                      {formatDps(w.avgDps)}
                      {w.dpsChange != null && w.dpsChange !== 0 && (
                        <span className={`ml-1 ${w.dpsChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {w.dpsChange > 0 ? '↑' : '↓'}{Math.abs(w.dpsChange)}%
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-red-400">{w.avgDeaths?.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-green-400">{Math.round(w.consumableScore || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderRecommendations = () => {
    if (!data?.recommendations?.length) {
      return <p className="text-lavender text-sm text-center py-8">{t('perf_no_data')}</p>
    }

    const categoryOrder = ['survivability', 'consumables', 'performance', 'utility']

    return (
      <div className="space-y-4">
        {categoryOrder.map(cat => {
          const tips = groupedTips[cat]
          if (!tips?.length) return null
          const style = CATEGORY_STYLES[cat]
          return (
            <div key={cat} className="rounded-xl bg-lavender-12/10 border border-lavender-20/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3 inline-flex items-center gap-1.5">
                <style.Icon size={14} className={style.color} />
                <span className="text-lavender">{t(style.label)}</span>
              </p>
              <div className="space-y-2">
                {tips.map((tip, i) => {
                  const sev = SEVERITY_STYLES[tip.severity] || SEVERITY_STYLES.info
                  return (
                    <div key={i} className={`p-3 rounded-lg ${sev.bg} border ${sev.border}`}>
                      <div className="flex items-start gap-2">
                        <sev.Icon size={14} className={`${sev.color} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 m-0">{lang === 'es' ? tip.message : tip.messageEn}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${sev.color} ${sev.bg}`}>
                          {t(`perf_severity_${tip.severity}`)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <CircleNotch size={30} className="animate-spin text-coral" />
        </div>
      )
    }

    if (!data || data.summary?.totalFights === 0) {
      return <p className="text-lavender text-center py-16">{t('perf_no_data')}</p>
    }

    switch (activeTab) {
      case 'overview': return renderOverview()
      case 'bosses': return renderBosses()
      case 'trends': return renderTrends()
      case 'recommendations': return renderRecommendations()
      default: return null
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-indigo border-2 border-lavender-20/30 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-lavender-20/20">
          <h3 className="text-white text-lg m-0 inline-flex items-center gap-2">
            <ChartBar size={20} className="text-coral" />
            {t('perf_detailed_analysis')}
          </h3>
          <div className="flex items-center gap-3">
            {/* Period selector */}
            <div className="flex bg-lavender-12/30 rounded-lg border border-lavender-20/20 overflow-hidden">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setWeeks(opt.value)}
                  className={`px-3 py-1 text-xs transition-all ${
                    weeks === opt.value ? 'bg-lavender-12 text-white' : 'text-lavender hover:text-white'
                  }`}
                >
                  {opt.value === 52 ? t('perf_all_time') : `${opt.value}${t('perf_weeks_short')}`}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-lavender hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-lavender-20/20 px-5">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm transition-all border-b-2 ${
                activeTab === tab
                  ? 'border-coral text-white'
                  : 'border-transparent text-lavender hover:text-white'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Helper components ──

const StatCard = ({ label, value, subValue, color }) => (
  <div className="text-center p-3 rounded-xl bg-lavender-12/15 border border-lavender-20/10">
    <p className={`text-2xl font-bold m-0 ${color}`}>
      {value}
      {subValue && <span className="text-xs font-normal text-lavender ml-1">{subValue}</span>}
    </p>
    <p className="text-[10px] text-lavender m-0 mt-1">{label}</p>
  </div>
)

const ConsumableBar = ({ label, pct }) => {
  const val = Math.round(pct || 0)
  const color = val >= 80 ? '#22c55e' : val >= 50 ? '#eab308' : '#ef4444'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-lavender truncate">{label}</span>
        <span className="text-[10px] font-bold" style={{ color }}>{val}%</span>
      </div>
      <div className="h-2 bg-lavender-12/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(val, 100)}%`, backgroundColor: color }}></div>
      </div>
    </div>
  )
}

export default PerformanceModal
