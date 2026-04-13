import { useState } from 'react'
import { Scroll } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { useHallOfFame } from '../../hooks/useQueries'
import SurfaceCard from '../ui/SurfaceCard'
import { Skeleton } from '../ui/Skeleton'
import CLASS_COLORS from '../../utils/classColors'
import HallOfFameDetail from './HallOfFameDetail'

const HallOfFameTab = () => {
  const { t } = useLanguage()
  const { data: legends = [], isLoading } = useHallOfFame()
  const [selectedId, setSelectedId] = useState(null)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-coral">{t('hall_of_fame_title')}</h2>
        <p className="text-lavender text-sm">{t('hall_of_fame_subtitle')}</p>
      </div>

      {legends.length === 0 ? (
        <SurfaceCard className="text-center py-16">
          <Scroll size={64} className="mx-auto text-lavender/40 mb-4" />
          <p className="text-cream text-lg font-semibold">{t('hall_of_fame_empty')}</p>
          <p className="text-lavender text-sm mt-1">{t('hall_of_fame_empty_desc')}</p>
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
          {legends.map((legend) => (
            <TombstoneCard
              key={legend.id}
              legend={legend}
              t={t}
              onClick={() => setSelectedId(legend.id)}
            />
          ))}
        </div>
      )}

      {selectedId && (
        <HallOfFameDetail
          entryId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

const TombstoneCard = ({ legend, t, onClick }) => {
  const classColor = CLASS_COLORS[legend.characterClass] || '#e8e4d8'

  const formatDate = (dateStr) => {
    if (!dateStr) return '????'
    const d = new Date(dateStr)
    const month = d.toLocaleString(undefined, { month: 'short' }).toUpperCase()
    return `${month} ${d.getFullYear()}`
  }

  const fromDate = formatDate(legend.joinDate)
  const untilDate = legend.leaveDate ? formatDate(legend.leaveDate) : '—'

  const isKrakatoar = legend.characterName?.toLowerCase() === 'krakatoar'
  const isStras = legend.characterName?.toLowerCase() === 'stras'

  const engraved = {
    textShadow:
      '0 1px 0 rgba(255,255,255,0.08), 0 -1px 1px rgba(0,0,0,0.7), 1px 0 1px rgba(0,0,0,0.5)',
  }

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer transition-all duration-300 hover:-translate-y-1"
    >
      {/* Ground shadow */}
      <div className="absolute -bottom-3 left-6 right-6 h-4 bg-black/60 blur-lg rounded-full" />

      {/* Tombstone body */}
      <div
        className="relative rounded-t-[45%] pt-12 pb-6 px-6 min-h-[440px] flex flex-col items-center text-center overflow-hidden transition-shadow duration-300 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
        style={{
          background:
            'linear-gradient(180deg, #7a7a82 0%, #5c5c64 35%, #46464e 70%, #3a3a42 100%)',
          boxShadow:
            'inset 0 4px 18px rgba(0,0,0,0.45), inset 0 -3px 10px rgba(255,255,255,0.04), 0 10px 28px rgba(0,0,0,0.6)',
        }}
      >
        {/* Mossy speckles / stone texture */}
        <div
          className="absolute inset-0 opacity-25 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 15%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 75% 85%, rgba(0,0,0,0.5), transparent 55%), radial-gradient(circle at 60% 40%, rgba(120,160,100,0.25), transparent 30%)',
          }}
        />

        {/* Engraved inner frame */}
        <div
          className="absolute inset-3 rounded-t-[45%] border border-black/50 pointer-events-none"
          style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.55)' }}
        />

        {/* Cross ornament (special icons for legends) */}
        <div
          className="relative z-10 font-serif text-3xl text-stone-300/80 leading-none mb-2"
          style={engraved}
          title={isKrakatoar ? 'Hora de la muerte' : isStras ? '/gquit' : undefined}
        >
          {isKrakatoar ? '🕘' : isStras ? '🚪' : '✝'}
        </div>

        {/* R.I.P. */}
        <div
          className="relative z-10 font-serif tracking-[0.35em] text-[11px] text-stone-300/75 mb-3"
          style={engraved}
        >
          R · I · P
        </div>

        {/* Divider */}
        <div className="relative z-10 w-20 h-px bg-stone-400/30 mb-4" />

        {/* Character name */}
        <h3
          className="relative z-10 font-serif text-2xl font-bold leading-tight mb-1"
          style={{
            color: classColor,
            textShadow:
              '0 1px 0 rgba(255,255,255,0.12), 0 -1px 2px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {legend.characterName}
        </h3>

        {/* Class / spec */}
        <p
          className="relative z-10 text-stone-400 text-xs font-serif italic mb-4"
          style={engraved}
        >
          {legend.spec && `${legend.spec} `}
          {legend.characterClass}
          {legend.raidRole && ` · ${legend.raidRole}`}
        </p>

        {/* Dates engraving */}
        <p
          className="relative z-10 font-serif text-stone-300 text-sm tracking-[0.15em] mb-4"
          style={engraved}
        >
          {fromDate}
          <span className="mx-2 text-stone-500">—</span>
          {isKrakatoar ? '21:03' : untilDate}
        </p>

        {/* Krakatoar — certificado de defunción */}
        {isKrakatoar && (
          <p
            className="relative z-10 font-serif text-stone-400 text-[11px] italic mb-4"
            style={engraved}
          >
            † Causa: <span className="text-stone-300">Impaciencia aguda</span>
            <br />
            <span className="text-stone-500">(3 minutos sin invite a raid)</span>
          </p>
        )}

        {/* Krakatoar — últimas palabras */}
        {isKrakatoar && (
          <div className="relative z-10 mb-4 px-2">
            <p
              className="font-serif text-stone-500 text-[9px] tracking-[0.25em] uppercase mb-1"
              style={engraved}
            >
              Últimas palabras
            </p>
            <p
              className="font-serif text-stone-300 text-xs italic leading-snug"
              style={engraved}
            >
              &ldquo;me voy que no me invita nadie&rdquo;
            </p>
          </div>
        )}

        {/* Stras — certificado de defunción */}
        {isStras && (
          <p
            className="relative z-10 font-serif text-stone-400 text-[11px] italic mb-4"
            style={engraved}
          >
            † Causa: <span className="text-stone-300">Picadez crónica</span>
            <br />
            <span className="text-stone-500">(rotado 1 día, /gquit sin avisar)</span>
          </p>
        )}

        {/* Stras — últimas palabras */}
        {isStras && (
          <div className="relative z-10 mb-4 px-2">
            <p
              className="font-serif text-stone-500 text-[9px] tracking-[0.25em] uppercase mb-1"
              style={engraved}
            >
              Últimas palabras
            </p>
            <p
              className="font-serif text-stone-300 text-xs italic leading-snug"
              style={engraved}
            >
              &ldquo;/gquit&rdquo;
            </p>
            <p
              className="font-serif text-stone-500 text-[9px] italic mt-1"
              style={engraved}
            >
              — y no dijo más
            </p>
          </div>
        )}

        {/* Tribute */}
        {legend.tribute && (
          <p
            className="relative z-10 text-stone-400 text-[11px] italic font-serif line-clamp-2 px-3 mb-4"
            style={engraved}
          >
            &ldquo;{legend.tribute}&rdquo;
          </p>
        )}

        {/* Stats carved at the foot */}
        <div className="relative z-10 mt-auto w-full pt-3 border-t border-stone-500/25 grid grid-cols-3 gap-2">
          <StatCarved value={legend.totalBossKills ?? 0} label={t('hof_boss_kills')} />
          <StatCarved value={legend.lifetimeDkpGained ?? 0} label={t('hof_dkp_earned')} />
          <StatCarved value={legend.lifetimeDkpSpent ?? 0} label={t('hof_dkp_spent')} />
        </div>
      </div>
    </div>
  )
}

const StatCarved = ({ value, label }) => (
  <div>
    <p
      className="font-serif font-bold text-stone-200 text-base leading-none"
      style={{
        textShadow:
          '0 1px 0 rgba(255,255,255,0.1), 0 -1px 2px rgba(0,0,0,0.8), 1px 1px 1px rgba(0,0,0,0.6)',
      }}
    >
      {value}
    </p>
    <p className="text-stone-500 text-[9px] tracking-wider uppercase mt-1">{label}</p>
  </div>
)

export default HallOfFameTab
