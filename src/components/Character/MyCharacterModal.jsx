import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI, authAPI, charactersAPI, blizzardAPI } from '../../services/api'
import WowheadTooltip from '../Common/WowheadTooltip'
import { X, CircleNotch, PencilSimple, Crop, MagnifyingGlassMinus, MagnifyingGlassPlus, User, Users, Coins, Envelope, Key, FloppyDisk, Gavel, ClockCounterClockwise, WarningCircle, DownloadSimple, ArrowsClockwise, Trash, Star, Info, Camera } from '@phosphor-icons/react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import {
  CHARACTER_MODAL_VIEW,
  CHARACTER_MODAL_VIEW_ORDER,
  normalizeCharacterModalView,
} from './characterModalViews'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#3FC7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
  DeathKnight: '#C41F3B', 'Demon Hunter': '#A330C9', DemonHunter: '#A330C9', Monk: '#00FF96', Evoker: '#33937F',
}

const SPEC_ICONS = {
  'Arms': 'https://wow.zamimg.com/images/wow/icons/medium/ability_warrior_savageblow.jpg',
  'Fury': 'https://wow.zamimg.com/images/wow/icons/medium/ability_warrior_innerrage.jpg',
  'Protection Warrior': 'https://wow.zamimg.com/images/wow/icons/medium/ability_warrior_defensivestance.jpg',
  'Holy Paladin': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_holybolt.jpg',
  'Protection Paladin': 'https://wow.zamimg.com/images/wow/icons/medium/ability_paladin_shieldofthetemplar.jpg',
  'Retribution': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_auraoflight.jpg',
  'Beast Mastery': 'https://wow.zamimg.com/images/wow/icons/medium/ability_hunter_bestialdiscipline.jpg',
  'Marksmanship': 'https://wow.zamimg.com/images/wow/icons/medium/ability_hunter_focusedaim.jpg',
  'Survival': 'https://wow.zamimg.com/images/wow/icons/medium/ability_hunter_camouflage.jpg',
  'Assassination': 'https://wow.zamimg.com/images/wow/icons/medium/ability_rogue_deadlybrew.jpg',
  'Outlaw': 'https://wow.zamimg.com/images/wow/icons/medium/ability_rogue_waylay.jpg',
  'Subtlety': 'https://wow.zamimg.com/images/wow/icons/medium/ability_stealth.jpg',
  'Discipline': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_powerwordshield.jpg',
  'Holy Priest': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_guardianspirit.jpg',
  'Shadow': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_shadowwordpain.jpg',
  'Elemental': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_lightning.jpg',
  'Enhancement': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shaman_improvedstormstrike.jpg',
  'Restoration Shaman': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_magicimmunity.jpg',
  'Arcane': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_magicalsentry.jpg',
  'Fire': 'https://wow.zamimg.com/images/wow/icons/medium/spell_fire_firebolt02.jpg',
  'Frost Mage': 'https://wow.zamimg.com/images/wow/icons/medium/spell_frost_frostbolt02.jpg',
  'Affliction': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_deathcoil.jpg',
  'Demonology': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_metamorphosis.jpg',
  'Destruction': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_rainoffire.jpg',
  'Balance': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_starfall.jpg',
  'Feral': 'https://wow.zamimg.com/images/wow/icons/medium/ability_druid_catform.jpg',
  'Guardian': 'https://wow.zamimg.com/images/wow/icons/medium/ability_racial_bearform.jpg',
  'Restoration Druid': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_healingtouch.jpg',
  'Blood': 'https://wow.zamimg.com/images/wow/icons/medium/spell_deathknight_bloodpresence.jpg',
  'Frost DK': 'https://wow.zamimg.com/images/wow/icons/medium/spell_deathknight_frostpresence.jpg',
  'Unholy': 'https://wow.zamimg.com/images/wow/icons/medium/spell_deathknight_unholypresence.jpg',
  'Brewmaster': 'https://wow.zamimg.com/images/wow/icons/medium/spell_monk_brewmaster_spec.jpg',
  'Mistweaver': 'https://wow.zamimg.com/images/wow/icons/medium/spell_monk_mistweaver_spec.jpg',
  'Windwalker': 'https://wow.zamimg.com/images/wow/icons/medium/spell_monk_windwalker_spec.jpg',
  'Havoc': 'https://wow.zamimg.com/images/wow/icons/medium/ability_demonhunter_specdps.jpg',
  'Vengeance': 'https://wow.zamimg.com/images/wow/icons/medium/ability_demonhunter_spectank.jpg',
  'Devastation': 'https://wow.zamimg.com/images/wow/icons/medium/classicon_evoker_devastation.jpg',
  'Preservation': 'https://wow.zamimg.com/images/wow/icons/medium/classicon_evoker_preservation.jpg',
  'Augmentation': 'https://wow.zamimg.com/images/wow/icons/medium/classicon_evoker_augmentation.jpg',
}

const CLASS_SPECS = {
  Warrior: { specs: ['Arms', 'Fury', 'Protection Warrior'], defaultRoles: ['DPS', 'DPS', 'Tank'] },
  Paladin: { specs: ['Holy Paladin', 'Protection Paladin', 'Retribution'], defaultRoles: ['Healer', 'Tank', 'DPS'] },
  Hunter: { specs: ['Beast Mastery', 'Marksmanship', 'Survival'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Rogue: { specs: ['Assassination', 'Outlaw', 'Subtlety'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Priest: { specs: ['Discipline', 'Holy Priest', 'Shadow'], defaultRoles: ['Healer', 'Healer', 'DPS'] },
  Shaman: { specs: ['Elemental', 'Enhancement', 'Restoration Shaman'], defaultRoles: ['DPS', 'DPS', 'Healer'] },
  Mage: { specs: ['Arcane', 'Fire', 'Frost Mage'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Warlock: { specs: ['Affliction', 'Demonology', 'Destruction'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Druid: { specs: ['Balance', 'Feral', 'Guardian', 'Restoration Druid'], defaultRoles: ['DPS', 'DPS', 'Tank', 'Healer'] },
  'Death Knight': { specs: ['Blood', 'Frost DK', 'Unholy'], defaultRoles: ['Tank', 'DPS', 'DPS'] },
  Monk: { specs: ['Brewmaster', 'Mistweaver', 'Windwalker'], defaultRoles: ['Tank', 'Healer', 'DPS'] },
  'Demon Hunter': { specs: ['Havoc', 'Vengeance'], defaultRoles: ['DPS', 'Tank'] },
  Evoker: { specs: ['Devastation', 'Preservation', 'Augmentation'], defaultRoles: ['DPS', 'Healer', 'DPS'] },
}

const RARITY_COLORS = {
  common: '#9d9d9d', uncommon: '#1eff00', rare: '#0070dd',
  epic: '#a335ee', legendary: '#ff8000',
}

const TAB_ICONS = {
  [CHARACTER_MODAL_VIEW.ACCOUNT]: User,
  [CHARACTER_MODAL_VIEW.CHARACTERS]: Users,
  [CHARACTER_MODAL_VIEW.DKP]: Coins,
}

// CLASSES removed - manual character creation disabled, only Blizzard import allowed

// Crop and compress image based on user selection.
// containerW/containerH = preview container dimensions in screen pixels.
// outputW/outputH = final output dimensions.
const cropAndCompressImage = (
  imageSrc, cropData,
  outputW = 400, outputH = 400,
  containerW = 256, containerH = 256,
  maxBytes = 150 * 1024
) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = outputW
      canvas.height = outputH
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Position (x,y) is a screen-pixel offset from center. Convert to image pixels by dividing by scale.
      const { x, y, scale } = cropData
      const cropW = containerW / scale
      const cropH = containerH / scale
      const sourceX = img.width / 2 - x / scale - cropW / 2
      const sourceY = img.height / 2 - y / scale - cropH / 2

      ctx.drawImage(img, sourceX, sourceY, cropW, cropH, 0, 0, outputW, outputH)

      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
      const format = supportsWebP ? 'image/webp' : 'image/jpeg'

      let quality = 0.92
      let dataUrl = canvas.toDataURL(format, quality)
      while (dataUrl.length > maxBytes && quality > 0.3) {
        quality -= 0.05
        dataUrl = canvas.toDataURL(format, quality)
      }
      resolve(dataUrl)
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

// Avatar Crop Modal Component
const AvatarCropModal = ({ imageSrc, onConfirm, onCancel, t }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(0.5)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useCallback(node => { if (node) window._cropContainer = node }, [])

  const handleMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e) => {
    if (!dragging) return
    const maxOffset = 100 * scale
    const newX = Math.max(-maxOffset, Math.min(maxOffset, e.clientX - dragStart.x))
    const newY = Math.max(-maxOffset, Math.min(maxOffset, e.clientY - dragStart.y))
    setPosition({ x: newX, y: newY })
  }

  const handleMouseUp = () => setDragging(false)

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    setDragging(true)
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
  }

  const handleTouchMove = (e) => {
    if (!dragging) return
    const touch = e.touches[0]
    const maxOffset = 100 * scale
    const newX = Math.max(-maxOffset, Math.min(maxOffset, touch.clientX - dragStart.x))
    const newY = Math.max(-maxOffset, Math.min(maxOffset, touch.clientY - dragStart.y))
    setPosition({ x: newX, y: newY })
  }

  const handleConfirm = async () => {
    // Square avatar: 400x400 output, 256x256 preview container
    const croppedImage = await cropAndCompressImage(imageSrc, { ...position, scale }, 400, 400, 256, 256)
    onConfirm(croppedImage)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-indigo border-2 border-lavender-20 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-lg text-coral mb-4 text-center">
          <Crop size={18} className="inline mr-2" />{t('crop_avatar')}
        </h4>

        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative w-64 h-64 mx-auto mb-4 overflow-hidden rounded-full border-4 border-lavender-20 cursor-move"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <img
            src={imageSrc}
            alt="Crop preview"
            className="absolute select-none pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
              maxWidth: 'none',
              width: 'auto',
              height: 'auto',
              minWidth: '100%',
              minHeight: '100%',
            }}
            draggable={false}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mb-4 px-4">
          <MagnifyingGlassMinus size={16} className="text-lavender" />
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-lavender-20"
          />
          <MagnifyingGlassPlus size={16} className="text-lavender" />
        </div>

        <p className="text-xs text-lavender text-center mb-4">
          {t('drag_to_position')}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            size="sm"
            radius="round"
            className="flex-1"
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            variant="primary"
            size="sm"
            radius="round"
            className="flex-1 font-bold"
          >
            {t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Banner Crop Modal — wide 3:1 aspect ratio (900×300 output, ~384×128 preview)
const BANNER_CONTAINER_W = 384
const BANNER_CONTAINER_H = 128

const BannerCropModal = ({ imageSrc, onConfirm, onCancel, t }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(0.5)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e) => {
    if (!dragging) return
    const maxOffsetX = (BANNER_CONTAINER_W / 2) * scale
    const maxOffsetY = (BANNER_CONTAINER_H / 2) * scale
    const newX = Math.max(-maxOffsetX, Math.min(maxOffsetX, e.clientX - dragStart.x))
    const newY = Math.max(-maxOffsetY, Math.min(maxOffsetY, e.clientY - dragStart.y))
    setPosition({ x: newX, y: newY })
  }

  const handleMouseUp = () => setDragging(false)

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    setDragging(true)
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
  }

  const handleTouchMove = (e) => {
    if (!dragging) return
    const touch = e.touches[0]
    const maxOffsetX = (BANNER_CONTAINER_W / 2) * scale
    const maxOffsetY = (BANNER_CONTAINER_H / 2) * scale
    const newX = Math.max(-maxOffsetX, Math.min(maxOffsetX, touch.clientX - dragStart.x))
    const newY = Math.max(-maxOffsetY, Math.min(maxOffsetY, touch.clientY - dragStart.y))
    setPosition({ x: newX, y: newY })
  }

  const handleConfirm = async () => {
    // Banner: 900×300 output, 384×128 preview container
    const croppedImage = await cropAndCompressImage(
      imageSrc, { ...position, scale },
      900, 300,
      BANNER_CONTAINER_W, BANNER_CONTAINER_H,
      300 * 1024
    )
    onConfirm(croppedImage)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110]" onClick={(e) => e.stopPropagation()}>
      <div className="bg-indigo border-2 border-lavender-20 rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-lg text-coral mb-4 text-center">
          <Camera size={18} className="inline mr-2" />{t('crop_banner') || 'Ajustar banner'}
        </h4>

        {/* Crop area — wide 3:1 */}
        <div
          className="relative mx-auto mb-4 overflow-hidden rounded-lg border-2 border-lavender-20 cursor-move"
          style={{ width: BANNER_CONTAINER_W, height: BANNER_CONTAINER_H, background: 'rgba(0,0,0,0.5)' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <img
            src={imageSrc}
            alt="Banner preview"
            className="absolute select-none pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
              maxWidth: 'none',
              width: 'auto',
              height: 'auto',
              minWidth: '100%',
              minHeight: '100%',
            }}
            draggable={false}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 mb-4 px-4">
          <MagnifyingGlassMinus size={16} className="text-lavender" />
          <input
            type="range"
            min="0.3"
            max="3"
            step="0.05"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-lavender-20"
          />
          <MagnifyingGlassPlus size={16} className="text-lavender" />
        </div>

        <p className="text-xs text-lavender text-center mb-4">
          {t('drag_to_position')}
        </p>

        <div className="flex gap-3">
          <Button onClick={onCancel} variant="outline" size="sm" radius="round" className="flex-1">
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm} variant="primary" size="sm" radius="round" className="flex-1 font-bold">
            {t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}

const MyCharacterModal = ({
  onClose,
  initialTab = CHARACTER_MODAL_VIEW.ACCOUNT,
  showTabs = true,
  importOnboarding = false,
  onImportClicked,
}) => {
  const { user, refreshUser } = useAuth()
  const { t, language } = useLanguage()
  const [activeTab, setActiveTab] = useState(normalizeCharacterModalView(initialTab))
  const [history, setHistory] = useState([])
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState(user?.email || '')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')
  const [charError, setCharError] = useState('')
  const [blizzardChars, setBlizzardChars] = useState([])
  const [blizzardLoading, setBlizzardLoading] = useState(false)
  const [blizzardError, setBlizzardError] = useState('')
  const [selectedChars, setSelectedChars] = useState(new Set())
  const [importing, setImporting] = useState(false)
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  // Avatar state
  const [avatarMsg, setAvatarMsg] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)
  const avatarInputRef = useRef(null)
  // Avatar crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)
  // Banner state
  const [bannerHover, setBannerHover] = useState(false)
  const [bannerSaving, setBannerSaving] = useState(false)
  const [bannerMsg, setBannerMsg] = useState('')
  const [bannerMsgOk, setBannerMsgOk] = useState(true)
  const bannerInputRef = useRef(null)
  // Banner crop modal state
  const [bannerCropOpen, setBannerCropOpen] = useState(false)
  const [bannerCropImageSrc, setBannerCropImageSrc] = useState(null)
  // Edit spec state
  const [editingCharId, setEditingCharId] = useState(null)
  const [editingSaving, setEditingSaving] = useState(false)
  // Onboarding: measure the Blizzard import button to show a beacon above it
  const importBtnRef = useRef(null)
  const [importBtnRect, setImportBtnRect] = useState(null)

  useLayoutEffect(() => {
    if (!importOnboarding || activeTab !== 'characters') return
    const el = importBtnRef.current
    if (!el) return
    const update = () => setImportBtnRect(el.getBoundingClientRect())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [importOnboarding, activeTab, loading])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setActiveTab(normalizeCharacterModalView(initialTab))
  }, [initialTab])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [histRes, charRes] = await Promise.all([
        dkpAPI.getHistory(user.id),
        charactersAPI.getAll(),
      ])
      setHistory(histRes.data?.transactions || [])
      setCharacters(charRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEmail = async () => {
    setEmailSaving(true)
    setEmailMsg('')
    try {
      await authAPI.updateProfile({ email: email || null })
      await refreshUser()
      setEmailMsg(t('email_saved'))
      setTimeout(() => setEmailMsg(''), 3000)
    } catch (error) {
      setEmailMsg(error.response?.data?.error || 'Error')
    } finally {
      setEmailSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMsg(t('password_min_length'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg(t('passwords_dont_match'))
      return
    }
    setPasswordSaving(true)
    setPasswordMsg('')
    try {
      await authAPI.updateProfile({ currentPassword, newPassword })
      setPasswordMsg(t('password_changed'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMsg(''), 3000)
    } catch (error) {
      setPasswordMsg(error.response?.data?.error || 'Error')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setAvatarMsg(t('avatar_invalid_type'))
      setTimeout(() => setAvatarMsg(''), 3000)
      return
    }

    // Read file and open crop modal
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCropImageSrc(ev.target.result)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)

    // Clear input so same file can be selected again
    e.target.value = ''
  }

  const handleCropConfirm = async (croppedImage) => {
    setCropModalOpen(false)
    setCropImageSrc(null)
    setAvatarSaving(true)
    setAvatarMsg('')

    try {
      await authAPI.updateProfile({ avatar: croppedImage })
      await refreshUser()
      setAvatarMsg(t('avatar_saved'))
      setTimeout(() => setAvatarMsg(''), 3000)
    } catch (error) {
      setAvatarMsg(error.response?.data?.error || 'Error uploading avatar')
    } finally {
      setAvatarSaving(false)
    }
  }

  const handleCropCancel = () => {
    setCropModalOpen(false)
    setCropImageSrc(null)
  }

  const handleRemoveAvatar = async () => {
    setAvatarSaving(true)
    setAvatarMsg('')
    try {
      await authAPI.updateProfile({ avatar: null })
      await refreshUser()
      setAvatarMsg(t('avatar_removed'))
      setTimeout(() => setAvatarMsg(''), 3000)
    } catch (error) {
      setAvatarMsg(error.response?.data?.error || 'Error')
    } finally {
      setAvatarSaving(false)
    }
  }

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setBannerMsg(t('avatar_invalid_type'))
      setBannerMsgOk(false)
      setTimeout(() => setBannerMsg(''), 3000)
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setBannerCropImageSrc(ev.target.result)
      setBannerCropOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleBannerCropConfirm = async (croppedImage) => {
    setBannerCropOpen(false)
    setBannerCropImageSrc(null)
    setBannerSaving(true)
    setBannerMsg('')
    try {
      await authAPI.updateProfile({ banner: croppedImage })
      await refreshUser()
      setBannerMsgOk(true)
      setBannerMsg('Banner guardado')
      setTimeout(() => setBannerMsg(''), 3000)
    } catch (error) {
      const msg = error.response?.data?.error
      setBannerMsgOk(false)
      setBannerMsg(msg || (error.code === 'ERR_NETWORK' || !error.response ? 'Error de conexión — inténtalo de nuevo' : 'Error al subir el banner'))
    } finally {
      setBannerSaving(false)
    }
  }

  const handleBannerCropCancel = () => {
    setBannerCropOpen(false)
    setBannerCropImageSrc(null)
  }

  const handleRemoveBanner = async () => {
    setBannerSaving(true)
    setBannerMsg('')
    try {
      await authAPI.updateProfile({ banner: null })
      await refreshUser()
      setBannerMsgOk(true)
      setBannerMsg('Banner eliminado')
      setTimeout(() => setBannerMsg(''), 3000)
    } catch (error) {
      setBannerMsgOk(false)
      setBannerMsg(error.response?.data?.error || 'Error')
    } finally {
      setBannerSaving(false)
    }
  }

  const handleSetPrimary = async (charId) => {
    try {
      await charactersAPI.setPrimary(charId)
      await refreshUser()
      const res = await charactersAPI.getAll()
      setCharacters(res.data || [])
      window.dispatchEvent(new Event('roster-refresh'))
    } catch (error) {
      console.error('Error setting primary:', error)
    }
  }

  const handleDeleteCharacter = async (charId) => {
    const char = characters.find(c => c.id === charId)
    if (characters.length <= 1) {
      setCharError(t('cannot_delete_only'))
      setTimeout(() => setCharError(''), 3000)
      return
    }
    if (char?.isPrimary) {
      setCharError(t('cannot_delete_primary'))
      setTimeout(() => setCharError(''), 3000)
      return
    }
    if (!confirm(t('confirm_delete_character'))) return
    try {
      await charactersAPI.remove(charId)
      const res = await charactersAPI.getAll()
      setCharacters(res.data || [])
    } catch (error) {
      setCharError(error.response?.data?.error || 'Error')
    }
  }

  const handleChangeSpec = async (charId, newSpec) => {
    const char = characters.find(c => c.id === charId)
    if (!char) return

    // Get the role for this spec
    const classData = CLASS_SPECS[char.characterClass]
    if (!classData) return

    const specIndex = classData.specs.indexOf(newSpec)
    const newRole = specIndex >= 0 ? classData.defaultRoles[specIndex] : 'DPS'

    setEditingSaving(true)
    try {
      await charactersAPI.update(charId, { spec: newSpec, raidRole: newRole })
      const res = await charactersAPI.getAll()
      setCharacters(res.data || [])
      if (char.isPrimary) {
        await refreshUser()
      }
      setEditingCharId(null)
    } catch (error) {
      setCharError(error.response?.data?.error || 'Error')
      setTimeout(() => setCharError(''), 3000)
    } finally {
      setEditingSaving(false)
    }
  }

  const handleBlizzardImport = async () => {
    setBlizzardLoading(true)
    setBlizzardError('')
    setBlizzardChars([])
    try {
      const res = await blizzardAPI.getOAuthUrl()
      const popup = window.open(res.data.url, 'blizzard-auth', 'width=600,height=700,scrollbars=yes')

      if (!popup) {
        setBlizzardError(t('blizzard_popup_blocked'))
        setBlizzardLoading(false)
        return
      }

      const handler = (event) => {
        if (event.data?.type !== 'blizzard-characters') return
        window.removeEventListener('message', handler)
        clearInterval(pollTimer)
        try {
          const data = event.data.data
          if (data.error) {
            setBlizzardError(data.error)
          } else {
            const chars = (data.characters || []).filter(c => c.name)
            setBlizzardChars(chars)
            const preSelected = new Set()
            chars.forEach((c, i) => {
              const exists = characters.some(ex =>
                (ex.characterName || '').toLowerCase() === (c.name || '').toLowerCase()
              )
              if (!exists) preSelected.add(i)
            })
            setSelectedChars(preSelected)
          }
        } catch (err) {
          console.error('Error processing Blizzard characters:', err)
          setBlizzardError('Error processing character data')
        }
        setBlizzardLoading(false)
      }
      window.addEventListener('message', handler)

      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer)
          window.removeEventListener('message', handler)
          setBlizzardLoading(false)
        }
      }, 1000)
    } catch (error) {
      setBlizzardError(error.response?.data?.error || 'Error')
      setBlizzardLoading(false)
    }
  }

  const toggleCharSelection = (index) => {
    const newSelected = new Set(selectedChars)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedChars(newSelected)
  }

  const handleImportSelected = async () => {
    setImporting(true)
    setCharError('')
    let importCount = 0

    for (const index of selectedChars) {
      const char = blizzardChars[index]
      // Use spec/role from Blizzard, or pick a random valid one for the class
      let spec = char.spec || null
      let raidRole = char.raidRole || 'DPS'
      if (!spec && CLASS_SPECS[char.className]) {
        const classData = CLASS_SPECS[char.className]
        const randIdx = Math.floor(Math.random() * classData.specs.length)
        spec = classData.specs[randIdx]
        raidRole = classData.defaultRoles[randIdx]
      }
      try {
        await charactersAPI.create({
          characterName: char.name,
          characterClass: char.className,
          spec: spec || '',
          raidRole,
          realm: char.realm || null,
          realmSlug: char.realmSlug || null,
        })
        importCount++
      } catch (error) {
        console.error(`Failed to import ${char.name}:`, error.response?.data?.error || error.message)
      }
    }

    try {
      const res = await charactersAPI.getAll()
      setCharacters(res.data || [])
    } catch (error) {
      console.error('Failed to reload characters:', error)
    }
    setBlizzardChars([])
    setSelectedChars(new Set())
    setImporting(false)

    if (importCount > 0) {
      setCharError(`${importCount} ${t('characters_imported')}`)
      setTimeout(() => setCharError(''), 4000)
      refreshUser()
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header — banner as background, compact single-row */}
        {(() => {
          const classColor = CLASS_COLORS[user?.characterClass] || '#A78BFA'
          const roleBadge = user?.raidRole
            ? user.raidRole === 'Healer' ? 'bg-green-500/20 text-green-400'
            : user.raidRole === 'Tank' ? 'bg-blue-500/20 text-blue-400'
            : 'bg-orange-500/20 text-orange-400'
            : null
          return (
            <div
              className="relative flex-shrink-0 p-6 rounded-t-2xl overflow-hidden cursor-pointer border-b border-lavender-20/30"
              onMouseEnter={() => setBannerHover(true)}
              onMouseLeave={() => setBannerHover(false)}
              onClick={() => !bannerSaving && bannerInputRef.current?.click()}
            >
              {/* Banner background */}
              {user?.banner ? (
                <img src={user.banner} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <>
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${classColor}70 0%, ${classColor}30 50%, #1a1a3e 100%)` }} />
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
                </>
              )}

              {/* Gradient overlay for text readability when banner is present */}
              {user?.banner && (
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
              )}

              {/* Banner hover overlay — hidden when hovering avatar */}
              <div className={`absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-1.5 transition-opacity ${bannerHover && !avatarHover ? 'opacity-100' : 'opacity-0'}`}>
                {bannerSaving ? (
                  <CircleNotch size={26} className="text-white animate-spin" />
                ) : (
                  <>
                    <Camera size={26} className="text-white" />
                    <span className="text-xs text-white/80 font-medium">Cambiar banner</span>
                  </>
                )}
              </div>

              {/* Remove banner */}
              {user?.banner && !bannerSaving && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveBanner() }}
                  className={`absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500 flex items-center justify-center transition-all ${bannerHover ? 'opacity-100' : 'opacity-0'}`}
                  title="Eliminar banner"
                >
                  <X size={12} className="text-white" />
                </button>
              )}

              {/* Close modal */}
              <button
                onClick={(e) => { e.stopPropagation(); onClose() }}
                className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors bg-black/30 hover:bg-black/50 rounded-full p-1.5 z-20"
              >
                <X size={18} />
              </button>

              {/* Hidden banner input */}
              <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleBannerUpload} disabled={bannerSaving} className="hidden" />

              {/* Content row */}
              <div className="relative z-10 flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="relative shrink-0 cursor-pointer"
                  onMouseEnter={(e) => { e.stopPropagation(); setBannerHover(false); setAvatarHover(true) }}
                  onMouseLeave={() => setAvatarHover(false)}
                  onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click() }}
                >
                  <div
                    className="w-16 h-16 rounded-full bg-lavender-12 flex items-center justify-center overflow-hidden border-2 shadow-xl transition-all duration-200"
                    style={{ borderColor: avatarHover ? '#FF6B6B' : classColor }}
                  >
                    {user?.avatar ? (
                      <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <img src="/logo.svg" alt="Default" className="w-full h-full object-cover" />
                    )}
                  </div>
                  {/* Avatar hover overlay */}
                  <div className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity ${avatarHover ? 'opacity-100' : 'opacity-0'}`}>
                    {avatarSaving ? <CircleNotch size={18} className="text-white animate-spin" /> : <PencilSimple size={18} className="text-white" />}
                  </div>
                  {/* Remove avatar */}
                  {user?.avatar && !avatarSaving && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveAvatar() }}
                      className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-all ${avatarHover ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                      title={t('remove_avatar')}
                    >
                      <X size={10} className="text-white" />
                    </button>
                  )}
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} disabled={avatarSaving} className="hidden" />
                </div>

                {/* Name / class / spec + messages */}
                <div>
                  <h3
                    className="text-xl font-bold m-0 leading-tight"
                    style={{
                      color: classColor,
                      textShadow: user?.banner ? '0 1px 4px rgba(0,0,0,0.9)' : 'none',
                    }}
                  >
                    {user?.characterName || user?.username}
                  </h3>
                  {user?.characterClass ? (
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p
                        className="text-sm m-0"
                        style={{
                          color: user?.banner ? 'rgba(255,255,255,0.85)' : undefined,
                          textShadow: user?.banner ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
                        }}
                      >
                        {user.characterClass}{user.spec ? ` · ${user.spec}` : ''}
                      </p>
                      {roleBadge && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadge}`}>
                          {user.raidRole}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p
                      className="text-sm m-0"
                      style={{ color: user?.banner ? 'rgba(255,255,255,0.7)' : undefined }}
                    >
                      {t('no_character')}
                    </p>
                  )}
                  {avatarMsg && (
                    <p className={`text-xs m-0 mt-1 ${avatarMsg === t('avatar_saved') || avatarMsg === t('avatar_removed') ? 'text-green-400' : 'text-red-400'}`}>{avatarMsg}</p>
                  )}
                  {bannerMsg && (
                    <p className={`text-xs m-0 mt-1 ${bannerMsgOk ? 'text-green-400' : 'text-red-400'}`}>{bannerMsg}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {showTabs && (
          <div className="flex border-b border-lavender-20/30 flex-shrink-0">
            {CHARACTER_MODAL_VIEW_ORDER.map((tab) => {
              const TabIcon = TAB_ICONS[tab]
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 px-4 text-sm font-semibold transition-all ${
                    activeTab === tab
                      ? 'text-coral border-b-2 border-coral bg-lavender-12/20'
                      : 'text-lavender hover:text-white hover:bg-lavender-12/10'
                  }`}
                >
                  <TabIcon size={16} className="inline mr-2" />
                  {t(`tab_${tab}`)}
                </button>
              )
            })}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          {/* ========== ACCOUNT TAB ========== */}
          {activeTab === 'account' && (
            <>
              {/* Email Section */}
              <div className="p-6 border-b border-lavender-20/30">
                <h4 className="text-sm text-coral mb-3">
                  <Envelope size={14} className="inline mr-2" />{t('email')}
                </h4>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('email_placeholder')}
                    size="sm"
                    radius="round"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSaveEmail}
                    disabled={emailSaving}
                    variant="secondary"
                    size="sm"
                    radius="round"
                    className="font-bold"
                  >
                    {emailSaving ? <CircleNotch size={16} className="animate-spin" /> : t('save')}
                  </Button>
                </div>
                {emailMsg && (
                  <p className={`text-xs mt-2 ${emailMsg === t('email_saved') ? 'text-green-400' : 'text-red-400'}`}>
                    {emailMsg}
                  </p>
                )}
              </div>

              {/* Password Change Section */}
              <div className="p-6">
                <h4 className="text-sm text-coral mb-3">
                  <Key size={14} className="inline mr-2" />{t('change_password')}
                </h4>
                <div className="space-y-3">
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('password_placeholder')}
                    size="sm"
                    radius="round"
                  />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('password_placeholder')}
                    size="sm"
                    radius="round"
                  />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('password_placeholder')}
                    size="sm"
                    radius="round"
                  />
                  <Button
                    onClick={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    variant="primary"
                    size="sm"
                    radius="round"
                    fullWidth
                    className="font-bold"
                  >
                    {passwordSaving ? <CircleNotch size={16} className="inline animate-spin mr-2" /> : <FloppyDisk size={16} className="inline mr-2" />}
                    {t('change_password')}
                  </Button>
                </div>
                {passwordMsg && (
                  <p className={`text-xs mt-2 ${passwordMsg === t('password_changed') ? 'text-green-400' : 'text-red-400'}`}>
                    {passwordMsg}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ========== CHARACTERS TAB ========== */}
          {activeTab === 'characters' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm text-coral m-0">
                  <Users size={14} className="inline mr-2" />{t('my_characters')}
                </h4>
                <Button
                  ref={importBtnRef}
                  onClick={() => { if (importOnboarding && onImportClicked) onImportClicked(); handleBlizzardImport() }}
                  disabled={blizzardLoading}
                  variant="outline"
                  size="sm"
                  radius="round"
                  className="text-xs"
                  title={t('blizzard_import_hint')}
                >
                  {blizzardLoading ? (
                    <><CircleNotch size={12} className="inline animate-spin mr-1" /></>
                  ) : (
                    <><DownloadSimple size={12} className="inline mr-1" />{t('import_from_blizzard')}</>
                  )}
                </Button>
              </div>

            {charError && (
              <p className={`text-xs mb-2 ${charError.includes(t('characters_imported')) ? 'text-green-400' : 'text-red-400'}`}>{charError}</p>
            )}

            {blizzardError && (
              <p className="text-xs text-red-400 mb-2"><WarningCircle size={12} className="inline mr-1" />{blizzardError}</p>
            )}

            {/* Blizzard Import Results */}
            {blizzardChars.length > 0 && (
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-blue-300 m-0 font-bold">
                    <DownloadSimple size={14} className="inline mr-1" />
                    {t('blizzard_characters_found')} ({blizzardChars.length})
                  </p>
                  <button onClick={() => { setBlizzardChars([]); setSelectedChars(new Set()) }}
                    className="text-xs text-lavender transition-colors hover:text-cream">
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-auto mb-2">
                  {blizzardChars.map((char, idx) => {
                    const alreadyExists = characters.some(c =>
                      (c.characterName || '').toLowerCase() === (char.name || '').toLowerCase()
                    )
                    return (
                      <label key={idx} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-lavender-12/30 ${alreadyExists ? 'opacity-60' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedChars.has(idx)}
                          onChange={() => toggleCharSelection(idx)}
                          className="accent-blue-500 flex-shrink-0"
                        />
                        <span className="text-sm font-bold truncate" style={{ color: CLASS_COLORS[char.className] || '#FFF' }}>
                          {char.name}
                        </span>
                        <span className="text-xs text-lavender flex-shrink-0">{char.className}{char.spec ? ` - ${char.spec}` : ''}</span>
                        <span className="hidden truncate text-xs text-lavender/70 sm:inline">{char.realm}</span>
                        <span className="ml-auto flex-shrink-0 text-xs text-lavender/70">Lv.{char.level}</span>
                        {alreadyExists && <span className="text-xs text-blue-400 flex-shrink-0"><ArrowsClockwise size={10} className="inline mr-0.5" />{t('will_update')}</span>}
                      </label>
                    )
                  })}
                </div>
                <Button
                  onClick={handleImportSelected}
                  disabled={selectedChars.size === 0 || importing}
                  variant="teal"
                  size="sm"
                  radius="round"
                  fullWidth
                  className="font-bold"
                >
                  {importing ? (
                    <><CircleNotch size={14} className="inline animate-spin mr-1" />{t('importing')}</>
                  ) : (
                    <><DownloadSimple size={14} className="inline mr-1" />{t('import_selected')} ({selectedChars.size})</>
                  )}
                </Button>
              </div>
            )}

            {/* Blizzard import hint when no characters */}
            {characters.length === 0 && !blizzardLoading && blizzardChars.length === 0 && (
              <div className="bg-blue-900/10 border border-blue-700/20 rounded-lg p-4 mb-3 text-center">
                <Info size={20} className="text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-lavender m-0">{t('blizzard_import_hint')}</p>
              </div>
            )}

            {/* Character List */}
            {loading ? (
              <div className="text-center py-4">
                <CircleNotch size={24} className="animate-spin text-coral mx-auto" />
              </div>
            ) : (
              <div className="space-y-2">
                {characters.map((char) => {
                  const isEditing = editingCharId === char.id
                  const classSpecs = CLASS_SPECS[char.characterClass]
                  return (
                    <div
                      key={char.id}
                      className="bg-lavender-12/20 rounded-lg p-3 flex items-center gap-3"
                    >
                      {/* Star */}
                      <button
                        onClick={() => !char.isPrimary && handleSetPrimary(char.id)}
                        className={`text-lg flex-shrink-0 transition-all ${
                          char.isPrimary
                            ? 'text-yellow-400 cursor-default'
                            : 'cursor-pointer text-lavender/60 hover:text-yellow-400'
                        }`}
                        title={char.isPrimary ? t('primary_character') : t('set_as_primary')}
                      >
                        <Star size={20} weight={char.isPrimary ? 'fill' : undefined} />
                      </button>

                      {/* Spec icon */}
                        {SPEC_ICONS[char.spec] && (
                        <img
                          src={SPEC_ICONS[char.spec]}
                          alt={char.spec}
                          className="h-8 w-8 flex-shrink-0 rounded-full border border-lavender-20/60"
                        />
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold m-0 truncate" style={{ color: CLASS_COLORS[char.characterClass] || '#FFF' }}>
                          {char.characterName}
                          {char.isPrimary && (
                            <span className="ml-2 text-xs font-normal bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded">
                              {t('primary_character')}
                            </span>
                          )}
                        </p>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Select
                              size="sm"
                              radius="round"
                              className="text-xs"
                              defaultValue={char.spec || ''}
                              onChange={(e) => handleChangeSpec(char.id, e.target.value)}
                              disabled={editingSaving}
                              autoFocus
                            >
                              {classSpecs?.specs.map((spec, idx) => (
                                <option key={spec} value={spec}>
                                  {spec} ({classSpecs.defaultRoles[idx]})
                                </option>
                              ))}
                            </Select>
                            <button
                              onClick={() => setEditingCharId(null)}
                              className="text-xs text-lavender transition-colors hover:text-cream"
                              disabled={editingSaving}
                            >
                              <X size={12} />
                            </button>
                            {editingSaving && <CircleNotch size={12} className="animate-spin text-coral" />}
                          </div>
                        ) : (
                          <p className="text-xs text-lavender m-0">
                            {char.characterClass} - {char.spec || '-'} ({char.raidRole})
                          </p>
                        )}
                      </div>

                      {/* Edit Spec Button */}
                      {!isEditing && classSpecs && (
                        <button
                          onClick={() => setEditingCharId(char.id)}
                          className="text-sm text-lavender/60 transition-colors hover:text-coral"
                          title={t('change_spec')}
                        >
                          <PencilSimple size={16} />
                        </button>
                      )}

                      {/* Delete */}
                      {!char.isPrimary && characters.length > 1 && !isEditing && (
                        <button
                          onClick={() => handleDeleteCharacter(char.id)}
                          className="text-sm text-lavender/60 transition-colors hover:text-red-400"
                          title={t('delete_character')}
                        >
                          <Trash size={16} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )}

          {/* ========== DKP TAB ========== */}
          {activeTab === 'dkp' && (
            <>
              {/* Stats */}
              <div className="p-6 border-b border-lavender-20/30">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-lavender-12/30 rounded-xl p-4 text-center">
                    <p className="text-xs text-lavender m-0 mb-1">{t('current_dkp')}</p>
                    <p className="text-3xl font-bold text-coral m-0">{user?.currentDkp || 0}</p>
                  </div>
                  <div className="bg-lavender-12/30 rounded-xl p-4 text-center">
                    <p className="text-xs text-lavender m-0 mb-1">{t('total_gained')}</p>
                    <p className="text-2xl font-bold text-green-400 m-0">+{user?.lifetimeGained || 0}</p>
                  </div>
                  <div className="bg-lavender-12/30 rounded-xl p-4 text-center">
                    <p className="text-xs text-lavender m-0 mb-1">{t('total_spent')}</p>
                    <p className="text-2xl font-bold text-red-400 m-0">-{user?.lifetimeSpent || 0}</p>
                  </div>
                </div>
              </div>

              {/* DKP History */}
              <div className="p-6">
                <h4 className="text-sm text-coral mb-3">
                  <ClockCounterClockwise size={14} className="inline mr-2" />{t('my_dkp_history')}
                  <span className="text-xs text-lavender font-sans ml-2">({history.length})</span>
                </h4>
                {loading ? (
                  <div className="text-center py-4">
                    <CircleNotch size={24} className="animate-spin text-coral mx-auto" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="py-4 text-center text-sm text-lavender/70">{t('no_transactions')}</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {history.map((tx) => (
                      <div key={tx.id} className="bg-lavender-12/20 rounded-lg p-3 flex items-center gap-3">
                        {/* Item icon (if auction transaction) with Wowhead tooltip */}
                        {tx.auctionItem ? (
                          <WowheadTooltip itemId={tx.auctionItem.itemId}>
                            <div
                              className="w-9 h-9 rounded-lg bg-lavender-12 flex items-center justify-center flex-shrink-0 border overflow-hidden cursor-help"
                              style={{ borderColor: RARITY_COLORS[tx.auctionItem.rarity] || RARITY_COLORS.epic }}
                            >
                              {tx.auctionItem.image && tx.auctionItem.image !== '🎁' ? (
                                <img src={tx.auctionItem.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Gavel size={16} style={{ color: RARITY_COLORS[tx.auctionItem.rarity] || RARITY_COLORS.epic }} />
                              )}
                            </div>
                          </WowheadTooltip>
                        ) : null}
                        <div className="flex-1 min-w-0">
                          {tx.auctionItem ? (
                            <WowheadTooltip itemId={tx.auctionItem.itemId}>
                              <p className="text-sm font-bold m-0 truncate cursor-help" style={{ color: RARITY_COLORS[tx.auctionItem.rarity] || '#fff' }}>
                                {tx.auctionItem.name}
                              </p>
                            </WowheadTooltip>
                          ) : (
                            <p className="text-white text-sm m-0 truncate">{tx.reason}</p>
                          )}
                          <p className="text-xs text-lavender m-0">
                            {formatDate(tx.createdAt || tx.created_at)}
                          </p>
                        </div>
                        <span className={`font-bold text-lg flex-shrink-0 ml-2 ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount >= 0 ? '+' : ''}{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Avatar Crop Modal */}
      {cropModalOpen && cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          t={t}
        />
      )}

      {/* Banner Crop Modal */}
      {bannerCropOpen && bannerCropImageSrc && (
        <BannerCropModal
          imageSrc={bannerCropImageSrc}
          onConfirm={handleBannerCropConfirm}
          onCancel={handleBannerCropCancel}
          t={t}
        />
      )}

      {/* Import onboarding beacon — glows over the Blizzard import button */}
      {importOnboarding && activeTab === 'characters' && importBtnRect && (
        <ImportOnboardingBeacon rect={importBtnRect} hint={t('onboarding_import_hint')} />
      )}
    </div>,
    document.body
  )
}

// Portals a glowing beacon above the Blizzard import button (z-[120], above modal z-[100])
const ImportOnboardingBeacon = ({ rect, hint }) => {
  const BEACON_COLOR = '#0ea5e9'
  const padding = 5

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, pointerEvents: 'none' }}>
      {/* Ping ring around the button */}
      <span
        className="animate-ping"
        style={{
          position: 'absolute',
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          borderRadius: 9999,
          background: 'rgba(14,165,233,0.35)',
          pointerEvents: 'none',
        }}
      />
      {/* Glowing border ring */}
      <div
        style={{
          position: 'absolute',
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          borderRadius: 9999,
          border: `2px solid ${BEACON_COLOR}`,
          boxShadow: `0 0 10px 2px rgba(14,165,233,0.5)`,
          pointerEvents: 'none',
        }}
      />
      {/* Callout below the button */}
      <div
        style={{
          position: 'absolute',
          top: rect.bottom + padding + 8,
          left: rect.left,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <div style={{
          marginLeft: rect.width / 2 - 7,
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderBottom: `7px solid ${BEACON_COLOR}`,
        }} />
        <div style={{
          background: BEACON_COLOR,
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 8,
          padding: '6px 12px',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {hint}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MyCharacterModal
