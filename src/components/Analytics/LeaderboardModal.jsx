import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import CLASS_COLORS from '../../utils/classColors'

// Gold / Silver / Bronze for top 3, then dimmed white for the rest
const positionColor = (i) => {
  if (i === 0) return '#FFD700'
  if (i === 1) return '#C0C0C0'
  if (i === 2) return '#CD7F32'
  return '#9ca3af'
}

/**
 * Reusable top-10 leaderboard modal.
 *
 * Props:
 *   title    — card title (string)
 *   Icon     — Phosphor icon component
 *   color    — accent color for icon + value
 *   entries  — array of { character_name, character_class, value, fights }
 *   format   — (value) => string for display
 *   badge    — optional subtitle badge (string | null)
 *   onClose  — () => void
 */
const LeaderboardModal = ({ title, Icon, color, entries, format, badge, onClose }) => {
  const { t } = useLanguage()

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a2e] border border-lavender-20/20 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-lavender-20/20">
          <h3 className="text-base font-semibold text-white inline-flex items-center gap-2">
            <Icon size={18} style={{ color }} />
            {t('analytics_top10_title')} — {title}
            {badge && (
              <span className="text-xs text-lavender/40 font-normal">({badge})</span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-lavender/40 hover:text-white transition-colors rounded-lg p-1"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="px-6 py-4 space-y-3">
          {entries?.length > 0 ? (
            entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-3">
                <span
                  className="text-sm font-bold w-6 flex-shrink-0 text-center tabular-nums"
                  style={{ color: positionColor(i) }}
                >
                  {i + 1}
                </span>
                <span
                  className="text-sm font-semibold flex-1 min-w-0 truncate"
                  style={{ color: CLASS_COLORS[entry.character_class] || '#fff' }}
                >
                  {entry.character_name}
                </span>
                {entry.fights != null && (
                  <span className="text-xs text-lavender/40 flex-shrink-0 tabular-nums">
                    {entry.fights}f
                  </span>
                )}
                <span
                  className="text-sm font-bold tabular-nums flex-shrink-0"
                  style={{ color }}
                >
                  {format(entry.value)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-lavender/40 text-sm text-center py-6">—</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default LeaderboardModal
