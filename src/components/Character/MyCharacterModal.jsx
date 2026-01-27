import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
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
}

const MyCharacterModal = ({ onClose }) => {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Close on ESC key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const response = await dkpAPI.getHistory(user.id)
      setHistory(response.data?.transactions || [])
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
      <div className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-midnight-purple flex items-center justify-center overflow-hidden border-2" style={{ borderColor: CLASS_COLORS[user?.characterClass] || '#A78BFA' }}>
                {user?.spec && SPEC_ICONS[user.spec] ? (
                  <img src={SPEC_ICONS[user.spec]} alt={user.spec} className="w-14 h-14" />
                ) : (
                  <i className="fas fa-user-shield text-3xl text-midnight-glow"></i>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-cinzel font-bold m-0" style={{ color: CLASS_COLORS[user?.characterClass] || '#FFF' }}>
                  {user?.characterName}
                </h3>
                <p className="text-midnight-silver m-0">{user?.characterClass} - {user?.spec || '-'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30 flex-shrink-0">
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

        {/* History */}
        <div className="flex-1 overflow-auto p-6">
          <h4 className="text-lg font-cinzel text-midnight-glow mb-4">
            <i className="fas fa-history mr-2"></i>{t('my_dkp_history')}
          </h4>
          {loading ? (
            <div className="text-center py-8">
              <i className="fas fa-circle-notch fa-spin text-4xl text-midnight-glow"></i>
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t('no_transactions')}</p>
          ) : (
            <div className="space-y-2">
              {history.map((tx) => (
                <div key={tx.id} className="bg-midnight-purple bg-opacity-20 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white m-0 truncate">{tx.reason}</p>
                    <p className="text-xs text-midnight-silver m-0">
                      {formatDate(tx.createdAt || tx.created_at)}
                      {(tx.character_name || tx.characterName) && (
                        <span className="ml-2 text-midnight-glow">
                          <i className="fas fa-user-edit mr-1"></i>
                          {tx.character_name || tx.characterName}
                        </span>
                      )}
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

        {/* Footer */}
        <div className="p-4 border-t border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold hover:shadow-lg transition-all"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MyCharacterModal
