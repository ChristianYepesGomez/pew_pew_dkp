import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import { itemPopularityAPI } from '../../services/api'
import RARITY_COLORS from '../../utils/rarityColors'
import WowheadTooltip from '../Common/WowheadTooltip'
import { PAPER_DOLL_SLOTS } from './PaperDoll'
import {
  SquaresFour, Sword, Key, X, Star, Diamond,
  CheckCircle, Circle, Trash, PlusCircle, Fire,
  Check, CircleNotch, Plus,
} from '@phosphor-icons/react'

const RARITY_BG = {
  common: 'from-gray-600 to-gray-700',
  uncommon: 'from-green-700 to-green-800',
  rare: 'from-blue-700 to-blue-800',
  epic: 'from-purple-700 to-purple-800',
  legendary: 'from-orange-600 to-orange-700',
}

const SOURCE_TABS = [
  { key: 'all', Icon: SquaresFour },
  { key: 'raid', Icon: Sword },
  { key: 'mythicplus', Icon: Key },
]

const SlotItemPicker = ({ slotKey, allItems = [], bisItems = [], onAdd, onRemove, onToggleObtained, onClose, userClass = null }) => {
  const { t, language } = useLanguage()
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(null) // item id being added
  const [popularItems, setPopularItems] = useState({}) // itemId -> usage_pct

  const slotDef = PAPER_DOLL_SLOTS[slotKey]
  if (!slotDef) return null

  // Fetch popularity data for this slot
  useEffect(() => {
    if (!userClass || !slotKey) return
    const slotName = slotDef?.matchSlots?.[0]
    if (!slotName) return
    itemPopularityAPI.get(userClass, null, slotName).then(res => {
      const map = {}
      for (const item of (res.data || [])) {
        if (item.usage_pct > 5) map[item.item_id] = item.usage_pct
      }
      setPopularItems(map)
    }).catch(() => {})
  }, [userClass, slotKey, slotDef])

  // BIS items for this slot
  const slotBisItems = useMemo(() => {
    return bisItems.filter(bi => {
      if (bi.slot_position === slotKey) return true
      if (!bi.slot_position && slotDef.matchSlots.includes(bi.item_slot)) return true
      return false
    })
  }, [bisItems, slotKey, slotDef])

  const bisItemIds = useMemo(() => new Set(slotBisItems.map(bi => bi.item_id)), [slotBisItems])

  const getBossName = useCallback((item) => {
    return language === 'es' ? item.boss : (item.bossEn || item.boss)
  }, [language])

  // Available items filtered for this slot
  const availableItems = useMemo(() => {
    let items = allItems.filter(item => slotDef.matchSlots.includes(item.slot))

    if (sourceFilter !== 'all') {
      items = items.filter(item => (item.sourceType || 'raid') === sourceFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      items = items.filter(item => {
        const nameEn = (item.name?.en || '').toLowerCase()
        const nameEs = (item.name?.es || '').toLowerCase()
        const boss = getBossName(item)?.toLowerCase() || ''
        return nameEn.includes(q) || nameEs.includes(q) || boss.includes(q)
      })
    }

    // Sort popular items higher
    if (Object.keys(popularItems).length > 0) {
      items.sort((a, b) => (popularItems[b.id] || 0) - (popularItems[a.id] || 0))
    }

    return items
  }, [allItems, slotDef, sourceFilter, search, getBossName, popularItems])

  const handleAdd = async (item) => {
    setAdding(item.id)
    try {
      await onAdd({
        item_id: item.id,
        item_name: item.name.es || item.name.en,
        item_name_en: item.name.en,
        item_image: item.icon,
        item_rarity: item.rarity,
        item_slot: item.slot,
        item_level: item.itemLevel || 0,
        boss_name: item.boss,
        raid_name: item.raid || item.dungeon,
        source_type: item.sourceType || 'raid',
        slot_position: slotKey,
        priority: 0,
        notes: null,
      })
    } catch (err) {
      console.error('Failed to add BIS item:', err)
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {slotDef.Icon && <slotDef.Icon size={16} className="text-coral" />}
          <h4 className="text-sm text-white m-0">{t(`bis_slot_${slotKey.toLowerCase()}`) || slotDef.label}</h4>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm p-1">
          <X size={14} />
        </button>
      </div>

      {/* Source tabs */}
      <div className="flex gap-1 mb-3 flex-shrink-0">
        {SOURCE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSourceFilter(tab.key)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 ${
              sourceFilter === tab.key
                ? 'bg-lavender-12 text-white'
                : 'bg-indigo/50 text-lavender hover:text-white'
            }`}
          >
            <tab.Icon size={14} />
            {t(`bis_source_${tab.key}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('search_items')}
        className="w-full px-3 py-2 rounded-lg bg-lavender-12/20 border border-lavender-20/30 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-coral mb-3 flex-shrink-0"
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {/* Current BIS items for this slot */}
        {slotBisItems.length > 0 && (
          <div>
            <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider inline-flex items-center gap-1">
              <Star size={14} weight="fill" className="text-yellow-400" />{t('bis_your_bis')} ({slotBisItems.length})
            </p>
            <div className="space-y-1.5">
              {slotBisItems.map(bi => (
                <div
                  key={bi.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    bi.obtained
                      ? 'border-green-500/30 bg-green-900/10'
                      : 'border-lavender-20/20 bg-lavender-12/10'
                  }`}
                >
                  <WowheadTooltip itemId={bi.item_id}>
                    <div
                      className={`w-9 h-9 rounded flex-shrink-0 overflow-hidden border bg-gradient-to-br cursor-help ${RARITY_BG[bi.item_rarity] || RARITY_BG.epic}`}
                      style={{ borderColor: RARITY_COLORS[bi.item_rarity] }}
                    >
                      {bi.item_image ? (
                        <img src={bi.item_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Diamond size={12} style={{ color: RARITY_COLORS[bi.item_rarity] }} />
                        </div>
                      )}
                    </div>
                  </WowheadTooltip>
                  <div className="flex-1 min-w-0">
                    <WowheadTooltip itemId={bi.item_id}>
                      <p className="text-xs font-bold truncate m-0 cursor-help" style={{ color: RARITY_COLORS[bi.item_rarity] }}>
                        {language === 'en' && bi.item_name_en ? bi.item_name_en : bi.item_name}
                      </p>
                    </WowheadTooltip>
                    <p className="text-[10px] text-lavender m-0 truncate">
                      {bi.boss_name}
                      {bi.source_type === 'mythicplus' && <span className="ml-1 text-blue-400">(M+)</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggleObtained(bi.id, bi.obtained ? 0 : 1)}
                    className={`p-1.5 rounded text-xs transition-all ${
                      bi.obtained
                        ? 'text-green-400 hover:text-green-300'
                        : 'text-lavender hover:text-green-400'
                    }`}
                    title={bi.obtained ? t('bis_mark_unobtained') : t('bis_mark_obtained')}
                  >
                    {bi.obtained ? <CheckCircle size={16} /> : <Circle size={16} />}
                  </button>
                  <button
                    onClick={() => onRemove(bi.id)}
                    className="p-1.5 rounded text-xs text-lavender hover:text-red-400 transition-all"
                    title={t('bis_remove')}
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available items to add */}
        <div>
          <p className="text-xs text-lavender mb-2 font-semibold uppercase tracking-wider inline-flex items-center gap-1">
            <PlusCircle size={14} className="text-coral" />{t('bis_available_items')} ({availableItems.length})
          </p>
          <div className="space-y-1">
            {availableItems.map(item => {
              const isAlreadyBis = bisItemIds.has(item.id)
              const isAdding = adding === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => !isAlreadyBis && !isAdding && handleAdd(item)}
                  disabled={isAlreadyBis || isAdding}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                    isAlreadyBis
                      ? 'border-green-500/20 bg-green-900/5 opacity-50 cursor-not-allowed'
                      : 'border-lavender-20/15 hover:border-lavender-20/40 hover:bg-lavender-12/15'
                  }`}
                >
                  <WowheadTooltip itemId={item.id}>
                    <div
                      className={`w-8 h-8 rounded flex-shrink-0 overflow-hidden border bg-gradient-to-br ${RARITY_BG[item.rarity] || RARITY_BG.epic}`}
                      style={{ borderColor: RARITY_COLORS[item.rarity] }}
                    >
                      {item.icon ? (
                        <img src={item.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Diamond size={12} style={{ color: RARITY_COLORS[item.rarity] }} />
                        </div>
                      )}
                    </div>
                  </WowheadTooltip>
                  <div className="flex-1 min-w-0">
                    <WowheadTooltip itemId={item.id}>
                      <p className="text-xs font-bold truncate m-0 cursor-help" style={{ color: RARITY_COLORS[item.rarity] }}>
                        {item.name[language] || item.name.en}
                      </p>
                    </WowheadTooltip>
                    <p className="text-[10px] text-lavender m-0 truncate">
                      {getBossName(item)}
                      {(item.sourceType || 'raid') === 'mythicplus' && <span className="ml-1 text-blue-400">(M+)</span>}
                      {item.itemLevel > 0 && <span className="ml-1">iLvl {item.itemLevel}</span>}
                    </p>
                  </div>
                  {popularItems[item.id] && (
                    <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[10px] font-bold" title={t('bis_popular')}>
                      <Fire size={10} />{Math.round(popularItems[item.id])}%
                    </span>
                  )}
                  {isAlreadyBis ? (
                    <Check size={14} className="text-green-500 flex-shrink-0" />
                  ) : isAdding ? (
                    <CircleNotch size={14} className="animate-spin text-coral flex-shrink-0" />
                  ) : (
                    <Plus size={14} className="text-lavender flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              )
            })}
            {availableItems.length === 0 && (
              <p className="text-lavender text-xs text-center py-4">{t('no_items_found')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SlotItemPicker
