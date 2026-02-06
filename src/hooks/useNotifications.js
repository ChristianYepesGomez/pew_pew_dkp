import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'dkp_notifications_enabled'
const SOUND_STORAGE_KEY = 'dkp_notifications_sound'
const SOUND_SELECTION_KEY = 'dkp_notifications_sound_selected'
const CUSTOM_SOUND_KEY = 'dkp_notifications_custom_sound'

// WoW-themed notification sounds
// Using reliable CDN-hosted sounds
export const NOTIFICATION_SOUNDS = [
  {
    id: 'ready_check',
    name: 'Ready Check',
    url: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
    description: 'Raid ready check style',
    icon: 'fa-check-circle',
  },
  {
    id: 'heroism',
    name: 'Heroism',
    url: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
    description: 'Epic buff activation',
    icon: 'fa-bolt',
  },
  {
    id: 'loot',
    name: 'Epic Loot',
    url: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
    description: 'Item drop fanfare',
    icon: 'fa-gem',
  },
  {
    id: 'gold',
    name: 'Gold',
    url: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
    description: 'Gold coins sound',
    icon: 'fa-coins',
  },
  {
    id: 'auction',
    name: 'Auction',
    url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    description: 'Auction House alert',
    icon: 'fa-gavel',
  },
  {
    id: 'quest',
    name: 'Quest',
    url: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
    description: 'Quest notification',
    icon: 'fa-scroll',
  },
  {
    id: 'raid_warning',
    name: 'Raid Warning',
    url: 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3',
    description: 'Raid alert sound',
    icon: 'fa-exclamation-triangle',
  },
  {
    id: 'spell',
    name: 'Spell Cast',
    url: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
    description: 'Magic spell effect',
    icon: 'fa-magic',
  },
  {
    id: 'custom',
    name: 'Custom',
    url: null,
    description: 'Your custom sound',
    icon: 'fa-upload',
  },
]

/**
 * Hook for browser/desktop notifications with localStorage persistence
 * Handles permission requests, notification display, and optional sound alerts
 */
export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [isSupported, setIsSupported] = useState(false)
  const [userEnabled, setUserEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'true'
  })
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY)
    return stored !== 'false' // Default to true
  })
  const [selectedSound, setSelectedSound] = useState(() => {
    const stored = localStorage.getItem(SOUND_SELECTION_KEY)
    // Handle migration from old 'default' ID
    if (stored === 'default') return 'ready_check'
    return stored || 'ready_check'
  })
  const [customSoundData, setCustomSoundData] = useState(() => {
    return localStorage.getItem(CUSTOM_SOUND_KEY) || null
  })

  const audioRef = useRef(null)

  // Get current sound URL
  const getSoundUrl = useCallback(() => {
    if (selectedSound === 'custom' && customSoundData) {
      return customSoundData
    }
    const sound = NOTIFICATION_SOUNDS.find(s => s.id === selectedSound)
    return sound?.url || NOTIFICATION_SOUNDS.find(s => s.id === 'ready_check')?.url || NOTIFICATION_SOUNDS[0].url
  }, [selectedSound, customSoundData])

  // Initialize/update audio element when sound changes
  useEffect(() => {
    const url = getSoundUrl()
    if (url) {
      audioRef.current = new Audio(url)
      audioRef.current.volume = 0.5
    }
  }, [getSoundUrl])

  useEffect(() => {
    setIsSupported('Notification' in window)
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // Persist user preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(userEnabled))
  }, [userEnabled])

  // Persist sound preference
  useEffect(() => {
    localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled))
  }, [soundEnabled])

  // Persist sound selection
  useEffect(() => {
    localStorage.setItem(SOUND_SELECTION_KEY, selectedSound)
  }, [selectedSound])

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn('Notifications not supported in this browser')
      return 'denied'
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        setUserEnabled(true)
      }
      return result
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return 'denied'
    }
  }, [isSupported])

  const enableNotifications = useCallback(async () => {
    if (permission !== 'granted') {
      const result = await requestPermission()
      if (result === 'granted') {
        setUserEnabled(true)
      }
      return result === 'granted'
    }
    setUserEnabled(true)
    return true
  }, [permission, requestPermission])

  const disableNotifications = useCallback(() => {
    setUserEnabled(false)
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev)
  }, [])

  const changeSound = useCallback((soundId) => {
    setSelectedSound(soundId)
  }, [])

  const setCustomSound = useCallback((base64Data) => {
    if (base64Data) {
      // Limit to ~2MB to avoid localStorage issues
      if (base64Data.length > 2 * 1024 * 1024) {
        console.warn('Custom sound too large (max 2MB)')
        return false
      }
      localStorage.setItem(CUSTOM_SOUND_KEY, base64Data)
      setCustomSoundData(base64Data)
      setSelectedSound('custom')
      return true
    }
    return false
  }, [])

  const clearCustomSound = useCallback(() => {
    localStorage.removeItem(CUSTOM_SOUND_KEY)
    setCustomSoundData(null)
    if (selectedSound === 'custom') {
      setSelectedSound('default')
    }
  }, [selectedSound])

  const playSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Ignore autoplay errors (user hasn't interacted yet)
      })
    }
  }, [soundEnabled])

  // Preview a specific sound without changing selection
  const previewSound = useCallback((soundId) => {
    let url
    if (soundId === 'custom' && customSoundData) {
      url = customSoundData
    } else {
      const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundId)
      url = sound?.url
    }
    if (url) {
      const audio = new Audio(url)
      audio.volume = 0.5
      audio.play().catch(() => {})
    }
  }, [customSoundData])

  const showNotification = useCallback((title, options = {}) => {
    // Check both browser permission AND user preference
    if (!isSupported || permission !== 'granted' || !userEnabled) {
      console.log('Notifications disabled or not permitted')
      return null
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: options.tag || 'default',
        renotify: options.renotify || false,
        requireInteraction: options.requireInteraction || false,
        ...options,
      })

      // Play sound if enabled
      if (options.playSound !== false) {
        playSound()
      }

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000)
      }

      // Handle click - focus the window
      notification.onclick = () => {
        window.focus()
        notification.close()
        if (options.onClick) options.onClick()
      }

      return notification
    } catch (error) {
      console.error('Error showing notification:', error)
      return null
    }
  }, [isSupported, permission, userEnabled, playSound])

  // Computed: notifications are enabled if browser granted AND user wants them
  const isEnabled = permission === 'granted' && userEnabled

  return {
    isSupported,
    permission,
    userEnabled,
    soundEnabled,
    selectedSound,
    customSoundData,
    isEnabled,
    requestPermission,
    enableNotifications,
    disableNotifications,
    toggleSound,
    changeSound,
    setCustomSound,
    clearCustomSound,
    previewSound,
    showNotification,
    playSound,
  }
}

export default useNotifications
