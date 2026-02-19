import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Users, X, CircleNotch, Skull, Crown, CaretDown } from '@phosphor-icons/react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI, buffsAPI } from '../../services/api'
import DKPAdjustModal from './DKPAdjustModal'
import ArmoryModal from './ArmoryModal'
import VaultIcon from '../Common/VaultIcon'
import CLASS_COLORS from '../../utils/classColors'
import SectionHeader from '../ui/SectionHeader'
import PillInput from '../ui/PillInput'
import PopoverMenu, { PopoverMenuItem } from '../ui/PopoverMenu'
import SurfaceCard from '../ui/SurfaceCard'
import PillBadge from '../ui/PillBadge'
import SortableHeader from '../ui/SortableHeader'

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

const ROLE_COLORS = {
  DPS: 'coral',
  Tank: 'lavender',
  Healer: 'teal',
}

const DEFAULT_SORT_DIRECTION = {
  characterName: 'asc',
  spec: 'asc',
  raidRole: 'asc',
  currentDkp: 'desc',
}

const getSortValue = (member, field) => {
  if (field === 'currentDkp') return Number(member.currentDkp || 0)
  if (field === 'characterName') return (member.characterName || '').toLowerCase()
  if (field === 'spec') return (member.spec || '').toLowerCase()
  if (field === 'raidRole') return (member.raidRole || '').toLowerCase()
  return member[field]
}

const MembersTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [adjustModal, setAdjustModal] = useState({ open: false, member: null })
  const [deleteModal, setDeleteModal] = useState({ open: false, member: null })
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [vaultLoading, setVaultLoading] = useState(null)
  const [sortField, setSortField] = useState('currentDkp')
  const [sortDir, setSortDir] = useState('desc')
  const [filterText, setFilterText] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const isAdmin = user?.role === 'admin'
  const isOfficer = user?.role === 'officer'
  const canManageVault = isAdmin || isOfficer
  const tableGridStyle = {
    gridTemplateColumns: isAdmin
      ? '2rem minmax(12rem, 2.2fr) minmax(10rem, 1.7fr) minmax(7.5rem, 1.2fr) minmax(4rem, 0.8fr) 2.5rem 2.25rem'
      : '2rem minmax(12rem, 2.2fr) minmax(10rem, 1.7fr) minmax(7.5rem, 1.2fr) minmax(4rem, 0.8fr) 2.5rem',
  }
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [armoryMemberId, setArmoryMemberId] = useState(null)

  const [activeBuffs, setActiveBuffs] = useState({})
  const sseRef = useRef(null)

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

  const refreshTimeoutRef = useRef(null)
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    refreshTimeoutRef.current = setTimeout(() => {
      loadMembers()
    }, 100)
  }, [])

  useEffect(() => { loadMembers() }, [])
  useSocket({ dkp_updated: debouncedRefresh, dkp_bulk_updated: debouncedRefresh, member_updated: debouncedRefresh })

  useEffect(() => {
    const refresh = () => loadMembers()
    window.addEventListener('roster-refresh', refresh)
    return () => window.removeEventListener('roster-refresh', refresh)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '')
    const sseUrl = `${baseUrl}/api/buffs/stream`

    const connectSSE = () => {
      const eventSource = new EventSource(`${sseUrl}?token=${token}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'sync') {
            setActiveBuffs(data.activeBuffs || {})
          } else if (data.type === 'buff_applied') {
            setActiveBuffs(prev => {
              const newBuffs = { ...prev }
              for (const targetId of data.targets) {
                newBuffs[targetId] = {
                  buff: data.buff,
                  expiresAt: data.expiresAt,
                  casterName: data.casterName,
                  casterId: data.casterId,
                  isSelfCast: data.isSelfCast,
                }
              }
              return newBuffs
            })
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err)
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setTimeout(connectSSE, 5000)
      }

      sseRef.current = eventSource
    }

    connectSSE()

    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [])

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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(DEFAULT_SORT_DIRECTION[field] || 'asc')
    }
  }

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = members

    if (filterText) {
      const lower = filterText.toLowerCase()
      filtered = filtered.filter(m =>
        m.characterName?.toLowerCase().includes(lower) ||
        m.username?.toLowerCase().includes(lower)
      )
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(m => m.raidRole === filterRole)
    }

    return [...filtered].sort((a, b) => {
      const aVal = getSortValue(a, sortField)
      const bVal = getSortValue(b, sortField)

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal ?? '').localeCompare(String(bVal ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      }

      if (comparison === 0) {
        return (a.characterName || '').localeCompare(b.characterName || '', undefined, { sensitivity: 'base' })
      }

      return sortDir === 'asc' ? comparison : -comparison
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

    const member = members.find(m => m.id === memberId)
    if (!member) return

    const previousState = member.weeklyVaultCompleted

    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, weeklyVaultCompleted: !previousState } : m
    ))
    setVaultLoading(memberId)

    try {
      await membersAPI.toggleVault(memberId)
    } catch (error) {
      console.error('Error toggling vault:', error)
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, weeklyVaultCompleted: previousState } : m
      ))
    } finally {
      setVaultLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <CircleNotch size={48} className="text-coral animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader icon={Users} title={t('members_list')}>
        <span className="text-sm text-lavender tabular-nums">
          {filteredAndSortedMembers.length === members.length
            ? `${members.length} ${t('members').toLowerCase()}`
            : `${filteredAndSortedMembers.length} / ${members.length}`}
        </span>
        <PillInput
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={t('search_name')}
          size="md"
          fullWidth={false}
          className="w-[211px]"
        />
        <PopoverMenu
          open={roleMenuOpen}
          onOpenChange={setRoleMenuOpen}
          menuId="role-filter-menu"
          placement="right"
          menuClassName="min-w-32 w-max max-w-xs"
          trigger={({ open, triggerProps }) => (
            <button
              {...triggerProps}
              className="flex items-center gap-2 h-10 whitespace-nowrap rounded-full bg-transparent px-4 py-2 text-sm font-medium text-cream outline outline-2 outline-lavender-20 transition-colors hover:bg-lavender-12"
            >
              {filterRole === 'all' ? t('all_roles') : t(filterRole.toLowerCase())}
              <CaretDown
                size={14}
                className={`text-cream transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        >
          {[
            { value: 'all', label: t('all_roles') },
            { value: 'Tank', label: t('tank') },
            { value: 'Healer', label: t('healer') },
            { value: 'DPS', label: t('dps') },
          ].map((option) => (
            <PopoverMenuItem
              key={option.value}
              onClick={() => {
                setFilterRole(option.value)
                setRoleMenuOpen(false)
              }}
              className={filterRole === option.value ? 'text-coral' : ''}
            >
              {option.label}
            </PopoverMenuItem>
          ))}
        </PopoverMenu>
      </SectionHeader>

      <SurfaceCard>
        <div className="grid gap-x-4 gap-y-3 items-center" style={tableGridStyle}>
          <div className="pb-4" />
          <div className="pb-4">
            <SortableHeader field="characterName" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
              {t('character')}
            </SortableHeader>
          </div>
          <div className="pb-4">
            <SortableHeader field="spec" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
              {t('spec')}
            </SortableHeader>
          </div>
          <div className="pb-4">
            <SortableHeader field="raidRole" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
              {t('role')}
            </SortableHeader>
          </div>
          <div className="pb-4">
            <SortableHeader field="currentDkp" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
              DKP
            </SortableHeader>
          </div>
          <div className="pb-4 flex justify-center">
            <VaultIcon size={16} completed={false} />
          </div>
          {isAdmin && (
            <div className="pb-4 text-right">
              <span className="text-xs font-bold text-cream">{t('actions')}</span>
            </div>
          )}

          {filteredAndSortedMembers.map((m) => {
            const classColor = CLASS_COLORS[m.characterClass] || '#FFFFFF'
            const role = m.raidRole || 'DPS'
            const roleColor = ROLE_COLORS[role] || 'coral'
            const isCurrentUser = m.id === user?.id

            return (
              <React.Fragment key={m.id}>
                <div className="flex items-center justify-center">
                  {m.avatar ? (
                    <img
                      src={m.avatar}
                      alt={m.characterName}
                      className="w-8 h-8 rounded-full object-cover border-2 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                      style={{ borderColor: classColor }}
                      onClick={(e) => { e.stopPropagation(); setAvatarPreview({ avatar: m.avatar }) }}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0"
                      style={{ borderColor: classColor, color: classColor, backgroundColor: `${classColor}22` }}
                    >
                      {m.characterName?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setArmoryMemberId(m.id)}
                    className="text-base font-semibold mix-blend-screen hover:underline cursor-pointer"
                    style={{ color: classColor }}
                    title={t('view_armory')}
                  >
                    {m.characterName}
                  </button>
                  {activeBuffs[m.id] && (
                    <div
                      className="animate-pulse"
                      title={`${activeBuffs[m.id].buff.name}${!activeBuffs[m.id].isSelfCast && activeBuffs[m.id].casterName && activeBuffs[m.id].casterId !== m.id ? ` (${activeBuffs[m.id].casterName})` : ''}`}
                    >
                      <img
                        src={activeBuffs[m.id].buff.icon}
                        alt={activeBuffs[m.id].buff.name}
                        className="w-5 h-5 rounded border border-yellow-400"
                        style={{ boxShadow: `0 0 8px ${activeBuffs[m.id].buff.raidWide ? '#ff4444' : '#ffff00'}` }}
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {m.spec && SPEC_ICONS[m.spec] && (
                    <img
                      src={SPEC_ICONS[m.spec]}
                      alt={m.spec}
                      className="w-6 h-6 rounded"
                      title={m.spec}
                    />
                  )}
                  <span
                    className="text-sm font-medium mix-blend-screen"
                    style={{ color: classColor }}
                  >
                    {m.spec || '-'}
                  </span>
                </div>

                <div>
                  <PillBadge color={roleColor}>{role}</PillBadge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-teal mix-blend-screen">
                    {m.currentDkp || 0}
                  </span>
                  {m.dkpCap && m.currentDkp >= m.dkpCap && (
                    <Crown size={14} weight="fill" className="text-yellow-400" />
                  )}
                </div>

                <div className="flex items-center justify-center">
                  {canManageVault ? (
                    <button
                      onClick={() => handleToggleVault(m.id)}
                      disabled={vaultLoading === m.id}
                      className={`transition-opacity ${vaultLoading === m.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
                      title={m.weeklyVaultCompleted ? t('vault_completed') : t('vault_not_completed')}
                    >
                      <VaultIcon completed={!!m.weeklyVaultCompleted} size={22} />
                    </button>
                  ) : (
                    <span title={m.weeklyVaultCompleted ? t('vault_completed') : t('vault_not_completed')}>
                      <VaultIcon completed={!!m.weeklyVaultCompleted} size={22} />
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, member: m }) }}
                      className={`transition-colors text-xs ${isCurrentUser ? 'text-red-500/35 cursor-not-allowed' : 'text-red-400 hover:text-red-300'}`}
                      title={t('remove_member')}
                      disabled={isCurrentUser}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </SurfaceCard>

      {filteredAndSortedMembers.length === 0 && (
        <p className="text-center text-lavender py-8">{t('no_members')}</p>
      )}

      {adjustModal.open && (
        <DKPAdjustModal
          member={adjustModal.member}
          onClose={() => setAdjustModal({ open: false, member: null })}
          onSubmit={handleAdjustSubmit}
        />
      )}

      {deleteModal.open && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-indigo border-2 border-red-500/50 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <Skull size={48} weight="fill" className="text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-cream mb-2">{t('remove_member')}</h3>
            <p className="text-lavender mb-1">{t('confirm_remove_member')}</p>
            <p className="font-bold text-lg mb-4" style={{ color: CLASS_COLORS[deleteModal.member?.characterClass] || '#FFF' }}>
              {deleteModal.member?.characterName}
            </p>
            <p className="text-sm text-lavender mb-6">{t('farewell_note')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, member: null })}
                className="flex-1 px-4 py-3 rounded-full border-2 border-lavender-20 text-cream hover:bg-lavender-12 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteMember}
                disabled={deleteLoading}
                className="flex-1 px-4 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                {deleteLoading ? (
                  <CircleNotch size={20} className="animate-spin mx-auto" />
                ) : (
                  t('confirm')
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {avatarPreview && createPortal(
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] cursor-pointer"
          onClick={() => setAvatarPreview(null)}
        >
          <img
            src={avatarPreview.avatar}
            alt=""
            className="rounded-lg shadow-2xl border-2 border-white/20"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
          />
          <button
            onClick={() => setAvatarPreview(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full text-white/50 hover:text-white transition-colors flex items-center justify-center"
          >
            <X size={24} />
          </button>
        </div>,
        document.body
      )}

      {armoryMemberId && (
        <ArmoryModal
          memberId={armoryMemberId}
          onClose={() => setArmoryMemberId(null)}
        />
      )}
    </div>
  )
}

export default MembersTab
