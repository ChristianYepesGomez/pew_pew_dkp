import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { useSocket } from '../../hooks/useSocket'
import { auctionsAPI } from '../../services/api'
import WowheadTooltip from '../Common/WowheadTooltip'
import CLASS_COLORS from '../../utils/classColors'
import RARITY_COLORS from '../../utils/rarityColors'
import {
  X,
  CheckCircle,
  Package,
  CircleNotch,
  Diamond,
  ArrowRight,
  Trophy,
} from '@phosphor-icons/react'

const DistributionQueue = ({ onClose }) => {
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [distributing, setDistributing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const loadQueue = useCallback(async () => {
    try {
      const response = await auctionsAPI.getDistributionQueue()
      setItems(response.data || [])
    } catch (err) {
      console.error('Error loading distribution queue:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Listen for real-time updates (new auction ended → new item in queue)
  useSocket({
    auction_ended: loadQueue,
    item_distributed: loadQueue,
  })

  const handleDistribute = async () => {
    const item = items[currentIndex]
    if (!item || distributing) return

    setDistributing(true)
    try {
      await auctionsAPI.distribute(item.auctionId)
      // Remove distributed item and keep index valid
      setItems(prev => {
        const next = prev.filter((_, i) => i !== currentIndex)
        if (currentIndex >= next.length && next.length > 0) {
          setCurrentIndex(next.length - 1)
        }
        return next
      })
    } catch (err) {
      console.error('Error distributing item:', err)
    } finally {
      setDistributing(false)
    }
  }

  const currentItem = items[currentIndex]
  const remaining = items.length

  return createPortal(
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-lavender-12 border-b border-lavender-20/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-indigo flex items-center justify-center border-2 border-teal">
                <Package size={22} weight="fill" className="text-teal" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-cream m-0">{t('distribution_queue')}</h3>
                <p className="text-xs text-lavender m-0">{t('distribution_queue_subtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-lavender transition-colors hover:text-cream">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center">
              <CircleNotch size={40} className="animate-spin text-coral mx-auto" />
            </div>
          ) : remaining === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle size={48} className="text-teal mx-auto mb-3" />
              <p className="text-lavender text-lg">{t('no_items_to_distribute')}</p>
            </div>
          ) : (
            <>
              {/* Counter */}
              <div className="text-center mb-5">
                <span className="inline-flex items-center gap-2 bg-lavender-12/40 rounded-full px-4 py-1.5 text-sm">
                  <span className="font-bold text-coral">{currentIndex + 1}</span>
                  <span className="text-lavender">/</span>
                  <span className="text-cream">{remaining}</span>
                  <span className="text-lavender">{t('items_remaining')}</span>
                </span>
              </div>

              {/* Current Item Card */}
              {currentItem && (
                <div
                  className="rounded-xl border-2 p-5 transition-all"
                  style={{ borderColor: RARITY_COLORS[currentItem.itemRarity] + '80' }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    {/* Item Icon */}
                    <WowheadTooltip itemId={currentItem.itemId}>
                      <div
                        className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-indigo"
                        style={{ borderColor: RARITY_COLORS[currentItem.itemRarity] }}
                      >
                        {currentItem.itemImage && currentItem.itemImage !== '\uD83C\uDF81' ? (
                          <img src={currentItem.itemImage} alt={currentItem.itemName} className="h-full w-full object-cover" />
                        ) : (
                          <Diamond size={32} weight="fill" style={{ color: RARITY_COLORS[currentItem.itemRarity] }} className="mx-auto mt-4" />
                        )}
                      </div>
                    </WowheadTooltip>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xl font-bold m-0 truncate" style={{ color: RARITY_COLORS[currentItem.itemRarity] }}>
                        {currentItem.itemName}
                      </h4>
                      <p className="text-sm text-lavender m-0 mt-1">
                        {currentItem.winningBid} DKP
                      </p>
                    </div>
                  </div>

                  {/* Winner */}
                  <div className="bg-lavender-12/30 rounded-lg p-4 flex items-center gap-3">
                    <Trophy size={20} weight="fill" className="text-yellow-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-lavender m-0 mb-0.5">{t('winner')}</p>
                      <p
                        className="text-lg font-bold m-0"
                        style={{ color: CLASS_COLORS[currentItem.winner.characterClass] || '#FFF' }}
                      >
                        {currentItem.winner.characterName}
                      </p>
                    </div>
                    <ArrowRight size={20} className="text-lavender/50" />
                  </div>
                </div>
              )}

              {/* Distribute Button */}
              <button
                onClick={handleDistribute}
                disabled={distributing}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-teal text-indigo font-bold py-4 rounded-xl text-lg transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {distributing ? (
                  <CircleNotch size={22} className="animate-spin" />
                ) : (
                  <CheckCircle size={22} weight="fill" />
                )}
                {t('distribute_item')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DistributionQueue
