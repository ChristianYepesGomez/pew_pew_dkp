import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { auctionsAPI } from '../../services/api'

const AuctionTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [auction, setAuction] = useState(null)
  const [loading, setLoading] = useState(true)
  const isAdmin = user?.role === 'admin' || user?.role === 'officer'

  const loadAuction = async () => {
    try {
      const response = await auctionsAPI.getActive()
      setAuction(response.data?.id ? response.data : null)
    } catch (error) {
      setAuction(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAuction() }, [])
  useSocket({ auction_started: loadAuction, auction_ended: loadAuction, bid_placed: loadAuction })

  const handleBid = async () => {
    const minBid = (auction.current_highest_bid || auction.min_bid) + 1
    const amount = prompt(`${t('place_bid')} (Min: ${minBid})`, minBid)
    if (!amount) return
    try {
      await auctionsAPI.bid(auction.id, parseInt(amount))
      loadAuction()
    } catch (error) {
      alert(error.response?.data?.error || t('error'))
    }
  }

  const handleCreate = async () => {
    const itemName = prompt('Item name:')
    if (!itemName) return
    const minBid = prompt('Min bid:', '50')
    if (!minBid) return
    try {
      await auctionsAPI.create({ item_name: itemName, min_bid: parseInt(minBid), item_rarity: 'epic' })
      loadAuction()
    } catch (error) {
      alert(error.response?.data?.error || t('error'))
    }
  }

  const handleEnd = async () => {
    if (!confirm(t('confirm'))) return
    try {
      await auctionsAPI.end(auction.id)
      loadAuction()
    } catch (error) {
      alert(error.response?.data?.error || t('error'))
    }
  }

  if (loading) return <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i></div>

  return (
    <div className="info-card">
      <div className="flex justify-between items-center mb-6">
        <h3 className="mb-0"><i className="fas fa-gavel mr-3"></i>{t('active_auction_title')}</h3>
        {isAdmin && !auction && (
          <button onClick={handleCreate} className="px-4 py-2 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white rounded-lg hover:shadow-lg">
            <i className="fas fa-plus-circle mr-2"></i>{t('create_auction')}
          </button>
        )}
      </div>

      {!auction ? (
        <p className="text-center text-gray-400 py-8">{t('no_active_auction')}</p>
      ) : (
        <div className="bg-gradient-to-r from-green-900 to-green-800 rounded-xl p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h5 className="text-2xl font-cinzel mb-2">
                <i className="fas fa-gem mr-2"></i>
                <span className="rarity-epic">{auction.item_name}</span>
              </h5>
              <p className="text-midnight-silver">
                <strong>{t('min_bid')}:</strong> {auction.min_bid} DKP |
                <strong className="ml-2">{t('current_bid')}:</strong>
                <span className="text-2xl ml-2 amount-negative">{auction.current_highest_bid || auction.min_bid} DKP</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBid} className="px-6 py-3 bg-midnight-purple hover:bg-midnight-bright-purple text-white rounded-lg text-lg">
                <i className="fas fa-hand-holding-usd mr-2"></i>{t('place_bid')}
              </button>
              {isAdmin && (
                <button onClick={handleEnd} className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                  <i className="fas fa-stop mr-2"></i>End
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuctionTab