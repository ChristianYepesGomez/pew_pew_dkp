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

  const loadActiveAuction = async () => {
    try {
      const response = await auctionsAPI.getActive()
      setAuction(response.data)
    } catch (error) {
      console.error('Error loading auction:', error)
      setAuction(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActiveAuction()
  }, [])

  // Listen to socket updates
  useSocket({
    auction_started: (data) => {
      alert(`${t('active_auction')}: ${data.item_name}`)
      loadActiveAuction()
    },
    bid_placed: () => loadActiveAuction(),
    auction_ended: () => {
      loadActiveAuction()
      alert(t('completed'))
    },
    auction_cancelled: () => {
      loadActiveAuction()
      alert(t('cancelled'))
    },
  })

  const handleBid = async () => {
    if (!auction) return

    const minBid = (auction.current_highest_bid || auction.min_bid) + 1
    const bidAmount = prompt(`${t('amount')} (${t('min_bid')}: ${minBid}):`, minBid)

    if (bidAmount === null) return

    const amount = parseInt(bidAmount)
    if (isNaN(amount) || amount < minBid) {
      alert(`${t('error')}: ${t('min_bid')} ${minBid}`)
      return
    }

    try {
      await auctionsAPI.bid(auction.id, amount)
      alert(`✅ ${t('success')}! ${amount} DKP`)
      loadActiveAuction()
    } catch (error) {
      console.error('Error placing bid:', error)
      alert(`❌ ${error.response?.data?.error || t('error')}`)
    }
  }

  const handleCreateAuction = async () => {
    const itemName = prompt(t('active_auction') + ' - ' + t('name') + ':')
    if (!itemName) return

    const minBid = prompt(t('min_bid') + ' (DKP):', '50')
    if (!minBid) return

    const minBidNum = parseInt(minBid)
    if (isNaN(minBidNum) || minBidNum < 0) {
      alert(t('please_complete_fields'))
      return
    }

    try {
      await auctionsAPI.create({
        item_name: itemName,
        min_bid: minBidNum,
        item_rarity: 'epic',
        item_image: '⚔️',
      })
      alert(`✅ ${t('success')}!`)
      loadActiveAuction()
    } catch (error) {
      console.error('Error creating auction:', error)
      alert(`❌ ${error.response?.data?.error || t('error')}`)
    }
  }

  const handleEndAuction = async () => {
    if (!auction || !confirm(t('confirm'))) return

    try {
      await auctionsAPI.end(auction.id)
      alert(`✅ ${t('completed')}`)
      loadActiveAuction()
    } catch (error) {
      console.error('Error ending auction:', error)
      alert(`❌ ${error.response?.data?.error || t('error')}`)
    }
  }

  const handleCancelAuction = async () => {
    if (!auction || !confirm(t('confirm'))) return

    try {
      await auctionsAPI.cancel(auction.id)
      alert(`✅ ${t('cancelled')}`)
      loadActiveAuction()
    } catch (error) {
      console.error('Error cancelling auction:', error)
      alert(`❌ ${error.response?.data?.error || t('error')}`)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i>
        <p className="mt-4 text-midnight-silver">{t('loading')}...</p>
      </div>
    )
  }

  return (
    <div className="info-card">
      <div className="flex justify-between items-center mb-6">
        <h3 className="mb-0">
          <i className="fas fa-gavel mr-3"></i>
          {t('active_auction_title')}
        </h3>
        {isAdmin && (
          <button
            onClick={handleCreateAuction}
            className="px-4 py-2 bg-midnight-purple hover:bg-midnight-bright-purple text-white rounded-lg font-semibold transition-all"
          >
            <i className="fas fa-plus-circle mr-2"></i>
            {t('create_auction')}
          </button>
        )}
      </div>

      {!auction || !auction.id ? (
        <div className="text-center py-12">
          <i className="fas fa-gavel text-6xl text-gray-400 mb-4"></i>
          <p className="text-gray-400 text-lg">{t('no_active_auction')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-rarity-epic to-purple-900 bg-opacity-20 border-2 border-rarity-epic rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h5 className="text-3xl font-cinzel mb-4">
                  <i className="fas fa-gem mr-2"></i>
                  <span className="rarity-epic">{auction.item_name}</span>
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-midnight-silver">
                  <p>
                    <strong className="text-midnight-glow">{t('min_bid')}:</strong>{' '}
                    {auction.min_bid} DKP
                  </p>
                  <p>
                    <strong className="text-midnight-glow">{t('current_bid')}:</strong>{' '}
                    <span className="text-2xl amount-negative">
                      {auction.current_highest_bid || auction.min_bid} DKP
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleBid}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-bold transition-all shadow-lg"
                >
                  <i className="fas fa-hand-holding-usd mr-2"></i>
                  {t('place_bid')}
                </button>

                {isAdmin && (
                  <>
                    <button
                      onClick={handleEndAuction}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all"
                    >
                      <i className="fas fa-check mr-2"></i>
                      Finalizar
                    </button>
                    <button
                      onClick={handleCancelAuction}
                      className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all"
                    >
                      <i className="fas fa-times mr-2"></i>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuctionTab
