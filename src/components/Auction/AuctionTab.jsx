import { useState, useEffect, useRef } from 'react'
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
  const [timeRemaining, setTimeRemaining] = useState({})
  const timerRef = useRef(null)
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

  // Calculate time remaining for all auctions
  const updateTimeRemaining = () => {
    const newTimes = {}
    auctions.forEach(auction => {
      if (auction.endsAt) {
        const endTime = new Date(auction.endsAt).getTime()
        const now = Date.now()
        const diff = endTime - now

        if (diff > 0) {
          const minutes = Math.floor(diff / 60000)
          const seconds = Math.floor((diff % 60000) / 1000)
          newTimes[auction.id] = { minutes, seconds, expired: false }
        } else {
          newTimes[auction.id] = { minutes: 0, seconds: 0, expired: true }
        }
      }
    })
    setTimeRemaining(newTimes)
  }

  useEffect(() => { loadAuctions() }, [])

  useEffect(() => {
    if (auctions.length > 0) {
      updateTimeRemaining()
      timerRef.current = setInterval(updateTimeRemaining, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [auctions])

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

  const formatTime = (time) => {
    if (!time) return '--:--'
    if (time.expired) return t('expired') || 'Expired'
    return `${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`
  }

  const getTimeColor = (time) => {
    if (!time || time.expired) return 'text-red-500'
    if (time.minutes < 1) return 'text-red-400 animate-pulse'
    if (time.minutes < 2) return 'text-yellow-400'
    return 'text-green-400'
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
          {auctions.map((auction) => {
            const time = timeRemaining[auction.id]
            const isExpired = time?.expired

            return (
              <div
                key={auction.id}
                className={`bg-gradient-to-r from-purple-900 to-purple-800 rounded-xl p-4 border border-purple-600 border-opacity-50 ${isExpired ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {/* Item Icon */}
                  <div
                    className="w-14 h-14 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0"
                    style={{ borderColor: RARITY_COLORS[auction.itemRarity] }}
                  >
                    {auction.itemImage && auction.itemImage !== '🎁' ? (
                      <img
                        src={auction.itemImage}
                        alt={auction.itemName}
                        className="w-12 h-12 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                      />
                    ) : null}
                    <i
                      className="fas fa-gem text-2xl"
                      style={{
                        color: RARITY_COLORS[auction.itemRarity],
                        display: auction.itemImage && auction.itemImage !== '🎁' ? 'none' : 'block'
                      }}
                    ></i>
                  </div>

                  {/* Item Name */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="text-lg font-cinzel mb-0 truncate"
                      style={{ color: RARITY_COLORS[auction.itemRarity] }}
                    >
                      {auction.itemName}
                    </h4>
                  </div>

                  {/* Highest Bidder */}
                  <div className="text-center min-w-[120px]">
                    <p className="text-xs text-midnight-silver m-0 mb-1">{t('highest_bidder')}</p>
                    {auction.highestBidder ? (
                      <p
                        className="font-bold m-0 truncate"
                        style={{ color: CLASS_COLORS[auction.highestBidder.characterClass] || '#FFF' }}
                      >
                        {auction.highestBidder.characterName}
                      </p>
                    ) : (
                      <p className="text-gray-500 m-0">-</p>
                    )}
                  </div>

                  {/* Current Bid */}
                  <div className="text-center min-w-[100px]">
                    <p className="text-xs text-midnight-silver m-0 mb-1">{t('current_bid')}</p>
                    <p className="text-xl font-bold text-green-400 m-0">
                      {auction.currentBid || 0} <span className="text-sm">DKP</span>
                    </p>
                  </div>

                  {/* Time Remaining */}
                  <div className="text-center min-w-[80px]">
                    <p className="text-xs text-midnight-silver m-0 mb-1">{t('time_remaining')}</p>
                    <p className={`text-xl font-mono font-bold m-0 ${getTimeColor(time)}`}>
                      {formatTime(time)}
                    </p>
                  </div>

                  {/* Bid Button */}
                  <button
                    onClick={() => setBidModal({ open: true, auction })}
                    disabled={isExpired}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <i className="fas fa-hand-holding-usd"></i>
                    {t('place_bid')}
                  </button>
                </div>
              </div>
            )
          })}
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
