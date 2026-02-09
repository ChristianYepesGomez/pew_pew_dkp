import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { useNotifications, NOTIFICATION_SOUNDS } from '../../hooks/useNotifications'
import { auctionsAPI, bisAPI } from '../../services/api'
import CreateAuctionModal from './CreateAuctionModal'
import BidModal from './BidModal'
import WowheadTooltip from '../Common/WowheadTooltip'
import CLASS_COLORS from '../../utils/classColors'
import RARITY_COLORS from '../../utils/rarityColors'
import {
  MusicNotes,
  X,
  Check,
  Play,
  CircleNotch,
  Upload,
  Trash,
  Info,
  Gavel,
  Bell,
  BellSlash,
  SpeakerHigh,
  SpeakerSlash,
  GearSix,
  PlusCircle,
  Diamond,
  Crosshair,
  DiceFive,
  HandCoins,
  ShieldStar
} from '@phosphor-icons/react'

// Map FA icon class names to Phosphor components for dynamic sound icon rendering
const SOUND_ICON_MAP = {
  'fa-bell': Bell,
  'fa-music': MusicNotes,
  'fa-gem': Diamond,
  'fa-dice': DiceFive,
  'fa-volume-up': SpeakerHigh,
  'fa-drum': MusicNotes,
  'fa-magic': MusicNotes,
  'fa-bolt': MusicNotes,
  'fa-star': MusicNotes,
  'fa-upload': Upload,
}

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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert(t('invalid_audio_file') || 'Por favor selecciona un archivo de audio válido')
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert(t('file_too_large') || 'El archivo es demasiado grande (máx 2MB)')
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
        alert(t('upload_error') || 'Error al cargar el archivo')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setUploading(false)
    }
  }

  const renderSoundIcon = (iconClass, isSelected) => {
    const IconComponent = SOUND_ICON_MAP[iconClass]
    if (!IconComponent) return null
    return <IconComponent size={16} weight="fill" className={isSelected ? 'text-coral' : 'text-lavender'} />
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-lavender-12 border-b border-lavender-20/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo flex items-center justify-center border-2 border-coral">
                <MusicNotes size={20} weight="fill" className="text-coral" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-cream m-0">{t('sound_settings') || 'Configuración de Sonido'}</h3>
                <p className="text-xs text-lavender m-0">{t('sound_settings_subtitle') || 'Personaliza el sonido de las notificaciones'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-cream text-xl">
              <X size={20} weight="bold" />
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
                    ? 'bg-lavender-12/30 border-coral'
                    : 'bg-white/5 border-gray-700 hover:border-lavender-20'
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
                    isSelected ? 'border-coral bg-coral' : 'border-gray-500'
                  }`}>
                    {isSelected && <Check size={12} weight="bold" className="text-cream" />}
                  </div>

                  {/* Sound icon */}
                  {sound.icon && (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-coral/20' : 'bg-lavender-12/30'
                    }`}>
                      {renderSoundIcon(sound.icon, isSelected)}
                    </div>
                  )}

                  {/* Sound info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold m-0 ${isSelected ? 'text-coral' : 'text-cream'}`}>
                      {isCustom ? (t('custom_sound') || 'Sonido Personalizado') : sound.name}
                    </p>
                    <p className="text-xs text-lavender m-0 truncate">
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
                      className="w-9 h-9 rounded-lg bg-lavender-12/50 hover:bg-lavender-12/80 text-cream flex items-center justify-center transition-all"
                      title={t('preview_sound') || 'Previsualizar'}
                    >
                      <Play size={14} weight="fill" />
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
                        className="w-9 h-9 rounded-lg bg-green-600/30 hover:bg-green-600/50 text-green-400 flex items-center justify-center transition-all"
                        title={t('upload_sound') || 'Subir sonido'}
                      >
                        {uploading
                          ? <CircleNotch size={14} weight="bold" className="animate-spin" />
                          : <Upload size={14} weight="bold" />
                        }
                      </button>
                      {hasCustomSound && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onClearCustomSound()
                          }}
                          className="w-9 h-9 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 flex items-center justify-center transition-all"
                          title={t('remove_sound') || 'Eliminar sonido'}
                        >
                          <Trash size={14} weight="bold" />
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
        <div className="p-4 border-t border-lavender-20/30 bg-lavender-12/10">
          <p className="text-xs text-lavender text-center m-0">
            <Info size={12} weight="fill" className="inline mr-1 align-middle" />
            {t('sound_settings_info') || 'Los sonidos personalizados se guardan en tu navegador (máx 2MB)'}
          </p>
        </div>
      </div>
    </div>
  )
}

const AuctionTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
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
  const [auctions, setAuctions] = useState([])
  const [availableDkp, setAvailableDkp] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [bidModal, setBidModal] = useState({ open: false, auction: null })
  const [showSoundModal, setShowSoundModal] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState({})
  const [bisData, setBisData] = useState({}) // { auctionId: [{ user_id, character_name, priority }] }
  const timerRef = useRef(null)
  const auctionsRef = useRef([]) // Keep track of auctions for notifications
  const isAdmin = user?.role === 'admin' || user?.role === 'officer'

  // Keep auctionsRef in sync
  useEffect(() => {
    auctionsRef.current = auctions
  }, [auctions])

  const loadAuctions = async () => {
    try {
      const response = await auctionsAPI.getActive()
      setAuctions(response.data?.auctions || [])
      setAvailableDkp(response.data?.availableDkp ?? (user?.currentDkp || 0))
    } catch (error) {
      console.error('Error loading auctions:', error)
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

  // Load BIS data for active auctions
  useEffect(() => {
    const loadBIS = async () => {
      const data = {}
      for (const auction of auctions) {
        if (auction.itemId) {
          try {
            const res = await bisAPI.getItemUsers(auction.itemId)
            if (res.data?.length > 0) data[auction.id] = res.data
          } catch { /* silent */ }
        }
      }
      setBisData(data)
    }
    if (auctions.length > 0) loadBIS()
  }, [auctions])

  useEffect(() => {
    if (auctions.length > 0) {
      updateTimeRemaining()
      timerRef.current = setInterval(updateTimeRemaining, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [auctions])

  // Notification handlers for socket events
  const handleAuctionStarted = useCallback((auction) => {
    loadAuctions()
    if (isEnabled) {
      showNotification(t('new_auction_notification') || 'Nueva Subasta', {
        body: auction.item_name || auction.itemName || 'Item',
        tag: `auction-${auction.id}`,
        icon: auction.item_image || '/favicon.ico',
      })
    }
  }, [isEnabled, showNotification, t])

  const handleBidPlaced = useCallback((data) => {
    // If time was extended due to anti-snipe, update the auction's endsAt directly
    if (data.timeExtended && data.newEndsAt) {
      setAuctions(prev => prev.map(a =>
        a.id === data.auctionId ? { ...a, endsAt: data.newEndsAt } : a
      ))
    } else {
      loadAuctions()
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
  }, [isEnabled, showNotification, user, t])

  // Handle auction ended - notify winner
  const handleAuctionEnded = useCallback((data) => {
    loadAuctions()
    if (!isEnabled || !user) return

    // Notify winner
    if (data.winnerId === user.id) {
      showNotification(t('auction_won_notification') || 'Has ganado la subasta!', {
        body: `${data.itemName || 'Item'} por ${data.winningBid || 0} DKP`,
        tag: `won-${data.auctionId}`,
        requireInteraction: true,
      })
    }
  }, [isEnabled, showNotification, user, t])

  useSocket({
    auction_started: handleAuctionStarted,
    auction_ended: handleAuctionEnded,
    bid_placed: handleBidPlaced,
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

  if (loading) return <div className="text-center py-20"><CircleNotch size={48} weight="bold" className="text-coral animate-spin mx-auto" /></div>

  return (
    <div className="rounded-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="mb-0 flex items-center gap-3"><Gavel size={24} weight="fill" />{t('active_auction_title')}</h3>
        <div className="flex items-center gap-3">
          {/* Notification Controls */}
          {isSupported && (
            <div className="flex items-center gap-1">
              {/* Notification Toggle */}
              <button
                onClick={isEnabled ? disableNotifications : enableNotifications}
                className={`px-3 py-2 rounded-l-lg flex items-center gap-2 text-sm transition-all ${
                  isEnabled
                    ? 'bg-green-600/20 text-green-400 border border-green-600'
                    : permission === 'denied'
                      ? 'bg-red-600/20 text-red-400 border border-red-600 cursor-not-allowed'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-gray-600'
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
                {isEnabled ? <Bell size={16} weight="fill" /> : <BellSlash size={16} weight="fill" />}
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
                        ? 'bg-green-600/20 text-green-400 border border-green-600'
                        : 'bg-white/10 text-gray-400 border border-gray-600 hover:bg-white/20'
                    }`}
                    title={soundEnabled ? (t('sound_on') || 'Sonido ON') : (t('sound_off') || 'Sonido OFF')}
                  >
                    {soundEnabled ? <SpeakerHigh size={16} weight="fill" /> : <SpeakerSlash size={16} weight="fill" />}
                  </button>
                  <button
                    onClick={() => setShowSoundModal(true)}
                    className="px-2 py-2 rounded-r-lg text-sm transition-all border-l-0 bg-white/10 text-gray-300 border border-gray-600 hover:bg-white/20 hover:text-coral"
                    title={t('sound_settings') || 'Configurar sonido'}
                  >
                    <GearSix size={16} weight="fill" />
                  </button>
                </>
              )}
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-coral text-indigo rounded-lg hover:shadow-lg flex items-center gap-2 font-bold"
            >
              <PlusCircle size={18} weight="bold" />{t('create_auction')}
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
                className={`bg-lavender-12 rounded-xl p-4 border border-lavender-20/50 ${isExpired ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {/* Item Icon */}
                  <WowheadTooltip itemId={auction.itemId}>
                    <div
                      className="w-14 h-14 rounded-lg bg-indigo flex items-center justify-center border-2 flex-shrink-0 overflow-hidden"
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
                      <Diamond
                        size={28}
                        weight="fill"
                        style={{
                          color: RARITY_COLORS[auction.itemRarity],
                          display: auction.itemImage && auction.itemImage !== '🎁' ? 'none' : 'block'
                        }}
                      />
                    </div>
                  </WowheadTooltip>

                  {/* Item Name + BIS Badge */}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="text-lg mb-0 truncate"
                      style={{ color: RARITY_COLORS[auction.itemRarity] }}
                    >
                      {auction.itemName}
                    </h4>
                    {bisData[auction.id]?.length > 0 && (
                      <div className="flex items-center gap-1 mt-1" title={bisData[auction.id].map(b => `${b.character_name}${b.priority ? ` #${b.priority}` : ''}`).join(', ')}>
                        <Crosshair size={12} weight="bold" className="text-yellow-400" />
                        <span className="text-xs text-yellow-400">
                          {bisData[auction.id].length} {t('bis_raiders_want')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Highest Bidder / Tie Info */}
                  <div className="text-center min-w-[120px]">
                    <p className="text-xs text-lavender m-0 mb-1">
                      {auction.hasTie ? t('tied_bidders') : t('highest_bidder')}
                    </p>
                    {auction.hasTie ? (
                      <div className="flex items-center justify-center gap-1">
                        <DiceFive size={16} weight="fill" className="text-yellow-400 animate-pulse" />
                        <span className="text-yellow-400 font-bold">{auction.tiedBidders?.length || 0}</span>
                        <span className="text-xs text-lavender">{t('players_tied')}</span>
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
                    <p className="text-xs text-lavender m-0 mb-1">{t('current_bid')}</p>
                    <p className="text-xl font-bold text-green-400 m-0">
                      {auction.currentBid || 0} <span className="text-sm">DKP</span>
                    </p>
                  </div>

                  {/* Time Remaining */}
                  <div className="text-center min-w-[80px]">
                    <p className="text-xs text-lavender m-0 mb-1 flex items-center justify-center gap-1">
                      {t('time_remaining')}
                      <ShieldStar
                        size={12}
                        weight="fill"
                        className="text-blue-400 cursor-help"
                        title={t('anti_snipe_info')}
                      />
                    </p>
                    <p className={`text-xl font-mono font-bold m-0 ${getTimeColor(time)}`}>
                      {formatTime(time)}
                    </p>
                  </div>

                  {/* Bid Button */}
                  <button
                    onClick={() => setBidModal({ open: true, auction })}
                    disabled={isExpired}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-cream rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <HandCoins size={20} weight="fill" />
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
