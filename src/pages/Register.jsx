import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import { authAPI } from '../services/api'
import CatLogo from '../components/Layout/CatLogo'

const Register = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t, language, changeLanguage } = useLanguage()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError(t('passwords_dont_match'))
      return
    }
    if (formData.password.length < 6) {
      setError(t('password_min_length'))
      return
    }
    if (!formData.email.includes('@')) {
      setError(t('invalid_email'))
      return
    }

    setLoading(true)
    setError('')
    try {
      await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || t('registration_failed'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-midnight-deepblue bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 text-center max-w-md border border-midnight-bright-purple">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
            <i className="fas fa-check text-white text-3xl"></i>
          </div>
          <h2 className="text-2xl font-cinzel font-bold text-midnight-glow mb-3">{t('registration_success')}</h2>
          <p className="text-midnight-silver">{t('redirecting_to_login')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Language toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="px-3 py-1 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
          >
            {language === 'es' ? '🇪🇸' : '🇬🇧'}
          </button>
        </div>

        {/* Main card */}
        <div className="bg-midnight-deepblue bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl border border-midnight-bright-purple overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center border-b border-midnight-bright-purple border-opacity-30 bg-gradient-to-b from-midnight-purple/20 to-transparent">
            <div className="mb-4 flex justify-center">
              <CatLogo size={70} />
            </div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-glow mb-1">{t('guild_name')}</h2>
            <p className="text-midnight-silver text-sm">{t('create_account')}</p>
          </div>

          {/* Form */}
          <div className="p-6">
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-midnight-silver text-sm font-semibold mb-2">
                  <i className="fas fa-user mr-2 text-midnight-glow"></i>{t('username')}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                  placeholder={t('enter_username')}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-midnight-silver text-sm font-semibold mb-2">
                  <i className="fas fa-envelope mr-2 text-midnight-glow"></i>{t('email')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                  placeholder={t('enter_email')}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-midnight-silver text-sm font-semibold mb-2">
                  <i className="fas fa-lock mr-2 text-midnight-glow"></i>{t('password')}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                  placeholder={t('enter_password')}
                  required
                />
                <p className="text-xs text-midnight-silver mt-1">{t('password_requirements')}</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-midnight-silver text-sm font-semibold mb-2">
                  <i className="fas fa-lock mr-2 text-midnight-glow"></i>{t('confirm_password')}
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                  placeholder={t('repeat_password')}
                  required
                />
              </div>

              {/* Info note */}
              <div className="flex items-start gap-3 px-4 py-3 bg-midnight-purple bg-opacity-20 rounded-lg border border-midnight-bright-purple border-opacity-20 text-sm">
                <i className="fas fa-info-circle text-midnight-glow mt-0.5"></i>
                <p className="text-midnight-silver">
                  {t('register_info')}
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-4 px-4 rounded-lg hover:shadow-lg hover:shadow-midnight-glow/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {loading ? (
                  <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
                ) : (
                  <><i className="fas fa-user-plus mr-2"></i>{t('create_account')}</>
                )}
              </button>
            </form>

            {/* Login link */}
            <div className="text-center mt-6 pt-6 border-t border-midnight-bright-purple border-opacity-20">
              <p className="text-midnight-silver">
                {t('have_account')}{' '}
                <Link to="/login" className="text-midnight-glow font-semibold hover:underline">
                  {t('login_here')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
