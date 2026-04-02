import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Skull, CurrencyCircleDollar, CalendarBlank, CaretDown, CaretUp, Sword, Lightning } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { hallOfFameAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import { DIFFICULTY_COLORS, RARITY_COLORS } from '../../utils/constants'

const HallOfFameDetail = ({ entryId, onClose }) => {
  const { t } = useLanguage()
  const [entry, setEntry] = useState(null)
  const [parses, setParses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedZone, setExpandedZone] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [entryRes, parsesRes] = await Promise.all([
          hallOfFameAPI.getById(entryId),
          hallOfFameAPI.getParses(entryId),
        ])
        setEntry(entryRes.data)
        setParses(parsesRes.data || [])
        // Auto-expand first zone
        if (parsesRes.data?.length > 0) {
          setExpandedZone(parsesRes.data[0].zoneName)
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [entryId])

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const classColor = entry ? (CLASS_COLORS[entry.characterClass] || '#ffffff') : '#ffffff'

  const toggleZone = (zoneName) => {
    setExpandedZone(prev => prev === zoneName ? null : zoneName)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border-2 border-lavender-20 bg-indigo p-6 sm:p-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-lavender hover:text-cream transition-colors"
        >
          <X size={20} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !entry ? (
          <p className="text-center text-lavender py-8">{t('not_found')}</p>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-3">
              {entry.avatar && (
                <div className="flex justify-center">
                  <div
                    className="w-20 h-20 rounded-xl overflow-hidden border-2"
                    style={{ borderColor: classColor }}
                  >
                    <img
                      src={entry.avatar}
                      alt={entry.characterName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold" style={{ color: classColor }}>
                  {entry.characterName}
                </h2>
                <p className="text-lavender text-sm">
                  {entry.spec && `${entry.spec} `}{entry.characterClass}
                  {entry.raidRole && ` · ${entry.raidRole}`}
                </p>
              </div>

              {/* Dates */}
              {(entry.joinDate || entry.leaveDate) && (
                <div className="flex items-center justify-center gap-1 text-sm text-lavender/70">
                  <CalendarBlank size={14} />
                  {formatDate(entry.joinDate) && <span>{t('hof_from')} {formatDate(entry.joinDate)}</span>}
                  {formatDate(entry.leaveDate) && <span> {t('hof_until')} {formatDate(entry.leaveDate)}</span>}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Skull} value={entry.totalBossKills} label={t('hof_boss_kills')} color="text-teal" />
              <StatCard icon={CurrencyCircleDollar} value={entry.lifetimeDkpGained} label={t('hof_dkp_earned')} color="text-amber-400" />
              <StatCard icon={CurrencyCircleDollar} value={entry.lifetimeDkpSpent} label={t('hof_dkp_spent')} color="text-lavender" />
            </div>

            {/* Items won */}
            {entry.itemsWon?.length > 0 && (
              <div className="border-t border-lavender/10 pt-4">
                <h3 className="text-sm font-semibold text-coral mb-3">{t('hof_items_won')}</h3>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {entry.itemsWon.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      {item.itemImage && (
                        <img
                          src={item.itemImage}
                          alt={item.itemName}
                          className="w-7 h-7 rounded border border-lavender/20"
                        />
                      )}
                      <span
                        className="flex-1 truncate"
                        style={{ color: RARITY_COLORS[item.itemRarity] || '#ffffff' }}
                      >
                        {item.itemName}
                      </span>
                      {item.winningBid > 0 && (
                        <span className="text-amber-400 text-xs shrink-0">{item.winningBid} DKP</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parses by raid */}
            {parses.length > 0 && (
              <div className="border-t border-lavender/10 pt-4">
                <h3 className="text-sm font-semibold text-coral mb-3">{t('hof_best_parses')}</h3>
                <div className="space-y-2">
                  {parses.map((zone) => (
                    <div key={zone.zoneName} className="rounded-xl bg-lavender-8 overflow-hidden">
                      <button
                        onClick={() => toggleZone(zone.zoneName)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-cream hover:bg-lavender-12 transition-colors"
                      >
                        <span>{zone.zoneName}</span>
                        {expandedZone === zone.zoneName
                          ? <CaretUp size={16} className="text-lavender" />
                          : <CaretDown size={16} className="text-lavender" />
                        }
                      </button>

                      {expandedZone === zone.zoneName && (
                        <div className="px-4 pb-3 space-y-2">
                          {zone.bosses.map((boss, i) => (
                            <div
                              key={`${boss.bossName}-${boss.difficulty}-${i}`}
                              className="flex items-center gap-3 text-xs py-1.5 border-t border-lavender/5 first:border-t-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-cream font-medium truncate">{boss.bossName}</span>
                                  <span
                                    className="text-[10px] font-bold shrink-0"
                                    style={{ color: DIFFICULTY_COLORS[boss.difficulty] || '#ffffff' }}
                                  >
                                    {boss.difficulty}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-lavender/60">
                                  <span>{boss.totalFights} {t('hof_fights')} · {boss.kills} kills</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 space-y-0.5">
                                <div className="flex items-center gap-1 justify-end">
                                  <Sword size={10} className="text-coral" />
                                  <span className="text-cream font-bold">{(boss.bestDps / 1000).toFixed(1)}k</span>
                                </div>
                                {boss.bestHps > 0 && (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Lightning size={10} className="text-teal" />
                                    <span className="text-cream">{(boss.bestHps / 1000).toFixed(1)}k</span>
                                  </div>
                                )}
                                {boss.bestPercentile != null && (
                                  <div className="text-[10px]" style={{ color: getPercentileColor(boss.bestPercentile) }}>
                                    {boss.bestPercentile}%
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Added by */}
            {entry.addedByName && (
              <p className="text-lavender/40 text-xs text-center">
                {t('hof_added_by')}: {entry.addedByName}
              </p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div className="rounded-xl bg-lavender-8 p-3 text-center">
    <Icon size={20} className={`mx-auto mb-1 ${color}`} />
    <p className="text-cream font-bold text-lg">{value ?? 0}</p>
    <p className="text-lavender/60 text-xs">{label}</p>
  </div>
)

const getPercentileColor = (pct) => {
  if (pct >= 95) return '#e268a8' // pink (legendary parse)
  if (pct >= 75) return '#ff8000' // orange
  if (pct >= 50) return '#a335ee' // purple
  if (pct >= 25) return '#0070dd' // blue
  return '#1eff00' // green
}

export default HallOfFameDetail
