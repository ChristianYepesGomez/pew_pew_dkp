import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { auctionsAPI } from '../../services/api'
import CreateAuctionModal from './CreateAuctionModal'
import BidModal from './BidModal'

const RARITY_COLORS = {
  common: '#9D9D9D',
  uncommon: '#1EFF00',
  rare: '#0070DD',
  epic: '#A335EE',
  legendary: '#FF8000',
}

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
}

const AuctionTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [auctions, setAuctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [bidModal, setBidModal] = useState({ open: false, auction: null })
  const isAdmin = user?.role === 'admin' || user?.role === 'officer'

  const loadAuctions = async () => {
    try {
      const response = await auctionsAPI.getActive()
      setAuctions(response.data?.auctions || [])
    } catch (error) {
      setAuctions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAuctions() }, [])
  useSocket({
    auction_started: loadAuctions,
    auction_ended: loadAuctions,
    bid_placed: loadAuctions,
    auction_cancelled: loadAuctions
  })

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    loadAuctions()
  }

  const handleBidSuccess = () => {
    setBidModal({ open: false, auction: null })
    loadAuctions()
  }

  const handleEnd = async (auctionId) => {
    if (!confirm(t('confirm'))) return
    try {
      await auctionsAPI.end(auctionId)
      loadAuctions()
    } catch (error) {
      alert(error.response?.data?.error || t('error'))
    }
  }

  const handleCancel = async (auctionId) => {
    if (!confirm(t('confirm_cancel_auction'))) return
    try {
      await auctionsAPI.cancel(auctionId)
      loadAuctions()
    } catch (error) {
      alert(error.response?.data?.error || t('error'))
    }
  }

  if (loading) return <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i></div>

  return (
    <div className="info-card">
      <div className="flex justify-between items-center mb-6">
        <h3 className="mb-0"><i className="fas fa-gavel mr-3"></i>{t('active_auction_title')}</h3>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white rounded-lg hover:shadow-lg flex items-center gap-2"
          >
            <i className="fas fa-plus-circle"></i>{t('create_auction')}
          </button>
        )}
      </div>

      {auctions.length === 0 ? (
        <p className="text-center text-gray-400 py-8">{t('no_active_auction')}</p>
      ) : (
        <div className="space-y-4">
          {auctions.map((auction) => (
            <div key={auction.id} className="bg-gradient-to-r from-purple-900 to-purple-800 rounded-xl p-6 border border-purple-600 border-opacity-50">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Item Info */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2" style={{ borderColor: RARITY_COLORS[auction.itemRarity] }}>
                    <i className="fas fa-gem text-3xl" style={{ color: RARITY_COLORS[auction.itemRarity] }}></i>
                  </div>
                  <div>
                    <h4 className="text-xl font-cinzel mb-1" style={{ color: RARITY_COLORS[auction.itemRarity] }}>
                      {auction.itemName}
                    </h4>
                    <p className="text-sm text-midnight-silver m-0">
                      {t('created_by')}: {auction.createdByName}
                    </p>
                  </div>
                </div>

                {/* Bid Info */}
                <div className="flex flex-wrap items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm text-midnight-silver m-0">{t('min_bid')}</p>
                    <p className="text-xl font-bold text-midnight-glow m-0">{auction.minimumBid} DKP</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-midnight-silver m-0">{t('current_bid')}</p>
                    <p className="text-2xl font-bold text-green-400 m-0">{auction.currentBid || auction.minimumBid} DKP</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-midnight-silver m-0">{t('bids')}</p>
                    <p className="text-xl font-bold text-midnight-glow m-0">{auction.bidsCount}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setBidModal({ open: true, auction })}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2"
                  >
                    <i className="fas fa-hand-holding-usd"></i>
                    {t('place_bid')}
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleEnd(auction.id)}
                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                        title={t('end_auction')}
                      >
                        <i className="fas fa-check"></i>
                      </button>
                      <button
                        onClick={() => handleCancel(auction.id)}
                        className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                        title={t('cancel_auction')}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bids List */}
              {auction.bids && auction.bids.length > 0 && (
                <div className="mt-4 pt-4 border-t border-purple-600 border-opacity-30">
                  <p className="text-sm text-midnight-silver mb-2">{t('recent_bids')}:</p>
                  <div className="flex flex-wrap gap-2">
                    {auction.bids.slice(0, 5).map((bid, idx) => (
                      <div
                        key={bid.id}
                        className={`px-3 py-1 rounded-lg text-sm ${idx === 0 ? 'bg-green-600' : 'bg-midnight-purple bg-opacity-50'}`}
                      >
                        <span style={{ color: CLASS_COLORS[bid.characterClass] || '#FFF' }}>{bid.characterName}</span>
                        <span className="ml-2 font-bold">{bid.amount} DKP</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Auction Modal */}
      {showCreateModal && (
        <CreateAuctionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Bid Modal */}
      {bidModal.open && (
        <BidModal
          auction={bidModal.auction}
          userDkp={user?.currentDkp || 0}
          onClose={() => setBidModal({ open: false, auction: null })}
          onSuccess={handleBidSuccess}
        />
      )}
    </div>
  )
}

export default AuctionTab