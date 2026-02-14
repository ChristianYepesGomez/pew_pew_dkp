import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI, authAPI, charactersAPI, blizzardAPI } from '../../services/api'
import WowheadTooltip from '../Common/WowheadTooltip'
import { CLASS_COLORS, RARITY_COLORS } from '../../utils/constants'

const TABS = ['profile', 'characters', 'dkp']

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

// CLASSES removed - manual character creation disabled, only Blizzard import allowed

// Crop and compress image to a square, centered based on user selection
// Uses 400x400 for retina quality, WebP for better compression with JPEG fallback
const cropAndCompressImage = (imageSrc, cropData, outputSize = 400, maxBytes = 150 * 1024) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = outputSize
      canvas.height = outputSize
      const ctx = canvas.getContext('2d')

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Calculate the source area based on crop data
      const { x, y, scale } = cropData
      const cropSize = Math.min(img.width, img.height) / scale
      const sourceX = (img.width / 2) - (cropSize / 2) - (x * cropSize / outputSize)
      const sourceY = (img.height / 2) - (cropSize / 2) - (y * cropSize / outputSize)

      // Draw the cropped and scaled image
      ctx.drawImage(img, sourceX, sourceY, cropSize, cropSize, 0, 0, outputSize, outputSize)

      // Try WebP first for better compression, fallback to JPEG
      const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
      const format = supportsWebP ? 'image/webp' : 'image/jpeg'

      // Compress with quality reduction until under maxBytes
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
    const croppedImage = await cropAndCompressImage(imageSrc, { ...position, scale })
    onConfirm(croppedImage)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[110]">
      <div className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl p-6 w-full max-w-sm">
        <h4 className="text-lg font-cinzel text-midnight-glow mb-4 text-center">
          <i className="fas fa-crop-alt mr-2"></i>{t('crop_avatar') || 'Ajustar foto'}
        </h4>

        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative w-64 h-64 mx-auto mb-4 overflow-hidden rounded-full border-4 border-midnight-bright-purple cursor-move"
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
          <i className="fas fa-search-minus text-midnight-silver"></i>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-midnight-bright-purple"
          />
          <i className="fas fa-search-plus text-midnight-silver"></i>
        </div>

        <p className="text-xs text-midnight-silver text-center mb-4">
          {t('drag_to_position') || 'Arrastra para posicionar'}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold hover:shadow-lg transition-all"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

const MyCharacterModal = ({ onClose }) => {
  const { user, refreshUser } = useAuth()
  const { t, language } = useLanguage()
  const [activeTab, setActiveTab] = useState('profile')
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
  const avatarInputRef = useCallback(node => { if (node) window._avatarInput = node }, [])
  // Crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)
  // Edit spec state
  const [editingCharId, setEditingCharId] = useState(null)
  const [editingSaving, setEditingSaving] = useState(false)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
      <div className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Editable Avatar */}
              <div
                className="relative cursor-pointer group"
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
              >
                <div
                  className="w-16 h-16 rounded-full bg-midnight-purple flex items-center justify-center overflow-hidden border-2 transition-all group-hover:border-midnight-glow"
                  style={{ borderColor: avatarHover ? undefined : (CLASS_COLORS[user?.characterClass] || '#A78BFA') }}
                  onClick={() => window._avatarInput?.click()}
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <img src="/logo.png" alt="Default" className="w-full h-full object-cover" />
                  )}
                </div>
                {/* Hover overlay with pencil */}
                <div
                  className={`absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center transition-opacity ${avatarHover ? 'opacity-100' : 'opacity-0'}`}
                  onClick={() => window._avatarInput?.click()}
                >
                  {avatarSaving ? (
                    <i className="fas fa-spinner fa-spin text-white text-lg"></i>
                  ) : (
                    <i className="fas fa-pencil-alt text-white text-lg"></i>
                  )}
                </div>
                {/* Delete button on hover (only if avatar exists) */}
                {user?.avatar && !avatarSaving && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveAvatar() }}
                    className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-all ${avatarHover ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                    title={t('remove_avatar')}
                  >
                    <i className="fas fa-times text-white text-xs"></i>
                  </button>
                )}
                {/* Hidden file input */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  disabled={avatarSaving}
                  className="hidden"
                />
              </div>
              <div>
                <h3 className="text-2xl font-cinzel font-bold m-0" style={{ color: user?.characterClass ? (CLASS_COLORS[user.characterClass] || '#A78BFA') : '#A78BFA' }}>
                  {user?.characterName || user?.username}
                </h3>
                {user?.characterClass ? (
                  <p className="text-midnight-silver m-0">{user?.characterClass} - {user?.spec || '-'}</p>
                ) : (
                  <p className="text-midnight-silver m-0">{t('no_character')}</p>
                )}
                {avatarMsg && (
                  <p className={`text-xs m-0 ${avatarMsg === t('avatar_saved') || avatarMsg === t('avatar_removed') ? 'text-green-400' : 'text-red-400'}`}>
                    {avatarMsg}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'text-midnight-glow border-b-2 border-midnight-glow bg-midnight-purple bg-opacity-20'
                  : 'text-midnight-silver hover:text-white hover:bg-midnight-purple hover:bg-opacity-10'
              }`}
            >
              <i className={`fas ${tab === 'profile' ? 'fa-user' : tab === 'characters' ? 'fa-users' : 'fa-coins'} mr-2`}></i>
              {t(`tab_${tab}`)}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          {/* ========== PROFILE TAB ========== */}
          {activeTab === 'profile' && (
            <>
              {/* Email Section */}
              <div className="p-6 border-b border-midnight-bright-purple border-opacity-30">
                <h4 className="text-sm font-cinzel text-midnight-glow mb-3">
                  <i className="fas fa-envelope mr-2"></i>{t('email')}
                </h4>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('email_placeholder')}
                    className="flex-1 bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={emailSaving}
                    className="px-4 py-2 rounded-lg bg-midnight-bright-purple text-white text-sm font-bold hover:bg-opacity-80 transition-all disabled:opacity-50"
                  >
                    {emailSaving ? <i className="fas fa-spinner fa-spin"></i> : t('save')}
                  </button>
                </div>
                {emailMsg && (
                  <p className={`text-xs mt-2 ${emailMsg === t('email_saved') ? 'text-green-400' : 'text-red-400'}`}>
                    {emailMsg}
                  </p>
                )}
              </div>

              {/* Password Change Section */}
              <div className="p-6">
                <h4 className="text-sm font-cinzel text-midnight-glow mb-3">
                  <i className="fas fa-key mr-2"></i>{t('change_password')}
                </h4>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('current_password')}
                    className="w-full bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('new_password')}
                    className="w-full bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('confirm_password')}
                    className="w-full bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                  />
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {passwordSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                    {t('change_password')}
                  </button>
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
                <h4 className="text-sm font-cinzel text-midnight-glow m-0">
                  <i className="fas fa-users mr-2"></i>{t('my_characters')}
                </h4>
                <button
                  onClick={handleBlizzardImport}
                  disabled={blizzardLoading}
                  className="text-xs px-3 py-1 rounded-lg bg-blue-700 bg-opacity-60 text-blue-200 hover:bg-opacity-80 transition-all disabled:opacity-50"
                  title={t('blizzard_import_hint')}
                >
                  {blizzardLoading ? (
                    <><i className="fas fa-spinner fa-spin mr-1"></i></>
                  ) : (
                    <><i className="fas fa-download mr-1"></i>{t('import_from_blizzard')}</>
                  )}
                </button>
              </div>

            {charError && (
              <p className={`text-xs mb-2 ${charError.includes(t('characters_imported')) ? 'text-green-400' : 'text-red-400'}`}>{charError}</p>
            )}

            {blizzardError && (
              <p className="text-xs text-red-400 mb-2"><i className="fas fa-exclamation-circle mr-1"></i>{blizzardError}</p>
            )}

            {/* Blizzard Import Results */}
            {blizzardChars.length > 0 && (
              <div className="bg-blue-900 bg-opacity-20 border border-blue-700 border-opacity-30 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-blue-300 m-0 font-bold">
                    <i className="fas fa-download mr-1"></i>
                    {t('blizzard_characters_found')} ({blizzardChars.length})
                  </p>
                  <button onClick={() => { setBlizzardChars([]); setSelectedChars(new Set()) }}
                    className="text-xs text-gray-400 hover:text-white transition-all">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="space-y-1 max-h-48 overflow-auto mb-2">
                  {blizzardChars.map((char, idx) => {
                    const alreadyExists = characters.some(c =>
                      (c.characterName || '').toLowerCase() === (char.name || '').toLowerCase()
                    )
                    return (
                      <label key={idx} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-midnight-purple hover:bg-opacity-30 ${alreadyExists ? 'opacity-60' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedChars.has(idx)}
                          onChange={() => toggleCharSelection(idx)}
                          className="accent-blue-500 flex-shrink-0"
                        />
                        <span className="text-sm font-bold truncate" style={{ color: CLASS_COLORS[char.className] || '#FFF' }}>
                          {char.name}
                        </span>
                        <span className="text-xs text-midnight-silver flex-shrink-0">{char.className}{char.spec ? ` - ${char.spec}` : ''}</span>
                        <span className="text-xs text-gray-500 truncate hidden sm:inline">{char.realm}</span>
                        <span className="text-xs text-gray-500 ml-auto flex-shrink-0">Lv.{char.level}</span>
                        {alreadyExists && <span className="text-[10px] text-blue-400 flex-shrink-0"><i className="fas fa-sync-alt mr-0.5"></i>{t('will_update')}</span>}
                      </label>
                    )
                  })}
                </div>
                <button
                  onClick={handleImportSelected}
                  disabled={selectedChars.size === 0 || importing}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 text-white text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {importing ? (
                    <><i className="fas fa-spinner fa-spin mr-1"></i>{t('importing')}</>
                  ) : (
                    <><i className="fas fa-download mr-1"></i>{t('import_selected')} ({selectedChars.size})</>
                  )}
                </button>
              </div>
            )}

            {/* Blizzard import hint when no characters */}
            {characters.length === 0 && !blizzardLoading && blizzardChars.length === 0 && (
              <div className="bg-blue-900 bg-opacity-10 border border-blue-700 border-opacity-20 rounded-lg p-4 mb-3 text-center">
                <i className="fas fa-info-circle text-blue-400 text-lg mb-2"></i>
                <p className="text-sm text-midnight-silver m-0">{t('blizzard_import_hint')}</p>
              </div>
            )}

            {/* Character List */}
            {loading ? (
              <div className="text-center py-4">
                <i className="fas fa-circle-notch fa-spin text-2xl text-midnight-glow"></i>
              </div>
            ) : (
              <div className="space-y-2">
                {characters.map((char) => {
                  const isEditing = editingCharId === char.id
                  const classSpecs = CLASS_SPECS[char.characterClass]
                  return (
                    <div
                      key={char.id}
                      className="bg-midnight-purple bg-opacity-20 rounded-lg p-3 flex items-center gap-3"
                    >
                      {/* Star */}
                      <button
                        onClick={() => !char.isPrimary && handleSetPrimary(char.id)}
                        className={`text-lg flex-shrink-0 transition-all ${
                          char.isPrimary
                            ? 'text-yellow-400 cursor-default'
                            : 'text-gray-600 hover:text-yellow-400 cursor-pointer'
                        }`}
                        title={char.isPrimary ? t('primary_character') : t('set_as_primary')}
                      >
                        <i className={`fas fa-star`}></i>
                      </button>

                      {/* Spec icon */}
                      {SPEC_ICONS[char.spec] && (
                        <img
                          src={SPEC_ICONS[char.spec]}
                          alt={char.spec}
                          className="w-8 h-8 rounded-full flex-shrink-0 border border-gray-600"
                        />
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold m-0 truncate" style={{ color: CLASS_COLORS[char.characterClass] || '#FFF' }}>
                          {char.characterName}
                          {char.isPrimary && (
                            <span className="ml-2 text-[10px] font-normal bg-yellow-400 bg-opacity-20 text-yellow-400 px-1.5 py-0.5 rounded">
                              {t('primary_character')}
                            </span>
                          )}
                        </p>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <select
                              className="text-xs bg-midnight-deepblue border border-midnight-bright-purple rounded px-2 py-1 text-white focus:outline-none focus:border-midnight-glow"
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
                            </select>
                            <button
                              onClick={() => setEditingCharId(null)}
                              className="text-gray-400 hover:text-white text-xs"
                              disabled={editingSaving}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                            {editingSaving && <i className="fas fa-spinner fa-spin text-xs text-midnight-glow"></i>}
                          </div>
                        ) : (
                          <p className="text-xs text-midnight-silver m-0">
                            {char.characterClass} - {char.spec || '-'} ({char.raidRole})
                          </p>
                        )}
                      </div>

                      {/* Edit Spec Button */}
                      {!isEditing && classSpecs && (
                        <button
                          onClick={() => setEditingCharId(char.id)}
                          className="text-gray-600 hover:text-midnight-glow text-sm flex-shrink-0 transition-all"
                          title={t('change_spec')}
                        >
                          <i className="fas fa-pencil-alt"></i>
                        </button>
                      )}

                      {/* Delete */}
                      {!char.isPrimary && characters.length > 1 && !isEditing && (
                        <button
                          onClick={() => handleDeleteCharacter(char.id)}
                          className="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 transition-all"
                          title={t('delete_character')}
                        >
                          <i className="fas fa-trash-alt"></i>
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
              <div className="p-6 border-b border-midnight-bright-purple border-opacity-30">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-midnight-purple bg-opacity-30 rounded-xl p-4 text-center">
                    <p className="text-xs text-midnight-silver m-0 mb-1">{t('current_dkp')}</p>
                    <p className="text-3xl font-bold text-midnight-glow m-0">{user?.currentDkp || 0}</p>
                  </div>
                  <div className="bg-midnight-purple bg-opacity-30 rounded-xl p-4 text-center">
                    <p className="text-xs text-midnight-silver m-0 mb-1">{t('total_gained')}</p>
                    <p className="text-2xl font-bold text-green-400 m-0">+{user?.lifetimeGained || 0}</p>
                  </div>
                  <div className="bg-midnight-purple bg-opacity-30 rounded-xl p-4 text-center">
                    <p className="text-xs text-midnight-silver m-0 mb-1">{t('total_spent')}</p>
                    <p className="text-2xl font-bold text-red-400 m-0">-{user?.lifetimeSpent || 0}</p>
                  </div>
                </div>
              </div>

              {/* DKP History */}
              <div className="p-6">
                <h4 className="text-sm font-cinzel text-midnight-glow mb-3">
                  <i className="fas fa-history mr-2"></i>{t('my_dkp_history')}
                  <span className="text-xs text-midnight-silver font-sans ml-2">({history.length})</span>
                </h4>
                {loading ? (
                  <div className="text-center py-4">
                    <i className="fas fa-circle-notch fa-spin text-2xl text-midnight-glow"></i>
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">{t('no_transactions')}</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {history.map((tx) => (
                      <div key={tx.id} className="bg-midnight-purple bg-opacity-20 rounded-lg p-3 flex items-center gap-3">
                        {/* Item icon (if auction transaction) with Wowhead tooltip */}
                        {tx.auctionItem ? (
                          <WowheadTooltip itemId={tx.auctionItem.itemId}>
                            <div
                              className="w-9 h-9 rounded-lg bg-midnight-purple flex items-center justify-center flex-shrink-0 border overflow-hidden cursor-help"
                              style={{ borderColor: RARITY_COLORS[tx.auctionItem.rarity] || RARITY_COLORS.epic }}
                            >
                              {tx.auctionItem.image && tx.auctionItem.image !== '🎁' ? (
                                <img src={tx.auctionItem.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <i className="fas fa-gavel text-sm" style={{ color: RARITY_COLORS[tx.auctionItem.rarity] || RARITY_COLORS.epic }}></i>
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
                          <p className="text-xs text-midnight-silver m-0">
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

        {/* Footer */}
        <div className="p-4 border-t border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold hover:shadow-lg transition-all"
          >
            {t('close')}
          </button>
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
    </div>,
    document.body
  )
}

export default MyCharacterModal
