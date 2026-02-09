import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { auctionsAPI } from '../../services/api'
import WowheadTooltip from '../Common/WowheadTooltip'
import RARITY_COLORS from '../../utils/rarityColors'
import { Diamond, X, WarningCircle, CircleNotch, HandCoins } from '@phosphor-icons/react'

const BidModal = ({ auction, userDkp, onClose, onSuccess }) => {
  const { t } = useLanguage()
  const minBid = (auction.currentBid || 0) + 1
  const [amount, setAmount] = useState(String(minBid))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // Close on ESC key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])

  const numAmount = parseInt(amount) || 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (numAmount < minBid) {
      setError(t('bid_too_low'))
      return
    }

    if (numAmount > userDkp) {
      setError(t('insufficient_dkp'))
      return
    }

    setLoading(true)
    try {
      await auctionsAPI.bid(auction.id, numAmount)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || t('error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
      <div className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-lavender-20/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WowheadTooltip itemId={auction.itemId}>
                <div className="w-12 h-12 rounded-lg bg-lavender-12 flex items-center justify-center border-2 overflow-hidden" style={{ borderColor: RARITY_COLORS[auction.itemRarity] }}>
                  {auction.itemImage && auction.itemImage !== '🎁' ? (
                    <img
                      src={auction.itemImage}
                      alt={auction.itemName}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    />
                  ) : null}
                  <Diamond size={20} weight="bold" style={{ color: RARITY_COLORS[auction.itemRarity], display: auction.itemImage && auction.itemImage !== '🎁' ? 'none' : 'block' }} />
                </div>
              </WowheadTooltip>
              <div>
                <h3 className="text-lg font-bold m-0" style={{ color: RARITY_COLORS[auction.itemRarity] }}>
                  {auction.itemName}
                </h3>
                <p className="text-sm text-lavender m-0">{t('place_bid')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
              <X size={24} weight="bold" />
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="p-6 bg-lavender-12/20 flex justify-around">
          <div className="text-center">
            <p className="text-sm text-lavender m-0">{t('your_dkp')}</p>
            <p className="text-2xl font-bold text-coral m-0">{userDkp}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-lavender m-0">{t('current_bid')}</p>
            <p className="text-2xl font-bold text-green-400 m-0">{auction.currentBid || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-lavender m-0">{t('min_next_bid')}</p>
            <p className="text-2xl font-bold text-yellow-400 m-0">{minBid}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
            <WarningCircle size={16} weight="bold" className="inline mr-2" />{error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Bid amount */}
          <div>
            <label className="block text-sm text-lavender mb-2">{t('your_bid')}</label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                min={minBid}
                max={userDkp}
                className="flex-1 px-4 py-3 rounded-lg bg-lavender-12/30 border border-lavender-20 text-white text-center text-xl font-bold focus:outline-none focus:border-coral"
              />
              <span className="text-coral font-bold text-xl">DKP</span>
            </div>
          </div>

          {/* After bid preview */}
          <div className="bg-lavender-12/20 rounded-lg p-3 text-center">
            <p className="text-sm text-lavender m-0">{t('dkp_after_bid')}</p>
            <p className={`text-xl font-bold m-0 ${userDkp - numAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {userDkp - numAmount} DKP
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg border border-lavender-20 text-lavender hover:bg-lavender-20/20 transition-all"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || numAmount < minBid || numAmount > userDkp}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><CircleNotch size={18} weight="bold" className="inline animate-spin mr-2" />{t('loading')}...</>
              ) : (
                <><HandCoins size={18} weight="bold" className="inline mr-2" />{t('place_bid')}</>
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
