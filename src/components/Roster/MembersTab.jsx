import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI } from '../../services/api'
import DKPAdjustModal from './DKPAdjustModal'
import CreateMemberModal from './CreateMemberModal'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
  DeathKnight: '#C41F3B', DemonHunter: '#A330C9', Monk: '#00FF96', Evoker: '#33937F',
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
  const [createModal, setCreateModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ open: false, member: null })
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [sortField, setSortField] = useState('currentDkp')
  const [sortDir, setSortDir] = useState('desc')
  const [filterText, setFilterText] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const isAdmin = user?.role === 'admin'

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

  useEffect(() => { loadMembers() }, [])
  useSocket({ dkp_updated: loadMembers, dkp_bulk_updated: loadMembers, member_updated: loadMembers })

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

  const handleCreateMember = () => {
    loadMembers()
    setCreateModal(false)
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
          {isAdmin && (
            <button
              onClick={() => setCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
            >
              <i className="fas fa-user-plus"></i>
              {t('create_member')}
            </button>
          )}
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
              {isAdmin && <th className="text-left py-3 px-4 text-midnight-glow">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedMembers.map((m) => (
              <tr key={m.id} className="group border-b border-midnight-bright-purple border-opacity-20 hover:bg-midnight-bright-purple hover:bg-opacity-10">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {isAdmin && m.id !== user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, member: m }) }}
                        className="text-red-500 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity text-xs"
                        title={t('remove_member')}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                    <strong style={{ color: CLASS_COLORS[m.characterClass] || '#FFF' }}>{m.characterName}</strong>
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
                <td className="py-3 px-4"><strong className="text-midnight-glow text-lg">{m.currentDkp || 0}</strong></td>
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

      {/* Create Member Modal */}
      {createModal && (
        <CreateMemberModal
          onClose={() => setCreateModal(false)}
          onSuccess={handleCreateMember}
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
    </div>
  )
}

export default MembersTab
