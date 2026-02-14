import { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import VaultIcon from './VaultIcon'

const DKPInfoModal = ({ onClose }) => {
  const { t } = useLanguage()
  const modalRef = useRef(null)
  useFocusTrap(modalRef)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        ref={modalRef} role="dialog" aria-modal="true" aria-label={t('dkp_system_title')}
        className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-lg max-sm:max-w-none shadow-2xl max-h-[90vh] max-sm:max-h-[100vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple border-b border-midnight-bright-purple border-opacity-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-midnight-deepblue flex items-center justify-center border-2 border-midnight-glow">
                <i className="fas fa-coins text-xl text-midnight-glow"></i>
              </div>
              <div>
                <h3 className="text-xl font-cinzel font-bold text-white m-0">{t('dkp_system_title')}</h3>
                <p className="text-sm text-midnight-silver m-0">{t('dkp_system_subtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={t('close')}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto space-y-6">
          {/* Earning DKP */}
          <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-green-400 font-bold mb-3 text-sm uppercase">
              <i className="fas fa-plus-circle"></i>
              {t('dkp_earning_title')}
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-green-500 bg-opacity-20 flex items-center justify-center text-green-400 flex-shrink-0">
                  <i className="fas fa-calendar-check"></i>
                </span>
                <span className="text-white">{t('dkp_earning_calendar')} <span className="text-green-400 font-bold">+1</span></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-green-500 bg-opacity-20 flex items-center justify-center text-green-400 flex-shrink-0">
                  <i className="fas fa-dragon"></i>
                </span>
                <span className="text-white">{t('dkp_earning_raid')} <span className="text-green-400 font-bold">+5</span></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-green-500 bg-opacity-20 flex items-center justify-center flex-shrink-0">
                  <VaultIcon completed={true} size={24} />
                </span>
                <span className="text-white">{t('dkp_earning_vault')} <span className="text-green-400 font-bold">+10</span></span>
              </li>
            </ul>
          </div>

          {/* Spending DKP */}
          <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-red-400 font-bold mb-3 text-sm uppercase">
              <i className="fas fa-gavel"></i>
              {t('dkp_spending_title')}
            </h4>
            <ul className="space-y-2 text-sm text-white">
              <li className="flex items-start gap-3">
                <i className="fas fa-check text-red-400 mt-1"></i>
                <span>{t('dkp_spending_auctions')}</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fas fa-check text-red-400 mt-1"></i>
                <span>{t('dkp_spending_free')}</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="fas fa-dice text-yellow-400 mt-1"></i>
                <span>{t('dkp_spending_ties')}</span>
              </li>
            </ul>
          </div>

          {/* Anti-Snipe Rule */}
          <div className="bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-orange-400 font-bold mb-3 text-sm uppercase">
              <i className="fas fa-clock"></i>
              {t('anti_snipe_title')}
            </h4>
            <p className="text-sm text-white">{t('anti_snipe_info')}</p>
            <p className="text-xs text-orange-300 mt-2 italic">{t('anti_snipe_reason')}</p>
          </div>

          {/* DKP Cap */}
          <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-yellow-400 font-bold mb-3 text-sm uppercase">
              <i className="fas fa-crown"></i>
              {t('dkp_cap_title')}: 250
            </h4>
            <p className="text-sm text-white mb-2">{t('dkp_cap_explanation')}</p>
            <p className="text-xs text-yellow-300 italic">{t('dkp_cap_why')}</p>
          </div>

          {/* Fair System Note */}
          <div className="text-center p-4 bg-midnight-purple bg-opacity-20 rounded-xl border border-midnight-bright-purple border-opacity-20">
            <i className="fas fa-balance-scale text-2xl text-midnight-glow mb-2"></i>
            <h5 className="text-white font-bold mb-1">{t('dkp_fair_system')}</h5>
            <p className="text-sm text-midnight-silver">{t('dkp_fair_explanation')}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DKPInfoModal
