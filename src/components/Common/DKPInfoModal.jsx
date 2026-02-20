import { createPortal } from 'react-dom'
import {
  Coins, PlusCircle, Gavel, Clock, Crown, Scales, X, CalendarCheck, Skull, Check, DiceFive,
} from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import VaultIcon from './VaultIcon'

const DKPInfoModal = ({ onClose }) => {
  const { t } = useLanguage()

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-lavender-12 border-b border-lavender-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo flex items-center justify-center border-2 border-lavender-20">
                <Coins size={24} className="text-coral" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-cream">{t('dkp_system_title')}</h3>
                <p className="text-sm text-lavender">{t('dkp_system_subtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-lavender hover:text-cream transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto space-y-6">
          <div className="bg-teal/10 border border-teal/30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-teal font-bold mb-3 text-sm uppercase">
              <PlusCircle size={18} />
              {t('dkp_earning_title')}
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center text-teal shrink-0">
                  <CalendarCheck size={18} />
                </span>
                <span className="text-cream">{t('dkp_earning_calendar')} <span className="text-teal font-bold">+1</span></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center text-teal shrink-0">
                  <Skull size={18} />
                </span>
                <span className="text-cream">{t('dkp_earning_raid')} <span className="text-teal font-bold">+5</span></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center shrink-0">
                  <VaultIcon completed={true} size={24} />
                </span>
                <span className="text-cream">{t('dkp_earning_vault')} <span className="text-teal font-bold">+10</span></span>
              </li>
            </ul>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-red-400 font-bold mb-3 text-sm uppercase">
              <Gavel size={18} />
              {t('dkp_spending_title')}
            </h4>
            <ul className="space-y-2 text-sm text-cream">
              <li className="flex items-start gap-3">
                <Check size={16} className="text-red-400 mt-0.5 shrink-0" />
                <span>{t('dkp_spending_auctions')}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check size={16} className="text-red-400 mt-0.5 shrink-0" />
                <span>{t('dkp_spending_free')}</span>
              </li>
              <li className="flex items-start gap-3">
                <DiceFive size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                <span>{t('dkp_spending_ties')}</span>
              </li>
            </ul>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-orange-400 font-bold mb-3 text-sm uppercase">
              <Clock size={18} />
              {t('anti_snipe_title')}
            </h4>
            <p className="text-sm text-cream">{t('anti_snipe_info')}</p>
            <p className="text-xs text-orange-300 mt-2 italic">{t('anti_snipe_reason')}</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <h4 className="flex items-center gap-2 text-yellow-400 font-bold mb-3 text-sm uppercase">
              <Crown size={18} />
              {t('dkp_cap_title')}: 250
            </h4>
            <p className="text-sm text-cream mb-2">{t('dkp_cap_explanation')}</p>
            <p className="text-xs text-yellow-300 italic">{t('dkp_cap_why')}</p>
          </div>

          <div className="text-center p-4 bg-lavender-12 rounded-xl border border-lavender-20">
            <Scales size={32} className="text-coral mx-auto mb-2" />
            <h5 className="text-cream font-bold mb-1">{t('dkp_fair_system')}</h5>
            <p className="text-sm text-lavender">{t('dkp_fair_explanation')}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default DKPInfoModal
