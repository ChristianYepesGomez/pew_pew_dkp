import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI } from '../../services/api'
import DKPAdjustModal from './DKPAdjustModal'
import VaultIcon from '../Common/VaultIcon'
import CLASS_COLORS from '../../utils/classColors'

// WoW Buffs for Easter egg system (short-duration cooldowns only)
// type: 'self' = only the caster class can have it, 'external' = anyone can receive it
// selfClasses: classes that can self-cast this buff
// targetRoles: for external buffs, which roles can receive (null = any)
const BUFFS = [
  // Raid-wide lust effects (applies to ALL members when triggered) - Horde only
  { id: 'bloodlust', name: 'Bloodlust', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_bloodlust.jpg', glow: '#ff4444', type: 'external', raidWide: true },
  { id: 'timewarp', name: 'Time Warp', duration: 40, icon: 'https://wow.zamimg.com/images/wow/icons/medium/ability_mage_timewarp.jpg', glow: '#69CCF0', type: 'external', raidWide: true },
  // Self-cast cooldowns (class-specific)
  { id: 'icyveins', name: 'Icy Veins', duration: 25, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_frost_coldhearted.jpg', glow: '#69CCF0', type: 'self', selfClasses: ['Mage'] },
  { id: 'combustion', name: 'Combustion', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_fire_sealoffire.jpg', glow: '#ff6600', type: 'self', selfClasses: ['Mage'] },
  { id: 'metamorphosis', name: 'Metamorphosis', duration: 24, icon: 'https://wow.zamimg.com/images/wow/icons/medium/ability_demonhunter_metamorphasisdps.jpg', glow: '#00ff00', type: 'self', selfClasses: ['Demon Hunter'] },
  { id: 'avenging', name: 'Avenging Wrath', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_avenginewrath.jpg', glow: '#F58CBA', type: 'self', selfClasses: ['Paladin'] },
  { id: 'recklessness', name: 'Recklessness', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/medium/warrior_talent_icon_innerrage.jpg', glow: '#C79C6E', type: 'self', selfClasses: ['Warrior'] },
  { id: 'shadowdance', name: 'Shadow Dance', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/medium/ability_rogue_shadowdance.jpg', glow: '#FFF569', type: 'self', selfClasses: ['Rogue'] },
  { id: 'berserk', name: 'Berserk', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/medium/ability_druid_berserk.jpg', glow: '#FF7D0A', type: 'self', selfClasses: ['Druid'] },
  { id: 'vendetta', name: 'Vendetta', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/medium/ability_rogue_deadliness.jpg', glow: '#FFF569', type: 'self', selfClasses: ['Rogue'] },
  { id: 'pillarofrost', name: 'Pillar of Frost', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/medium/ability_deathknight_pillaroffrost.jpg', glow: '#C41F3B', type: 'self', selfClasses: ['Death Knight'] },
  { id: 'celestialalignment', name: 'Celestial Alignment', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_natureguardian.jpg', glow: '#FF7D0A', type: 'self', selfClasses: ['Druid'] },
  { id: 'trueshot', name: 'Trueshot', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/medium/ability_trueshot.jpg', glow: '#ABD473', type: 'self', selfClasses: ['Hunter'] },
  { id: 'darksoultorment', name: 'Dark Soul', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/medium/warlock_darksoultorment.jpg', glow: '#8788EE', type: 'self', selfClasses: ['Warlock'] },
  // External buffs (short cooldowns only - can be cast on others)
  { id: 'powerinfusion', name: 'Power Infusion', duration: 15, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_powerinfusion.jpg', glow: '#ffff00', type: 'external' },
  { id: 'innervate', name: 'Innervate', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_lightning.jpg', glow: '#00ff00', type: 'external', targetRoles: ['Healer'] },
  { id: 'windfury', name: 'Windfury Totem', duration: 20, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_windfury.jpg', glow: '#0070DE', type: 'external', targetRoles: ['DPS', 'Tank'] },
  { id: 'painsuppression', name: 'Pain Suppression', duration: 8, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_painsupression.jpg', glow: '#ffffff', type: 'external', targetRoles: ['Tank'] },
  { id: 'ironbark', name: 'Ironbark', duration: 12, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_druid_ironbark.jpg', glow: '#FF7D0A', type: 'external', targetRoles: ['Tank'] },
  { id: 'blessingofprotection', name: 'Blessing of Protection', duration: 10, icon: 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_sealofprotection.jpg', glow: '#F58CBA', type: 'external', targetRoles: ['Healer', 'DPS'] },
]

// Get valid buffs for a member based on their class and role
function getValidBuffsForMember(member) {
  const memberClass = member.characterClass
  const memberRole = member.raidRole || 'DPS'

  return BUFFS.filter(buff => {
    if (buff.type === 'self') {
      // Self-buffs only for the specific class
      return buff.selfClasses?.includes(memberClass)
    } else {
      // External buffs: check role restrictions if any
      if (buff.targetRoles) {
        return buff.targetRoles.includes(memberRole)
      }
      return true // No restrictions
    }
  })
}

// Spec icons from Wowhead (WoW Classic/Retail icons)
const SPEC_ICONS = {
  // Warrior
  'Arms': 'https://wow.zamimg.com/images/wow/icons/medium/ability_warrior_savageblow.jpg',
  'Fury': 'https://wow.zamimg.com/images/wow/icons/medium/ability_warrior_innerrage.jpg',
  'Protection Warrior': 'https://wow.zamimg.com/images/wow/icons/medium/ability_warrior_defensivestance.jpg',
  // Paladin
  'Holy Paladin': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_holybolt.jpg',
  'Protection Paladin': 'https://wow.zamimg.com/images/wow/icons/medium/ability_paladin_shieldofthetemplar.jpg',
  'Retribution': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_auraoflight.jpg',
  // Hunter
  'Beast Mastery': 'https://wow.zamimg.com/images/wow/icons/medium/ability_hunter_bestialdiscipline.jpg',
  'Marksmanship': 'https://wow.zamimg.com/images/wow/icons/medium/ability_hunter_focusedaim.jpg',
  'Survival': 'https://wow.zamimg.com/images/wow/icons/medium/ability_hunter_camouflage.jpg',
  // Rogue
  'Assassination': 'https://wow.zamimg.com/images/wow/icons/medium/ability_rogue_deadlybrew.jpg',
  'Outlaw': 'https://wow.zamimg.com/images/wow/icons/medium/ability_rogue_waylay.jpg',
  'Subtlety': 'https://wow.zamimg.com/images/wow/icons/medium/ability_stealth.jpg',
  // Priest
  'Discipline': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_powerwordshield.jpg',
  'Holy Priest': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_guardianspirit.jpg',
  'Shadow': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_shadowwordpain.jpg',
  // Shaman
  'Elemental': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_lightning.jpg',
  'Enhancement': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shaman_improvedstormstrike.jpg',
  'Restoration Shaman': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_magicimmunity.jpg',
  // Mage
  'Arcane': 'https://wow.zamimg.com/images/wow/icons/medium/spell_holy_magicalsentry.jpg',
  'Fire': 'https://wow.zamimg.com/images/wow/icons/medium/spell_fire_firebolt02.jpg',
  'Frost Mage': 'https://wow.zamimg.com/images/wow/icons/medium/spell_frost_frostbolt02.jpg',
  // Warlock
  'Affliction': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_deathcoil.jpg',
  'Demonology': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_metamorphosis.jpg',
  'Destruction': 'https://wow.zamimg.com/images/wow/icons/medium/spell_shadow_rainoffire.jpg',
  // Druid
  'Balance': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_starfall.jpg',
  'Feral': 'https://wow.zamimg.com/images/wow/icons/medium/ability_druid_catform.jpg',
  'Guardian': 'https://wow.zamimg.com/images/wow/icons/medium/ability_racial_bearform.jpg',
  'Restoration Druid': 'https://wow.zamimg.com/images/wow/icons/medium/spell_nature_healingtouch.jpg',
  // Death Knight
  'Blood': 'https://wow.zamimg.com/images/wow/icons/medium/spell_deathknight_bloodpresence.jpg',
  'Frost DK': 'https://wow.zamimg.com/images/wow/icons/medium/spell_deathknight_frostpresence.jpg',
  'Unholy': 'https://wow.zamimg.com/images/wow/icons/medium/spell_deathknight_unholypresence.jpg',
  // Monk
  'Brewmaster': 'https://wow.zamimg.com/images/wow/icons/medium/spell_monk_brewmaster_spec.jpg',
  'Mistweaver': 'https://wow.zamimg.com/images/wow/icons/medium/spell_monk_mistweaver_spec.jpg',
  'Windwalker': 'https://wow.zamimg.com/images/wow/icons/medium/spell_monk_windwalker_spec.jpg',
  // Demon Hunter
  'Havoc': 'https://wow.zamimg.com/images/wow/icons/medium/ability_demonhunter_specdps.jpg',
  'Vengeance': 'https://wow.zamimg.com/images/wow/icons/medium/ability_demonhunter_spectank.jpg',
  // Evoker
  'Devastation': 'https://wow.zamimg.com/images/wow/icons/medium/classicon_evoker_devastation.jpg',
  'Preservation': 'https://wow.zamimg.com/images/wow/icons/medium/classicon_evoker_preservation.jpg',
  'Augmentation': 'https://wow.zamimg.com/images/wow/icons/medium/classicon_evoker_augmentation.jpg',
}

const MembersTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [adjustModal, setAdjustModal] = useState({ open: false, member: null })
  const [deleteModal, setDeleteModal] = useState({ open: false, member: null })
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [vaultLoading, setVaultLoading] = useState(null) // Track which member's vault is being toggled
  const [sortField, setSortField] = useState('currentDkp')
  const [sortDir, setSortDir] = useState('desc')
  const [filterText, setFilterText] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const isAdmin = user?.role === 'admin'
  const isOfficer = user?.role === 'officer'
  const canManageVault = isAdmin || isOfficer
  const [avatarPreview, setAvatarPreview] = useState(null) // { avatar, name, class }

  // Buff system state (Easter egg)
  const [activeBuffs, setActiveBuffs] = useState({}) // { memberId: { buff, expiresAt } }
  const buffTimerRef = useRef(null)

  const loadMembers = async () => {
    try {
      const response = await membersAPI.getAll()
      setMembers(response.data)
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  // Debounced refresh to prevent multiple calls from duplicate socket events
  const refreshTimeoutRef = useRef(null)
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    refreshTimeoutRef.current = setTimeout(() => {
      loadMembers()
    }, 100) // 100ms debounce
  }, [])

  useEffect(() => { loadMembers() }, [])
  useSocket({ dkp_updated: debouncedRefresh, dkp_bulk_updated: debouncedRefresh, member_updated: debouncedRefresh })

  // Also listen for roster-refresh (fired when primary character changes in modal)
  useEffect(() => {
    const refresh = () => loadMembers()
    window.addEventListener('roster-refresh', refresh)
    return () => window.removeEventListener('roster-refresh', refresh)
  }, [])

  // Buff system: randomly apply buffs to members (Easter egg)
  const applyRandomBuff = useCallback(() => {
    if (members.length === 0) return
    const randomMember = members[Math.floor(Math.random() * members.length)]
    // Get only valid buffs for this member's class/role
    const validBuffs = getValidBuffsForMember(randomMember)
    if (validBuffs.length === 0) return // No valid buffs for this member
    const randomBuff = validBuffs[Math.floor(Math.random() * validBuffs.length)]
    const expiresAt = Date.now() + randomBuff.duration * 1000

    // Raid-wide buffs (lust) apply to ALL members
    if (randomBuff.raidWide) {
      setActiveBuffs(prev => {
        const newBuffs = { ...prev }
        members.forEach(m => {
          newBuffs[m.id] = { buff: randomBuff, expiresAt }
        })
        return newBuffs
      })
    } else {
      setActiveBuffs(prev => ({ ...prev, [randomMember.id]: { buff: randomBuff, expiresAt } }))
    }
  }, [members])

  // Clear expired buffs
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBuffs(prev => {
        const now = Date.now()
        const updated = {}
        for (const [id, data] of Object.entries(prev)) {
          if (data.expiresAt > now) updated[id] = data
        }
        return updated
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Schedule random buff every 30-90 seconds
  useEffect(() => {
    const scheduleNextBuff = () => {
      const delay = 30000 + Math.random() * 60000 // 30-90 seconds
      buffTimerRef.current = setTimeout(() => {
        applyRandomBuff()
        scheduleNextBuff()
      }, delay)
    }
    // Initial buff after 10-20 seconds
    buffTimerRef.current = setTimeout(() => {
      applyRandomBuff()
      scheduleNextBuff()
    }, 10000 + Math.random() * 10000)
    return () => clearTimeout(buffTimerRef.current)
  }, [applyRandomBuff])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = members

    // Filter by text (name)
    if (filterText) {
      const lower = filterText.toLowerCase()
      filtered = filtered.filter(m =>
        m.characterName?.toLowerCase().includes(lower) ||
        m.username?.toLowerCase().includes(lower)
      )
    }

    // Filter by role
    if (filterRole !== 'all') {
      filtered = filtered.filter(m => m.raidRole === filterRole)
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (typeof aVal === 'string') aVal = aVal?.toLowerCase() || ''
      if (typeof bVal === 'string') bVal = bVal?.toLowerCase() || ''

      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }, [members, filterText, filterRole, sortField, sortDir])

  const handleOpenAdjust = (member) => {
    setAdjustModal({ open: true, member })
  }

  const handleAdjustSubmit = async (amount, reason) => {
    try {
      await dkpAPI.adjust(adjustModal.member.id, amount, reason)
      loadMembers()
      setAdjustModal({ open: false, member: null })
    } catch (error) {
      alert(t('error_adjusting_dkp'))
    }
  }

  const handleDeleteMember = async () => {
    if (!deleteModal.member) return
    setDeleteLoading(true)
    try {
      await membersAPI.remove(deleteModal.member.id)
      loadMembers()
      setDeleteModal({ open: false, member: null })
    } catch (error) {
      console.error('Error removing member:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleVault = async (memberId) => {
    if (!canManageVault) return

    // Find current member state for optimistic update
    const member = members.find(m => m.id === memberId)
    if (!member) return

    const previousState = member.weeklyVaultCompleted

    // Optimistic update - immediately toggle UI
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, weeklyVaultCompleted: !previousState } : m
    ))
    setVaultLoading(memberId)

    try {
      await membersAPI.toggleVault(memberId)
      // Don't call loadMembers() - socket will handle sync if needed
    } catch (error) {
      console.error('Error toggling vault:', error)
      // Revert optimistic update on error
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, weeklyVaultCompleted: previousState } : m
      ))
    } finally {
      setVaultLoading(null)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <i className="fas fa-sort text-gray-600 ml-1"></i>
    return sortDir === 'asc'
      ? <i className="fas fa-sort-up text-midnight-glow ml-1"></i>
      : <i className="fas fa-sort-down text-midnight-glow ml-1"></i>
  }

  if (loading) return <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i></div>

  return (
    <div className="info-card flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 flex-shrink-0">
        <h3 className="m-0"><i className="fas fa-users mr-3"></i>{t('members_list')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter by name */}
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={t('search_name')}
            className="px-3 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow text-sm"
          />
          {/* Filter by role */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white focus:outline-none focus:border-midnight-glow text-sm"
          >
            <option value="all">{t('all_roles')}</option>
            <option value="Tank">{t('tank')}</option>
            <option value="Healer">{t('healer')}</option>
            <option value="DPS">{t('dps')}</option>
          </select>
        </div>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full">
          <thead className="sticky top-0 bg-midnight-deepblue">
            <tr className="border-b-2 border-midnight-bright-purple">
              <th
                className="text-left py-3 px-4 text-midnight-glow cursor-pointer hover:text-white"
                onClick={() => handleSort('characterName')}
              >
                {t('character')}<SortIcon field="characterName" />
              </th>
              <th className="text-left py-3 px-4 text-midnight-glow">{t('spec')}</th>
              <th
                className="text-left py-3 px-4 text-midnight-glow cursor-pointer hover:text-white"
                onClick={() => handleSort('raidRole')}
              >
                {t('role')}<SortIcon field="raidRole" />
              </th>
              <th
                className="text-left py-3 px-4 text-midnight-glow cursor-pointer hover:text-white"
                onClick={() => handleSort('currentDkp')}
              >
                DKP<SortIcon field="currentDkp" />
              </th>
              <th className="text-center py-3 px-4 text-midnight-glow" title={t('weekly_vault')}>
                <div className="flex items-center justify-center">
                  <VaultIcon completed={true} size={28} />
                </div>
              </th>
              {isAdmin && <th className="text-left py-3 px-4 text-midnight-glow">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedMembers.map((m) => (
              <tr key={m.id} className="group border-b border-midnight-bright-purple border-opacity-20 hover:bg-midnight-bright-purple hover:bg-opacity-10">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, member: m }) }}
                        className={`text-red-500 transition-opacity text-xs ${m.id === user?.id ? 'invisible' : 'opacity-0 group-hover:opacity-40 hover:!opacity-100'}`}
                        title={t('remove_member')}
                        disabled={m.id === user?.id}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                    {/* Avatar */}
                    {m.avatar ? (
                      <img
                        src={m.avatar}
                        alt={m.characterName}
                        className="w-8 h-8 rounded-full object-cover border-2 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                        style={{ borderColor: CLASS_COLORS[m.characterClass] || '#6B21A8' }}
                        onClick={(e) => { e.stopPropagation(); setAvatarPreview({ avatar: m.avatar, name: m.characterName, characterClass: m.characterClass }) }}
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0"
                        style={{
                          borderColor: CLASS_COLORS[m.characterClass] || '#6B21A8',
                          backgroundColor: `${CLASS_COLORS[m.characterClass] || '#6B21A8'}20`,
                          color: CLASS_COLORS[m.characterClass] || '#FFF'
                        }}
                      >
                        {m.characterName?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <strong
                      className="cursor-default"
                      style={{ color: CLASS_COLORS[m.characterClass] || '#FFF' }}
                    >
                      {m.characterName}
                    </strong>
                    {/* Buff icon slot (fixed width to prevent layout shift) */}
                    <div className="w-6 h-5 flex-shrink-0 flex items-center justify-center">
                      {activeBuffs[m.id] && (
                        <div
                          className="animate-pulse"
                          title={activeBuffs[m.id].buff.name}
                        >
                          <img
                            src={activeBuffs[m.id].buff.icon}
                            alt={activeBuffs[m.id].buff.name}
                            className="w-5 h-5 rounded border border-yellow-400"
                            style={{ boxShadow: `0 0 8px ${activeBuffs[m.id].buff.glow}` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {m.spec && SPEC_ICONS[m.spec] ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={SPEC_ICONS[m.spec]}
                        alt={m.spec}
                        className="w-6 h-6 rounded"
                        title={m.spec}
                      />
                    </div>
                  ) : (
                    <span className="text-midnight-silver">-</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${m.raidRole === 'Tank' ? 'bg-blue-500' : m.raidRole === 'Healer' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                    {m.raidRole || 'DPS'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <strong className="text-midnight-glow text-lg">{m.currentDkp || 0}</strong>
                    {m.dkpCap && m.currentDkp >= m.dkpCap && (
                      <span className="text-xs text-yellow-400" title={t('dkp_cap_reached')}>
                        <i className="fas fa-crown"></i>
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center">
                    {canManageVault ? (
                      <button
                        onClick={() => handleToggleVault(m.id)}
                        disabled={vaultLoading === m.id}
                        className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110"
                        title={m.weeklyVaultCompleted ? t('vault_completed') : t('vault_not_completed')}
                      >
                        {vaultLoading === m.id ? (
                          <i className="fas fa-circle-notch fa-spin text-sm text-midnight-glow"></i>
                        ) : (
                          <VaultIcon completed={m.weeklyVaultCompleted} size={28} />
                        )}
                      </button>
                    ) : (
                      <div
                        className="w-8 h-8 flex items-center justify-center"
                        title={m.weeklyVaultCompleted ? t('vault_completed') : t('vault_not_completed')}
                      >
                        <VaultIcon completed={m.weeklyVaultCompleted} size={28} />
                      </div>
                    )}
                  </div>
                </td>
                {isAdmin && (
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleOpenAdjust(m)}
                      className="px-4 py-2 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <i className="fas fa-coins"></i>
                      {t('adjust_dkp')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredAndSortedMembers.length === 0 && <p className="text-center text-gray-400 py-8">{t('no_members')}</p>}

      {/* DKP Adjust Modal */}
      {adjustModal.open && (
        <DKPAdjustModal
          member={adjustModal.member}
          onClose={() => setAdjustModal({ open: false, member: null })}
          onSubmit={handleAdjustSubmit}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteModal.open && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
          <div className="bg-midnight-deepblue border-2 border-red-500 border-opacity-50 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <i className="fas fa-skull-crossbones text-4xl text-red-400 mb-4"></i>
            <h3 className="text-lg font-bold mb-2">{t('remove_member')}</h3>
            <p className="text-midnight-silver mb-1">{t('confirm_remove_member')}</p>
            <p className="font-bold text-lg mb-4" style={{ color: CLASS_COLORS[deleteModal.member?.characterClass] || '#FFF' }}>
              {deleteModal.member?.characterName}
            </p>
            <p className="text-sm text-gray-500 mb-6">{t('farewell_note')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, member: null })}
                className="flex-1 px-4 py-3 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteMember}
                disabled={deleteLoading}
                className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-all disabled:opacity-50"
              >
                {deleteLoading ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : (
                  <><i className="fas fa-user-slash mr-2"></i>{t('confirm')}</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Avatar Preview Modal */}
      {avatarPreview && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100] cursor-pointer"
          onClick={() => setAvatarPreview(null)}
        >
          <img
            src={avatarPreview.avatar}
            alt=""
            className="rounded-lg shadow-2xl border-2 border-white border-opacity-20"
            style={{ maxWidth: '90vw', maxHeight: '90vh', imageRendering: 'auto' }}
          />
          <button
            onClick={() => setAvatarPreview(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full text-white text-opacity-50 hover:text-opacity-100 transition-all flex items-center justify-center text-2xl"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

export default MembersTab
