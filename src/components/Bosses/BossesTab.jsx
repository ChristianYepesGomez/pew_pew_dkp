import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { bossesAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'
import { CircleNotch, WarningCircle, Skull, Book, BookOpen, ArrowsClockwise, CaretDown, CaretRight, CheckCircle, XCircle, Lightning, ArrowSquareOut, X, ChartBar, Trophy, Heart, ShieldStar, Fire, Flag, ClockCounterClockwise, Sword } from '@phosphor-icons/react'
import SectionHeader from '../ui/SectionHeader'
import SurfaceCard from '../ui/SurfaceCard'
import Button from '../ui/Button'

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
  const { user } = useAuth()
  const { t } = useLanguage()
  const [data, setData] = useState({ current: [], legacy: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('current')
  const [expandedZones, setExpandedZones] = useState({})
  const [selectedBoss, setSelectedBoss] = useState(null)
  const [bossDetails, setBossDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    loadBosses()
  }, [])

  const loadBosses = async () => {
    try {
      setLoading(true)
      const response = await bossesAPI.getAll()
      setData(response.data)
      // Auto-expand first current zone
      if (response.data.current.length > 0) {
        setExpandedZones({ [response.data.current[0].id]: true })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load bosses')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      await bossesAPI.sync()
      loadBosses()
    } catch (err) {
      console.error('Sync error:', err)
    }
  }

  const handleToggleLegacy = async (zoneId, currentlyLegacy) => {
    try {
      await bossesAPI.setZoneLegacy(zoneId, !currentlyLegacy)
      loadBosses()
    } catch (err) {
      console.error('Toggle legacy error:', err)
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

  const zones = activeTab === 'current' ? data.current : data.legacy

  return (
    <div className="space-y-6">
      <SectionHeader icon={Skull} title={t('bosses')}>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setActiveTab('current')}
            variant={activeTab === 'current' ? 'primary' : 'secondary'}
            size="md"
            radius="pill"
            className="font-semibold"
          >
            <Skull size={16} />
            {t('current_raids')}
            {data.current.length > 0 && (
              <span className="rounded-full bg-indigo px-2 py-0.5 text-xs text-coral">
                {data.current.length}
              </span>
            )}
          </Button>
          <Button
            onClick={() => setActiveTab('legacy')}
            variant={activeTab === 'legacy' ? 'primary' : 'secondary'}
            size="md"
            radius="pill"
            className="font-semibold"
          >
            <Book size={16} />
            {t('legacy_raids')}
            {data.legacy.length > 0 && (
              <span className="rounded-full bg-indigo px-2 py-0.5 text-xs text-lavender">
                {data.legacy.length}
              </span>
            )}
          </Button>
          {isAdmin && (
            <Button
              onClick={handleSync}
              variant="outline"
              size="md"
              radius="pill"
              icon={ArrowsClockwise}
            >
              {t('sync_zones')}
            </Button>
          )}
        </div>
      </SectionHeader>

      <SurfaceCard className="space-y-4 p-5 sm:p-6">
        {zones.length === 0 ? (
          <div className="py-10 text-center text-lavender">
            <Sword size={40} className="mx-auto mb-4 opacity-60" />
            <p>{t('no_bosses')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {zones.map(zone => (
              <div key={zone.id} className="overflow-hidden rounded-2xl bg-indigo outline outline-2 outline-lavender-20">
                {/* Zone Header */}
                <button
                  onClick={() => toggleZone(zone.id)}
                  className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-lavender-12"
                >
                  <div className="flex items-center gap-3">
                    {expandedZones[zone.id] ? <CaretDown size={16} className="text-lavender" /> : <CaretRight size={16} className="text-lavender" />}
                    <span className="text-lg font-bold text-cream">{zone.name}</span>
                    {zone.progress && (
                      <span
                        className="rounded px-2 py-0.5 text-sm font-bold"
                        style={{ color: DIFFICULTY_COLORS[zone.highestDifficulty] || '#fff' }}
                      >
                        {zone.progress}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-lavender">{zone.bossCount} bosses</span>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleLegacy(zone.id, activeTab === 'legacy')
                        }}
                        className="rounded-full bg-lavender-12 px-3 py-1 text-xs text-cream transition-colors hover:bg-lavender-20"
                      >
                        {activeTab === 'legacy' ? t('mark_current') : t('mark_legacy')}
                      </button>
                    )}
                  </div>
                </button>

                {/* Boss Grid */}
                {expandedZones[zone.id] && (
                  <div className="grid grid-cols-1 gap-4 px-4 pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {zone.bosses.map(boss => (
                      <BossCard
                        key={boss.id}
                        boss={boss}
                        onClick={() => openBossDetails(boss)}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

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
const BossCard = ({ boss, onClick, t }) => {
  const diffColor = DIFFICULTY_COLORS[boss.highestDifficulty] || '#888'
  const hasKillsOrWipes = boss.kills > 0 || boss.wipes > 0

  return (
    <div
      onClick={onClick}
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

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">
        {/* Boss Name */}
        <h4 className="font-bold text-lg text-white drop-shadow-lg mb-2 group-hover:text-coral transition-colors">
          {boss.name}
        </h4>

        {/* Stats Row - Always show, even with 0 values */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle size={14} className={boss.kills > 0 ? 'text-green-400' : 'text-lavender/50'} />
            <span className={`font-semibold ${boss.kills > 0 ? 'text-green-400' : 'text-lavender/50'}`}>{boss.kills || 0}</span>
            <span className="text-xs text-lavender/80">{t('kills')}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle size={14} className={boss.wipes > 0 ? 'text-red-400' : 'text-lavender/50'} />
            <span className={`font-semibold ${boss.wipes > 0 ? 'text-red-400' : 'text-lavender/50'}`}>{boss.wipes || 0}</span>
            <span className="text-xs text-lavender/80">{t('wipes')}</span>
          </div>
          {boss.fastestKill && (
            <div className="flex items-center gap-1">
              <Lightning size={14} className="text-yellow-400" />
              <span className="text-yellow-400 font-semibold">{boss.fastestKill}</span>
            </div>
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
