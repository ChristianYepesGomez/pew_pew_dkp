import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'

const WOW_CLASSES = [
  'Warrior',
  'Paladin',
  'Hunter',
  'Rogue',
  'Priest',
  'Shaman',
  'Mage',
  'Warlock',
  'Druid',
  'Death Knight',
]

const RAID_ROLES = ['Tank', 'Healer', 'DPS']

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    characterName: '',
    characterClass: '',
    raidRole: 'DPS',
    spec: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const { t, language, changeLanguage } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.characterClass) {
      setError(t('please_complete_fields'))
      return
    }

    setLoading(true)
    const result = await register(formData)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.error)
    }

    setLoading(false)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Language Selector */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="text-midnight-silver hover:text-midnight-glow transition-colors"
          >
            {language === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
          </button>
        </div>

        {/* Register Card */}
        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              <i className="fas fa-user-plus text-midnight-purple"></i>
            </div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-purple mb-2">
              {t('guild_name')}
            </h2>
            <p className="text-gray-600">{t('register')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username */}
              <div className="mb-4">
                <label htmlFor="username" className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-user mr-2"></i>
                  {t('username')}
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                  required
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <label htmlFor="password" className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-lock mr-2"></i>
                  {t('password')}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                  required
                />
              </div>

              {/* Character Name */}
              <div className="mb-4">
                <label htmlFor="characterName" className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-id-card mr-2"></i>
                  {t('character_name')}
                </label>
                <input
                  type="text"
                  id="characterName"
                  name="characterName"
                  value={formData.characterName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                  required
                />
              </div>

              {/* Character Class */}
              <div className="mb-4">
                <label htmlFor="characterClass" className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-dragon mr-2"></i>
                  {t('class')}
                </label>
                <select
                  id="characterClass"
                  name="characterClass"
                  value={formData.characterClass}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                  required
                >
                  <option value="">{t('select_class')}</option>
                  {WOW_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              {/* Raid Role */}
              <div className="mb-4">
                <label htmlFor="raidRole" className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-shield-alt mr-2"></i>
                  {t('role')}
                </label>
                <select
                  id="raidRole"
                  name="raidRole"
                  value={formData.raidRole}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                  required
                >
                  {RAID_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(role.toLowerCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Spec */}
              <div className="mb-4">
                <label htmlFor="spec" className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-star mr-2"></i>
                  {t('spec')}
                </label>
                <input
                  type="text"
                  id="spec"
                  name="spec"
                  value={formData.spec}
                  onChange={handleChange}
                  placeholder={t('select_spec')}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fas fa-circle-notch fa-spin mr-2"></i>
                  {t('loading')}...
                </>
              ) : (
                <>
                  <i className="fas fa-user-plus mr-2"></i>
                  {t('register')}
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              {t('have_account')}{' '}
              <Link
                to="/login"
                className="text-midnight-purple font-semibold hover:text-midnight-bright-purple transition-colors"
              >
                {t('login_here')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
