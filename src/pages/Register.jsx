import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Envelope, Lock, UserPlus, CircleNotch, WarningCircle, Info, CheckCircle } from '@phosphor-icons/react'
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
        <div className="bg-lavender-12 rounded-2xl p-8 text-center max-w-md">
          <div className="w-20 h-20 bg-teal/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} weight="fill" className="text-teal" />
          </div>
          <h2 className="text-2xl font-bold text-coral mb-3">{t('registration_success')}</h2>
          <p className="text-lavender">{t('redirecting_to_login')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="px-4 py-2 rounded-full border-2 border-lavender-20 text-cream text-sm font-semibold hover:bg-lavender-12 transition-colors uppercase"
          >
            {language}
          </button>
        </div>

        <div className="bg-lavender-12 rounded-2xl overflow-hidden">
          <div className="p-8 text-center border-b border-lavender-20">
            <div className="mb-4 flex justify-center">
              <CatLogo size={70} />
            </div>
            <h2 className="text-2xl font-bold text-coral mb-1">{t('guild_name')}</h2>
            <p className="text-lavender text-sm">{t('create_account')}</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <WarningCircle size={20} weight="bold" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <User size={16} weight="bold" className="text-coral" />{t('username')}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                  placeholder={t('enter_username')}
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <Envelope size={16} weight="bold" className="text-coral" />{t('email')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                  placeholder={t('enter_email')}
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <Lock size={16} weight="bold" className="text-coral" />{t('password')}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                  placeholder={t('enter_password')}
                  required
                />
                <p className="text-xs text-lavender mt-1">{t('password_requirements')}</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <Lock size={16} weight="bold" className="text-coral" />{t('confirm_password')}
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                  placeholder={t('repeat_password')}
                  required
                />
              </div>

              <div className="flex items-start gap-3 px-4 py-3 bg-indigo rounded-xl border-2 border-lavender-20 text-sm">
                <Info size={18} weight="bold" className="text-coral mt-0.5 shrink-0" />
                <p className="text-lavender">{t('register_info')}</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-coral text-indigo font-bold py-4 px-4 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <CircleNotch size={20} weight="bold" className="animate-spin" />{t('loading')}...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus size={20} weight="bold" />{t('create_account')}
                  </span>
                )}
              </button>
            </form>

            <div className="text-center mt-6 pt-6 border-t border-lavender-20">
              <p className="text-lavender">
                {t('have_account')}{' '}
                <Link to="/login" className="text-coral font-semibold hover:underline">
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
