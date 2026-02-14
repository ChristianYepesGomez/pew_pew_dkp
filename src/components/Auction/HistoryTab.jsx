import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { useAuctionHistory } from '../../hooks/useQueries'
import { auctionsAPI } from '../../services/api'
import WowheadTooltip from '../Common/WowheadTooltip'
import { CLASS_COLORS, RARITY_COLORS } from '../../utils/constants'
import { HistorySkeleton } from '../ui/Skeleton'

const HistoryTab = () => {
  const { t, language } = useLanguage()
  const { data: auctions = [], isLoading } = useAuctionHistory()
  const [farewellModal, setFarewellModal] = useState(null)
  const [expandedBids, setExpandedBids] = useState({}) // { auctionId: bidsArray | 'loading' | null }

  const toggleBids = async (auctionId, bidCount) => {
    if (expandedBids[auctionId]) {
      // Collapse
      setExpandedBids(prev => ({ ...prev, [auctionId]: null }))
    } else if (bidCount > 0) {
      // Expand - fetch bids
      setExpandedBids(prev => ({ ...prev, [auctionId]: 'loading' }))
      try {
        const res = await auctionsAPI.getBids(auctionId)
        setExpandedBids(prev => ({ ...prev, [auctionId]: res.data }))
      } catch (err) {
        console.error('Error loading bids:', err)
        setExpandedBids(prev => ({ ...prev, [auctionId]: [] }))
      }
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) return <HistorySkeleton />

  return (
    <div className="info-card">
      <h3><i className="fas fa-history mr-3"></i>{t('auction_history_title')}</h3>

      {auctions.length === 0 ? (
        <p className="text-center text-gray-400 py-8">{t('no_auction_history')}</p>
      ) : (
        <div className="space-y-3 mt-6">
          {auctions.map((a) => {
            // Farewell entry
            if (a.farewell) {
              const fw = a.farewell
              return (
                <div
                  key={a.id}
                  onClick={() => setFarewellModal(a)}
                  className="bg-gradient-to-r from-red-900 to-red-800 bg-opacity-50 rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:from-red-800 hover:to-red-700 transition-all border border-red-500 border-opacity-30"
                >
                  <div className="w-12 h-12 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 border-red-500 flex-shrink-0">
                    <i className="fas fa-door-open text-xl text-red-400"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-cinzel mb-1 truncate" style={{ color: CLASS_COLORS[fw.member?.characterClass] || '#FFF' }}>
                      {fw.member?.characterName}
                    </h5>
                    <p className="text-xs text-red-300 m-0">
                      {t('farewell_left_guild')} &bull; {formatDate(a.ended_at || a.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-red-300 m-0 mb-1">{t('total_spent')}</p>
                      <p className="font-bold text-red-400 m-0">{fw.member?.lifetimeSpent || 0} DKP</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-red-300 m-0 mb-1">{t('items_won')}</p>
                      <p className="font-bold text-yellow-400 m-0">{fw.itemsWon?.length || 0}</p>
                    </div>
                    <i className="fas fa-chevron-right text-red-400 opacity-50"></i>
                  </div>
                </div>
              )
            }

            // Normal auction entry
            const hasWinner = a.status === 'completed' && a.winner
            const bidsData = expandedBids[a.id]
            const isExpanded = bidsData && bidsData !== 'loading'
            const isLoading = bidsData === 'loading'

            return (
              <div key={a.id} className="bg-midnight-spaceblue bg-opacity-50 rounded-lg overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                {/* Item Icon */}
                <WowheadTooltip itemId={a.item_id}>
                  <div
                    className="w-12 h-12 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0 overflow-hidden"
                    style={{ borderColor: RARITY_COLORS[a.item_rarity] || RARITY_COLORS.epic }}
                  >
                    {a.item_image && a.item_image !== '🎁' ? (
                      <img
                        src={a.item_image}
                        alt={a.item_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                      />
                    ) : null}
                    <i
                      className="fas fa-gem text-xl"
                      style={{
                        color: RARITY_COLORS[a.item_rarity] || RARITY_COLORS.epic,
                        display: a.item_image && a.item_image !== '🎁' ? 'none' : 'block'
                      }}
                    ></i>
                  </div>
                </WowheadTooltip>

                {/* Item Name */}
                <div className="flex-1 min-w-0">
                  <h5
                    className="font-cinzel mb-1 truncate"
                    style={{ color: RARITY_COLORS[a.item_rarity] || RARITY_COLORS.epic }}
                  >
                    {a.item_name}
                  </h5>
                  <p className="text-xs text-midnight-silver m-0">
                    {formatDate(a.ended_at || a.created_at)}
                  </p>
                </div>

                {/* Winner & DKP */}
                {hasWinner ? (
                  <div className="flex items-center gap-4">
                    {/* Roll info if it was a tie */}
                    {a.was_tie && a.rolls && (
                      <div className="text-center px-3 py-1 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-lg">
                        <p className="text-xs text-yellow-400 m-0 mb-1">
                          <i className="fas fa-dice mr-1"></i>{t('tie_resolved')}
                        </p>
                        <div className="flex flex-col gap-0.5">
                          {a.rolls.map((roll, idx) => (
                            <p
                              key={idx}
                              className={`text-xs m-0 ${roll.isWinner ? 'text-yellow-400 font-bold' : 'text-gray-500'}`}
                            >
                              <span style={{ color: roll.isWinner ? CLASS_COLORS[roll.characterClass] : undefined }}>
                                {roll.characterName}
                              </span>
                              : {roll.roll}
                              {roll.isWinner && <i className="fas fa-trophy ml-1 text-yellow-400"></i>}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-xs text-midnight-silver m-0 mb-1">{t('winner')}</p>
                      <p
                        className="font-bold m-0 flex items-center justify-end gap-2"
                        style={{ color: CLASS_COLORS[a.winner.characterClass] || '#FFF' }}
                      >
                        {a.winner.characterName}
                        {a.was_tie && (
                          <span className="text-xs text-yellow-400" title={`Roll: ${a.winning_roll}`}>
                            <i className="fas fa-dice"></i> {a.winning_roll}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="text-xs text-midnight-silver m-0 mb-1">{t('dkp_spent')}</p>
                      <p className="font-bold text-red-400 m-0">-{a.winning_bid} DKP</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-midnight-silver m-0">{t('no_winner')}</p>
                  </div>
                )}
              </div>

              {/* Bid count toggle button */}
              {a.bid_count > 0 && (
                <button
                  onClick={() => toggleBids(a.id, a.bid_count)}
                  className="w-full px-4 py-2 text-sm text-midnight-silver hover:text-white hover:bg-midnight-purple hover:bg-opacity-20 transition-colors border-t border-midnight-bright-purple border-opacity-10 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><i className="fas fa-circle-notch fa-spin"></i> {t('loading')}</>
                  ) : isExpanded ? (
                    <><i className="fas fa-chevron-up"></i> {t('hide_bids')}</>
                  ) : (
                    <><i className="fas fa-chevron-down"></i> {t('show_bids')} ({a.bid_count})</>
                  )}
                </button>
              )}

              {/* Expanded bids list */}
              {isExpanded && Array.isArray(bidsData) && bidsData.length > 0 && (
                <div className="border-t border-midnight-bright-purple border-opacity-10 bg-midnight-deepblue bg-opacity-50">
                  <div className="px-4 py-2 space-y-1">
                    {bidsData.map((bid, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between text-sm py-1 ${idx === 0 ? 'text-yellow-400' : 'text-midnight-silver'}`}
                      >
                        <span style={{ color: idx === 0 ? CLASS_COLORS[bid.characterClass] : undefined }}>
                          {idx === 0 && <i className="fas fa-trophy mr-2 text-yellow-400"></i>}
                          {bid.characterName}
                        </span>
                        <span className={idx === 0 ? 'text-red-400 font-bold' : ''}>
                          {bid.amount} DKP
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* Farewell Modal */}
      {farewellModal && createPortal(
        <FarewellModal
          auction={farewellModal}
          onClose={() => setFarewellModal(null)}
          t={t}
          formatDate={formatDate}
        />,
        document.body
      )}
    </div>
  )
}

const FarewellModal = ({ auction, onClose, t, formatDate: _formatDate }) => {
  const fw = auction.farewell
  const member = fw.member
  const items = fw.itemsWon || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-midnight-deepblue border-2 border-red-500 border-opacity-40 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-red-900 to-red-800 border-b border-red-500 border-opacity-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-midnight-deepblue flex items-center justify-center border-2 border-red-500">
                <i className="fas fa-door-open text-2xl text-red-400"></i>
              </div>
              <div>
                <h3 className="text-xl font-cinzel font-bold m-0" style={{ color: CLASS_COLORS[member?.characterClass] || '#FFF' }}>
                  {member?.characterName}
                </h3>
                <p className="text-sm text-red-300 m-0">
                  {member?.characterClass} &bull; {member?.spec || member?.raidRole}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 bg-midnight-purple bg-opacity-20 grid grid-cols-3 gap-4 text-center border-b border-midnight-bright-purple border-opacity-20">
          <div>
            <p className="text-xs text-midnight-silver m-0">{t('total_gained')}</p>
            <p className="text-xl font-bold text-green-400 m-0">{member?.lifetimeGained || 0}</p>
          </div>
          <div>
            <p className="text-xs text-midnight-silver m-0">{t('total_spent')}</p>
            <p className="text-xl font-bold text-red-400 m-0">{member?.lifetimeSpent || 0}</p>
          </div>
          <div>
            <p className="text-xs text-midnight-silver m-0">{t('items_won')}</p>
            <p className="text-xl font-bold text-yellow-400 m-0">{items.length}</p>
          </div>
        </div>

        {/* Items List */}
        <div className="p-4 overflow-auto flex-1">
          {items.length > 0 ? (
            <>
              <h6 className="font-bold mb-3 text-midnight-silver">
                <i className="fas fa-trophy mr-2 text-yellow-400"></i>{t('items_obtained')}
              </h6>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-midnight-purple bg-opacity-20 rounded-lg p-3">
                    <WowheadTooltip itemId={item.item_id}>
                      <div
                        className="w-8 h-8 rounded bg-midnight-deepblue flex items-center justify-center border flex-shrink-0 overflow-hidden"
                        style={{ borderColor: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic }}
                      >
                        {item.item_image && item.item_image !== '🎁' ? (
                          <img src={item.item_image} alt={item.item_name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                        ) : null}
                        <i className="fas fa-gem text-sm" style={{ color: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic, display: item.item_image && item.item_image !== '🎁' ? 'none' : 'block' }}></i>
                      </div>
                    </WowheadTooltip>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold m-0 truncate text-sm" style={{ color: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic }}>
                        {item.item_name}
                      </p>
                    </div>
                    <span className="text-red-400 font-bold text-sm">-{item.winning_bid} DKP</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-gray-500 py-4">{t('no_items_obtained')}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-midnight-bright-purple border-opacity-20 text-center">
          <p className="text-sm text-gray-500 m-0 italic">{t('farewell_message')}</p>
        </div>
      </div>
    </div>
  )
}

export default HistoryTab
