import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CircleNotch, X, Trophy, ShieldStar, WarningCircle, ArrowCounterClockwise, Question, Diamond, Sword } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { armoryAPI } from '../../services/api'
import WowheadTooltip from '../Common/WowheadTooltip'
import CLASS_COLORS from '../../utils/classColors'
import PillBadge from '../UI/PillBadge'

const RARITY_COLORS = {
  common: '#9d9d9d', uncommon: '#1eff00', rare: '#0070dd',
  epic: '#a335ee', legendary: '#ff8000',
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

const ROLE_COLORS = { DPS: 'coral', Tank: 'lavender', Healer: 'teal' }

const ArmoryModal = ({ memberId, onClose }) => {
  const { t, language } = useLanguage()
  const [profile, setProfile] = useState(null)
  const [loot, setLoot] = useState([])
  const [equipment, setEquipment] = useState(null)
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [equipmentError, setEquipmentError] = useState(null)
  const [characterMedia, setCharacterMedia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('loot')

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [profileRes, lootRes] = await Promise.all([
          armoryAPI.getProfile(memberId),
          armoryAPI.getLoot(memberId),
        ])
        setProfile(profileRes.data)
        setLoot(lootRes.data || [])
      } catch (error) {
        console.error('Error loading armory data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [memberId])

  const loadEquipment = useCallback(async () => {
    if (!profile?.server || !profile?.characterName || equipment || equipmentLoading) return

    setEquipmentLoading(true)
    setEquipmentError(null)
    try {
      const [equipRes, mediaRes] = await Promise.all([
        armoryAPI.getEquipment(profile.server, profile.characterName),
        armoryAPI.getMedia(profile.server, profile.characterName).catch(() => ({ data: null })),
      ])
      setEquipment(equipRes.data?.items || equipRes.data?.equipped_items || [])
      setCharacterMedia(mediaRes.data)
    } catch (error) {
      console.error('Error loading equipment:', error)
      setEquipmentError(error.response?.data?.error || t('equipment_load_error'))
    } finally {
      setEquipmentLoading(false)
    }
  }, [profile, equipment, equipmentLoading, t])

  useEffect(() => {
    if (activeTab === 'equipment') loadEquipment()
  }, [activeTab, loadEquipment])

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
        <CircleNotch size={48} weight="bold" className="text-coral animate-spin" />
      </div>,
      document.body
    )
  }

  if (!profile) {
    return createPortal(
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
        <div className="bg-indigo border-2 border-red-500 rounded-2xl p-6 text-center">
          <WarningCircle size={48} weight="bold" className="text-red-400 mx-auto mb-4" />
          <p className="text-cream mb-4">{t('member_not_found')}</p>
          <button onClick={onClose} className="px-6 py-2 rounded-full bg-lavender-12 text-cream hover:bg-lavender-20 transition-colors">
            {t('close')}
          </button>
        </div>
      </div>,
      document.body
    )
  }

  const role = profile.raidRole || 'DPS'
  const roleColor = ROLE_COLORS[role] || 'coral'

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-lavender-20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full bg-lavender-12 flex items-center justify-center overflow-hidden border-2"
                style={{ borderColor: CLASS_COLORS[profile.characterClass] || '#b1a7d0' }}
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold" style={{ color: CLASS_COLORS[profile.characterClass] || '#FFF' }}>
                    {profile.characterName?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold" style={{ color: CLASS_COLORS[profile.characterClass] || '#ffaf9d' }}>
                  {profile.characterName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {SPEC_ICONS[profile.spec] && <img src={SPEC_ICONS[profile.spec]} alt="" className="w-5 h-5 rounded" />}
                  <p className="text-lavender text-sm">{profile.characterClass} {profile.spec ? `- ${profile.spec}` : ''}</p>
                  <PillBadge color={roleColor}>{role}</PillBadge>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-lavender hover:text-cream transition-colors">
              <X size={24} weight="bold" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-lavender-12 grid grid-cols-4 gap-4 text-center border-b border-lavender-20 shrink-0">
          <div>
            <p className="text-xs text-lavender">{t('current_dkp')}</p>
            <p className="text-xl font-bold text-coral">{profile.currentDkp}</p>
          </div>
          <div>
            <p className="text-xs text-lavender">{t('total_gained')}</p>
            <p className="text-xl font-bold text-teal">+{profile.lifetimeGained}</p>
          </div>
          <div>
            <p className="text-xs text-lavender">{t('total_spent')}</p>
            <p className="text-xl font-bold text-red-400">-{profile.lifetimeSpent}</p>
          </div>
          <div>
            <p className="text-xs text-lavender">{t('items_won')}</p>
            <p className="text-xl font-bold text-yellow-400">{profile.itemsWon}</p>
          </div>
        </div>

        <div className="flex border-b border-lavender-20 shrink-0">
          <button
            onClick={() => setActiveTab('loot')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'loot' ? 'text-coral border-b-2 border-coral bg-lavender-12' : 'text-lavender hover:text-cream hover:bg-lavender-12'
            }`}
          >
            <Trophy size={18} weight="bold" />
            {t('loot_history')} ({loot.length})
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'equipment' ? 'text-coral border-b-2 border-coral bg-lavender-12' : 'text-lavender hover:text-cream hover:bg-lavender-12'
            }`}
          >
            <ShieldStar size={18} weight="bold" />
            {t('equipment')}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'loot' && (
            loot.length === 0 ? (
              <p className="text-center text-lavender py-8">{t('no_items_won')}</p>
            ) : (
              <div className="space-y-2">
                {loot.map((item) => (
                  <div key={item.id} className="bg-lavender-12 rounded-xl p-3 flex items-center gap-3">
                    <WowheadTooltip itemId={item.itemId}>
                      <div
                        className="w-10 h-10 rounded-lg bg-indigo flex items-center justify-center border-2 shrink-0 overflow-hidden cursor-help"
                        style={{ borderColor: RARITY_COLORS[item.itemRarity] || RARITY_COLORS.epic }}
                      >
                        {item.itemImage && item.itemImage !== '🎁' ? (
                          <img src={item.itemImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Diamond size={18} weight="bold" style={{ color: RARITY_COLORS[item.itemRarity] || RARITY_COLORS.epic }} />
                        )}
                      </div>
                    </WowheadTooltip>
                    <div className="flex-1 min-w-0">
                      <WowheadTooltip itemId={item.itemId}>
                        <p className="font-bold truncate cursor-help" style={{ color: RARITY_COLORS[item.itemRarity] || RARITY_COLORS.epic }}>
                          {item.itemName}
                        </p>
                      </WowheadTooltip>
                      <p className="text-xs text-lavender">{formatDate(item.wonAt)}</p>
                    </div>
                    <span className="text-red-400 font-bold shrink-0">-{item.dkpSpent} DKP</span>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'equipment' && (
            <div>
              {!profile?.server ? (
                <div className="text-center py-8">
                  <Sword size={48} weight="bold" className="text-lavender mx-auto mb-4" />
                  <p className="text-lavender">{t('no_server_configured')}</p>
                </div>
              ) : equipmentLoading ? (
                <div className="text-center py-8">
                  <CircleNotch size={48} weight="bold" className="text-coral animate-spin mx-auto" />
                  <p className="text-lavender mt-2">{t('loading_equipment')}</p>
                </div>
              ) : equipmentError ? (
                <div className="text-center py-8">
                  <WarningCircle size={48} weight="bold" className="text-yellow-500 mx-auto mb-4" />
                  <p className="text-yellow-400">{equipmentError}</p>
                  <button
                    onClick={() => { setEquipment(null); setCharacterMedia(null); loadEquipment() }}
                    className="mt-4 px-4 py-2 rounded-full bg-lavender-12 text-cream hover:bg-lavender-20 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <ArrowCounterClockwise size={16} weight="bold" />
                    {t('retry')}
                  </button>
                </div>
              ) : equipment && equipment.length > 0 ? (
                <div className="flex gap-4">
                  {characterMedia?.mainRaw && (
                    <div className="hidden sm:flex shrink-0 w-[200px] items-start justify-center">
                      <div className="relative w-full rounded-xl overflow-hidden bg-lavender-12 border border-lavender-20">
                        <img
                          src={characterMedia.mainRaw}
                          alt={profile.characterName}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    </div>
                  )}
                  <div className={`flex-1 grid gap-2 ${characterMedia?.mainRaw ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
                    {equipment.map((item) => {
                      const quality = (item.rarity || item.quality || 'epic').toLowerCase()
                      const rarityColor = RARITY_COLORS[quality] || RARITY_COLORS.epic
                      const slotName = (item.slotName || item.slot || '').replace(/_/g, ' ')
                      return (
                        <WowheadTooltip key={item.slot} itemId={item.itemId}>
                          <div className="bg-lavender-12 rounded-xl p-2 flex items-center gap-2 cursor-help hover:bg-lavender-20 transition-colors">
                            <div
                              className="w-9 h-9 rounded bg-indigo flex items-center justify-center border-2 shrink-0 overflow-hidden"
                              style={{ borderColor: rarityColor }}
                            >
                              {item.icon ? (
                                <img src={item.icon} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Question size={16} weight="bold" className="text-lavender" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate" style={{ color: rarityColor }}>{item.name}</p>
                              <p className="text-xs text-lavender">{slotName} {item.itemLevel ? `\u2022 iLvl ${item.itemLevel}` : ''}</p>
                            </div>
                          </div>
                        </WowheadTooltip>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ShieldStar size={48} weight="bold" className="text-lavender mx-auto mb-4" />
                  <p className="text-lavender">{t('no_equipment_data')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-lavender-20 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-full bg-coral text-indigo font-bold hover:opacity-90 transition-opacity"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ArmoryModal
