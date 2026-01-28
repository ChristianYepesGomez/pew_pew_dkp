import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { auctionsAPI } from '../../services/api'

const RARITY_COLORS = {
  common: '#9D9D9D',
  uncommon: '#1EFF00',
  rare: '#0070DD',
  epic: '#A335EE',
  legendary: '#FF8000',
}

const BidModal = ({ auction, userDkp, onClose, onSuccess }) => {
  const { t } = useLanguage()
  const minBid = (auction.currentBid || 0) + 1
  const [amount, setAmount] = useState(minBid)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Close on ESC key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (amount < minBid) {
      setError(t('bid_too_low'))
      return
    }

    if (amount > userDkp) {
      setError(t('insufficient_dkp'))
      return
    }

    setLoading(true)
    try {
      await auctionsAPI.bid(auction.id, amount)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || t('error_generic'))
    } finally {
      setLoading(false)
    }
  }

  const quickBids = [
    minBid,
    Math.ceil(minBid * 1.1),
    Math.ceil(minBid * 1.25),
    Math.ceil(minBid * 1.5),
  ].filter(bid => bid <= userDkp)

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
      <div className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-midnight-purple flex items-center justify-center border-2" style={{ borderColor: RARITY_COLORS[auction.itemRarity] }}>
                <i className="fas fa-gem text-xl" style={{ color: RARITY_COLORS[auction.itemRarity] }}></i>
              </div>
              <div>
                <h3 className="text-lg font-bold m-0" style={{ color: RARITY_COLORS[auction.itemRarity] }}>
                  {auction.itemName}
                </h3>
                <p className="text-sm text-midnight-silver m-0">{t('place_bid')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="p-6 bg-midnight-purple bg-opacity-20 flex justify-around">
          <div className="text-center">
            <p className="text-sm text-midnight-silver m-0">{t('your_dkp')}</p>
            <p className="text-2xl font-bold text-midnight-glow m-0">{userDkp}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-midnight-silver m-0">{t('current_bid')}</p>
            <p className="text-2xl font-bold text-green-400 m-0">{auction.currentBid || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-midnight-silver m-0">{t('min_next_bid')}</p>
            <p className="text-2xl font-bold text-yellow-400 m-0">{minBid}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick bids */}
          {quickBids.length > 1 && (
            <div>
              <label className="block text-sm text-midnight-silver mb-2">{t('quick_bid')}</label>
              <div className="grid grid-cols-4 gap-2">
                {quickBids.map((bid) => (
                  <button
                    key={bid}
                    type="button"
                    onClick={() => setAmount(bid)}
                    className={`py-2 rounded-lg text-sm font-bold transition-all ${
                      amount === bid
                        ? 'bg-green-600 text-white'
                        : 'bg-midnight-purple bg-opacity-50 text-midnight-silver hover:bg-opacity-70'
                    }`}
                  >
                    {bid}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom amount */}
          <div>
            <label className="block text-sm text-midnight-silver mb-2">{t('your_bid')}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                min={minBid}
                max={userDkp}
                className="flex-1 px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white text-center text-xl font-bold focus:outline-none focus:border-midnight-glow"
              />
              <span className="text-midnight-glow font-bold text-xl">DKP</span>
            </div>
          </div>

          {/* After bid preview */}
          <div className="bg-midnight-purple bg-opacity-20 rounded-lg p-3 text-center">
            <p className="text-sm text-midnight-silver m-0">{t('dkp_after_bid')}</p>
            <p className={`text-xl font-bold m-0 ${userDkp - amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {userDkp - amount} DKP
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || amount < minBid || amount > userDkp}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
              ) : (
                <><i className="fas fa-hand-holding-usd mr-2"></i>{t('place_bid')}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default BidModal
