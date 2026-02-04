import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { dkpAPI, authAPI, charactersAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
  DeathKnight: '#C41F3B', 'Demon Hunter': '#A330C9', DemonHunter: '#A330C9', Monk: '#00FF96', Evoker: '#33937F',
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

const CLASSES = Object.keys(CLASS_SPECS)

const MyCharacterModal = ({ onClose }) => {
  const { user, refreshUser } = useAuth()
  const { t, language } = useLanguage()
  const [history, setHistory] = useState([])
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState(user?.email || '')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newChar, setNewChar] = useState({
    characterName: '',
    characterClass: 'Warrior',
    spec: 'Arms',
    raidRole: 'DPS',
  })
  const [charError, setCharError] = useState('')
  const [showHistory, setShowHistory] = useState(false)

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

  const handleClassChange = (cls) => {
    const classData = CLASS_SPECS[cls]
    setNewChar({
      ...newChar,
      characterClass: cls,
      spec: classData.specs[0],
      raidRole: classData.defaultRoles[0],
    })
  }

  const handleSpecChange = (spec) => {
    const classData = CLASS_SPECS[newChar.characterClass]
    const idx = classData.specs.indexOf(spec)
    setNewChar({
      ...newChar,
      spec,
      raidRole: classData.defaultRoles[idx] || 'DPS',
    })
  }

  const handleAddCharacter = async () => {
    if (!newChar.characterName.trim()) return
    setCharError('')
    try {
      await charactersAPI.create(newChar)
      setShowAddForm(false)
      setNewChar({ characterName: '', characterClass: 'Warrior', spec: 'Arms', raidRole: 'DPS' })
      const res = await charactersAPI.getAll()
      setCharacters(res.data || [])
    } catch (error) {
      setCharError(error.response?.data?.error || 'Error')
    }
  }

  const handleSetPrimary = async (charId) => {
    try {
      await charactersAPI.setPrimary(charId)
      await refreshUser()
      const res = await charactersAPI.getAll()
      setCharacters(res.data || [])
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
              <div className="w-16 h-16 rounded-full bg-midnight-purple flex items-center justify-center overflow-hidden border-2" style={{ borderColor: CLASS_COLORS[user?.characterClass] || '#A78BFA' }}>
                <img src="/logo.png" alt="Profile" className="w-full h-full object-cover" />
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
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

          {/* Characters Section */}
          <div className="p-6 border-b border-midnight-bright-purple border-opacity-30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-cinzel text-midnight-glow m-0">
                <i className="fas fa-users mr-2"></i>{t('my_characters')}
              </h4>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-xs px-3 py-1 rounded-lg bg-midnight-purple bg-opacity-50 text-midnight-glow hover:bg-opacity-70 transition-all"
              >
                <i className={`fas ${showAddForm ? 'fa-minus' : 'fa-plus'} mr-1`}></i>
                {t('add_character')}
              </button>
            </div>

            {charError && (
              <p className="text-xs text-red-400 mb-2">{charError}</p>
            )}

            {/* Add Character Form */}
            {showAddForm && (
              <div className="bg-midnight-purple bg-opacity-20 rounded-lg p-3 mb-3 space-y-2">
                <input
                  type="text"
                  value={newChar.characterName}
                  onChange={(e) => setNewChar({ ...newChar, characterName: e.target.value })}
                  placeholder={t('character_name')}
                  className="w-full bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newChar.characterClass}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="bg-midnight-purple border border-midnight-bright-purple border-opacity-30 rounded-lg px-2 py-2 text-white text-sm focus:outline-none"
                  >
                    {CLASSES.map(cls => (
                      <option key={cls} value={cls} style={{ color: CLASS_COLORS[cls] }}>{cls}</option>
                    ))}
                  </select>
                  <select
                    value={newChar.spec}
                    onChange={(e) => handleSpecChange(e.target.value)}
                    className="bg-midnight-purple border border-midnight-bright-purple border-opacity-30 rounded-lg px-2 py-2 text-white text-sm focus:outline-none"
                  >
                    {CLASS_SPECS[newChar.characterClass].specs.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                  <select
                    value={newChar.raidRole}
                    onChange={(e) => setNewChar({ ...newChar, raidRole: e.target.value })}
                    className="bg-midnight-purple border border-midnight-bright-purple border-opacity-30 rounded-lg px-2 py-2 text-white text-sm focus:outline-none"
                  >
                    <option value="Tank">Tank</option>
                    <option value="Healer">Healer</option>
                    <option value="DPS">DPS</option>
                  </select>
                </div>
                <button
                  onClick={handleAddCharacter}
                  disabled={!newChar.characterName.trim()}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <i className="fas fa-plus mr-1"></i>{t('create')}
                </button>
              </div>
            )}

            {/* Character List */}
            {loading ? (
              <div className="text-center py-4">
                <i className="fas fa-circle-notch fa-spin text-2xl text-midnight-glow"></i>
              </div>
            ) : (
              <div className="space-y-2">
                {characters.map((char) => (
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
                      <p className="text-xs text-midnight-silver m-0">
                        {char.characterClass} - {char.spec || '-'} ({char.raidRole})
                      </p>
                    </div>

                    {/* Delete */}
                    {!char.isPrimary && characters.length > 1 && (
                      <button
                        onClick={() => handleDeleteCharacter(char.id)}
                        className="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 transition-all"
                        title={t('delete_character')}
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DKP History (collapsible) */}
          <div className="p-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-cinzel text-midnight-glow mb-3 hover:text-white transition-all"
            >
              <i className={`fas fa-chevron-${showHistory ? 'down' : 'right'} text-xs`}></i>
              <i className="fas fa-history"></i>
              {t('my_dkp_history')}
              <span className="text-xs text-midnight-silver font-sans">({history.length})</span>
            </button>
            {showHistory && (
              loading ? (
                <div className="text-center py-4">
                  <i className="fas fa-circle-notch fa-spin text-2xl text-midnight-glow"></i>
                </div>
              ) : history.length === 0 ? (
                <p className="text-center text-gray-400 py-4 text-sm">{t('no_transactions')}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-auto">
                  {history.map((tx) => (
                    <div key={tx.id} className="bg-midnight-purple bg-opacity-20 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm m-0 truncate">{tx.reason}</p>
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
              )
            )}
          </div>
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
    </div>,
    document.body
  )
}

export default MyCharacterModal
