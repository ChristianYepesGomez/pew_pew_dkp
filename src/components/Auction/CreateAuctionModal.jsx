import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useLanguage } from '../../hooks/useLanguage'
import { raidItemsAPI, auctionsAPI } from '../../services/api'
import { RARITY_COLORS } from '../../utils/constants'

const RARITY_BG = {
  common: 'from-gray-600 to-gray-700',
  uncommon: 'from-green-700 to-green-800',
  rare: 'from-blue-700 to-blue-800',
  epic: 'from-purple-700 to-purple-800',
  legendary: 'from-orange-600 to-orange-700',
}

const CreateAuctionModal = ({ onClose, onSuccess }) => {
  const { t, language } = useLanguage()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [durationMinutes, setDurationMinutes] = useState(5)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [selectedBoss, setSelectedBoss] = useState('all')

  const modalRef = useRef(null)
  useFocusTrap(modalRef)

  // Close on ESC key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      const response = await raidItemsAPI.getAll()
      setItems(response.data.items || [])
    } catch (error) {
      console.error('Error loading items:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get boss name in current language
  const getBossName = useCallback((item) => {
    return language === 'es' ? item.boss : (item.bossEn || item.boss)
  }, [language])

  // Filter items using useMemo for proper derived state
  const filteredItems = useMemo(() => {
    let filtered = items

    if (selectedBoss !== 'all') {
      filtered = filtered.filter(item => item.boss === selectedBoss)
    }

    if (search.trim()) {
      const lowerSearch = search.toLowerCase().trim()
      filtered = filtered.filter(item => {
        const nameEn = (item.name?.en || '').toLowerCase()
        const nameEs = (item.name?.es || '').toLowerCase()
        const bossName = getBossName(item)?.toLowerCase() || ''

        return nameEn.includes(lowerSearch) ||
               nameEs.includes(lowerSearch) ||
               bossName.includes(lowerSearch)
      })
    }

    return filtered
  }, [items, selectedBoss, search, getBossName])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedItem) return

    setError('')
    setCreating(true)

    try {
      await auctionsAPI.create({
        itemName: selectedItem.name[language] || selectedItem.name.en,
        itemNameEN: selectedItem.name.en,
        itemImage: selectedItem.icon,
        itemRarity: selectedItem.rarity,
        minBid: 0,
        itemId: selectedItem.id,
        durationMinutes: durationMinutes
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || t('error_generic'))
    } finally {
      setCreating(false)
    }
  }

  // Get unique bosses with both language names
  const bossesMap = new Map()
  items.forEach(item => {
    if (!bossesMap.has(item.boss)) {
      bossesMap.set(item.boss, {
        key: item.boss, // Spanish name as unique key
        es: item.boss,
        en: item.bossEn || item.boss
      })
    }
  })
  const bosses = Array.from(bossesMap.values())

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 overflow-y-auto" onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={t('create_auction')} className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-4xl max-sm:max-w-none shadow-2xl max-h-[85vh] max-sm:max-h-[100vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-midnight-purple flex items-center justify-center">
                <i className="fas fa-gavel text-2xl text-midnight-glow"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white m-0">{t('create_auction')}</h3>
                <p className="text-sm text-midnight-silver m-0">{t('select_item_desc')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={t('close')}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex-shrink-0">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
          {/* Filters */}
          <div className="flex gap-4 flex-shrink-0">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search_items')}
                className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
              />
            </div>
            <div>
              <select
                value={selectedBoss}
                onChange={(e) => setSelectedBoss(e.target.value)}
                className="px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white focus:outline-none focus:border-midnight-glow"
              >
                <option value="all">{t('all_bosses')}</option>
                {bosses.map(boss => (
                  <option key={boss.key} value={boss.key}>{language === 'es' ? boss.es : boss.en}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-10">
                <i className="fas fa-circle-notch fa-spin text-4xl text-midnight-glow"></i>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
                      selectedItem?.id === item.id
                        ? 'border-midnight-glow bg-midnight-purple bg-opacity-40'
                        : 'border-midnight-bright-purple border-opacity-30 hover:border-opacity-60 hover:bg-midnight-purple hover:bg-opacity-20'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${RARITY_BG[item.rarity]} flex items-center justify-center flex-shrink-0 overflow-hidden border`} style={{ borderColor: RARITY_COLORS[item.rarity] }}>
                      {item.icon ? (
                        <img
                          src={item.icon}
                          alt={item.name[language] || item.name.en}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                        />
                      ) : null}
                      <i className="fas fa-gem text-xl" style={{ color: RARITY_COLORS[item.rarity], display: item.icon ? 'none' : 'block' }}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate m-0" style={{ color: RARITY_COLORS[item.rarity] }}>
                        {item.name[language] || item.name.en}
                      </p>
                      <p className="text-xs text-midnight-silver m-0 truncate">
                        {getBossName(item)} - {t(item.slot) || item.slot}
                      </p>
                    </div>
                    {selectedItem?.id === item.id && (
                      <i className="fas fa-check-circle text-midnight-glow text-xl flex-shrink-0"></i>
                    )}
                  </button>
                ))}
                {filteredItems.length === 0 && !loading && (
                  <div className="col-span-2 text-center text-gray-400 py-8">
                    {t('no_items_found')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Item Preview & Settings */}
          {selectedItem && (
            <div className="flex-shrink-0 p-4 bg-midnight-purple bg-opacity-30 rounded-lg border border-midnight-bright-purple">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${RARITY_BG[selectedItem.rarity]} flex items-center justify-center border-2 overflow-hidden`} style={{ borderColor: RARITY_COLORS[selectedItem.rarity] }}>
                  {selectedItem.icon ? (
                    <img
                      src={selectedItem.icon}
                      alt={selectedItem.name[language] || selectedItem.name.en}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    />
                  ) : null}
                  <i className="fas fa-gem text-2xl" style={{ color: RARITY_COLORS[selectedItem.rarity], display: selectedItem.icon ? 'none' : 'block' }}></i>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg m-0" style={{ color: RARITY_COLORS[selectedItem.rarity] }}>
                    {selectedItem.name[language] || selectedItem.name.en}
                  </p>
                  <p className="text-sm text-midnight-silver m-0">
                    {getBossName(selectedItem)} - {t(selectedItem.slot) || selectedItem.slot}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-midnight-silver">{t('duration')}:</label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                    className="px-3 py-2 rounded-lg bg-midnight-deepblue border border-midnight-bright-purple text-white focus:outline-none focus:border-midnight-glow"
                  >
                    <option value={5}>5 {t('minutes')}</option>
                    <option value={10}>10 {t('minutes')}</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-midnight-bright-purple border-opacity-30 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating || !selectedItem}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
            ) : (
              <><i className="fas fa-gavel mr-2"></i>{t('create_auction')}</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default CreateAuctionModal
