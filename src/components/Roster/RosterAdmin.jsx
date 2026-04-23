import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { rosterAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import { X, CircleNotch, ShieldStar, Heart, Crosshair, Check, ClockCountdown, CheckCircle } from '@phosphor-icons/react'
import Button from '../ui/Button'

const ROLE_CONFIG = {
  Tank:   { icon: ShieldStar,  color: '#f87171' },
  Healer: { icon: Heart,       color: '#4ade80' },
  DPS:    { icon: Crosshair,   color: '#69cff0' },
}

const SIGNUP_ICONS = {
  confirmed: { Icon: CheckCircle, color: 'text-green-400', label: 'Confirmado' },
  late:      { Icon: ClockCountdown, color: 'text-orange-400', label: 'Llega tarde' },
  tentative: { Icon: () => <span>?</span>, color: 'text-yellow-400', label: 'Tentativo' },
}

export default function RosterAdmin({ roster, date, availableBosses, onClose, onSaved }) {
  const isEdit = !!roster

  const [name, setName]           = useState(roster?.name || 'Roster')
  const [playerIds, setPlayerIds] = useState(
    roster?.players.filter((p) => p.slot === 'in_roster').map((p) => p.user_id) || []
  )
  const [benchIds, setBenchIds]   = useState(
    roster?.players.filter((p) => p.slot === 'bench').map((p) => p.user_id) || []
  )
  const [bossIds, setBossIds]     = useState(roster?.bosses.map((b) => b.boss_id) || [])
  const [published, setPublished] = useState(roster?.published ?? false)
  const [available, setAvailable] = useState([])
  const [loadingAvail, setLoadingAvail] = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    rosterAPI.getAvailable(date)
      .then((res) => setAvailable(res.data))
      .catch(() => setAvailable([]))
      .finally(() => setLoadingAvail(false))
  }, [date])

  // Group bosses by zone
  const bossGroups = availableBosses.reduce((acc, b) => {
    const key = b.zone_name
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  const togglePlayer = (userId) => {
    setPlayerIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
    setBenchIds((prev) => prev.filter((id) => id !== userId))
  }

  const toggleBench = (userId) => {
    setBenchIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
    setPlayerIds((prev) => prev.filter((id) => id !== userId))
  }

  const toggleBoss = (bossId) => {
    setBossIds((prev) =>
      prev.includes(bossId) ? prev.filter((id) => id !== bossId) : [...prev, bossId]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      const payload = { name, player_ids: playerIds, bench_ids: benchIds, boss_ids: bossIds, published }
      if (isEdit) {
        await rosterAPI.update(roster.id, payload)
      } else {
        await rosterAPI.create({ ...payload, raid_date: date })
      }
      onSaved()
    } catch (e) {
      setError(e?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Group available players by role
  const byRole = {
    Tank:   available.filter((p) => p.raid_role === 'Tank'),
    Healer: available.filter((p) => p.raid_role === 'Healer'),
    DPS:    available.filter((p) => p.raid_role === 'DPS'),
  }

  const totalSelected = playerIds.length

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#0f0b20] border-2 border-[rgba(177,167,208,0.20)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(177,167,208,0.15)]">
          <h2 className="text-lg font-bold text-[#ffeccd]">
            {isEdit ? 'Editar roster' : 'Nuevo roster'} — {formatDateLabel(date)}
          </h2>
          <button onClick={onClose} className="text-[#b1a7d0] hover:text-[#ffeccd] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {/* Name + publish */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-[#b1a7d0] mb-1 block">Nombre del roster</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[rgba(177,167,208,0.08)] border border-[rgba(177,167,208,0.20)] rounded-lg px-3 py-2 text-sm text-[#ffeccd] outline-none focus:border-[#b1a7d0]"
                placeholder="Ej: Roster principal"
              />
            </div>
            <div className="flex flex-col items-center gap-1 mt-5">
              <button
                onClick={() => setPublished((v) => !v)}
                className={`w-10 h-6 rounded-full transition-all relative ${published ? 'bg-green-500' : 'bg-[rgba(177,167,208,0.20)]'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${published ? 'right-1' : 'left-1'}`} />
              </button>
              <span className="text-[10px] text-[#b1a7d0]">{published ? 'Publicado' : 'Borrador'}</span>
            </div>
          </div>

          {/* Boss picker */}
          <div>
            <label className="text-xs font-semibold text-[#b1a7d0] mb-2 block uppercase tracking-wider">
              Bosses asignados a este roster
            </label>
            <div className="flex flex-col gap-3">
              {Object.entries(bossGroups).map(([zoneName, bosses]) => (
                <div key={zoneName}>
                  <div className="text-[10px] font-bold text-[#b1a7d0] opacity-50 uppercase tracking-widest mb-1.5">{zoneName}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {bosses.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => toggleBoss(b.id)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                          bossIds.includes(b.id)
                            ? 'bg-[rgba(255,175,157,0.20)] text-[#ffaf9d] border border-[rgba(255,175,157,0.40)]'
                            : 'bg-[rgba(177,167,208,0.08)] text-[#b1a7d0] border border-[rgba(177,167,208,0.15)] hover:border-[rgba(177,167,208,0.30)]'
                        }`}
                      >
                        {bossIds.includes(b.id) && <Check size={10} className="inline mr-1" weight="bold" />}
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Player picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#b1a7d0] uppercase tracking-wider">
                Jugadores
              </label>
              <span className={`text-xs font-bold ${totalSelected > 20 ? 'text-red-400' : totalSelected === 20 ? 'text-green-400' : 'text-[#b1a7d0]'}`}>
                {totalSelected} / 20 en roster · {benchIds.length} banquillo
              </span>
            </div>

            {loadingAvail ? (
              <div className="flex justify-center py-6">
                <CircleNotch size={22} className="animate-spin text-[#b1a7d0]" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(byRole).map(([role, players]) => {
                  const cfg = ROLE_CONFIG[role]
                  const Icon = cfg.icon
                  if (players.length === 0) return null
                  return (
                    <div key={role}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon size={12} style={{ color: cfg.color }} />
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{role}</span>
                        <div className="flex-1 h-px bg-[rgba(177,167,208,0.12)]" />
                      </div>
                      <div className="flex flex-col gap-1">
                        {players.map((p) => (
                          <PlayerRow
                            key={p.user_id}
                            player={p}
                            inRoster={playerIds.includes(p.user_id)}
                            onBench={benchIds.includes(p.user_id)}
                            onToggleRoster={() => togglePlayer(p.user_id)}
                            onToggleBench={() => toggleBench(p.user_id)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-[rgba(248,113,113,0.10)] rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(177,167,208,0.15)]">
          <Button variant="outline" size="sm" radius="round" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="success" size="sm" radius="round" disabled={saving} onClick={handleSave}>
            {saving ? <CircleNotch size={14} className="animate-spin" /> : <Check size={14} weight="bold" />}
            {isEdit ? 'Guardar cambios' : 'Crear roster'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function PlayerRow({ player, inRoster, onBench, onToggleRoster, onToggleBench }) {
  const classColor = CLASS_COLORS[player.character_class] || '#b1a7d0'
  const signupCfg = SIGNUP_ICONS[player.signup_status] || null

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        inRoster
          ? 'bg-[rgba(74,222,128,0.06)] border border-[rgba(74,222,128,0.20)]'
          : onBench
          ? 'bg-[rgba(177,167,208,0.06)] border border-[rgba(177,167,208,0.15)]'
          : 'border border-transparent hover:bg-[rgba(177,167,208,0.05)]'
      }`}
    >
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: classColor }} />
      <span className="text-sm font-medium flex-1 truncate" style={{ color: classColor }}>
        {player.character_name}
      </span>
      <span className="text-xs text-[#b1a7d0] mr-1">{player.spec || player.character_class}</span>

      {/* Signup status badge */}
      {signupCfg && (
        <span className={`text-[10px] font-semibold ${signupCfg.color} mr-1`} title={signupCfg.label}>
          {player.signup_status === 'late' ? '⏰' : '✓'}
        </span>
      )}

      {/* Roster / Bench toggles */}
      <button
        onClick={onToggleRoster}
        title={inRoster ? 'Quitar del roster' : 'Añadir al roster'}
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
          inRoster
            ? 'bg-[rgba(74,222,128,0.20)] text-green-400'
            : 'bg-[rgba(177,167,208,0.10)] text-[#b1a7d0] hover:text-[#ffeccd]'
        }`}
      >
        {inRoster ? '✓ Dentro' : '+ Roster'}
      </button>
      <button
        onClick={onToggleBench}
        title={onBench ? 'Quitar del banquillo' : 'Al banquillo'}
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
          onBench
            ? 'bg-[rgba(177,167,208,0.20)] text-[#ffeccd]'
            : 'bg-[rgba(177,167,208,0.06)] text-[#b1a7d0] hover:text-[#ffeccd]'
        }`}
      >
        {onBench ? '🪑 Banq.' : 'Banq.'}
      </button>
    </div>
  )
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}
