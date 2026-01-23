import { useState, useEffect } from 'react'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { auctionsAPI } from '../../services/api'

const HistoryTab = () => {
  const { t } = useLanguage()
  const [auctions, setAuctions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadHistory = async () => {
    try {
      const response = await auctionsAPI.getHistory()
      setAuctions(response.data)
    } catch (error) {
      console.error('Error loading auction history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Listen to socket updates
  useSocket({
    auction_ended: () => loadHistory(),
    auction_cancelled: () => loadHistory(),
  })

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
      <h3>
        <i className="fas fa-history mr-3"></i>
        {t('auction_history_title')}
      </h3>

      <div className="space-y-4 mt-6">
        {auctions.length === 0 ? (
          <p className="text-center text-gray-400 py-8">{t('no_auction_history')}</p>
        ) : (
          auctions.map((auction) => {
            const isCompleted = auction.status === 'completed' || auction.status === 'ended'
            const date = new Date(auction.created_at).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={auction.id}
                className={`border-l-4 ${
                  isCompleted ? 'border-green-500' : 'border-yellow-500'
                } bg-midnight-spaceblue bg-opacity-50 rounded-lg p-4 hover:bg-opacity-70 transition-all`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="text-xl font-cinzel mb-2">
                      <i className="fas fa-cube mr-2"></i>
                      <span className="rarity-epic">{auction.item_name}</span>
                    </h5>
                    <div className="text-sm text-gray-400 mb-2">
                      <i className="far fa-calendar-alt mr-2"></i>
                      {date}
                    </div>
                    <div className="flex flex-wrap gap-4 text-midnight-silver">
                      <span>
                        <strong>{t('min_bid')}:</strong> {auction.min_bid} DKP
                      </span>
                      {isCompleted && auction.winner && (
                        <>
                          <span className="text-green-400">
                            <i className="fas fa-trophy mr-1"></i>
                            <strong>{t('winner')}:</strong> {auction.winner.characterName}
                          </span>
                          <span className="amount-negative">
                            <i className="fas fa-coins mr-1"></i>
                            <strong>{auction.winning_bid} DKP</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-yellow-500 text-black'
                      }`}
                    >
                      {isCompleted ? '✓ ' + t('completed') : '✗ ' + t('cancelled')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default HistoryTab
