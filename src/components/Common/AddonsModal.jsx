import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Wrench, X, Check, PencilSimple, Trash, Plus, FloppyDisk, X as XIcon,
} from '@phosphor-icons/react'
import { useAuth } from '../../hooks/useAuth'
import { addonsAPI } from '../../services/api'

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

// ── Main modal ────────────────────────────────────────────────────
const AddonsModal = ({ onClose }) => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
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

  const handleAdd = (category) => setForm({ mode: 'add', category, addon: null })
  const handleEdit = (addon) => setForm({ mode: 'edit', category: addon.category, addon })

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
                <Wrench size={24} className="text-coral" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-cream">Addons</h3>
                <p className="text-sm text-lavender">Addons recomendados para raid</p>
              </div>
            </div>
            <button onClick={onClose} className="text-lavender hover:text-cream transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-6 text-center text-sm text-muted">Cargando…</div>
        ) : (
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
        )}
      </div>
    </div>,
    document.body
  )
}

export default AddonsModal
