import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLanguage } from '../../hooks/useLanguage'
import { bossesAPI } from '../../services/api'
import CLASS_COLORS from '../../utils/classColors'

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

  const openBossDetails = async (boss) => {
    setSelectedBoss(boss)
    setLoadingDetails(true)
    try {
      const response = await bossesAPI.getDetails(boss.id)
      setBossDetails(response.data)
    } catch (err) {
      console.error('Load boss details error:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeBossDetails = () => {
    setSelectedBoss(null)
    setBossDetails(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <i className="fas fa-spinner fa-spin text-3xl text-midnight-purple"></i>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-4 text-center">
        <i className="fas fa-exclamation-circle mr-2"></i>{error}
      </div>
    )
  }

  const zones = activeTab === 'current' ? data.current : data.legacy

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'current'
                ? 'bg-midnight-purple text-white'
                : 'bg-white bg-opacity-10 text-gray-300 hover:bg-opacity-20'
            }`}
          >
            <i className="fas fa-dragon mr-2"></i>
            {t('current_raids')}
            {data.current.length > 0 && (
              <span className="ml-2 bg-midnight-glow text-midnight-purple px-2 py-0.5 rounded-full text-xs">
                {data.current.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'legacy'
                ? 'bg-midnight-purple text-white'
                : 'bg-white bg-opacity-10 text-gray-300 hover:bg-opacity-20'
            }`}
          >
            <i className="fas fa-book mr-2"></i>
            {t('legacy_raids')}
            {data.legacy.length > 0 && (
              <span className="ml-2 bg-gray-600 text-gray-200 px-2 py-0.5 rounded-full text-xs">
                {data.legacy.length}
              </span>
            )}
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={handleSync}
            className="px-3 py-2 bg-white bg-opacity-10 hover:bg-opacity-20 rounded-lg text-sm transition-all"
          >
            <i className="fas fa-sync mr-2"></i>
            {t('sync_zones')}
          </button>
        )}
      </div>

      {/* Zones */}
      {zones.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <i className="fas fa-dungeon text-4xl mb-4"></i>
          <p>{t('no_bosses')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {zones.map(zone => (
            <div key={zone.id} className="bg-white bg-opacity-5 rounded-xl overflow-hidden">
              {/* Zone Header */}
              <button
                onClick={() => toggleZone(zone.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white hover:bg-opacity-5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <i className={`fas fa-chevron-${expandedZones[zone.id] ? 'down' : 'right'} text-gray-400`}></i>
                  <span className="font-cinzel font-bold text-lg">{zone.name}</span>
                  {zone.progress && (
                    <span
                      className="px-2 py-0.5 rounded text-sm font-bold"
                      style={{ color: DIFFICULTY_COLORS[zone.highestDifficulty] || '#fff' }}
                    >
                      {zone.progress}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">{zone.bossCount} bosses</span>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleLegacy(zone.id, activeTab === 'legacy')
                      }}
                      className="text-xs px-2 py-1 bg-white bg-opacity-10 hover:bg-opacity-20 rounded transition-all"
                    >
                      {activeTab === 'legacy' ? t('mark_current') : t('mark_legacy')}
                    </button>
                  )}
                </div>
              </button>

              {/* Boss Grid */}
              {expandedZones[zone.id] && (
                <div className="px-4 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {/* Boss Details Modal */}
      {selectedBoss && (
        <BossDetailModal
          boss={selectedBoss}
          details={bossDetails}
          loading={loadingDetails}
          onClose={closeBossDetails}
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
        <div className="absolute inset-0 bg-gradient-to-br from-midnight-deep to-purple-900" />
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
        <h4 className="font-cinzel font-bold text-lg text-white drop-shadow-lg mb-2 group-hover:text-midnight-glow transition-colors">
          {boss.name}
        </h4>

        {/* Stats Row - Always show, even with 0 values */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <i className={`fas fa-check-circle text-xs ${boss.kills > 0 ? 'text-green-400' : 'text-gray-500'}`}></i>
            <span className={`font-semibold ${boss.kills > 0 ? 'text-green-400' : 'text-gray-500'}`}>{boss.kills || 0}</span>
            <span className="text-gray-400 text-xs">{t('kills')}</span>
          </div>
          <div className="flex items-center gap-1">
            <i className={`fas fa-times-circle text-xs ${boss.wipes > 0 ? 'text-red-400' : 'text-gray-500'}`}></i>
            <span className={`font-semibold ${boss.wipes > 0 ? 'text-red-400' : 'text-gray-500'}`}>{boss.wipes || 0}</span>
            <span className="text-gray-400 text-xs">{t('wipes')}</span>
          </div>
          {boss.fastestKill && (
            <div className="flex items-center gap-1">
              <i className="fas fa-bolt text-yellow-400 text-xs"></i>
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
            className="mt-3 flex items-center justify-center gap-2 py-2 bg-midnight-glow/20 backdrop-blur-sm rounded-lg text-midnight-glow text-sm font-medium opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:bg-midnight-glow/30"
          >
            <i className="fas fa-book-open"></i>
            {t('view_guide')}
            <i className="fas fa-external-link-alt text-xs"></i>
          </a>
        )}
      </div>

      {/* Hover Border Effect */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-midnight-glow/50 transition-colors duration-300 pointer-events-none" />
    </div>
  )
}

// Boss Detail Modal Component
const BossDetailModal = ({ boss, details, loading, onClose, t }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-midnight-deep to-midnight-purple rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Hero Header with Boss Image */}
        <div className="relative h-48 overflow-hidden">
          {boss.imageUrl ? (
            <img
              src={boss.imageUrl}
              alt={boss.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-midnight-deep" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-midnight-deep via-midnight-deep/60 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-gray-300 hover:text-white hover:bg-black/70 transition-all"
          >
            <i className="fas fa-times text-lg"></i>
          </button>

          {/* Boss Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="font-cinzel font-bold text-3xl text-white drop-shadow-lg">{boss.name}</h2>
            {details?.boss?.raid && (
              <p className="text-gray-300 mt-1">{details.boss.raid}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-192px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <i className="fas fa-spinner fa-spin text-3xl text-midnight-glow"></i>
            </div>
          ) : details ? (
            <div className="space-y-6">
              {/* Statistics */}
              {details.statistics && (
                <div className="bg-white bg-opacity-5 rounded-xl p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <i className="fas fa-chart-bar text-midnight-glow"></i>
                    {t('statistics')}
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: (DIFFICULTY_COLORS[details.statistics.difficulty] || '#888') + '30',
                        color: DIFFICULTY_COLORS[details.statistics.difficulty] || '#888'
                      }}
                    >
                      {details.statistics.difficulty}
                    </span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatBox label={t('kills')} value={details.statistics.kills} color="text-green-400" />
                    <StatBox label={t('wipes')} value={details.statistics.wipes} color="text-red-400" />
                    <StatBox label={t('fastest_kill')} value={details.statistics.fastestKill || '-'} color="text-yellow-400" />
                    <StatBox label={t('avg_kill_time')} value={details.statistics.avgKillTime || '-'} color="text-blue-400" />
                  </div>

                  {/* Progression Stats Row */}
                  {(details.statistics.wipesToFirstKill !== null || details.statistics.firstKillDate) && (
                    <div className="mt-4 pt-4 border-t border-white border-opacity-10">
                      <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                        <i className="fas fa-flag-checkered text-yellow-400"></i>
                        {t('progression_stats')}
                      </h4>
                      <div className="flex flex-wrap gap-4">
                        {details.statistics.wipesToFirstKill !== null && (
                          <div className="flex items-center gap-2 bg-red-500 bg-opacity-10 px-3 py-2 rounded-lg">
                            <i className="fas fa-skull-crossbones text-red-400"></i>
                            <span className="text-sm text-gray-300">{t('wipes_to_first_kill')}:</span>
                            <span className="font-bold text-red-400">{details.statistics.wipesToFirstKill}</span>
                          </div>
                        )}
                        {details.statistics.firstKillDate && (
                          <div className="flex items-center gap-2 bg-green-500 bg-opacity-10 px-3 py-2 rounded-lg">
                            <i className="fas fa-trophy text-green-400"></i>
                            <span className="text-sm text-gray-300">{t('first_kill')}:</span>
                            <span className="font-bold text-green-400">{details.statistics.firstKillDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {details.statistics.lastKill && (
                    <p className="text-xs text-gray-400 mt-3">
                      {t('last_kill')}: {details.statistics.lastKill}
                    </p>
                  )}
                </div>
              )}

              {/* Records (Top Performers) */}
              {details.records && (details.records.topDamage || details.records.topHealing || details.records.mostDeaths) && (
                <div className="bg-white bg-opacity-5 rounded-xl p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <i className="fas fa-trophy text-yellow-400"></i>
                    {t('records')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {details.records.topDamage && (
                      <RecordCard
                        icon="fa-fire"
                        iconColor="text-orange-400"
                        title={t('top_damage')}
                        record={details.records.topDamage}
                      />
                    )}
                    {details.records.topHealing && (
                      <RecordCard
                        icon="fa-heart"
                        iconColor="text-green-400"
                        title={t('top_healing')}
                        record={details.records.topHealing}
                      />
                    )}
                    {details.records.mostDamageTaken && (
                      <RecordCard
                        icon="fa-shield-alt"
                        iconColor="text-blue-400"
                        title={t('most_damage_taken')}
                        record={details.records.mostDamageTaken}
                      />
                    )}
                    {details.records.mostDeaths && (
                      <RecordCard
                        icon="fa-skull"
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
                <div className="bg-white bg-opacity-5 rounded-xl p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <i className="fas fa-skull text-red-400"></i>
                    {t('hall_of_shame')}
                  </h3>
                  <div className="space-y-2">
                    {details.deathLeaderboard.slice(0, 10).map((player, idx) => (
                      <div
                        key={player.userId}
                        className="flex items-center justify-between py-2 px-3 bg-white bg-opacity-5 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-bold ${idx < 3 ? 'text-red-400' : 'text-gray-500'}`}>
                            #{player.rank}
                          </span>
                          <span style={{ color: CLASS_COLORS[player.characterClass] || '#fff' }}>
                            {player.characterName}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-red-400">
                            <i className="fas fa-skull mr-1"></i>
                            {player.deaths}
                          </span>
                          <span className="text-gray-400">
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
                <div className="bg-white bg-opacity-5 rounded-xl p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <i className="fas fa-history text-green-400"></i>
                    {t('recent_kills')}
                  </h3>
                  <div className="space-y-2">
                    {details.recentKills.map((kill, idx) => (
                      <a
                        key={idx}
                        href={kill.wclUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between py-2 px-3 bg-white bg-opacity-5 rounded-lg hover:bg-opacity-10 transition-all"
                      >
                        <span className="text-gray-300">{kill.date}</span>
                        <span className="text-yellow-400">{kill.killTime}</span>
                        <span className="text-midnight-glow text-sm">
                          <i className="fas fa-external-link-alt mr-1"></i>
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
                  className="flex items-center justify-center gap-2 py-3 bg-midnight-glow bg-opacity-20 hover:bg-opacity-30 rounded-xl text-midnight-glow font-semibold transition-all"
                >
                  <i className="fas fa-book-open"></i>
                  {t('view_guide')}
                  <i className="fas fa-external-link-alt text-sm"></i>
                </a>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
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
    <div className="text-xs text-gray-400">{label}</div>
  </div>
)

// Record Card Component
const RecordCard = ({ icon, iconColor, title, record }) => (
  <div className="bg-white bg-opacity-5 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-2">
      <i className={`fas ${icon} ${iconColor}`}></i>
      <span className="text-xs text-gray-400">{title}</span>
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
