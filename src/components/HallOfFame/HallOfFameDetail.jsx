import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, CalendarBlank, CaretDown, CaretUp, Sword, Heart, Shield } from '@phosphor-icons/react'
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
  const [showAllItems, setShowAllItems] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [entryRes, parsesRes] = await Promise.all([
          hallOfFameAPI.getById(entryId),
          hallOfFameAPI.getParses(entryId),
        ])
        setEntry(entryRes.data)
        setParses(parsesRes.data || [])
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

  const ITEMS_COLLAPSED = 6

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

              {(entry.joinDate || entry.leaveDate) && (
                <div className="flex items-center justify-center gap-1 text-sm text-lavender/70">
                  <CalendarBlank size={14} />
                  {formatDate(entry.joinDate) && <span>{t('hof_from')} {formatDate(entry.joinDate)}</span>}
                  {formatDate(entry.leaveDate) && <span> {t('hof_until')} {formatDate(entry.leaveDate)}</span>}
                </div>
              )}
            </div>

            {/* Stats — no icons */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-lavender-8 p-3">
                <p className="text-cream font-bold text-lg">{entry.totalBossKills ?? 0}</p>
                <p className="text-lavender/60 text-xs">{t('hof_boss_kills')}</p>
              </div>
              <div className="rounded-xl bg-lavender-8 p-3">
                <p className="text-cream font-bold text-lg">{entry.lifetimeDkpGained ?? 0}</p>
                <p className="text-lavender/60 text-xs">{t('hof_dkp_earned')}</p>
              </div>
              <div className="rounded-xl bg-lavender-8 p-3">
                <p className="text-cream font-bold text-lg">{entry.lifetimeDkpSpent ?? 0}</p>
                <p className="text-lavender/60 text-xs">{t('hof_dkp_spent')}</p>
              </div>
            </div>

            {/* Items won — compact grid, collapsible */}
            {entry.itemsWon?.length > 0 && (
              <div className="border-t border-lavender/10 pt-4">
                <h3 className="text-sm font-semibold text-coral mb-3">{t('hof_items_won')}</h3>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {(showAllItems ? entry.itemsWon : entry.itemsWon.slice(0, ITEMS_COLLAPSED)).map((item, i) => (
                    <div
                      key={i}
                      className="relative group"
                      title={`${item.itemName}${item.winningBid ? ` — ${item.winningBid} DKP` : ''}`}
                    >
                      {item.itemImage ? (
                        <img
                          src={item.itemImage}
                          alt={item.itemName}
                          className="w-full aspect-square rounded border-2 object-cover"
                          style={{ borderColor: RARITY_COLORS[item.itemRarity] || '#666' }}
                        />
                      ) : (
                        <div
                          className="w-full aspect-square rounded border-2 flex items-center justify-center text-[10px] text-cream/50"
                          style={{ borderColor: RARITY_COLORS[item.itemRarity] || '#666' }}
                        >
                          ?
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {entry.itemsWon.length > ITEMS_COLLAPSED && (
                  <button
                    onClick={() => setShowAllItems(!showAllItems)}
                    className="mt-2 text-xs text-lavender/50 hover:text-lavender transition-colors"
                  >
                    {showAllItems
                      ? t('hof_show_less')
                      : `${t('hof_show_all')} (${entry.itemsWon.length})`
                    }
                  </button>
                )}
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
                        <div className="px-4 pb-3 space-y-1">
                          {zone.bosses.map((boss, i) => (
                            <div
                              key={`${boss.bossName}-${boss.difficulty}-${i}`}
                              className="flex items-center gap-3 text-xs py-1.5 border-t border-lavender/5 first:border-t-0"
                            >
                              <RoleIcon role={boss.spec} />
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
                                <span className="text-lavender/50">{boss.totalFights} {t('hof_fights')} · {boss.kills} kills</span>
                              </div>
                              {boss.bestPercentile != null && (
                                <span
                                  className="text-sm font-bold shrink-0 tabular-nums"
                                  style={{ color: getPercentileColor(boss.bestPercentile) }}
                                >
                                  {boss.bestPercentile}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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

const RoleIcon = ({ role }) => {
  const HEALER_SPECS = ['Holy', 'Discipline', 'Restoration', 'Restoration Druid', 'Restoration Shaman', 'Mistweaver', 'Preservation', 'Holy Paladin', 'Holy Priest']
  const TANK_SPECS = ['Protection', 'Protection Warrior', 'Protection Paladin', 'Guardian', 'Blood', 'Brewmaster', 'Vengeance']

  if (HEALER_SPECS.includes(role)) return <Heart size={12} weight="fill" className="text-green-400 shrink-0" />
  if (TANK_SPECS.includes(role)) return <Shield size={12} weight="fill" className="text-blue-400 shrink-0" />
  return <Sword size={12} weight="fill" className="text-red-400 shrink-0" />
}

const getPercentileColor = (pct) => {
  if (pct >= 95) return '#e268a8'
  if (pct >= 75) return '#ff8000'
  if (pct >= 50) return '#a335ee'
  if (pct >= 25) return '#0070dd'
  return '#1eff00'
}

export default HallOfFameDetail
