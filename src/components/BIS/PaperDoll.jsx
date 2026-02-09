import { useMemo } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import RARITY_COLORS from '../../utils/rarityColors'
import {
  Crown, Circle, TShirt, Wind, Bandaids,
  Hand, Minus, Pants, Boot, Ring, Diamond, Sword, Shield,
  Check, CheckCircle, User, SquaresFour,
} from '@phosphor-icons/react'

// Paper doll slot definitions — WoW armory-style layout
// matchSlots: item.slot values that can go in this slot
const PAPER_DOLL_SLOTS = {
  // Left column (top to bottom)
  HEAD:      { label: 'Head', Icon: Crown, matchSlots: ['Head'], col: 'left', row: 0 },
  NECK:      { label: 'Neck', Icon: Circle, matchSlots: ['Neck'], col: 'left', row: 1 },
  SHOULDER:  { label: 'Shoulder', Icon: TShirt, matchSlots: ['Shoulder'], col: 'left', row: 2 },
  BACK:      { label: 'Back', Icon: Wind, matchSlots: ['Back'], col: 'left', row: 3 },
  CHEST:     { label: 'Chest', Icon: TShirt, matchSlots: ['Chest'], col: 'left', row: 4 },
  WRIST:     { label: 'Wrist', Icon: Bandaids, matchSlots: ['Wrist'], col: 'left', row: 5 },
  // Right column (top to bottom)
  HANDS:     { label: 'Hands', Icon: Hand, matchSlots: ['Hands'], col: 'right', row: 0 },
  WAIST:     { label: 'Waist', Icon: Minus, matchSlots: ['Waist'], col: 'right', row: 1 },
  LEGS:      { label: 'Legs', Icon: Pants, matchSlots: ['Legs'], col: 'right', row: 2 },
  FEET:      { label: 'Feet', Icon: Boot, matchSlots: ['Feet'], col: 'right', row: 3 },
  FINGER_1:  { label: 'Finger', Icon: Ring, matchSlots: ['Finger'], col: 'right', row: 4 },
  FINGER_2:  { label: 'Finger', Icon: Ring, matchSlots: ['Finger'], col: 'right', row: 5 },
  TRINKET_1: { label: 'Trinket', Icon: Diamond, matchSlots: ['Trinket'], col: 'right', row: 6 },
  TRINKET_2: { label: 'Trinket', Icon: Diamond, matchSlots: ['Trinket'], col: 'right', row: 7 },
  // Bottom row
  MAIN_HAND: { label: 'Main Hand', Icon: Sword, matchSlots: ['Main Hand', 'One-Hand', 'Two-Hand'], col: 'bottom-left', row: 0 },
  OFF_HAND:  { label: 'Off Hand', Icon: Shield, matchSlots: ['Off Hand', 'Shield', 'One-Hand'], col: 'bottom-right', row: 0 },
}

export { PAPER_DOLL_SLOTS }

const RARITY_BORDER = {
  common: 'border-gray-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-orange-500',
}

const PaperDoll = ({ bisItems = [], selectedSlot, onSlotClick, hasTwoHand = false }) => {
  const { t } = useLanguage()

  // Map BIS items to their slots
  const slotItemsMap = useMemo(() => {
    const map = {}
    for (const item of bisItems) {
      // Use slot_position if explicitly set, otherwise auto-assign
      let slotKey = item.slot_position
      if (!slotKey) {
        // Auto-assign based on item_slot
        for (const [key, def] of Object.entries(PAPER_DOLL_SLOTS)) {
          if (def.matchSlots.includes(item.item_slot)) {
            // For dual slots (Finger, Trinket), check if first slot has items
            if (key === 'FINGER_2' || key === 'TRINKET_2') continue
            if (!slotKey) slotKey = key
          }
        }
      }
      if (slotKey) {
        if (!map[slotKey]) map[slotKey] = []
        map[slotKey].push(item)
      }
    }

    // Handle overflow: if FINGER_1 has items and there are more Finger items, put them in FINGER_2
    const fingerItems = bisItems.filter(i => i.item_slot === 'Finger' && !i.slot_position)
    if (fingerItems.length > 1) {
      map['FINGER_1'] = [fingerItems[0]]
      map['FINGER_2'] = [fingerItems[1]]
    }
    const trinketItems = bisItems.filter(i => i.item_slot === 'Trinket' && !i.slot_position)
    if (trinketItems.length > 1) {
      map['TRINKET_1'] = [trinketItems[0]]
      map['TRINKET_2'] = [trinketItems[1]]
    }

    return map
  }, [bisItems])

  // Check if main hand has a two-hand weapon
  const mainHandHasTwoHand = useMemo(() => {
    const mainItems = slotItemsMap['MAIN_HAND'] || []
    return mainItems.some(i => i.item_slot === 'Two-Hand')
  }, [slotItemsMap])

  const renderSlot = (slotKey) => {
    const slotDef = PAPER_DOLL_SLOTS[slotKey]
    const items = slotItemsMap[slotKey] || []
    const isSelected = selectedSlot === slotKey
    const isDisabled = slotKey === 'OFF_HAND' && mainHandHasTwoHand
    const displayItem = items[0] // Show first item in slot
    const SlotIcon = slotDef.Icon

    return (
      <button
        key={slotKey}
        onClick={() => !isDisabled && onSlotClick(slotKey)}
        disabled={isDisabled}
        title={`${slotDef.label}${items.length > 0 ? ` (${items.length} BIS)` : ''}`}
        className={`relative w-12 h-12 rounded-lg border-2 transition-all flex items-center justify-center overflow-hidden group ${
          isDisabled
            ? 'border-gray-700 bg-gray-900 opacity-30 cursor-not-allowed'
            : isSelected
              ? 'border-coral bg-lavender-12/60 shadow-lg shadow-coral/30 scale-110'
              : displayItem
                ? `bg-gradient-to-br from-lavender-12/30 to-indigo hover:scale-105 hover:shadow-md`
                : 'border-lavender-20/30 bg-indigo/50 hover:border-lavender-20/60 hover:bg-indigo/80'
        }`}
        style={displayItem ? { borderColor: RARITY_COLORS[displayItem.item_rarity] || '#a335ee' } : undefined}
      >
        {displayItem?.item_image ? (
          <img
            src={displayItem.item_image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <SlotIcon size={16} className={isSelected ? 'text-coral' : 'text-lavender opacity-40'} />
        )}

        {/* Obtained check overlay */}
        {displayItem?.obtained === 1 && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
            <Check size={14} className="text-green-400" />
          </div>
        )}

        {/* Count badge for multiple items */}
        {items.length > 1 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-coral text-black text-[10px] font-bold rounded-full flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>
    )
  }

  const leftSlots = ['HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST']
  const rightSlots = ['HANDS', 'WAIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2']

  // Count stats
  const totalSlots = Object.keys(PAPER_DOLL_SLOTS).length
  const filledSlots = Object.keys(slotItemsMap).filter(k => slotItemsMap[k]?.length > 0).length
  const obtainedCount = bisItems.filter(i => i.obtained === 1).length

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Stats bar */}
      <div className="flex gap-4 text-xs text-lavender">
        <span className="inline-flex items-center gap-1"><SquaresFour size={14} className="text-coral" />{filledSlots}/{totalSlots} {t('bis_slots_filled')}</span>
        <span className="inline-flex items-center gap-1"><CheckCircle size={14} className="text-green-400" />{obtainedCount} {t('bis_obtained')}</span>
      </div>

      {/* Paper doll grid */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'auto 1fr auto', gridTemplateRows: 'repeat(8, auto) auto' }}>
        {/* Left column */}
        {leftSlots.map((slot, i) => (
          <div key={slot} style={{ gridColumn: 1, gridRow: i + 1 }} className="flex items-center">
            {renderSlot(slot)}
          </div>
        ))}

        {/* Center spacer — class emblem placeholder */}
        <div style={{ gridColumn: 2, gridRow: '1 / 9' }} className="w-24 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border border-lavender-20/20 bg-lavender-12/10 flex items-center justify-center">
            <User size={28} className="text-coral/20" />
          </div>
        </div>

        {/* Right column */}
        {rightSlots.map((slot, i) => (
          <div key={slot} style={{ gridColumn: 3, gridRow: i + 1 }} className="flex items-center">
            {renderSlot(slot)}
          </div>
        ))}

        {/* Bottom weapons row */}
        <div style={{ gridColumn: '1 / 4', gridRow: 9 }} className="flex justify-center gap-4 mt-2">
          {renderSlot('MAIN_HAND')}
          {renderSlot('OFF_HAND')}
        </div>
      </div>
    </div>
  )
}

export default PaperDoll
