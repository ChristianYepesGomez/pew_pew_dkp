import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    // Check if user previously dismissed
    if (localStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setDeferredPrompt(null)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  if (!deferredPrompt || dismissed) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] animate-slide-down">
      <div className="bg-midnight-spaceblue border border-midnight-bright-purple rounded-xl p-4 shadow-lg flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-midnight-purple flex items-center justify-center flex-shrink-0">
          <i className="fas fa-download text-midnight-glow"></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-midnight-silver text-sm font-medium">
            {t('install_app') || 'Install DKP Manager'}
          </p>
          <p className="text-midnight-glow text-xs opacity-70">
            {t('install_app_desc') || 'Quick access from your home screen'}
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-midnight-bright-purple text-white text-sm rounded-lg hover:bg-midnight-accent transition-colors flex-shrink-0"
        >
          {t('install') || 'Install'}
        </button>
        <button
          onClick={handleDismiss}
          className="text-midnight-silver opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
          aria-label="Dismiss"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
