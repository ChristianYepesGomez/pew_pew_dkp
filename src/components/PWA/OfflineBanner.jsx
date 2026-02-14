import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const { t } = useLanguage()

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-600 text-white text-center py-2 px-4 text-sm font-medium shadow-lg">
      <i className="fas fa-wifi-slash mr-2"></i>
      {t('offline_banner') || "You're offline — some features may be limited"}
    </div>
  )
}

export default OfflineBanner
