import { useState } from 'react'
import { useLanguage } from '../../hooks/useLanguage'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
}

const QUICK_AMOUNTS = [
  { value: 10, label: '+10', color: 'bg-green-600' },
  { value: 25, label: '+25', color: 'bg-green-600' },
  { value: 50, label: '+50', color: 'bg-green-600' },
  { value: -10, label: '-10', color: 'bg-red-600' },
  { value: -25, label: '-25', color: 'bg-red-600' },
  { value: -50, label: '-50', color: 'bg-red-600' },
]

const COMMON_REASONS = [
  { key: 'raid_attendance', icon: 'fa-dungeon' },
  { key: 'boss_kill', icon: 'fa-skull' },
  { key: 'auction_win', icon: 'fa-gavel' },
  { key: 'manual_adjustment', icon: 'fa-edit' },
]

const DKPAdjustModal = ({ member, onClose, onSubmit }) => {
  const { t } = useLanguage()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || amount === '0') return
    setLoading(true)
    await onSubmit(parseInt(amount), reason || t('manual_adjustment'))
    setLoading(false)
  }

  const handleQuickAmount = (value) => {
    setAmount(value.toString())
  }

  const handleQuickReason = (key) => {
    setReason(t(key))
  }

  const newDkp = (member?.current_dkp || 0) + (parseInt(amount) || 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-midnight-purple flex items-center justify-center">
                <i className="fas fa-coins text-2xl text-midnight-glow"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white m-0">{t('adjust_dkp')}</h3>
                <p className="text-sm m-0" style={{ color: CLASS_COLORS[member?.character_class] || '#FFF' }}>
                  {member?.character_name}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Current & Preview DKP */}
        <div className="p-6 bg-midnight-purple bg-opacity-20 flex justify-around">
          <div className="text-center">
            <p className="text-sm text-midnight-silver m-0">{t('current')}</p>
            <p className="text-3xl font-bold text-midnight-glow m-0">{member?.current_dkp || 0}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-midnight-silver m-0">{t('after')}</p>
            <p className={`text-3xl font-bold m-0 ${newDkp >= (member?.current_dkp || 0) ? 'text-green-400' : 'text-red-400'}`}>
              {newDkp}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick amounts */}
          <div>
            <label className="block text-sm text-midnight-silver mb-2">{t('quick_adjust')}</label>
            <div className="grid grid-cols-6 gap-2">
              {QUICK_AMOUNTS.map((qa) => (
                <button
                  key={qa.value}
                  type="button"
                  onClick={() => handleQuickAmount(qa.value)}
                  className={`${qa.color} hover:opacity-80 text-white py-2 rounded-lg text-sm font-bold transition-all`}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-sm text-midnight-silver mb-2">{t('amount')}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('enter_amount')}
              className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
            />
          </div>

          {/* Quick reasons */}
          <div>
            <label className="block text-sm text-midnight-silver mb-2">{t('reason')}</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {COMMON_REASONS.map((cr) => (
                <button
                  key={cr.key}
                  type="button"
                  onClick={() => handleQuickReason(cr.key)}
                  className="bg-midnight-purple bg-opacity-50 hover:bg-opacity-70 text-midnight-silver hover:text-white py-2 px-3 rounded-lg text-sm transition-all flex items-center gap-2"
                >
                  <i className={`fas ${cr.icon}`}></i>
                  {t(cr.key)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('enter_reason')}
              className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !amount || amount === '0'}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
              ) : (
                <><i className="fas fa-check mr-2"></i>{t('confirm')}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DKPAdjustModal
