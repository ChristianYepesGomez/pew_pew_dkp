import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Coins, X, CircleNotch, Check, Skull, Gavel, PencilSimple, CastleTurret } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#3FC7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
  DeathKnight: '#C41F3B', DemonHunter: '#A330C9', Monk: '#00FF96', Evoker: '#33937F',
}

const QUICK_AMOUNTS = [
  { value: 10, label: '+10', color: 'bg-teal' },
  { value: 25, label: '+25', color: 'bg-teal' },
  { value: 50, label: '+50', color: 'bg-teal' },
  { value: -10, label: '-10', color: 'bg-red-600' },
  { value: -25, label: '-25', color: 'bg-red-600' },
  { value: -50, label: '-50', color: 'bg-red-600' },
]

const COMMON_REASONS = [
  { key: 'raid_attendance', Icon: CastleTurret },
  { key: 'boss_kill', Icon: Skull },
  { key: 'auction_win', Icon: Gavel },
  { key: 'manual_adjustment', Icon: PencilSimple },
]

const DKPAdjustModal = ({ member, onClose, onSubmit }) => {
  const { t } = useLanguage()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || amount === '0') return
    setLoading(true)
    await onSubmit(parseInt(amount), reason || t('manual_adjustment'))
    setLoading(false)
  }

  const currentDkp = member?.currentDkp ?? member?.current_dkp ?? 0
  const characterName = member?.characterName ?? member?.character_name ?? ''
  const characterClass = member?.characterClass ?? member?.character_class ?? ''
  const newDkp = currentDkp + (parseInt(amount) || 0)

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-md shadow-2xl my-auto">
        <div className="p-6 border-b border-lavender-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-lavender-12 flex items-center justify-center">
                <Coins size={24} weight="bold" className="text-coral" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-cream">{t('adjust_dkp')}</h3>
                <p className="text-sm" style={{ color: CLASS_COLORS[characterClass] || '#FFF' }}>
                  {characterName}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-lavender hover:text-cream transition-colors">
              <X size={24} weight="bold" />
            </button>
          </div>
        </div>

        <div className="p-6 bg-lavender-12 flex justify-around">
          <div className="text-center">
            <p className="text-sm text-lavender">{t('current')}</p>
            <p className="text-3xl font-bold text-coral">{currentDkp}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-lavender">{t('after')}</p>
            <p className={`text-3xl font-bold ${newDkp >= currentDkp ? 'text-teal' : 'text-red-400'}`}>
              {newDkp}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-cream font-semibold mb-2">{t('quick_adjust')}</label>
            <div className="grid grid-cols-6 gap-2">
              {QUICK_AMOUNTS.map((qa) => (
                <button
                  key={qa.value}
                  type="button"
                  onClick={() => setAmount(qa.value.toString())}
                  className={`${qa.color} text-indigo py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80`}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-cream font-semibold mb-2">{t('amount')}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('enter_amount')}
              className="w-full px-4 py-3 rounded-xl bg-lavender-12 border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-cream font-semibold mb-2">{t('reason')}</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {COMMON_REASONS.map((cr) => (
                <button
                  key={cr.key}
                  type="button"
                  onClick={() => setReason(t(cr.key))}
                  className="bg-lavender-12 hover:bg-lavender-20 text-cream py-2 px-3 rounded-xl text-sm transition-colors flex items-center gap-2"
                >
                  <cr.Icon size={16} weight="bold" className="text-coral" />
                  {t(cr.key)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('enter_reason')}
              className="w-full px-4 py-3 rounded-xl bg-lavender-12 border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-full border-2 border-lavender-20 text-cream hover:bg-lavender-12 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !amount || amount === '0'}
              className="flex-1 px-4 py-3 rounded-full bg-coral text-indigo font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2"><CircleNotch size={20} weight="bold" className="animate-spin" />{t('loading')}...</span>
              ) : (
                <span className="flex items-center justify-center gap-2"><Check size={20} weight="bold" />{t('confirm')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default DKPAdjustModal
