import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { armoryAPI } from '../../services/api'
import WowheadTooltip from '../Common/WowheadTooltip'
import CLASS_COLORS from '../../utils/classColors'

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

// Equipment slot order and display names
const EQUIPMENT_SLOTS = [
  { slot: 'HEAD', icon: 'inv_helmet_03' },
  { slot: 'NECK', icon: 'inv_jewelry_necklace_01' },
  { slot: 'SHOULDER', icon: 'inv_shoulder_02' },
  { slot: 'BACK', icon: 'inv_misc_cape_18' },
  { slot: 'CHEST', icon: 'inv_chest_chain' },
  { slot: 'SHIRT', icon: 'inv_shirt_grey_01' },
  { slot: 'TABARD', icon: 'inv_shirt_guildtabard_01' },
  { slot: 'WRIST', icon: 'inv_bracer_07' },
  { slot: 'HANDS', icon: 'inv_gauntlets_04' },
  { slot: 'WAIST', icon: 'inv_belt_03' },
  { slot: 'LEGS', icon: 'inv_pants_03' },
  { slot: 'FEET', icon: 'inv_boots_05' },
  { slot: 'FINGER_1', icon: 'inv_jewelry_ring_01' },
  { slot: 'FINGER_2', icon: 'inv_jewelry_ring_01' },
  { slot: 'TRINKET_1', icon: 'inv_trinket_naxxramas04' },
  { slot: 'TRINKET_2', icon: 'inv_trinket_naxxramas04' },
  { slot: 'MAIN_HAND', icon: 'inv_sword_04' },
  { slot: 'OFF_HAND', icon: 'inv_shield_04' },
]

const ArmoryModal = ({ memberId, onClose }) => {
  const { t, language } = useLanguage()
  const [profile, setProfile] = useState(null)
  const [loot, setLoot] = useState([])
  const [equipment, setEquipment] = useState(null)
  const [equipmentLoading, setEquipmentLoading] = useState(false)
  const [equipmentError, setEquipmentError] = useState(null)
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

  // Load equipment when switching to equipment tab
  const loadEquipment = useCallback(async () => {
    if (!profile?.server || !profile?.characterName || equipment || equipmentLoading) return

    setEquipmentLoading(true)
    setEquipmentError(null)
    try {
      const res = await armoryAPI.getEquipment(profile.server, profile.characterName)
      setEquipment(res.data?.equipped_items || [])
    } catch (error) {
      console.error('Error loading equipment:', error)
      setEquipmentError(error.response?.data?.error || t('equipment_load_error'))
    } finally {
      setEquipmentLoading(false)
    }
  }, [profile, equipment, equipmentLoading, t])

  useEffect(() => {
    if (activeTab === 'equipment') {
      loadEquipment()
    }
  }, [activeTab, loadEquipment])

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
        <i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i>
      </div>,
      document.body
    )
  }

  if (!profile) {
    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
        <div className="bg-midnight-deepblue border-2 border-red-500 rounded-2xl p-6 text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
          <p className="text-white mb-4">{t('member_not_found')}</p>
          <button onClick={onClose} className="px-6 py-2 rounded-lg bg-midnight-purple text-white">
            {t('close')}
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-full bg-midnight-purple flex items-center justify-center overflow-hidden border-2"
                style={{ borderColor: CLASS_COLORS[profile.characterClass] || '#A78BFA' }}
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span
                    className="text-2xl font-bold"
                    style={{ color: CLASS_COLORS[profile.characterClass] || '#FFF' }}
                  >
                    {profile.characterName?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h3
                  className="text-2xl font-cinzel font-bold m-0"
                  style={{ color: CLASS_COLORS[profile.characterClass] || '#A78BFA' }}
                >
                  {profile.characterName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {SPEC_ICONS[profile.spec] && (
                    <img src={SPEC_ICONS[profile.spec]} alt="" className="w-5 h-5 rounded" />
                  )}
                  <p className="text-midnight-silver m-0 text-sm">
                    {profile.characterClass} {profile.spec ? `- ${profile.spec}` : ''}
                  </p>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${profile.raidRole === 'Tank' ? 'bg-blue-500' : profile.raidRole === 'Healer' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                    {profile.raidRole || 'DPS'}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 bg-midnight-purple bg-opacity-20 grid grid-cols-4 gap-4 text-center border-b border-midnight-bright-purple border-opacity-20 flex-shrink-0">
          <div>
            <p className="text-xs text-midnight-silver m-0">{t('current_dkp')}</p>
            <p className="text-xl font-bold text-midnight-glow m-0">{profile.currentDkp}</p>
          </div>
          <div>
            <p className="text-xs text-midnight-silver m-0">{t('total_gained')}</p>
            <p className="text-xl font-bold text-green-400 m-0">+{profile.lifetimeGained}</p>
          </div>
          <div>
            <p className="text-xs text-midnight-silver m-0">{t('total_spent')}</p>
            <p className="text-xl font-bold text-red-400 m-0">-{profile.lifetimeSpent}</p>
          </div>
          <div>
            <p className="text-xs text-midnight-silver m-0">{t('items_won')}</p>
            <p className="text-xl font-bold text-yellow-400 m-0">{profile.itemsWon}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          <button
            onClick={() => setActiveTab('loot')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-all ${
              activeTab === 'loot'
                ? 'text-midnight-glow border-b-2 border-midnight-glow bg-midnight-purple bg-opacity-20'
                : 'text-midnight-silver hover:text-white hover:bg-midnight-purple hover:bg-opacity-10'
            }`}
          >
            <i className="fas fa-trophy mr-2"></i>
            {t('loot_history')} ({loot.length})
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-all ${
              activeTab === 'equipment'
                ? 'text-midnight-glow border-b-2 border-midnight-glow bg-midnight-purple bg-opacity-20'
                : 'text-midnight-silver hover:text-white hover:bg-midnight-purple hover:bg-opacity-10'
            }`}
          >
            <i className="fas fa-shield-alt mr-2"></i>
            {t('equipment')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'loot' && (
            loot.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('no_items_won')}</p>
            ) : (
              <div className="space-y-2">
                {loot.map((item) => (
                  <div
                    key={item.id}
                    className="bg-midnight-purple bg-opacity-20 rounded-lg p-3 flex items-center gap-3"
                  >
                    <WowheadTooltip itemId={item.itemId}>
                      <div
                        className="w-10 h-10 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0 overflow-hidden cursor-help"
                        style={{ borderColor: RARITY_COLORS[item.itemRarity] || RARITY_COLORS.epic }}
                      >
                        {item.itemImage && item.itemImage !== '🎁' ? (
                          <img src={item.itemImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <i
                            className="fas fa-gem"
                            style={{ color: RARITY_COLORS[item.itemRarity] || RARITY_COLORS.epic }}
                          ></i>
                        )}
                      </div>
                    </WowheadTooltip>
                    <div className="flex-1 min-w-0">
                      <WowheadTooltip itemId={item.itemId}>
                        <p
                          className="font-bold m-0 truncate cursor-help"
                          style={{ color: RARITY_COLORS[item.itemRarity] || RARITY_COLORS.epic }}
                        >
                          {item.itemName}
                        </p>
                      </WowheadTooltip>
                      <p className="text-xs text-midnight-silver m-0">
                        {formatDate(item.wonAt)}
                      </p>
                    </div>
                    <span className="text-red-400 font-bold flex-shrink-0">
                      -{item.dkpSpent} DKP
                    </span>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'equipment' && (
            <div>
              {!profile?.server ? (
                <div className="text-center py-8">
                  <i className="fas fa-server text-4xl text-gray-500 mb-4"></i>
                  <p className="text-gray-500">{t('no_server_configured')}</p>
                </div>
              ) : equipmentLoading ? (
                <div className="text-center py-8">
                  <i className="fas fa-circle-notch fa-spin text-4xl text-midnight-glow"></i>
                  <p className="text-midnight-silver mt-2">{t('loading_equipment')}</p>
                </div>
              ) : equipmentError ? (
                <div className="text-center py-8">
                  <i className="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                  <p className="text-yellow-400">{equipmentError}</p>
                  <button
                    onClick={() => { setEquipment(null); loadEquipment() }}
                    className="mt-4 px-4 py-2 rounded-lg bg-midnight-purple text-white hover:bg-midnight-bright-purple transition-all"
                  >
                    {t('retry')}
                  </button>
                </div>
              ) : equipment && equipment.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {equipment.map((item) => {
                    const quality = item.quality?.type?.toLowerCase() || 'epic'
                    const rarityColor = RARITY_COLORS[quality] || RARITY_COLORS.epic
                    return (
                      <WowheadTooltip key={item.slot.type} itemId={item.item?.id}>
                        <div className="bg-midnight-purple bg-opacity-20 rounded-lg p-2 flex items-center gap-2 cursor-help hover:bg-opacity-30 transition-all">
                          <div
                            className="w-9 h-9 rounded bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0 overflow-hidden"
                            style={{ borderColor: rarityColor }}
                          >
                            {item.media?.value ? (
                              <img src={item.media.value} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <i className="fas fa-question text-gray-500"></i>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold m-0 truncate" style={{ color: rarityColor }}>
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500 m-0">
                              {item.slot?.type?.replace(/_/g, ' ')} • iLvl {item.level?.value}
                            </p>
                          </div>
                        </div>
                      </WowheadTooltip>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="fas fa-shield-alt text-4xl text-gray-500 mb-4"></i>
                  <p className="text-gray-500">{t('no_equipment_data')}</p>
                </div>
              )}
            </div>
          )}
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

export default ArmoryModal
