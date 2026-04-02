import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { useNotifications, NOTIFICATION_SOUNDS } from '../../hooks/useNotifications'
import { auctionsAPI } from '../../services/api'
import CreateAuctionModal from './CreateAuctionModal'
import BidModal from './BidModal'
import DistributionQueue from './DistributionQueue'
import WowheadTooltip from '../Common/WowheadTooltip'
import CLASS_COLORS from '../../utils/classColors'
import RARITY_COLORS from '../../utils/rarityColors'
import { AuctionsSkeleton } from '../ui/Skeleton'
import SectionHeader from '../ui/SectionHeader'
import SurfaceCard from '../ui/SurfaceCard'
import Button from '../ui/Button'
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
  SpeakerLow,
  SpeakerNone,
  GearSix,
  PlusCircle,
  Diamond,
  DiceFive,
  HandCoins,
  ShieldStar,
  Trophy,
  Crown,
  ClockCounterClockwise,
  ArrowCounterClockwise,
  Lock,
  Package,
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
  volume,
  onChangeSound,
  onPreviewSound,
  onSetCustomSound,
  onClearCustomSound,
  onSetVolume,
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
      alert(t('invalid_audio_file'))
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert(t('file_too_large'))
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
        alert(t('upload_error'))
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
                <h3 className="text-lg font-bold text-cream m-0">{t('sound_settings')}</h3>
                <p className="text-xs text-lavender m-0">{t('sound_settings_subtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-xl text-lavender transition-colors hover:text-cream">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Volume Control */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSetVolume(volume > 0 ? 0 : 0.5)}
              className="text-lavender hover:text-cream transition-colors"
              title={volume > 0 ? t('sound_mute') : t('sound_unmute')}
            >
              {volume === 0 ? (
                <SpeakerNone size={18} weight="fill" />
              ) : volume < 0.5 ? (
                <SpeakerLow size={18} weight="fill" />
              ) : (
                <SpeakerHigh size={18} weight="fill" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onSetVolume(parseFloat(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-coral bg-lavender-20/50
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-coral [&::-webkit-slider-thumb]:shadow-md
                [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-coral [&::-moz-range-thumb]:border-0"
            />
            <span className="text-xs text-lavender w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* Sound List */}
        <div className="p-4 pt-2 overflow-auto space-y-2">
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
                    : 'bg-indigo/60 border-lavender-20/30 hover:border-lavender-20'
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
                    isSelected ? 'border-coral bg-coral' : 'border-lavender/50'
                  }`}>
                    {isSelected && <Check size={12} className="text-cream" />}
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
                      {isCustom ? t('custom_sound') : sound.name}
                    </p>
                    <p className="text-xs text-lavender m-0 truncate">
                      {isCustom
                        ? (hasCustomSound
                          ? t('custom_sound_loaded')
                          : t('upload_custom_sound'))
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
                      title={t('preview_sound')}
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
                        title={t('upload_sound')}
                      >
                        {uploading
                          ? <CircleNotch size={14} className="animate-spin" />
                          : <Upload size={14} />
                        }
                      </button>
                      {hasCustomSound && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onClearCustomSound()
                          }}
                          className="w-9 h-9 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 flex items-center justify-center transition-all"
                          title={t('remove_sound')}
                        >
                          <Trash size={14} />
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
            {t('sound_settings_info')}
          </p>
        </div>
      </div>
    </div>
  )
}

const AuctionTab = ({ onNavigate }) => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const {
    isSupported,
    permission,
    isEnabled,
    soundEnabled,
    selectedSound,
    customSoundData,
    volume,
    enableNotifications,
    disableNotifications,
    toggleSound,
    changeSound,
    setVolume,
    setCustomSound,
    clearCustomSound,
    previewSound,
    playVictorySound,
    showNotification
  } = useNotifications()
  const [auctions, setAuctions] = useState([])
  const [availableDkp, setAvailableDkp] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDistribution, setShowDistribution] = useState(false)
  const [bidModal, setBidModal] = useState({ open: false, auction: null })
  const [showSoundModal, setShowSoundModal] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState({})
  const [wonAuctions, setWonAuctions] = useState([]) // Auctions in "celebration" state for 15s
  const timerRef = useRef(null)
  const wonTimeoutsRef = useRef(new Map()) // Cleanup timeouts for won auctions
  const serverOffsetRef = useRef(0) // Server time minus local time (ms) — corrects client clock drift
  const auctionsRef = useRef([]) // Keep track of auctions for notifications
  const expiredAtRef = useRef({}) // Track when each auction first expired locally (ms)
  const lastExpiredRefreshRef = useRef(0) // Throttle expired-auction refreshes
  const isAdmin = user?.role === 'admin' || user?.role === 'officer'
  const loadingRef = useRef(false) // Dedup concurrent loadAuctions calls
  const pendingRefreshRef = useRef(false) // Queue a refresh if one is in-flight

  // Keep auctionsRef in sync
  useEffect(() => {
    auctionsRef.current = auctions
  }, [auctions])

  const loadAuctions = useCallback(async () => {
    // Dedup: if a fetch is already in-flight, queue one more refresh after it finishes
    if (loadingRef.current) {
      pendingRefreshRef.current = true
      return
    }
    loadingRef.current = true
    try {
      const response = await auctionsAPI.getActive()
      setAuctions(response.data?.auctions || [])
      setAvailableDkp(response.data?.availableDkp ?? (user?.currentDkp || 0))
      // Calculate clock offset: positive = client is behind server, negative = client is ahead
      if (response.data?.serverTime) {
        serverOffsetRef.current = new Date(response.data.serverTime).getTime() - Date.now()
      }
    } catch (error) {
      console.error('Error loading auctions:', error)
      setAuctions([])
    } finally {
      setLoading(false)
      loadingRef.current = false
      // If another refresh was requested while we were fetching, do one more
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false
        loadAuctions()
      }
    }
  }, [user?.currentDkp])

  // Calculate time remaining for all auctions (using server-synced time)
  const updateTimeRemaining = () => {
    const newTimes = {}
    const now = Date.now()
    const serverNow = now + serverOffsetRef.current
    let shouldRefresh = false

    auctions.forEach(auction => {
      if (auction.endsAt) {
        const endTime = new Date(auction.endsAt).getTime()
        const diff = endTime - serverNow

        if (diff > 0) {
          const minutes = Math.floor(diff / 60000)
          const seconds = Math.floor((diff % 60000) / 1000)
          newTimes[auction.id] = { minutes, seconds, expired: false }
          // Clear expiry tracking if auction got extended (anti-snipe)
          delete expiredAtRef.current[auction.id]
        } else {
          newTimes[auction.id] = { minutes: 0, seconds: 0, expired: true }
          // Track when we first saw this auction as expired
          if (!expiredAtRef.current[auction.id]) {
            expiredAtRef.current[auction.id] = now
          }
          // If expired for >3s and socket event hasn't arrived, force refresh (throttled to once per 5s)
          if (now - expiredAtRef.current[auction.id] > 3000 && now - lastExpiredRefreshRef.current > 5000) {
            shouldRefresh = true
          }
        }
      }
    })
    setTimeRemaining(newTimes)
    if (shouldRefresh) {
      lastExpiredRefreshRef.current = now
      loadAuctions()
    }
  }

  useEffect(() => { loadAuctions() }, [])

  useEffect(() => {
    if (auctions.length > 0) {
      updateTimeRemaining()
      timerRef.current = setInterval(updateTimeRemaining, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      wonTimeoutsRef.current.forEach(t => clearTimeout(t))
    }
  }, [auctions])

  // Notification handlers for socket events
  const handleAuctionStarted = useCallback((auction) => {
    loadAuctions()
    if (isEnabled) {
      showNotification(t('new_auction_notification'), {
        body: auction.item_name || auction.itemName || 'Item',
        tag: `auction-${auction.id}`,
        icon: auction.item_image || '/favicon.ico',
      })
    }
  }, [isEnabled, showNotification, t, loadAuctions])

  const handleBidPlaced = useCallback((data) => {
    // If time was extended due to anti-snipe, update the endsAt immediately for responsive UI
    if (data.timeExtended && data.newEndsAt) {
      setAuctions(prev => prev.map(a =>
        a.id === data.auctionId ? { ...a, endsAt: data.newEndsAt } : a
      ))
    }
    // Always re-fetch to keep availableDkp and bid state in sync
    loadAuctions()

    if (!isEnabled || !user) return

    const currentUserId = user.id

    // Notify about time extension (anti-snipe)
    if (data.timeExtended) {
      const auction = auctionsRef.current.find(a => a.id === data.auctionId)
      showNotification(t('time_extended_notification'), {
        body: `+30s en ${auction?.itemName || 'la subasta'} (anti-snipe)`,
        tag: `snipe-${data.auctionId}`,
        playSound: false, // Don't play sound for this, it can be noisy
      })
    }

    // Check if current user was outbid
    if (data.outbidUserId === currentUserId) {
      const auction = auctionsRef.current.find(a => a.id === data.auctionId)
      showNotification(t('outbid_notification'), {
        body: `${data.characterName} ha pujado ${data.amount} DKP en ${auction?.itemName || 'la subasta'}`,
        tag: `outbid-${data.auctionId}`,
        requireInteraction: true,
      })
    }

    // Check if someone tied with current user
    if (data.tieWithUserId === currentUserId) {
      const auction = auctionsRef.current.find(a => a.id === data.auctionId)
      showNotification(t('tie_notification'), {
        body: `${data.characterName} ha empatado contigo en ${auction?.itemName || 'la subasta'} (${data.amount} DKP)`,
        tag: `tie-${data.auctionId}`,
        requireInteraction: true,
      })
    }
  }, [isEnabled, showNotification, user, t, loadAuctions])

  // Handle auction ended - show winner for 15s then move to history
  const handleAuctionEnded = useCallback((data) => {
    // Find the auction in current state to grab display data
    const existing = auctionsRef.current.find(a => a.id === data.auctionId)

    const wonAuction = {
      id: data.auctionId,
      itemName: data.itemName,
      itemImage: data.itemImage || existing?.itemImage,
      itemRarity: data.itemRarity || existing?.itemRarity || 'epic',
      itemId: data.itemId || existing?.itemId,
      winner: data.winner,
      winningBid: data.winningBid,
      wasTie: data.wasTie,
      winningRoll: data.winningRoll,
      rolls: data.rolls || [],
      wonAt: Date.now(),
    }

    setWonAuctions(prev => [...prev, wonAuction])

    // Remove from active auctions and refresh availableDkp immediately
    delete expiredAtRef.current[data.auctionId]
    setAuctions(prev => prev.filter(a => a.id !== data.auctionId))
    loadAuctions()

    // Auto-remove after 15 seconds
    const timeout = setTimeout(() => {
      setWonAuctions(prev => prev.filter(a => a.id !== data.auctionId))
      wonTimeoutsRef.current.delete(data.auctionId)
      loadAuctions() // Refresh to sync state
    }, 15000)
    wonTimeoutsRef.current.set(data.auctionId, timeout)

    if (!isEnabled || !user) return

    // Victory sound + notification for winner
    if (data.winnerId === user?.id) {
      playVictorySound()
      if (isEnabled) {
        showNotification(t('auction_won_notification'), {
          body: `${data.itemName || 'Item'} por ${data.winningBid || 0} DKP`,
          tag: `won-${data.auctionId}`,
          requireInteraction: true,
          playSound: false, // Victory sound already playing
        })
      }
    }
  }, [isEnabled, showNotification, playVictorySound, user, t, loadAuctions])

  useSocket({
    auction_started: handleAuctionStarted,
    auction_ended: handleAuctionEnded,
    bid_placed: handleBidPlaced,
    auction_cancelled: loadAuctions,
    auction_reset: loadAuctions,
    auctions_cleared: loadAuctions,
  })

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false)
    loadAuctions()
  }, [loadAuctions])

  const handleBidSuccess = useCallback(() => {
    setBidModal({ open: false, auction: null })
    loadAuctions()
  }, [loadAuctions])

  const handleCancelAuction = async (auctionId) => {
    if (!window.confirm(t('confirm_cancel_auction'))) return
    try {
      await auctionsAPI.cancel(auctionId)
      loadAuctions()
    } catch (err) {
      console.error('Cancel auction error:', err)
    }
  }

  const handleResetAuction = async (auctionId) => {
    if (!window.confirm(t('confirm_reset_auction'))) return
    try {
      await auctionsAPI.reset(auctionId)
      loadAuctions()
    } catch (err) {
      console.error('Reset auction error:', err)
    }
  }

  const formatTime = (time) => {
    if (!time) return '--:--'
    if (time.expired) return t('expired')
    return `${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`
  }

  const getTimeColor = (time) => {
    if (!time || time.expired) return 'text-red-500'
    if (time.minutes < 1) return 'text-red-400 animate-pulse'
    if (time.minutes < 2) return 'text-yellow-400'
    return 'text-green-400'
  }

  if (loading) return <AuctionsSkeleton />

  return (
    <div className="space-y-6">
      <SectionHeader icon={Gavel} title={t('active_auction_title')}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('history')}
            className="flex h-10 items-center gap-2 rounded-full border border-lavender-20 bg-indigo px-4 text-sm text-lavender transition-colors hover:bg-lavender-12 hover:text-cream"
          >
            <ClockCounterClockwise size={16} weight="bold" />
            <span className="hidden sm:inline">{t('auction_history')}</span>
          </button>

          {/* Notification Controls */}
          {isSupported && (
            <div className="flex items-center gap-1">
              {/* Notification Toggle */}
              <button
                onClick={isEnabled ? disableNotifications : enableNotifications}
                className={`h-10 rounded-l-full border px-3 text-sm transition-colors ${
                  isEnabled
                    ? 'border-teal bg-teal/10 text-teal'
                    : permission === 'denied'
                      ? 'cursor-not-allowed border-red-600 bg-red-600/20 text-red-400'
                      : 'border-lavender-20 bg-indigo text-lavender hover:bg-lavender-12 hover:text-cream'
                }`}
                title={
                  isEnabled
                    ? t('notifications_enabled')
                    : permission === 'denied'
                      ? t('notifications_blocked')
                      : t('enable_notifications')
                }
                disabled={permission === 'denied'}
              >
                {isEnabled ? <Bell size={16} weight="fill" /> : <BellSlash size={16} weight="fill" />}
                <span className="hidden sm:inline">
                  {isEnabled ? t('notifications_on') : t('notifications_off')}
                </span>
              </button>
              {/* Sound Toggle (only show if notifications enabled) */}
              {isEnabled && (
                <>
                  <button
                    onClick={toggleSound}
                    className={`h-10 border border-l-0 px-2 text-sm transition-colors ${
                      soundEnabled
                        ? 'border-teal bg-teal/10 text-teal'
                        : 'border-lavender-20 bg-indigo text-lavender hover:bg-lavender-12 hover:text-cream'
                    }`}
                    title={soundEnabled ? t('sound_on') : t('sound_off')}
                  >
                    {soundEnabled ? <SpeakerHigh size={16} weight="fill" /> : <SpeakerSlash size={16} weight="fill" />}
                  </button>
                  <button
                    onClick={() => setShowSoundModal(true)}
                    className="h-10 rounded-r-full border border-l-0 border-lavender-20 bg-indigo px-2 text-sm text-lavender transition-colors hover:bg-lavender-12 hover:text-coral"
                    title={t('sound_settings')}
                  >
                    <GearSix size={16} weight="fill" />
                  </button>
                </>
              )}
            </div>
          )}

          {isAdmin && (
            <>
              <Button
                onClick={() => setShowDistribution(true)}
                variant="teal"
                size="md"
                radius="pill"
                icon={Package}
                className="font-bold"
              >
                {t('distribution_queue')}
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="primary"
                size="md"
                radius="pill"
                icon={PlusCircle}
                className="font-bold"
              >
                {t('create_auction')}
              </Button>
            </>
          )}
        </div>
      </SectionHeader>

      <SurfaceCard className="space-y-4 p-5 sm:p-6">
        {auctions.length === 0 && wonAuctions.length === 0 ? (
          <p className="py-8 text-center text-lavender">{t('no_active_auction')}</p>
        ) : (
          <div className="space-y-4">
            {/* Won auctions - celebration display */}
            {wonAuctions.map((won) => (
              <div
                key={`won-${won.id}`}
                className="rounded-xl border-2 border-yellow-400/70 bg-gradient-to-r from-yellow-950/30 via-indigo to-yellow-950/30 p-4 transition-all animate-pulse-subtle"
                style={{ boxShadow: '0 0 24px 4px rgba(234,179,8,0.25)' }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  {/* Item Icon */}
                  <WowheadTooltip itemId={won.itemId}>
                    <div
                      className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-indigo"
                      style={{ borderColor: RARITY_COLORS[won.itemRarity] }}
                    >
                      {won.itemImage && won.itemImage !== '🎁' ? (
                        <img src={won.itemImage} alt={won.itemName} className="h-full w-full object-cover" />
                      ) : (
                        <Diamond size={28} weight="fill" style={{ color: RARITY_COLORS[won.itemRarity] }} className="mx-auto mt-3" />
                      )}
                    </div>
                  </WowheadTooltip>

                  {/* Item Name */}
                  <div className="min-w-0 flex-1">
                    <h4 className="mb-0 truncate text-lg" style={{ color: RARITY_COLORS[won.itemRarity] }}>
                      {won.itemName}
                    </h4>
                    <p className="m-0 mt-1 text-xs text-yellow-400/80 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Trophy size={12} weight="fill" />
                      {t('auction_sold')}
                    </p>
                  </div>

                  {/* Winner */}
                  <div className="min-w-[160px] text-left lg:text-center">
                    <p className="m-0 mb-1 text-xs text-yellow-400/80 flex items-center justify-center gap-1">
                      <Crown size={12} weight="fill" />
                      {t('winner')}
                    </p>
                    {won.winner ? (
                      <p
                        className="m-0 truncate text-lg font-bold"
                        style={{ color: CLASS_COLORS[won.winner.characterClass] || '#FFF' }}
                      >
                        {won.winner.characterName}
                      </p>
                    ) : (
                      <p className="m-0 text-lavender/60">{t('no_bids')}</p>
                    )}
                  </div>

                  {/* Winning Bid */}
                  <div className="min-w-[100px] text-left lg:text-center">
                    <p className="m-0 mb-1 text-xs text-lavender">{t('winning_bid')}</p>
                    <p className="m-0 text-xl font-bold text-green-400">
                      {won.winningBid || 0} <span className="text-sm">DKP</span>
                    </p>
                  </div>

                  {/* Tie Roll Info */}
                  {won.wasTie && won.rolls?.length > 0 && (
                    <div className="min-w-[120px] text-left lg:text-center">
                      <p className="m-0 mb-1 text-xs text-yellow-400/80 flex items-center justify-center gap-1">
                        <DiceFive size={12} weight="fill" />
                        {t('tie_resolved')}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {won.rolls.map((roll, i) => (
                          <span
                            key={i}
                            className={`text-xs font-semibold ${roll.userId === won.winner?.userId ? 'text-yellow-400' : 'text-lavender/70'}`}
                          >
                            {roll.characterName}: {roll.roll}
                            {roll.userId === won.winner?.userId && <Trophy size={10} weight="fill" className="inline ml-1" />}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {auctions.map((auction) => {
              const time = timeRemaining[auction.id]
              const isExpired = time?.expired
              return (
                <div
                  key={auction.id}
                  className={`rounded-xl border p-4 transition-all ${isExpired ? 'opacity-60' : ''} border-lavender-20/50 bg-indigo`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    {/* Item Icon */}
                    <WowheadTooltip itemId={auction.itemId}>
                      <div
                        className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-indigo"
                        style={{ borderColor: RARITY_COLORS[auction.itemRarity] }}
                      >
                        {auction.itemImage && auction.itemImage !== '🎁' ? (
                          <img
                            src={auction.itemImage}
                            alt={auction.itemName}
                            className="h-full w-full object-cover"
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
                          className="mx-auto mt-3"
                        />
                      </div>
                    </WowheadTooltip>

                    <div className="min-w-0 flex-1">
                      <h4
                        className="mb-0 truncate text-lg"
                        style={{ color: RARITY_COLORS[auction.itemRarity] }}
                      >
                        {auction.itemName}
                      </h4>
                    </div>

                    {/* Highest Bidder / Tie Info */}
                    <div className="min-w-[120px] text-left lg:text-center">
                      <p className="m-0 mb-1 text-xs text-lavender">
                        {auction.hasTie ? t('tied_bidders') : t('highest_bidder')}
                      </p>
                      {auction.hasTie ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1">
                            <DiceFive size={14} weight="fill" className="animate-pulse text-yellow-400" />
                            <span className="font-bold text-yellow-400 text-sm">{auction.tiedBidders?.length || 0} {t('players_tied')}</span>
                          </div>
                          {auction.tiedBidders?.map((b, i) => (
                            <span key={i} className="text-xs font-semibold truncate max-w-[120px]" style={{ color: CLASS_COLORS[b.characterClass] || '#FFF' }}>
                              {b.characterName}
                            </span>
                          ))}
                        </div>
                      ) : auction.highestBidder ? (
                        <p
                          className="m-0 truncate font-bold"
                          style={{ color: CLASS_COLORS[auction.highestBidder.characterClass] || '#FFF' }}
                        >
                          {auction.highestBidder.characterName}
                        </p>
                      ) : (
                        <p className="m-0 text-lavender/60">-</p>
                      )}
                    </div>

                    {/* Current Bid */}
                    <div className="min-w-[100px] text-left lg:text-center">
                      <p className="m-0 mb-1 text-xs text-lavender">{t('current_bid')}</p>
                      <p className="m-0 text-xl font-bold text-green-400">
                        {auction.currentBid || 0} <span className="text-sm">DKP</span>
                      </p>
                    </div>

                    {/* Time Remaining */}
                    <div className="min-w-[80px] text-left lg:text-center">
                      <p className="m-0 mb-1 flex items-center justify-center gap-1 text-xs text-lavender">
                        {t('time_remaining')}
                        <ShieldStar
                          size={12}
                          weight="fill"
                          className="cursor-help text-blue-400"
                          title={t('anti_snipe_info')}
                        />
                      </p>
                      <p className={`m-0 font-mono text-xl font-bold ${getTimeColor(time)}`}>
                        {formatTime(time)}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex w-full shrink-0 gap-2 lg:w-auto">
                      {(() => {
                        const classRestricted = auction.eligibleClasses && !auction.eligibleClasses.includes(user?.characterClass)
                        return (
                          <Button
                            onClick={() => setBidModal({ open: true, auction })}
                            disabled={isExpired || classRestricted}
                            variant="success"
                            size="md"
                            radius="pill"
                            icon={classRestricted ? Lock : HandCoins}
                            className="flex-1 font-bold lg:flex-initial"
                            title={classRestricted ? `${t('class_restricted')}: ${auction.eligibleClasses.join(', ')}` : ''}
                          >
                            {classRestricted ? t('class_restricted') : t('place_bid')}
                          </Button>
                        )
                      })()}
                      {isAdmin && (
                        <>
                          <Button
                            onClick={() => handleResetAuction(auction.id)}
                            variant="warning"
                            size="md"
                            radius="pill"
                            icon={ArrowCounterClockwise}
                            className="flex-1 font-bold lg:flex-initial"
                          >
                            {t('reset_auction')}
                          </Button>
                          <Button
                            onClick={() => handleCancelAuction(auction.id)}
                            variant="danger"
                            size="md"
                            radius="pill"
                            icon={X}
                            className="flex-1 font-bold lg:flex-initial"
                          >
                            {t('cancel_auction')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SurfaceCard>

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
          userClass={user?.characterClass}
          ownBid={bidModal.auction?.bids?.find(b => b.userId === user?.id)?.amount || 0}
          onClose={() => setBidModal({ open: false, auction: null })}
          onSuccess={handleBidSuccess}
        />
      )}

      {/* Distribution Queue Modal */}
      {showDistribution && (
        <DistributionQueue onClose={() => setShowDistribution(false)} />
      )}

      {/* Sound Settings Modal */}
      {showSoundModal && createPortal(
        <SoundSettingsModal
          selectedSound={selectedSound}
          customSoundData={customSoundData}
          volume={volume}
          onChangeSound={changeSound}
          onPreviewSound={previewSound}
          onSetCustomSound={setCustomSound}
          onClearCustomSound={clearCustomSound}
          onSetVolume={setVolume}
          onClose={() => setShowSoundModal(false)}
          t={t}
        />,
        document.body
      )}
    </div>
  )
}

export default AuctionTab
