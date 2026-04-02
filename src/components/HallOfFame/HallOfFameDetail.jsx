import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Sword, Skull, CurrencyCircleDollar, CalendarBlank, Trophy } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { hallOfFameAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import { RARITY_COLORS } from '../../utils/constants'

const HallOfFameDetail = ({ entryId, onClose }) => {
  const { t } = useLanguage()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await hallOfFameAPI.getById(entryId)
        setEntry(res.data)
      } catch {
        /* silent */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [entryId])

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const classColor = entry ? (CLASS_COLORS[entry.characterClass] || '#ffffff') : '#ffffff'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border-2 border-lavender-20 bg-indigo p-6 sm:p-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
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
              <div className="flex justify-center">
                <div
                  className="w-20 h-20 rounded-xl flex items-center justify-center border-2"
                  style={{ borderColor: classColor, backgroundColor: `${classColor}15` }}
                >
                  {entry.avatar ? (
                    <img
                      src={entry.avatar}
                      alt={entry.characterName}
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    <Trophy size={36} className="text-amber-400" weight="fill" />
                  )}
                </div>
              </div>
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
              <div className="flex items-center justify-center gap-3 text-sm text-lavender/70">
                {entry.joinDate && (
                  <span className="flex items-center gap-1">
                    <CalendarBlank size={14} />
                    {t('hof_joined')}: {formatDate(entry.joinDate)}
                  </span>
                )}
                {entry.leaveDate && (
                  <span className="flex items-center gap-1">
                    {t('hof_left')}: {formatDate(entry.leaveDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Sword} value={entry.totalRaids} label={t('hof_raids')} color="text-coral" />
              <StatCard icon={Skull} value={entry.totalBossKills} label={t('hof_boss_kills')} color="text-teal" />
              <StatCard icon={CurrencyCircleDollar} value={entry.lifetimeDkpGained} label={t('hof_dkp_earned')} color="text-amber-400" />
              <StatCard icon={CurrencyCircleDollar} value={entry.lifetimeDkpSpent} label={t('hof_dkp_spent')} color="text-lavender" />
            </div>

            {/* Tribute */}
            <div className="border-t border-lavender/10 pt-4">
              <h3 className="text-sm font-semibold text-coral mb-2">{t('hof_tribute')}</h3>
              <p className="text-cream/80 italic text-sm">
                {entry.tribute ? `"${entry.tribute}"` : t('hof_no_tribute')}
              </p>
            </div>

            {/* Items won */}
            {entry.itemsWon?.length > 0 && (
              <div className="border-t border-lavender/10 pt-4">
                <h3 className="text-sm font-semibold text-coral mb-3">{t('hof_items_won')}</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
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

export default HallOfFameDetail
