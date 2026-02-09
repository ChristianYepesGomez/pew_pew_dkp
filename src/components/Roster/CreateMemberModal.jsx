import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { UserPlus, X, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI } from '../../services/api'

const CLASS_SPECS = {
  Warrior: { specs: ['Arms', 'Fury', 'Protection Warrior'], defaultRoles: ['DPS', 'DPS', 'Tank'] },
  Paladin: { specs: ['Holy Paladin', 'Protection Paladin', 'Retribution'], defaultRoles: ['Healer', 'Tank', 'DPS'] },
  Hunter: { specs: ['Beast Mastery', 'Marksmanship', 'Survival'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Rogue: { specs: ['Assassination', 'Outlaw', 'Subtlety'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Priest: { specs: ['Discipline', 'Holy Priest', 'Shadow'], defaultRoles: ['Healer', 'Healer', 'DPS'] },
  Shaman: { specs: ['Elemental', 'Enhancement', 'Restoration Shaman'], defaultRoles: ['DPS', 'DPS', 'Healer'] },
  Mage: { specs: ['Arcane', 'Fire', 'Frost Mage'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Warlock: { specs: ['Affliction', 'Demonology', 'Destruction'], defaultRoles: ['DPS', 'DPS', 'DPS'] },
  Druid: { specs: ['Balance', 'Feral', 'Guardian', 'Restoration Druid'], defaultRoles: ['DPS', 'DPS', 'Tank', 'Healer'] },
  'Death Knight': { specs: ['Blood', 'Frost DK', 'Unholy'], defaultRoles: ['Tank', 'DPS', 'DPS'] },
  Monk: { specs: ['Brewmaster', 'Mistweaver', 'Windwalker'], defaultRoles: ['Tank', 'Healer', 'DPS'] },
  'Demon Hunter': { specs: ['Havoc', 'Vengeance'], defaultRoles: ['DPS', 'Tank'] },
  Evoker: { specs: ['Devastation', 'Preservation', 'Augmentation'], defaultRoles: ['DPS', 'Healer', 'DPS'] },
}

const CLASSES = Object.keys(CLASS_SPECS)

const inputClass = 'w-full px-4 py-2 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors'

const CreateMemberModal = ({ onClose, onSuccess }) => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    username: '',
    characterName: '',
    characterClass: 'Warrior',
    spec: 'Arms',
    raidRole: 'DPS',
    role: 'raider',
    initialDkp: '',
  })

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleClassChange = (newClass) => {
    const classData = CLASS_SPECS[newClass]
    setForm({
      ...form,
      characterClass: newClass,
      spec: classData.specs[0],
      raidRole: classData.defaultRoles[0],
    })
  }

  const handleSpecChange = (newSpec) => {
    const classData = CLASS_SPECS[form.characterClass]
    const specIndex = classData.specs.indexOf(newSpec)
    setForm({
      ...form,
      spec: newSpec,
      raidRole: classData.defaultRoles[specIndex],
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const password = `${form.username}_pewpew`
      await membersAPI.create({
        ...form,
        password,
        initialDkp: parseInt(form.initialDkp) || 0
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || t('error_generic'))
    } finally {
      setLoading(false)
    }
  }

  const currentSpecs = CLASS_SPECS[form.characterClass]?.specs || []

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-indigo border-2 border-lavender-20 rounded-2xl w-full max-w-lg shadow-2xl my-8">
        <div className="p-6 border-b border-lavender-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal/20 flex items-center justify-center">
                <UserPlus size={24} weight="bold" className="text-teal" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-cream">{t('create_member')}</h3>
                <p className="text-sm text-lavender">{t('create_member_desc')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-lavender hover:text-cream transition-colors">
              <X size={24} weight="bold" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-6 bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
            <WarningCircle size={18} weight="bold" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-cream font-semibold mb-2">{t('username')} *</label>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm text-cream font-semibold mb-2">{t('character_name')} *</label>
              <input type="text" value={form.characterName} onChange={(e) => setForm({ ...form, characterName: e.target.value })} className={inputClass} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-cream font-semibold mb-2">{t('class')} *</label>
              <select value={form.characterClass} onChange={(e) => handleClassChange(e.target.value)} className={inputClass}>
                {CLASSES.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-cream font-semibold mb-2">{t('spec')} *</label>
              <select value={form.spec} onChange={(e) => handleSpecChange(e.target.value)} className={inputClass}>
                {currentSpecs.map((spec) => <option key={spec} value={spec}>{spec}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-cream font-semibold mb-2">{t('raid_role')}</label>
              <select value={form.raidRole} onChange={(e) => setForm({ ...form, raidRole: e.target.value })} className={inputClass}>
                <option value="Tank">Tank</option>
                <option value="Healer">Healer</option>
                <option value="DPS">DPS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-cream font-semibold mb-2">{t('guild_role')}</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass}>
                <option value="raider">{t('role_raider')}</option>
                <option value="officer">{t('role_officer')}</option>
                <option value="admin">{t('role_admin')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-cream font-semibold mb-2">{t('initial_dkp')}</label>
            <input type="number" value={form.initialDkp} onChange={(e) => setForm({ ...form, initialDkp: e.target.value })} placeholder="0" className={inputClass} min={0} />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-full border-2 border-lavender-20 text-cream hover:bg-lavender-12 transition-colors">
              {t('cancel')}
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 rounded-full bg-teal text-indigo font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2"><CircleNotch size={20} weight="bold" className="animate-spin" />{t('loading')}...</span>
              ) : (
                <span className="flex items-center justify-center gap-2"><UserPlus size={20} weight="bold" />{t('create')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default CreateMemberModal
