import { useState, useEffect } from 'react'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { auctionsAPI } from '../../services/api'

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

const HistoryTab = () => {
  const { t, language } = useLanguage()
  const [auctions, setAuctions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadHistory = async () => {
    try {
      const response = await auctionsAPI.getHistory()
      setAuctions(response.data)
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, [])
  useSocket({ auction_ended: loadHistory })

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

  if (loading) return <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i></div>

  return (
    <div className="info-card">
      <h3><i className="fas fa-history mr-3"></i>{t('auction_history_title')}</h3>

      {auctions.length === 0 ? (
        <p className="text-center text-gray-400 py-8">{t('no_auction_history')}</p>
      ) : (
        <div className="space-y-3 mt-6">
          {auctions.map((a) => {
            const hasWinner = a.status === 'completed' && a.winner

            return (
              <div
                key={a.id}
                className="bg-midnight-spaceblue bg-opacity-50 rounded-lg p-4 flex items-center gap-4"
              >
                {/* Item Icon */}
                <div
                  className="w-12 h-12 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0"
                  style={{ borderColor: RARITY_COLORS[a.item_rarity] || RARITY_COLORS.epic }}
                >
                  {a.item_image && a.item_image !== '🎁' ? (
                    <img
                      src={a.item_image}
                      alt={a.item_name}
                      className="w-10 h-10 object-contain"
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
                    <div className="text-right">
                      <p className="text-xs text-midnight-silver m-0 mb-1">{t('winner')}</p>
                      <p
                        className="font-bold m-0"
                        style={{ color: CLASS_COLORS[a.winner.characterClass] || '#FFF' }}
                      >
                        {a.winner.characterName}
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
            )
          })}
        </div>
      )}
    </div>
  )
}

export default HistoryTab
