import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'

const CLASSES = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid', 'Death Knight']
const ROLES = ['Tank', 'Healer', 'DPS']

const Register = () => {
  const [formData, setFormData] = useState({ username: '', password: '', characterName: '', characterClass: '', raidRole: 'DPS', spec: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const { t, language, changeLanguage } = useLanguage()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.characterClass) { setError(t('please_complete_fields')); return }
    setLoading(true)
    const result = await register(formData)
    if (!result.success) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')} className="text-midnight-silver hover:text-midnight-glow">
            {language === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
          </button>
        </div>

        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4"><i className="fas fa-user-plus text-midnight-purple"></i></div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-purple mb-2">{t('guild_name')}</h2>
            <p className="text-gray-600">{t('register')}</p>
          </div>

          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4"><i className="fas fa-exclamation-circle mr-2"></i>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2"><i className="fas fa-user mr-2"></i>{t('username')}</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:outline-none bg-white text-gray-900" required />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2"><i className="fas fa-lock mr-2"></i>{t('password')}</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:outline-none bg-white text-gray-900" required />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2"><i className="fas fa-id-card mr-2"></i>{t('character_name')}</label>
                <input type="text" value={formData.characterName} onChange={(e) => setFormData({ ...formData, characterName: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:outline-none bg-white text-gray-900" required />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2"><i className="fas fa-dragon mr-2"></i>{t('class')}</label>
                <select value={formData.characterClass} onChange={(e) => setFormData({ ...formData, characterClass: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:outline-none bg-white text-gray-900" required>
                  <option value="">{t('select_class')}</option>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2"><i className="fas fa-shield-alt mr-2"></i>{t('role')}</label>
                <select value={formData.raidRole} onChange={(e) => setFormData({ ...formData, raidRole: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:outline-none bg-white text-gray-900">
                  {ROLES.map((r) => <option key={r} value={r}>{t(r.toLowerCase())}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2"><i className="fas fa-star mr-2"></i>{t('spec')}</label>
                <input type="text" value={formData.spec} onChange={(e) => setFormData({ ...formData, spec: e.target.value })} placeholder={t('select_spec')} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:outline-none bg-white text-gray-900" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-4 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50">
              {loading ? <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</> : <><i className="fas fa-user-plus mr-2"></i>{t('register')}</>}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-gray-600">{t('have_account')} <Link to="/login" className="text-midnight-purple font-semibold hover:text-midnight-bright-purple">{t('login_here')}</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register