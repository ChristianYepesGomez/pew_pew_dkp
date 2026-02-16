import { useState, useEffect } from 'react'
import { useLanguage } from '../../hooks/useLanguage'

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const { t } = useLanguage()

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[300] bg-red-600 text-white text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg" role="alert">
      <i className="fas fa-wifi-slash"></i>
      <span>{t('offline_message')}</span>
    </div>
  )
}

export default OfflineBanner
