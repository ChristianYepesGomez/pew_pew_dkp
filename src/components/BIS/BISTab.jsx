import { useState, useEffect, useMemo } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { useAuth } from '../../hooks/useAuth'
import { bisAPI, membersAPI, raidItemsAPI } from '../../services/api'
import { CLASS_COLORS, RARITY_COLORS } from '../../utils/constants'
import WowheadTooltip from '../Common/WowheadTooltip'
import PaperDoll, { PAPER_DOLL_SLOTS } from './PaperDoll'
import SlotItemPicker from './SlotItemPicker'

const BISTab = () => {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const [myItems, setMyItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState('my') // 'my' or 'guild'
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [allItems, setAllItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)

  // Guild BIS state
  const [members, setMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberBIS, setMemberBIS] = useState([])
  const [memberLoading, setMemberLoading] = useState(false)
  const [guildSelectedSlot, setGuildSelectedSlot] = useState(null)
  const [guildSearch, _setGuildSearch] = useState('')
  const [guildBIS, setGuildBIS] = useState({})
  const [_guildLoading, setGuildLoading] = useState(false)

  // Load my BIS list
  const loadMyBIS = async () => {
    try {
      const res = await bisAPI.getMy()
      setMyItems(res.data)
    } catch (error) {
      console.error('Failed to load BIS list:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load members for Guild BIS view
  const loadMembers = async () => {
    try {
      const res = await membersAPI.getAll()
      setMembers(res.data.members || res.data || [])
    } catch { /* silent */ }
  }

  // Load all items (raid + M+) when picker opens
  const loadAllItems = async () => {
    if (allItems.length > 0) return // Already loaded
    setItemsLoading(true)
    try {
      const res = await raidItemsAPI.getAllSources()
      setAllItems(res.data.items || [])
    } catch (error) {
      console.error('Failed to load items:', error)
    } finally {
      setItemsLoading(false)
    }
  }

  useEffect(() => {
    loadMyBIS()
    loadMembers()
  }, [])

  // Load items when a slot is selected
  useEffect(() => {
    if (selectedSlot) loadAllItems()
  }, [selectedSlot])

  // Load guild-wide BIS data
  useEffect(() => {
    if (subTab !== 'guild') return
    const loadGuildBIS = async () => {
      setGuildLoading(true)
      try {
        const allBIS = {}
        const promises = members.map(async (m) => {
          try {
            const res = await bisAPI.getUser(m.userId || m.id)
            return { member: m, items: res.data }
          } catch { return { member: m, items: [] } }
        })
        const results = await Promise.all(promises)
        for (const { member, items } of results) {
          for (const item of items) {
            if (!allBIS[item.item_id]) {
              allBIS[item.item_id] = {
                item_id: item.item_id,
                item_name: item.item_name,
                item_name_en: item.item_name_en,
                item_image: item.item_image,
                item_rarity: item.item_rarity,
                item_slot: item.item_slot,
                boss_name: item.boss_name,
                raid_name: item.raid_name,
                source_type: item.source_type,
                wantedBy: [],
              }
            }
            allBIS[item.item_id].wantedBy.push({
              userId: member.userId || member.id,
              characterName: member.characterName || member.character_name,
              characterClass: member.characterClass || member.character_class,
              priority: item.priority,
              obtained: item.obtained,
            })
          }
        }
        setGuildBIS(allBIS)
      } catch (error) {
        console.error('Failed to load guild BIS:', error)
      } finally {
        setGuildLoading(false)
      }
    }
    if (members.length > 0) loadGuildBIS()
  }, [subTab, members])

  // Load another member's BIS
  useEffect(() => {
    if (!selectedMember) { setMemberBIS([]); return }
    const loadMemberBIS = async () => {
      setMemberLoading(true)
      try {
        const res = await bisAPI.getUser(selectedMember)
        setMemberBIS(res.data)
      } catch { setMemberBIS([]) }
      finally { setMemberLoading(false) }
    }
    loadMemberBIS()
  }, [selectedMember])

  // Guild BIS filtered by search
  const _filteredGuildBIS = useMemo(() => {
    const items = Object.values(guildBIS)
    if (!guildSearch) return items.sort((a, b) => b.wantedBy.length - a.wantedBy.length)
    const q = guildSearch.toLowerCase()
    return items.filter(i =>
      i.item_name?.toLowerCase().includes(q) ||
      i.item_name_en?.toLowerCase().includes(q) ||
      i.boss_name?.toLowerCase().includes(q)
    ).sort((a, b) => b.wantedBy.length - a.wantedBy.length)
  }, [guildBIS, guildSearch])

  const handleAddItem = async (itemData) => {
    await bisAPI.add(itemData)
    await loadMyBIS()
  }

  const handleRemoveItem = async (id) => {
    try {
      await bisAPI.remove(id)
      setMyItems(prev => prev.filter(i => i.id !== id))
    } catch (error) {
      console.error('Failed to remove BIS item:', error)
    }
  }

  const handleToggleObtained = async (id, newValue) => {
    try {
      await bisAPI.update(id, { obtained: newValue })
      setMyItems(prev => prev.map(i => i.id === id ? { ...i, obtained: newValue } : i))
    } catch (error) {
      console.error('Failed to toggle obtained:', error)
    }
  }

  const handleSlotClick = (slotKey) => {
    setSelectedSlot(prev => prev === slotKey ? null : slotKey)
  }

  // Render a guild BIS item row
  const _renderGuildItemRow = (item) => (
    <div
      key={item.item_id}
      className="flex items-start gap-4 p-4 rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-40"
    >
      <WowheadTooltip itemId={item.item_id}>
        <div
          className="w-10 h-10 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0 overflow-hidden"
          style={{ borderColor: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic }}
        >
          {item.item_image ? (
            <img src={item.item_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <i className="fas fa-gem" style={{ color: RARITY_COLORS[item.item_rarity] }}></i>
          )}
        </div>
      </WowheadTooltip>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <WowheadTooltip itemId={item.item_id}>
            <span
              className="font-semibold text-sm cursor-pointer"
              style={{ color: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic }}
            >
              {language === 'es' ? item.item_name : (item.item_name_en || item.item_name)}
            </span>
          </WowheadTooltip>
          <span className="text-xs text-midnight-silver">
            {item.boss_name} {'\u2022'} {item.item_slot}
            {item.source_type === 'mythicplus' && <span className="ml-1 text-blue-400">(M+)</span>}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.wantedBy
            .filter(w => !w.obtained)
            .sort((a, b) => (a.priority || 99) - (b.priority || 99))
            .map(w => (
              <span
                key={w.userId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-opacity-30"
                style={{
                  color: CLASS_COLORS[w.characterClass] || '#fff',
                  borderColor: CLASS_COLORS[w.characterClass] || '#666',
                }}
              >
                {w.characterName}
                {w.priority > 0 && (
                  <span className="text-midnight-glow font-bold">#{w.priority}</span>
                )}
              </span>
            ))}
        </div>
      </div>

      <span className="bg-midnight-purple px-2 py-1 rounded text-xs text-midnight-glow font-bold flex-shrink-0">
        {item.wantedBy.filter(w => !w.obtained).length}
      </span>
    </div>
  )

  // Render a member BIS item row (no controls)
  const renderMemberItemRow = (item) => (
    <div
      key={item.id}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        item.obtained
          ? 'border-green-500 border-opacity-40 bg-green-900 bg-opacity-10'
          : 'border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-40'
      }`}
    >
      <WowheadTooltip itemId={item.item_id}>
        <div
          className="w-10 h-10 rounded-lg bg-midnight-deepblue flex items-center justify-center border-2 flex-shrink-0 overflow-hidden"
          style={{ borderColor: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic }}
        >
          {item.item_image ? (
            <img src={item.item_image} alt={item.item_name} className="w-full h-full object-cover" />
          ) : (
            <i className="fas fa-gem" style={{ color: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic }}></i>
          )}
        </div>
      </WowheadTooltip>

      <div className="flex-1 min-w-0">
        <WowheadTooltip itemId={item.item_id}>
          <span
            className="font-semibold text-sm truncate block cursor-pointer"
            style={{ color: RARITY_COLORS[item.item_rarity] || RARITY_COLORS.epic }}
          >
            {item.obtained && <i className="fas fa-check-circle text-green-400 mr-1"></i>}
            {language === 'es' ? item.item_name : (item.item_name_en || item.item_name)}
          </span>
        </WowheadTooltip>
        <div className="flex items-center gap-2 text-xs text-midnight-silver">
          {item.boss_name && <span>{item.boss_name}</span>}
          {item.item_slot && <span className="opacity-60">{'\u2022'} {item.item_slot}</span>}
          {item.source_type === 'mythicplus' && <span className="text-blue-400">(M+)</span>}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-circle-notch fa-spin text-4xl text-midnight-glow"></i>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs: My BIS / Guild BIS */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setSubTab('my'); setSelectedSlot(null) }}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              subTab === 'my'
                ? 'bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white'
                : 'bg-midnight-deepblue border border-midnight-bright-purple border-opacity-30 text-midnight-silver hover:text-white'
            }`}
          >
            <i className="fas fa-user mr-2"></i>{t('bis_my_list')}
          </button>
          <button
            onClick={() => { setSubTab('guild'); setSelectedSlot(null) }}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              subTab === 'guild'
                ? 'bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white'
                : 'bg-midnight-deepblue border border-midnight-bright-purple border-opacity-30 text-midnight-silver hover:text-white'
            }`}
          >
            <i className="fas fa-users mr-2"></i>{t('bis_guild_list')}
          </button>
        </div>
      </div>

      {/* MY BIS TAB — Paper Doll Layout */}
      {subTab === 'my' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Paper Doll (left side) */}
          <div className="lg:w-[280px] flex-shrink-0">
            <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
              <PaperDoll
                bisItems={myItems}
                selectedSlot={selectedSlot}
                onSlotClick={handleSlotClick}
              />
            </div>

            {/* Class Resources */}
            {user?.character_class && (
              <div className="mt-3 rounded-xl border border-midnight-bright-purple border-opacity-15 bg-midnight-deepblue bg-opacity-20 p-3">
                <p className="text-[10px] text-midnight-silver mb-2 font-semibold uppercase tracking-wider">
                  <i className="fas fa-book-open mr-1 text-midnight-glow"></i>{t('bis_class_resources')}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { name: 'Archon', icon: 'fa-chart-bar', color: 'text-purple-400', href: `https://www.archon.gg/wow/builds/${(user.character_class || '').toLowerCase()}/overview` },
                    { name: 'Murlok', icon: 'fa-fish', color: 'text-green-400', href: `https://murlok.io/${(user.character_class || '').toLowerCase()}` },
                    { name: 'WoWAnalyzer', icon: 'fa-microscope', color: 'text-blue-400', href: 'https://wowanalyzer.com/' },
                    { name: 'Wowhead', icon: 'fa-database', color: 'text-yellow-400', href: `https://www.wowhead.com/guide/classes/${(user.character_class || '').toLowerCase()}` },
                  ].map(link => (
                    <a
                      key={link.name}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-midnight-purple bg-opacity-20 hover:bg-opacity-40 transition-all text-xs ${link.color}`}
                    >
                      <i className={`fas ${link.icon} text-[10px]`}></i>
                      {link.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Slot Item Picker (right side) */}
          <div className="flex-1 min-w-0">
            {selectedSlot ? (
              <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5 h-[600px] flex flex-col">
                {itemsLoading ? (
                  <div className="flex items-center justify-center flex-1">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-midnight-glow"></i>
                  </div>
                ) : (
                  <SlotItemPicker
                    slotKey={selectedSlot}
                    allItems={allItems}
                    bisItems={myItems}
                    onAdd={handleAddItem}
                    onRemove={handleRemoveItem}
                    onToggleObtained={handleToggleObtained}
                    onClose={() => setSelectedSlot(null)}
                    userClass={user?.character_class}
                  />
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-8 flex flex-col items-center justify-center min-h-[400px]">
                <i className="fas fa-hand-pointer text-5xl text-midnight-silver opacity-20 mb-4"></i>
                <p className="text-midnight-silver text-center">{t('bis_select_slot')}</p>
                <p className="text-midnight-silver text-center text-sm opacity-60 mt-1">{t('bis_select_slot_desc')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GUILD BIS TAB — Member Paper Doll View */}
      {subTab === 'guild' && (
        <>
          {/* Member selector dropdown */}
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={selectedMember || ''}
              onChange={(e) => { setSelectedMember(e.target.value ? parseInt(e.target.value) : null); setGuildSelectedSlot(null) }}
              className="px-4 py-2.5 rounded-lg bg-midnight-deepblue border border-midnight-bright-purple border-opacity-30 text-white min-w-[250px]"
            >
              <option value="">{t('bis_select_member')}</option>
              {members
                .filter(m => m.characterName || m.character_name)
                .sort((a, b) => (a.characterName || a.character_name).localeCompare(b.characterName || b.character_name))
                .map(m => (
                  <option key={m.userId || m.id} value={m.userId || m.id}>
                    {m.characterName || m.character_name} — {m.characterClass || m.character_class}
                  </option>
                ))}
            </select>
            {selectedMember && memberBIS.length > 0 && (
              <span className="text-xs text-midnight-silver">
                <i className="fas fa-star text-yellow-400 mr-1"></i>
                {memberBIS.length} BIS {t('items')}
                <span className="ml-2"><i className="fas fa-check-circle text-green-400 mr-1"></i>{memberBIS.filter(i => i.obtained).length} {t('bis_obtained')}</span>
              </span>
            )}
          </div>

          {/* Member paper doll + slot detail */}
          {!selectedMember ? (
            <div className="text-center py-16 text-midnight-silver">
              <i className="fas fa-users text-5xl opacity-20 mb-4"></i>
              <p>{t('bis_select_member_desc')}</p>
            </div>
          ) : memberLoading ? (
            <div className="flex items-center justify-center py-12">
              <i className="fas fa-circle-notch fa-spin text-3xl text-midnight-glow"></i>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Paper Doll (left side — read-only view) */}
              <div className="lg:w-[280px] flex-shrink-0">
                <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
                  <PaperDoll
                    bisItems={memberBIS}
                    selectedSlot={guildSelectedSlot}
                    onSlotClick={(slot) => setGuildSelectedSlot(prev => prev === slot ? null : slot)}
                  />
                </div>
              </div>

              {/* Slot detail (right side) */}
              <div className="flex-1 min-w-0">
                {guildSelectedSlot ? (
                  <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-cinzel text-sm text-white m-0">
                        <i className="fas fa-star text-midnight-glow mr-2"></i>
                        {t(`bis_slot_${guildSelectedSlot.toLowerCase()}`) || guildSelectedSlot}
                      </h4>
                      <button onClick={() => setGuildSelectedSlot(null)} className="text-gray-400 hover:text-white text-sm p-1">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <div className="space-y-2">
                      {memberBIS.filter(bi => {
                        if (bi.slot_position === guildSelectedSlot) return true
                        const slotDef = PAPER_DOLL_SLOTS[guildSelectedSlot]
                        if (!bi.slot_position && slotDef?.matchSlots.includes(bi.item_slot)) return true
                        return false
                      }).map(item => renderMemberItemRow(item))}
                      {memberBIS.filter(bi => {
                        if (bi.slot_position === guildSelectedSlot) return true
                        const slotDef = PAPER_DOLL_SLOTS[guildSelectedSlot]
                        if (!bi.slot_position && slotDef?.matchSlots.includes(bi.item_slot)) return true
                        return false
                      }).length === 0 && (
                        <p className="text-midnight-silver text-sm text-center py-6">{t('bis_slot_empty')}</p>
                      )}
                    </div>
                  </div>
                ) : memberBIS.length === 0 ? (
                  <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-8 flex flex-col items-center justify-center min-h-[300px]">
                    <i className="fas fa-scroll text-4xl text-midnight-silver opacity-20 mb-3"></i>
                    <p className="text-midnight-silver text-center">{t('bis_member_empty')}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-midnight-bright-purple border-opacity-20 bg-midnight-deepblue bg-opacity-30 p-8 flex flex-col items-center justify-center min-h-[300px]">
                    <i className="fas fa-hand-pointer text-5xl text-midnight-silver opacity-20 mb-4"></i>
                    <p className="text-midnight-silver text-center">{t('bis_click_slot_to_view')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default BISTab
