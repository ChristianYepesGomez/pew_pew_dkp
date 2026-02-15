import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { useToast } from '../../context/ToastContext'
import { useNotifications, NOTIFICATION_SOUNDS } from '../../hooks/useNotifications'
import { useActiveAuctions, useMyBis, useRaidItems } from '../../hooks/useQueries'
import { auctionsAPI, bisAPI } from '../../services/api'
import CreateAuctionModal from './CreateAuctionModal'
import BidModal from './BidModal'
import WowheadTooltip from '../Common/WowheadTooltip'
import { CLASS_COLORS, RARITY_COLORS } from '../../utils/constants'
import { AuctionsSkeleton } from '../ui/Skeleton'

// Sound Settings Modal Component
const SoundSettingsModal = ({
  selectedSound,
  customSoundData,
  onChangeSound,
  onPreviewSound,
  onSetCustomSound,
  onClearCustomSound,
  onClose,
  t
}) => {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const { addToast } = useToast()

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      addToast(t('invalid_audio_file'), 'error')
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      addToast(t('file_too_large'), 'error')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result
        if (base64 && onSetCustomSound(base64)) {
          // Success - sound is now selected
        }
        setUploading(false)
      }
      reader.onerror = () => {
        addToast(t('upload_error'), 'error')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple border-b border-midnight-bright-purple border-opacity-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-midnight-deepblue flex items-center justify-center border-2 border-midnight-glow">
                <i className="fas fa-music text-lg text-midnight-glow"></i>
              </div>
              <div>
                <h3 className="text-lg font-cinzel font-bold text-white m-0">{t('sound_settings') || 'Configuración de Sonido'}</h3>
                <p className="text-xs text-midnight-silver m-0">{t('sound_settings_subtitle') || 'Personaliza el sonido de las notificaciones'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Sound List */}
        <div className="p-4 overflow-auto space-y-2">
          {NOTIFICATION_SOUNDS.map((sound) => {
            const isSelected = selectedSound === sound.id
            const isCustom = sound.id === 'custom'
            const hasCustomSound = isCustom && customSoundData

            return (
              <div
                key={sound.id}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-midnight-purple bg-opacity-30 border-midnight-glow'
                    : 'bg-white bg-opacity-5 border-gray-700 hover:border-midnight-bright-purple'
                }`}
                onClick={() => {
                  if (!isCustom || hasCustomSound) {
                    onChangeSound(sound.id)
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Selection indicator */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'border-midnight-glow bg-midnight-glow' : 'border-gray-500'
                  }`}>
                    {isSelected && <i className="fas fa-check text-xs text-white"></i>}
                  </div>

                  {/* Sound icon */}
                  {sound.icon && (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-midnight-glow bg-opacity-20' : 'bg-midnight-purple bg-opacity-30'
                    }`}>
                      <i className={`fas ${sound.icon} ${isSelected ? 'text-midnight-glow' : 'text-midnight-silver'}`}></i>
                    </div>
                  )}

                  {/* Sound info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold m-0 ${isSelected ? 'text-midnight-glow' : 'text-white'}`}>
                      {isCustom ? (t('custom_sound') || 'Sonido Personalizado') : sound.name}
                    </p>
                    <p className="text-xs text-midnight-silver m-0 truncate">
                      {isCustom
                        ? (hasCustomSound
                          ? (t('custom_sound_loaded') || 'Sonido cargado')
                          : (t('upload_custom_sound') || 'Sube tu propio sonido'))
                        : (t(`sound_desc_${sound.id}`) || sound.description)
                      }
                    </p>
                  </div>

                  {/* Preview button */}
                  {(!isCustom || hasCustomSound) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onPreviewSound(sound.id)
                      }}
                      className="w-9 h-9 rounded-lg bg-midnight-purple bg-opacity-50 hover:bg-opacity-80 text-white flex items-center justify-center transition-all"
                      title={t('preview_sound') || 'Previsualizar'}
                    >
                      <i className="fas fa-play text-sm"></i>
                    </button>
                  )}

                  {/* Custom sound actions */}
                  {isCustom && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          fileInputRef.current?.click()
                        }}
                        disabled={uploading}
                        className="w-9 h-9 rounded-lg bg-green-600 bg-opacity-30 hover:bg-opacity-50 text-green-400 flex items-center justify-center transition-all"
                        title={t('upload_sound') || 'Subir sonido'}
                      >
                        <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'} text-sm`}></i>
                      </button>
                      {hasCustomSound && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onClearCustomSound()
                          }}
                          className="w-9 h-9 rounded-lg bg-red-600 bg-opacity-30 hover:bg-opacity-50 text-red-400 flex items-center justify-center transition-all"
                          title={t('remove_sound') || 'Eliminar sonido'}
                        >
                          <i className="fas fa-trash text-sm"></i>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-midnight-bright-purple border-opacity-30 bg-midnight-purple bg-opacity-10">
          <p className="text-xs text-midnight-silver text-center m-0">
            <i className="fas fa-info-circle mr-1"></i>
            {t('sound_settings_info') || 'Los sonidos personalizados se guardan en tu navegador (máx 2MB)'}
          </p>
        </div>
      </div>
    </div>
  )
}

const AuctionTab = () => {
  const { user, refreshUser } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const {
    isSupported,
    permission,
    isEnabled,
    soundEnabled,
    selectedSound,
    customSoundData,
    enableNotifications,
    disableNotifications,
    toggleSound,
    changeSound,
    setCustomSound,
    clearCustomSound,
    previewSound,
    showNotification
  } = useNotifications()
  const { data: auctionData, isLoading } = useActiveAuctions()
  const auctions = auctionData?.auctions || []
  const availableDkp = auctionData?.availableDkp ?? (user?.currentDkp || 0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [bidModal, setBidModal] = useState({ open: false, auction: null })
  const [showSoundModal, setShowSoundModal] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState({})
  const [bisData, setBisData] = useState({}) // { auctionId: [{ user_id, character_name, priority }] }
  const timerRef = useRef(null)
  const auctionsRef = useRef([]) // Keep track of auctions for notifications
  const isAdmin = user?.role === 'admin' || user?.role === 'officer'
  // Prefetch raid items for admins so CreateAuctionModal opens instantly
  useRaidItems(isAdmin)
  const { data: myBisItems } = useMyBis()
  const myBisItemIds = useMemo(
    () => new Set((myBisItems || []).filter(i => !i.obtained).map(i => i.item_id)),
    [myBisItems]
  )

  // Keep auctionsRef in sync
  useEffect(() => {
    auctionsRef.current = auctions
  }, [auctions])

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

  // Load BIS data for active auctions (admins only — regular users use their own BIS list)
  useEffect(() => {
    if (!isAdmin || !auctions?.length) return
    const loadBIS = async () => {
      const entries = await Promise.all(
        auctions.filter(a => a.itemId).map(async (auction) => {
          try {
            const res = await bisAPI.getItemUsers(auction.itemId)
            return res.data?.length > 0 ? [auction.id, res.data] : null
          } catch { return null }
        })
      )
      setBisData(Object.fromEntries(entries.filter(Boolean)))
    }
    loadBIS()
  }, [auctions, isAdmin])

  useEffect(() => {
    if (auctions.length > 0) {
      updateTimeRemaining()
      timerRef.current = setInterval(updateTimeRemaining, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [auctions])

  // Notification handlers for socket events (keep notifications, remove data loading)
  const handleAuctionStarted = useCallback((auction) => {
    if (isEnabled) {
      showNotification(t('new_auction_notification') || 'Nueva Subasta', {
        body: auction.item_name || auction.itemName || 'Item',
        tag: `auction-${auction.id}`,
        icon: auction.item_image || '/favicon.ico',
      })
    }
  }, [isEnabled, showNotification, t])

  const handleBidPlaced = useCallback((data) => {
    // If time was extended due to anti-snipe, update the auction's endsAt directly via React Query cache
    if (data.timeExtended && data.newEndsAt) {
      queryClient.setQueryData(['auctions', 'active'], (old) => {
        if (!old?.auctions) return old
        return {
          ...old,
          auctions: old.auctions.map(a =>
            a.id === data.auctionId ? { ...a, endsAt: data.newEndsAt } : a
          )
        }
      })
    }

    if (!isEnabled || !user) return

    const currentUserId = user.id

    // Notify about time extension (anti-snipe)
    if (data.timeExtended) {
      const auction = auctionsRef.current.find(a => a.id === data.auctionId)
      showNotification(t('time_extended_notification') || 'Tiempo extendido', {
        body: `+30s en ${auction?.itemName || 'la subasta'} (anti-snipe)`,
        tag: `snipe-${data.auctionId}`,
        playSound: false, // Don't play sound for this, it can be noisy
      })
    }

    // Check if current user was outbid
    if (data.outbidUserId === currentUserId) {
      const auction = auctionsRef.current.find(a => a.id === data.auctionId)
      showNotification(t('outbid_notification') || 'Te han superado!', {
        body: `${data.characterName} ha pujado ${data.amount} DKP en ${auction?.itemName || 'la subasta'}`,
        tag: `outbid-${data.auctionId}`,
        requireInteraction: true,
      })
    }

    // Check if someone tied with current user
    if (data.tieWithUserId === currentUserId) {
      const auction = auctionsRef.current.find(a => a.id === data.auctionId)
      showNotification(t('tie_notification') || 'Empate en puja!', {
        body: `${data.characterName} ha empatado contigo en ${auction?.itemName || 'la subasta'} (${data.amount} DKP)`,
        tag: `tie-${data.auctionId}`,
        requireInteraction: true,
      })
    }
  }, [isEnabled, showNotification, user, t, queryClient])

  // Handle auction ended - notify winner (data refresh handled by SocketContext)
  const handleAuctionEnded = useCallback((data) => {
    if (!isEnabled || !user) return

    // Notify winner and refresh DKP in header
    if (data.winnerId === user.id) {
      showNotification(t('auction_won_notification') || 'Has ganado la subasta!', {
        body: `${data.itemName || 'Item'} por ${data.winningBid || 0} DKP`,
        tag: `won-${data.auctionId}`,
        requireInteraction: true,
      })
      refreshUser()
    }
  }, [isEnabled, showNotification, user, t, refreshUser])

  // Keep socket handlers for notifications only (data refresh handled by SocketContext)
  useSocket({
    auction_started: handleAuctionStarted,
    auction_ended: handleAuctionEnded,
    bid_placed: handleBidPlaced,
  })

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    queryClient.invalidateQueries({ queryKey: ['auctions'] })
  }

  const handleBidSuccess = () => {
    setBidModal({ open: false, auction: null })
    queryClient.invalidateQueries({ queryKey: ['auctions'] })
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

  if (isLoading) return <AuctionsSkeleton />

  return (
    <div className="info-card">
      <div className="flex justify-between items-center mb-6">
        <h3 className="mb-0"><i className="fas fa-gavel mr-3"></i>{t('active_auction_title')}</h3>
        <div className="flex items-center gap-3">
          {/* Notification Controls */}
          {isSupported && (
            <div className="flex items-center gap-1">
              {/* Notification Toggle */}
              <button
                onClick={isEnabled ? disableNotifications : enableNotifications}
                className={`px-3 py-2 rounded-l-lg flex items-center gap-2 text-sm transition-all ${
                  isEnabled
                    ? 'bg-green-600 bg-opacity-20 text-green-400 border border-green-600'
                    : permission === 'denied'
                      ? 'bg-red-600 bg-opacity-20 text-red-400 border border-red-600 cursor-not-allowed'
                      : 'bg-white bg-opacity-10 text-gray-300 hover:bg-opacity-20 border border-gray-600'
                }`}
                title={
                  isEnabled
                    ? t('notifications_enabled') || 'Notificaciones activadas - Click para desactivar'
                    : permission === 'denied'
                      ? t('notifications_blocked') || 'Notificaciones bloqueadas en el navegador'
                      : t('enable_notifications') || 'Activar notificaciones'
                }
                disabled={permission === 'denied'}
              >
                <i className={`fas ${isEnabled ? 'fa-bell' : 'fa-bell-slash'}`}></i>
                <span className="hidden sm:inline">
                  {isEnabled ? (t('notifications_on') || 'Notif.') : (t('notifications_off') || 'Notif.')}
                </span>
              </button>
              {/* Sound Toggle (only show if notifications enabled) */}
              {isEnabled && (
                <>
                  <button
                    onClick={toggleSound}
                    className={`px-2 py-2 text-sm transition-all border-l-0 ${
                      soundEnabled
                        ? 'bg-green-600 bg-opacity-20 text-green-400 border border-green-600'
                        : 'bg-white bg-opacity-10 text-gray-400 border border-gray-600 hover:bg-opacity-20'
                    }`}
                    title={soundEnabled ? (t('sound_on') || 'Sonido ON') : (t('sound_off') || 'Sonido OFF')}
                  >
                    <i className={`fas ${soundEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                  </button>
                  <button
                    onClick={() => setShowSoundModal(true)}
                    className="px-2 py-2 rounded-r-lg text-sm transition-all border-l-0 bg-white bg-opacity-10 text-gray-300 border border-gray-600 hover:bg-opacity-20 hover:text-midnight-glow"
                    title={t('sound_settings') || 'Configurar sonido'}
                  >
                    <i className="fas fa-cog"></i>
                  </button>
                </>
              )}
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white rounded-lg hover:shadow-lg flex items-center gap-2"
            >
              <i className="fas fa-plus-circle"></i>{t('create_auction')}
            </button>
          )}
        </div>
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
                  <WowheadTooltip itemId={auction.itemId}>
                    <div
                      className="w-14 h-14 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0 overflow-hidden"
                      style={{ borderColor: RARITY_COLORS[auction.itemRarity] }}
                    >
                      {auction.itemImage && auction.itemImage !== '🎁' ? (
                        <img
                          src={auction.itemImage}
                          alt={auction.itemName}
                          className="w-full h-full object-cover"
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
                  </WowheadTooltip>

                  {/* Item Name + BIS Badge */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="text-lg font-cinzel mb-0 truncate"
                      style={{ color: RARITY_COLORS[auction.itemRarity] }}
                    >
                      {auction.itemName}
                    </h4>
                    {isAdmin && bisData[auction.id]?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <i className="fas fa-crosshairs text-[10px]"></i>BIS:
                        </span>
                        {bisData[auction.id].map((b, i) => (
                          <span
                            key={b.user_id}
                            className="text-xs font-semibold"
                            style={{ color: CLASS_COLORS[b.character_class] || '#FFF' }}
                          >
                            {b.character_name}{i < bisData[auction.id].length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {!isAdmin && myBisItemIds.has(auction.itemId) && (
                      <div className="flex items-center gap-1 mt-1">
                        <i className="fas fa-star text-xs text-yellow-400"></i>
                        <span className="text-xs text-yellow-400">{t('bis_your_bis')}</span>
                      </div>
                    )}
                  </div>

                  {/* Highest Bidder / Tie Info */}
                  <div className="text-center min-w-[120px]">
                    <p className="text-xs text-midnight-silver m-0 mb-1">
                      {auction.hasTie ? t('tied_bidders') : t('highest_bidder')}
                    </p>
                    {auction.hasTie ? (
                      <div className="flex items-center justify-center gap-1">
                        <i className="fas fa-dice text-yellow-400 animate-pulse"></i>
                        <span className="text-yellow-400 font-bold">{auction.tiedBidders?.length || 0}</span>
                        <span className="text-xs text-midnight-silver">{t('players_tied')}</span>
                      </div>
                    ) : auction.highestBidder ? (
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
                    <p className="text-xs text-midnight-silver m-0 mb-1 flex items-center justify-center gap-1">
                      {t('time_remaining')}
                      <i
                        className="fas fa-shield-alt text-[10px] text-blue-400 cursor-help"
                        title={t('anti_snipe_info')}
                      ></i>
                    </p>
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
          userDkp={availableDkp}
          onClose={() => setBidModal({ open: false, auction: null })}
          onSuccess={handleBidSuccess}
        />
      )}

      {/* Sound Settings Modal */}
      {showSoundModal && createPortal(
        <SoundSettingsModal
          selectedSound={selectedSound}
          customSoundData={customSoundData}
          onChangeSound={changeSound}
          onPreviewSound={previewSound}
          onSetCustomSound={setCustomSound}
          onClearCustomSound={clearCustomSound}
          onClose={() => setShowSoundModal(false)}
          t={t}
        />,
        document.body
      )}
    </div>
  )
}

export default AuctionTab
