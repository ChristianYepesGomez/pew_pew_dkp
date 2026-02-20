import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { bossesAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import { CircleNotch, WarningCircle, Skull, BookOpen, CaretDown, CaretRight, CheckCircle, XCircle, Lightning, ArrowSquareOut, X, ChartBar, Trophy, Heart, ShieldStar, Fire, Flag, ClockCounterClockwise, Sword, Clipboard, Check, Pencil } from '@phosphor-icons/react'
import SectionHeader from '../ui/SectionHeader'

// Difficulty colors
const DIFFICULTY_COLORS = {
  Mythic: '#ff8000',
  Heroic: '#a335ee',
  Normal: '#1eff00',
  LFR: '#0070dd',
}

const DIFFICULTY_SHORT = {
  Mythic: 'M',
  Heroic: 'H',
  Normal: 'N',
  LFR: 'LFR',
}

const BossesTab = () => {
  const { t } = useLanguage()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'officer'

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedZones, setExpandedZones] = useState({})
  const [selectedBoss, setSelectedBoss] = useState(null)
  const [bossDetails, setBossDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // MRT state — lazy loaded per boss on hover
  const [mrtNotes, setMrtNotes] = useState({}) // { [bossId]: { note_text, loaded, loading } }
  const [copiedBossId, setCopiedBossId] = useState(null)
  const [noNoteBossId, setNoNoteBossId] = useState(null)
  const [editState, setEditState] = useState(null) // { bossId, text, saving }

  useEffect(() => {
    loadBosses()
  }, [])

  const loadBosses = async () => {
    try {
      setLoading(true)
      const response = await bossesAPI.getAll()
      setData(response.data)
      // Auto-expand first zone
      if (response.data.length > 0) {
        setExpandedZones({ [response.data[0].id]: true })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load bosses')
    } finally {
      setLoading(false)
    }
  }

  const toggleZone = (zoneId) => {
    setExpandedZones(prev => ({ ...prev, [zoneId]: !prev[zoneId] }))
  }

  const openBossDetails = async (boss, difficulty = null) => {
    setSelectedBoss(boss)
    setLoadingDetails(true)
    try {
      const response = await bossesAPI.getDetails(boss.id, difficulty)
      setBossDetails(response.data)
    } catch (err) {
      console.error('Load boss details error:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const changeDifficulty = (difficulty) => {
    if (selectedBoss) {
      openBossDetails(selectedBoss, difficulty)
    }
  }

  const closeBossDetails = () => {
    setSelectedBoss(null)
    setBossDetails(null)
  }

  // MRT actions
  const fetchMrtNote = useCallback(async (bossId) => {
    if (mrtNotes[bossId]?.loaded || mrtNotes[bossId]?.loading) return
    setMrtNotes(prev => ({ ...prev, [bossId]: { ...prev[bossId], loading: true } }))
    try {
      const res = await bossesAPI.getMrtNote(bossId)
      setMrtNotes(prev => ({ ...prev, [bossId]: { note_text: res.data.note_text, loaded: true, loading: false } }))
    } catch {
      setMrtNotes(prev => ({ ...prev, [bossId]: { note_text: '', loaded: true, loading: false } }))
    }
  }, [mrtNotes])

  const copyMrtNote = useCallback(async (e, bossId) => {
    e.stopPropagation()
    const note = mrtNotes[bossId]?.note_text
    if (!note) {
      setNoNoteBossId(bossId)
      setTimeout(() => setNoNoteBossId(null), 2000)
      return
    }
    try {
      await navigator.clipboard.writeText(note)
      setCopiedBossId(bossId)
      setTimeout(() => setCopiedBossId(null), 2000)
    } catch { /* ignore clipboard errors */ }
  }, [mrtNotes])

  const openEdit = useCallback((e, bossId) => {
    e.stopPropagation()
    setEditState({ bossId, text: mrtNotes[bossId]?.note_text || '', saving: false })
  }, [mrtNotes])

  const closeEdit = useCallback(() => setEditState(null), [])

  const saveEdit = useCallback(async () => {
    if (!editState || editState.saving) return
    setEditState(prev => ({ ...prev, saving: true }))
    try {
      await bossesAPI.saveMrtNote(editState.bossId, editState.text)
      setMrtNotes(prev => ({ ...prev, [editState.bossId]: { note_text: editState.text, loaded: true, loading: false } }))
      setEditState(null)
    } catch {
      setEditState(prev => ({ ...prev, saving: false }))
    }
  }, [editState])

  // Invalidate note cache on remote update so next hover refetches
  useSocket({
    mrt_note_updated: ({ bossId }) => {
      setMrtNotes(prev => {
        const entry = prev[bossId]
        if (!entry) return prev
        return { ...prev, [bossId]: { ...entry, loaded: false } }
      })
    },
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <CircleNotch size={32} className="animate-spin text-coral" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/50 bg-red-500/15 px-5 py-4 text-center text-red-300">
        <WarningCircle size={18} className="mr-2 inline" />{error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader icon={Skull} title={t('bosses')} />

      <div className="space-y-3">
        {data.length === 0 ? (
          <div className="rounded-2xl bg-indigo py-10 text-center text-lavender outline outline-2 outline-lavender-20">
            <Sword size={40} className="mx-auto mb-4 opacity-60" />
            <p>{t('no_bosses')}</p>
          </div>
        ) : (
          data.map(zone => {
            const diffColor = DIFFICULTY_COLORS[zone.highestDifficulty] || '#555'
            return (
              <div key={zone.id} className="overflow-hidden rounded-2xl bg-indigo outline outline-2 outline-lavender-20">
                {/* Zone Header */}
                <button
                  onClick={() => toggleZone(zone.id)}
                  className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-lavender-12"
                  style={{ borderLeft: `3px solid ${diffColor}` }}
                >
                  <div className="flex items-center gap-3">
                    {expandedZones[zone.id]
                      ? <CaretDown size={16} className="text-lavender" />
                      : <CaretRight size={16} className="text-lavender" />}
                    <span className="text-lg font-bold text-cream">{zone.name}</span>
                    {zone.progress && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-sm font-bold"
                        style={{ color: diffColor, backgroundColor: diffColor + '25', border: `1px solid ${diffColor}50` }}
                      >
                        {zone.progress}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-lavender">{zone.bossCount} bosses</span>
                </button>

                {/* Boss Grid */}
                {expandedZones[zone.id] && (
                  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {zone.bosses.map(boss => (
                      <BossCard
                        key={boss.id}
                        boss={boss}
                        onClick={() => openBossDetails(boss)}
                        t={t}
                        onMouseEnter={() => fetchMrtNote(boss.id)}
                        mrtNote={mrtNotes[boss.id]}
                        isCopied={copiedBossId === boss.id}
                        isNoNote={noNoteBossId === boss.id}
                        canEdit={canEdit}
                        isEditing={editState?.bossId === boss.id}
                        editText={editState?.bossId === boss.id ? editState.text : ''}
                        editSaving={editState?.bossId === boss.id ? editState.saving : false}
                        onCopy={(e) => copyMrtNote(e, boss.id)}
                        onOpenEdit={(e) => openEdit(e, boss.id)}
                        onEditChange={(text) => setEditState(prev => ({ ...prev, text }))}
                        onEditSave={saveEdit}
                        onEditCancel={closeEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Boss Details Modal */}
      {selectedBoss && (
        <BossDetailModal
          boss={selectedBoss}
          details={bossDetails}
          loading={loadingDetails}
          onClose={closeBossDetails}
          onChangeDifficulty={changeDifficulty}
          t={t}
        />
      )}
    </div>
  )
}

// Boss Card Component - Cinematic design with full artwork
const BossCard = ({ boss, onClick, t, onMouseEnter, mrtNote, isCopied, isNoNote, canEdit, isEditing, editText, editSaving, onCopy, onOpenEdit, onEditChange, onEditSave, onEditCancel }) => {
  const diffColor = DIFFICULTY_COLORS[boss.highestDifficulty] || '#888'

  return (
    <div
      onClick={!isEditing ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      className="relative rounded-xl overflow-hidden cursor-pointer group aspect-[4/3] min-h-[180px]"
    >
      {/* Background Image */}
      {boss.imageUrl ? (
        <img
          src={boss.imageUrl}
          alt={boss.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo to-purple-900" />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-70 transition-opacity" />

      {/* Difficulty Badge */}
      {boss.highestDifficulty && (
        <div className="absolute top-3 right-3 z-10">
          <span
            className="text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm"
            style={{ backgroundColor: diffColor + '40', color: diffColor, border: `1px solid ${diffColor}60` }}
          >
            {DIFFICULTY_SHORT[boss.highestDifficulty]}
          </span>
        </div>
      )}

      {/* MRT Icons — top-left, revealed on hover */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={onCopy}
          className={`flex items-center justify-center w-7 h-7 rounded-full backdrop-blur-sm transition-colors ${
            isCopied
              ? 'bg-green-500/80 text-white'
              : isNoNote
                ? 'bg-red-500/80 text-white'
                : 'bg-black/60 text-lavender hover:bg-black/80 hover:text-cream'
          }`}
          title={isCopied ? '¡Copiado!' : isNoNote ? 'Sin nota MRT' : 'Copiar nota MRT'}
        >
          {isCopied ? <Check size={13} weight="bold" /> : <Clipboard size={13} />}
        </button>
        {canEdit && (
          <button
            onClick={onOpenEdit}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-lavender backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-cream"
            title="Editar nota MRT"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      {/* Edit Overlay */}
      {isEditing && (
        <div
          className="absolute inset-0 z-30 bg-black/90 flex flex-col p-3 gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            className="flex-1 resize-none rounded bg-white/10 text-white text-xs p-2 border border-white/20 focus:outline-none focus:border-coral/60 placeholder-lavender/40"
            placeholder="Pega la nota MRT aquí..."
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={onEditSave}
              disabled={editSaving}
              className="flex-1 py-1.5 bg-coral/80 hover:bg-coral rounded text-white text-xs font-bold transition-colors disabled:opacity-50"
            >
              {editSaving ? '...' : 'Guardar'}
            </button>
            <button
              onClick={onEditCancel}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-white text-xs transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Content Overlay */}
      {!isEditing && (
        <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">
          {/* Boss Name */}
          <h4 className="font-bold text-base text-white drop-shadow-lg mb-2 leading-tight line-clamp-1 group-hover:text-coral transition-colors" title={boss.name}>
            {boss.name}
          </h4>

          {/* Stats Badges */}
          <div className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold backdrop-blur-sm ${boss.kills > 0 ? 'bg-green-400/20 text-green-400' : 'bg-white/10 text-lavender/50'}`}>
              <CheckCircle size={11} weight={boss.kills > 0 ? 'fill' : 'regular'} />
              {boss.kills || 0}
            </span>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold backdrop-blur-sm ${boss.wipes > 0 ? 'bg-red-400/20 text-red-400' : 'bg-white/10 text-lavender/50'}`}>
              <XCircle size={11} weight={boss.wipes > 0 ? 'fill' : 'regular'} />
              {boss.wipes || 0}
            </span>
            {boss.fastestKill && (
              <span className="flex items-center gap-1 rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-400 backdrop-blur-sm">
                <Lightning size={11} weight="fill" />
                {boss.fastestKill}
              </span>
            )}
          </div>

          {/* Guide Link - appears on hover */}
          {boss.mythicTrapUrl && (
            <a
              href={boss.mythicTrapUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 flex items-center justify-center gap-2 py-2 bg-coral/20 backdrop-blur-sm rounded-lg text-coral text-sm font-medium opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:bg-coral/30"
            >
              <BookOpen size={16} />
              {t('view_guide')}
              <ArrowSquareOut size={14} />
            </a>
          )}
        </div>
      )}

      {/* Hover Border Effect */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-coral/50 transition-colors duration-300 pointer-events-none" />
    </div>
  )
}

// Boss Detail Modal Component
const BossDetailModal = ({ boss, details, loading, onClose, onChangeDifficulty, t }) => {
  const availableDiffs = details?.availableDifficulties || []
  const currentDiff = details?.statistics?.difficulty

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-indigo to-lavender-12 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Hero Header with Boss Image */}
        <div className="relative h-48 overflow-hidden">
          {boss.imageUrl ? (
            <img
              src={boss.imageUrl}
              alt={boss.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-indigo" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-indigo via-indigo/60 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lavender backdrop-blur-sm transition-all hover:bg-black/70 hover:text-cream"
          >
            <X size={20} />
          </button>

          {/* Boss Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="font-bold text-3xl text-white drop-shadow-lg">{boss.name}</h2>
            {details?.boss?.raid && (
              <p className="mt-1 text-lavender">{details.boss.raid}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-192px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <CircleNotch size={32} className="animate-spin text-coral" />
            </div>
          ) : details ? (
            <div className="space-y-6">
              {/* Difficulty Selector */}
              {availableDiffs.length > 1 && (
                <div className="flex gap-2">
                  {availableDiffs.map(d => {
                    const isActive = d.difficulty === currentDiff
                    const color = DIFFICULTY_COLORS[d.difficulty] || '#888'
                    return (
                      <button
                        key={d.difficulty}
                        onClick={() => !isActive && onChangeDifficulty(d.difficulty)}
                        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-all ${
                          isActive
                            ? 'ring-1 ring-opacity-60'
                            : 'opacity-50 hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: isActive ? color + '25' : 'rgba(255,255,255,0.05)',
                          color: color,
                          ringColor: color,
                          borderColor: isActive ? color : 'transparent',
                          border: isActive ? `1px solid ${color}60` : '1px solid transparent',
                        }}
                      >
                        {d.difficulty}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Statistics */}
              {details.statistics && (
                <div className="rounded-xl border border-lavender-20/30 bg-indigo/60 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ChartBar size={18} className="text-coral" />
                    {t('statistics')}
                    {availableDiffs.length <= 1 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: (DIFFICULTY_COLORS[currentDiff] || '#888') + '30',
                          color: DIFFICULTY_COLORS[currentDiff] || '#888'
                        }}
                      >
                        {currentDiff}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatBox label={t('kills')} value={details.statistics.kills} color="text-green-400" />
                    <StatBox label={t('wipes')} value={details.statistics.wipes} color="text-red-400" />
                    <StatBox label={t('fastest_kill')} value={details.statistics.fastestKill || '-'} color="text-yellow-400" />
                    <StatBox label={t('avg_kill_time')} value={details.statistics.avgKillTime || '-'} color="text-blue-400" />
                  </div>

                  {/* Progression Stats Row */}
                  {(details.statistics.wipesToFirstKill !== null || details.statistics.firstKillDate) && (
                    <div className="mt-4 border-t border-lavender-20/30 pt-4">
                      <h4 className="mb-2 flex items-center gap-2 text-xs text-lavender/80">
                        <Flag size={14} className="text-yellow-400" />
                        {t('progression_stats')}
                      </h4>
                      <div className="flex flex-wrap gap-4">
                        {details.statistics.wipesToFirstKill !== null && (
                          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-2 rounded-lg">
                            <Skull size={16} className="text-red-400" />
                            <span className="text-sm text-lavender">{t('wipes_to_first_kill')}:</span>
                            <span className="font-bold text-red-400">{details.statistics.wipesToFirstKill}</span>
                          </div>
                        )}
                        {details.statistics.firstKillDate && (
                          <div className="flex items-center gap-2 bg-green-500/10 px-3 py-2 rounded-lg">
                            <Trophy size={16} className="text-green-400" />
                            <span className="text-sm text-lavender">{t('first_kill')}:</span>
                            <span className="font-bold text-green-400">{details.statistics.firstKillDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {details.statistics.lastKill && (
                    <p className="mt-3 text-xs text-lavender/80">
                      {t('last_kill')}: {details.statistics.lastKill}
                    </p>
                  )}
                </div>
              )}

              {/* Records (Top Performers) */}
              {details.records && (details.records.topDamage || details.records.topHealing || details.records.mostDeaths) && (
                <div className="rounded-xl border border-lavender-20/30 bg-indigo/60 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-400" />
                    {t('records')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {details.records.topDamage && (
                      <RecordCard
                        Icon={Fire}
                        iconColor="text-orange-400"
                        title={t('top_damage')}
                        record={details.records.topDamage}
                      />
                    )}
                    {details.records.topHealing && (
                      <RecordCard
                        Icon={Heart}
                        iconColor="text-green-400"
                        title={t('top_healing')}
                        record={details.records.topHealing}
                      />
                    )}
                    {details.records.mostDamageTaken && (
                      <RecordCard
                        Icon={ShieldStar}
                        iconColor="text-blue-400"
                        title={t('most_damage_taken')}
                        record={details.records.mostDamageTaken}
                      />
                    )}
                    {details.records.mostDeaths && (
                      <RecordCard
                        Icon={Skull}
                        iconColor="text-red-400"
                        title={t('most_deaths')}
                        record={details.records.mostDeaths}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Death Leaderboard */}
              {details.deathLeaderboard && details.deathLeaderboard.length > 0 && (
                <div className="rounded-xl border border-lavender-20/30 bg-indigo/60 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Skull size={18} className="text-red-400" />
                    {t('hall_of_shame')}
                  </h3>
                  <div className="space-y-2">
                    {details.deathLeaderboard.slice(0, 10).map((player, idx) => (
                      <div
                        key={player.userId}
                        className="flex items-center justify-between rounded-lg bg-indigo/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-bold ${idx < 3 ? 'text-red-400' : 'text-lavender/60'}`}>
                            #{player.rank}
                          </span>
                          <span style={{ color: CLASS_COLORS[player.characterClass] || '#fff' }}>
                            {player.characterName}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-red-400">
                            <Skull size={14} className="inline mr-1" />
                            {player.deaths}
                          </span>
                          <span className="text-lavender/80">
                            {player.fights} {t('fights')}
                          </span>
                          <span className="text-yellow-400 font-semibold">
                            {player.deathRate}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Kills */}
              {details.recentKills && details.recentKills.length > 0 && (
                <div className="rounded-xl border border-lavender-20/30 bg-indigo/60 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ClockCounterClockwise size={18} className="text-green-400" />
                    {t('recent_kills')}
                  </h3>
                  <div className="space-y-2">
                    {details.recentKills.map((kill, idx) => (
                      <a
                        key={idx}
                        href={kill.wclUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg bg-indigo/40 px-3 py-2 transition-all hover:bg-indigo/70"
                      >
                        <span>{kill.date}</span>
                        <span>{kill.killTime}</span>
                        <span className="text-sm">
                          <ArrowSquareOut size={14} className="inline mr-1" />
                          WCL
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Mythic Trap Link - only for current raids */}
              {boss.mythicTrapUrl && (
                <a
                  href={boss.mythicTrapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 bg-coral/20 hover:bg-coral/30 rounded-xl text-coral font-semibold transition-all"
                >
                  <BookOpen size={18} />
                  {t('view_guide')}
                  <ArrowSquareOut size={16} />
                </a>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-lavender">
              {t('no_stats_yet')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Stat Box Component
const StatBox = ({ label, value, color }) => (
  <div className="text-center">
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    <div className="text-xs text-lavender/80">{label}</div>
  </div>
)

// Record Card Component
const RecordCard = ({ Icon, iconColor, title, record }) => (
  <div className="rounded-lg border border-lavender-20/30 bg-indigo/40 p-3">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={16} className={iconColor} />
      <span className="text-xs text-lavender/80">{title}</span>
    </div>
    <div className="flex items-center justify-between">
      <span
        className="font-semibold"
        style={{ color: CLASS_COLORS[record.characterClass] || '#fff' }}
      >
        {record.characterName}
      </span>
      <span className="text-yellow-400 font-bold text-sm">
        {record.valueFormatted}
      </span>
    </div>
  </div>
)

export default BossesTab
