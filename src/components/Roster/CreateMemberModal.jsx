import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../hooks/useLanguage'
import { useFocusTrap } from '../../hooks/useFocusTrap'
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

const CreateMemberModal = ({ onClose, onSuccess }) => {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef(null)
  useFocusTrap(modalRef)
  const [form, setForm] = useState({
    username: '',
    characterName: '',
    characterClass: 'Warrior',
    spec: 'Arms',
    raidRole: 'DPS',
    role: 'raider',
    initialDkp: '',
  })

  // Close on ESC key
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
      // Password is auto-generated: username_pewpew
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 overflow-y-auto" onClick={onClose}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={t('create_member')} className="bg-midnight-deepblue border-2 border-midnight-bright-purple rounded-2xl w-full max-w-lg max-sm:max-w-none shadow-2xl my-8" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-midnight-bright-purple border-opacity-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                <i className="fas fa-user-plus text-2xl text-white"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white m-0">{t('create_member')}</h3>
                <p className="text-sm text-midnight-silver m-0">{t('create_member_desc')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={t('close')}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-6 bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
            <i className="fas fa-exclamation-circle mr-2"></i>{error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Username & Character Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-midnight-silver mb-2">{t('username')} *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-midnight-silver mb-2">{t('character_name')} *</label>
              <input
                type="text"
                value={form.characterName}
                onChange={(e) => setForm({ ...form, characterName: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
                required
              />
            </div>
          </div>

          {/* Class & Spec */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-midnight-silver mb-2">{t('class')} *</label>
              <select
                value={form.characterClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white focus:outline-none focus:border-midnight-glow"
              >
                {CLASSES.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-midnight-silver mb-2">{t('spec')} *</label>
              <select
                value={form.spec}
                onChange={(e) => handleSpecChange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white focus:outline-none focus:border-midnight-glow"
              >
                {currentSpecs.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Raid Role & Guild Role */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-midnight-silver mb-2">{t('raid_role')}</label>
              <select
                value={form.raidRole}
                onChange={(e) => setForm({ ...form, raidRole: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white focus:outline-none focus:border-midnight-glow"
              >
                <option value="Tank">{t('tank')}</option>
                <option value="Healer">{t('healer')}</option>
                <option value="DPS">{t('dps')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-midnight-silver mb-2">{t('guild_role')}</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white focus:outline-none focus:border-midnight-glow"
              >
                <option value="raider">{t('role_raider')}</option>
                <option value="officer">{t('role_officer')}</option>
                <option value="admin">{t('role_admin')}</option>
              </select>
            </div>
          </div>

          {/* Initial DKP */}
          <div>
            <label className="block text-sm text-midnight-silver mb-2">{t('initial_dkp')}</label>
            <input
              type="number"
              value={form.initialDkp}
              onChange={(e) => setForm({ ...form, initialDkp: e.target.value })}
              placeholder="0"
              className="w-full px-4 py-2 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow"
              min={0}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
              ) : (
                <><i className="fas fa-user-plus mr-2"></i>{t('create')}</>
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
