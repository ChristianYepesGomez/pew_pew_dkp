import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Coins, PlusCircle, Gavel, Clock, Crown, Scales, X, CalendarCheck, Skull, Check, DiceFive,
  Wrench, PencilSimple, Trash, Plus, FloppyDisk, X as XIcon,
} from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { useAuth } from '../../hooks/useAuth'
import { addonsAPI } from '../../services/api'
import VaultIcon from './VaultIcon'

// ── DKP System tab ────────────────────────────────────────────────
function DKPTab() {
  const { t } = useLanguage()

  return (
    <div className="p-6 overflow-auto space-y-6">
      <div className="bg-teal/10 border border-teal/30 rounded-xl p-4">
        <h4 className="flex items-center gap-2 text-teal font-bold mb-3 text-sm uppercase">
          <PlusCircle size={18} />
          {t('dkp_earning_title')}
        </h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center text-teal shrink-0">
              <CalendarCheck size={18} />
            </span>
            <span className="text-cream">{t('dkp_earning_calendar')} <span className="text-teal font-bold">+1</span></span>
          </li>
          <li className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center text-teal shrink-0">
              <Skull size={18} />
            </span>
            <span className="text-cream">{t('dkp_earning_raid')} <span className="text-teal font-bold">+5</span></span>
          </li>
          <li className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-teal/20 flex items-center justify-center shrink-0">
              <VaultIcon completed={true} size={24} />
            </span>
            <span className="text-cream">{t('dkp_earning_vault')} <span className="text-teal font-bold">+10</span></span>
          </li>
        </ul>
      </div>

      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <h4 className="flex items-center gap-2 text-red-400 font-bold mb-3 text-sm uppercase">
          <Gavel size={18} />
          {t('dkp_spending_title')}
        </h4>
        <ul className="space-y-2 text-sm text-cream">
          <li className="flex items-start gap-3">
            <Check size={16} className="text-red-400 mt-0.5 shrink-0" />
            <span>{t('dkp_spending_auctions')}</span>
          </li>
          <li className="flex items-start gap-3">
            <Check size={16} className="text-red-400 mt-0.5 shrink-0" />
            <span>{t('dkp_spending_free')}</span>
          </li>
          <li className="flex items-start gap-3">
            <DiceFive size={16} className="text-yellow-400 mt-0.5 shrink-0" />
            <span>{t('dkp_spending_ties')}</span>
          </li>
        </ul>
      </div>

      <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
        <h4 className="flex items-center gap-2 text-orange-400 font-bold mb-3 text-sm uppercase">
          <Clock size={18} />
          {t('anti_snipe_title')}
        </h4>
        <p className="text-sm text-cream">{t('anti_snipe_info')}</p>
        <p className="text-xs text-orange-300 mt-2 italic">{t('anti_snipe_reason')}</p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
        <h4 className="flex items-center gap-2 text-yellow-400 font-bold mb-3 text-sm uppercase">
          <Crown size={18} />
          {t('dkp_cap_title')}: 250
        </h4>
        <p className="text-sm text-cream mb-2">{t('dkp_cap_explanation')}</p>
        <p className="text-xs text-yellow-300 italic">{t('dkp_cap_why')}</p>
      </div>

      <div className="text-center p-4 bg-lavender-12 rounded-xl border border-lavender-20">
        <Scales size={32} className="text-coral mx-auto mb-2" />
        <h5 className="text-cream font-bold mb-1">{t('dkp_fair_system')}</h5>
        <p className="text-sm text-lavender">{t('dkp_fair_explanation')}</p>
      </div>
    </div>
  )
}

// ── Addon form ────────────────────────────────────────────────────
function AddonForm({ initialData = {}, onSave, onCancel, saving }) {
  const [title, setTitle] = useState(initialData.title || '')
  const [body, setBody] = useState(initialData.body || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    onSave({ title: title.trim(), body: body.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 rounded-lg border border-lavender-20 bg-lavender-8 space-y-2">
      <input
        type="text"
        placeholder="Título"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full bg-indigo border border-lavender-20 rounded-lg px-3 py-2 text-sm text-cream placeholder:text-muted focus:outline-none focus:border-lavender-40"
        autoFocus
      />
      <textarea
        placeholder="Descripción"
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        className="w-full bg-indigo border border-lavender-20 rounded-lg px-3 py-2 text-sm text-cream placeholder:text-muted focus:outline-none focus:border-lavender-40 resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-cream transition-colors"
        >
          <XIcon size={13} />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim() || !body.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal/20 hover:bg-teal/30 text-teal border border-teal/30 rounded-lg transition-colors disabled:opacity-50"
        >
          <FloppyDisk size={13} />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

// ── Addon card ────────────────────────────────────────────────────
function AddonCard({ addon, required, isAdmin, onEdit, onDelete }) {
  return (
    <div className={`p-3 rounded-lg border ${required ? 'border-coral/40 bg-coral/5' : 'border-lavender-12 bg-lavender-8'}`}>
      <div className="flex items-start gap-2">
        {required
          ? <Check size={14} className="text-coral flex-shrink-0 mt-0.5" />
          : <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        }
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-cream">{addon.title}</p>
          <p className="text-xs text-muted mt-0.5">{addon.body}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-1 shrink-0 ml-1">
            <button
              onClick={() => onEdit(addon)}
              className="w-6 h-6 flex items-center justify-center text-muted hover:text-cream rounded transition-colors"
              title="Editar"
            >
              <PencilSimple size={13} />
            </button>
            <button
              onClick={() => onDelete(addon.id)}
              className="w-6 h-6 flex items-center justify-center text-muted hover:text-red-400 rounded transition-colors"
              title="Eliminar"
            >
              <Trash size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Addon section ─────────────────────────────────────────────────
function AddonSection({ label, labelColor, items, required, isAdmin, onEdit, onDelete, onAdd }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-semibold ${labelColor} uppercase tracking-wide`}>{label}</p>
        {isAdmin && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-muted hover:text-cream transition-colors"
          >
            <Plus size={12} />
            Añadir
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.map(addon => (
          <AddonCard
            key={addon.id}
            addon={addon}
            required={required}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted italic py-1">
            {isAdmin ? 'Sin entradas. Usa "Añadir" para crear la primera.' : 'Sin addons configurados.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Addons tab ────────────────────────────────────────────────────
function AddonsTab({ isAdmin }) {
  const [addons, setAddons] = useState([])
  const [loading, setLoading] = useState(true)
  // form: { mode: 'add'|'edit', category: 'required'|'recommended', addon: null|{...} }
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    addonsAPI.getAll()
      .then(res => { if (!cancelled) setAddons(res.data || []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const required = addons.filter(a => a.category === 'required')
  const recommended = addons.filter(a => a.category === 'recommended')

  const handleAdd = (category) => {
    setForm({ mode: 'add', category, addon: null })
  }

  const handleEdit = (addon) => {
    setForm({ mode: 'edit', category: addon.category, addon })
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este addon?')) return
    try {
      await addonsAPI.remove(id)
      setAddons(prev => prev.filter(a => a.id !== id))
    } catch (_e) {}
  }

  const handleSave = async ({ title, body }) => {
    setSaving(true)
    try {
      if (form.mode === 'add') {
        const res = await addonsAPI.create({ title, body, category: form.category })
        setAddons(prev => [...prev, res.data])
      } else {
        const res = await addonsAPI.update(form.addon.id, { title, body, category: form.category })
        setAddons(prev => prev.map(a => a.id === form.addon.id ? res.data : a))
      }
      setForm(null)
    } catch (_e) {}
    setSaving(false)
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-muted">Cargando…</div>
  }

  return (
    <div className="p-6 overflow-auto space-y-5">
      {/* Required section */}
      <AddonSection
        label="Obligatorios"
        labelColor="text-coral"
        items={required}
        required
        isAdmin={isAdmin}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={() => handleAdd('required')}
      />
      {form && form.category === 'required' && (
        <AddonForm
          initialData={form.addon || {}}
          onSave={handleSave}
          onCancel={() => setForm(null)}
          saving={saving}
        />
      )}

      {/* Recommended section */}
      <AddonSection
        label="Recomendados"
        labelColor="text-lavender"
        items={recommended}
        required={false}
        isAdmin={isAdmin}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={() => handleAdd('recommended')}
      />
      {form && form.category === 'recommended' && (
        <AddonForm
          initialData={form.addon || {}}
          onSave={handleSave}
          onCancel={() => setForm(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────
const DKPInfoModal = ({ onClose, onboardingStep, onAdvanceOnboarding }) => {
  const { t } = useLanguage()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [activeTab, setActiveTab] = useState('dkp')

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab === 'addons' && onboardingStep === 1) {
      onAdvanceOnboarding?.(2)
    }
  }

  // Pulse on Addons tab when onboardingStep === 1 and user hasn't clicked it yet
  const showAddonsPulse = onboardingStep === 1 && activeTab === 'dkp'

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-lavender-12 border-b border-lavender-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo flex items-center justify-center border-2 border-lavender-20">
                <Coins size={24} className="text-coral" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-cream">{t('dkp_system_title')}</h3>
                <p className="text-sm text-lavender">{t('dkp_system_subtitle')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-lavender hover:text-cream transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-indigo rounded-xl p-1">
            <button
              onClick={() => handleTabChange('dkp')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dkp'
                  ? 'bg-lavender-20 text-cream'
                  : 'text-muted hover:text-cream'
              }`}
            >
              <Coins size={15} />
              Sistema DKP
            </button>
            <button
              onClick={() => handleTabChange('addons')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'addons'
                  ? 'bg-lavender-20 text-cream'
                  : 'text-muted hover:text-cream'
              }`}
            >
              <Wrench size={15} />
              Addons
              {showAddonsPulse && (
                <span className="relative inline-flex">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'dkp' ? <DKPTab /> : <AddonsTab isAdmin={isAdmin} />}
      </div>
    </div>,
    document.body
  )
}

export default DKPInfoModal
