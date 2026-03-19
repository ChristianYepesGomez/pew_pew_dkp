import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { analyticsAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import { CircleNotch, Trophy, Sword, Heart, Shield } from '@phosphor-icons/react'

const DIFFICULTY_COLORS = {
  Mythic: '#ff8000',
  Heroic: '#a335ee',
  Normal: '#1eff00',
  LFR: '#0070dd',
}

const wclColor = (pct) => {
  if (pct >= 100) return '#e5cc80'
  if (pct >= 99) return '#e268a8'
  if (pct >= 95) return '#ff8000'
  if (pct >= 75) return '#a335ee'
  if (pct >= 50) return '#0070ff'
  if (pct >= 25) return '#1eff00'
  return '#666666'
}

const RoleIcon = ({ role, size = 14 }) => {
  if (role === 'Healer') return <Heart size={size} weight="fill" className="text-green-400" />
  if (role === 'Tank') return <Shield size={size} weight="fill" className="text-blue-400" />
  return <Sword size={size} weight="fill" className="text-red-400" />
}

const PercentileMatrix = () => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState(null)

  useEffect(() => {
    loadData(selectedDifficulty)
  }, [selectedDifficulty])

  const loadData = async (difficulty) => {
    setLoading(true)
    try {
      const res = await analyticsAPI.getPercentileMatrix(difficulty)
      setData(res.data)
    } catch (err) {
      console.error('Failed to load percentile matrix:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-10">
        <CircleNotch size={28} className="animate-spin text-coral" />
      </div>
    )
  }

  if (!data || !data.players?.length) return null

  const { bosses, players, difficulties } = data

  // Shorten boss names for column headers
  const shortName = (name) => {
    // Take first word or abbreviation for very long names
    if (name.length <= 12) return name
    const words = name.split(/[\s-]+/)
    if (words.length === 1) return name.slice(0, 10) + '…'
    return words.map(w => w[0]).join('')
  }

  return (
    <div className="rounded-xl border border-lavender-20/20 bg-indigo/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg text-white inline-flex items-center gap-2">
          <Trophy size={20} className="text-coral" />
          {t('analytics_percentile_matrix')}
        </h3>

        {/* Difficulty filter */}
        {difficulties?.length > 0 && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setSelectedDifficulty(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                !selectedDifficulty
                  ? 'bg-lavender-20/30 text-white'
                  : 'text-lavender/50 hover:text-lavender/80'
              }`}
            >
              {t('analytics_all_difficulties')}
            </button>
            {difficulties.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDifficulty(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedDifficulty === d
                    ? 'bg-lavender-20/30'
                    : 'text-lavender/50 hover:text-lavender/80'
                }`}
                style={selectedDifficulty === d ? { color: DIFFICULTY_COLORS[d] } : undefined}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-lavender/60 uppercase tracking-wider border-b border-lavender-20/20">
              <th className="text-left pb-3 pr-3 font-semibold sticky left-0 bg-indigo/30 z-10 min-w-[120px]">
                Name
              </th>
              <th className="text-center pb-3 px-1 font-semibold w-12">
                {t('analytics_avg')}
              </th>
              {bosses.map((boss) => (
                <th key={boss.id} className="text-center pb-3 px-1 font-semibold min-w-[60px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] leading-tight" title={boss.name}>
                      {shortName(boss.name)}
                    </span>
                    {boss.kills === 0 && boss.wipes > 0 && boss.bestWipePct != null && (
                      <span className="text-[9px] text-yellow-400/70 font-normal normal-case" title={t('analytics_best_wipe')}>
                        {boss.bestWipePct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-lavender-20/10">
            {players.map((player) => (
              <tr key={player.userId} className="hover:bg-lavender-12/5 transition-colors">
                <td className="py-1.5 pr-3 sticky left-0 bg-indigo/30 z-10">
                  <div className="flex items-center gap-1.5">
                    <RoleIcon role={player.raidRole} />
                    <span
                      className="font-semibold text-xs"
                      style={{ color: CLASS_COLORS[player.characterClass] || '#fff' }}
                    >
                      {player.characterName}
                    </span>
                  </div>
                </td>
                <td className="text-center py-1.5 px-1 tabular-nums">
                  <span
                    className="font-bold text-xs"
                    style={{ color: wclColor(player.avgPercentile) }}
                  >
                    {Math.round(player.avgPercentile)}
                  </span>
                </td>
                {bosses.map((boss) => {
                  const stat = player.bosses[boss.id]
                  if (!stat) {
                    return (
                      <td key={boss.id} className="text-center py-1.5 px-1">
                        <span className="text-lavender/20">—</span>
                      </td>
                    )
                  }
                  return (
                    <td key={boss.id} className="text-center py-1.5 px-1 tabular-nums">
                      <span
                        className="font-bold text-xs"
                        style={{ color: wclColor(stat.bestPct) }}
                        title={`Best: ${stat.bestPct}% | Avg: ${stat.avgPct}% | ${stat.fights} fights`}
                      >
                        {Math.round(stat.bestPct)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PercentileMatrix
