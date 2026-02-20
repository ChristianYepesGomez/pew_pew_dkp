import { X, ArrowSquareOut, Warning, Check } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'

const ADDONS = {
  required: [
    {
      name: 'Method Raid Tools (MRT)',
      description: 'Imprescindible. Distribuye notas de asignación a todo el raid, gestiona recordatorios en combate y trackea CDs de grupo.',
      links: [
        { label: 'CurseForge', url: 'https://www.curseforge.com/wow/addons/method-raid-tools' },
        { label: 'Wago Addons', url: 'https://addons.wago.io/addons/method-raid-tools' },
      ],
    },
  ],
  recommended: [
    {
      name: 'MRT Reminders',
      description: 'Feature dentro de MRT. Reemplaza a las WeakAuras clásicas para alertas en combate — muestra texto/barras cuando el boss castea habilidades específicas.',
      links: [
        { label: 'Guía Method', url: 'https://www.method.gg/method-raid-tools-reminders' },
      ],
    },
    {
      name: 'Encounter Planner',
      description: 'Addon alternativo para planificar mecánicas dentro del juego. Permite importar/exportar notas MRT.',
      links: [
        { label: 'CurseForge', url: 'https://www.curseforge.com/wow/addons/encounter-planner' },
      ],
    },
    {
      name: 'Cooldown Manager (nativo)',
      description: 'Herramienta built-in de Blizzard en Midnight. Trackea tus propios CDs con alertas visuales y de sonido. No requiere addon.',
      links: [
        { label: 'Guía Wowhead', url: 'https://www.wowhead.com/guide/ui/cooldown-manager-setup' },
      ],
    },
    {
      name: 'Luxthos Cooldown Manager Profiles',
      description: 'Perfiles pre-configurados para el Cooldown Manager nativo, organizados por clase y spec.',
      links: [
        { label: 'Luxthos.com', url: 'https://www.luxthos.com/cooldown-manager-profiles-world-of-warcraft-midnight/' },
      ],
    },
  ],
}

export default function AddonRecommendationsModal({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-indigo border border-lavender-20 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-lavender-12">
          <h2 className="text-base font-semibold text-cream">Addons para Raid (Midnight)</h2>
          <button onClick={onClose} className="text-muted hover:text-cream transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* WeakAuras notice */}
        <div className="mx-6 mt-4 flex gap-3 p-3 bg-yellow-900/30 border border-yellow-600/40 rounded-lg">
          <Warning size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200">
            <strong>WeakAuras no funciona en Midnight.</strong> El equipo de WA confirmó que no dará soporte tras los cambios de API de combate de Blizzard.
            Usa <strong>MRT Reminders</strong> como alternativa para alertas en combate.
          </p>
        </div>

        {/* Obligatorios */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs font-semibold text-coral uppercase tracking-wide mb-2">Obligatorios</p>
          <div className="space-y-3">
            {ADDONS.required.map(addon => (
              <AddonCard key={addon.name} addon={addon} required />
            ))}
          </div>
        </div>

        {/* Recomendados */}
        <div className="px-6 pt-2 pb-6">
          <p className="text-xs font-semibold text-lavender uppercase tracking-wide mb-2">Recomendados</p>
          <div className="space-y-3">
            {ADDONS.recommended.map(addon => (
              <AddonCard key={addon.name} addon={addon} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function AddonCard({ addon, required }) {
  return (
    <div className={`p-3 rounded-lg border ${required ? 'border-coral/40 bg-coral/5' : 'border-lavender-12 bg-lavender-8'}`}>
      <div className="flex items-start gap-2 mb-1">
        {required
          ? <Check size={14} className="text-coral flex-shrink-0 mt-0.5" />
          : <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        }
        <div className="min-w-0">
          <p className="text-sm font-medium text-cream">{addon.name}</p>
          <p className="text-xs text-muted mt-0.5">{addon.description}</p>
          <div className="flex gap-2 mt-2">
            {addon.links.map(link => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-lavender hover:text-cream transition-colors"
              >
                {link.label}
                <ArrowSquareOut size={10} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
