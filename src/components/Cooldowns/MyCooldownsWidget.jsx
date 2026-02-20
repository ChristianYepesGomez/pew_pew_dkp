import { useState, useEffect, useRef } from 'react'
import { cooldownsAPI } from '../../services/api'
import { useSocket } from '../../hooks/useSocket'
import { ShieldStar, Heart, Sword, CaretDown, X } from '@phosphor-icons/react'

const CATEGORY_ICON = {
  healing:   { Icon: Heart,      color: 'text-green-400' },
  defensive: { Icon: ShieldStar, color: 'text-yellow-400' },
  interrupt: { Icon: Sword,      color: 'text-red-400' },
}

function formatTs(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function SpellIcon({ iconSlug }) {
  if (!iconSlug) return null
  return (
    <img
      src={`https://wow.zamimg.com/images/wow/icons/small/${iconSlug}.jpg`}
      alt=""
      width={18}
      height={18}
      className="rounded flex-shrink-0"
      onError={e => { e.target.style.display = 'none' }}
    />
  )
}

export default function MyCooldownsWidget() {
  const [assignments, setAssignments] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    loadAssignments()
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useSocket({ cooldowns_updated: loadAssignments })

  async function loadAssignments() {
    try {
      const res = await cooldownsAPI.getMyAssignments()
      setAssignments(res.data)
    } catch {
      // non-fatal — widget silently hides if no data
    }
  }

  if (assignments.length === 0) return null

  // Group by boss_name + difficulty
  const byBoss = {}
  for (const a of assignments) {
    const key = `${a.boss_name} — ${a.difficulty}`
    if (!byBoss[key]) byBoss[key] = []
    byBoss[key].push(a)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center gap-1.5 h-9 px-3 rounded-lg bg-lavender-12 hover:bg-lavender-20 text-cream text-sm font-medium transition-colors"
        title="Mis CDs asignados"
      >
        <ShieldStar size={16} className="text-yellow-400" />
        <span className="hidden sm:inline">Mis CDs</span>
        {/* Dot indicator */}
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-coral rounded-full" />
        <CaretDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 bg-indigo border border-lavender-20 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-lavender-12">
            <div className="flex items-center gap-2">
              <ShieldStar size={16} className="text-yellow-400" />
              <span className="text-sm font-semibold text-cream">Mis CDs</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-cream transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {Object.entries(byBoss).map(([bossKey, bossAssignments]) => (
              <div key={bossKey} className="border-b border-lavender-12 last:border-0">
                <div className="px-4 py-2 bg-lavender-8">
                  <p className="text-xs font-medium text-lavender">{bossKey}</p>
                </div>
                <div className="px-4 py-2 space-y-2">
                  {bossAssignments
                    .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
                    .map(a => {
                      const { Icon, color } = CATEGORY_ICON[a.category] || CATEGORY_ICON.defensive
                      return (
                        <div key={a.id} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted w-10 flex-shrink-0">
                            {formatTs(a.timestamp_seconds)}
                          </span>
                          <SpellIcon iconSlug={a.icon_slug} />
                          <Icon size={12} className={color} />
                          <span className="text-sm text-cream">{a.cooldown_name}</span>
                          <span className="text-xs text-muted truncate ml-auto">{a.event_label}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-lavender-12">
            <p className="text-xs text-muted text-center">
              Pega la nota MRT en el juego para ver timers en combate
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
