import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Envelope, Lock, UserPlus, CircleNotch, WarningCircle, Info, CheckCircle } from '@phosphor-icons/react'
import { useLanguage } from '../hooks/useLanguage'
import { authAPI } from '../services/api'
import CatLogo from '../components/Layout/CatLogo'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'

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
          <Button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            variant="outline"
            size="sm"
            radius="pill"
            className="uppercase"
          >
            {language}
          </Button>
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
                <WarningCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <User size={16} className="text-coral" />{t('username')}
                </label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder={t('enter_username')}
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <Envelope size={16} className="text-coral" />{t('email')}
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('enter_email')}
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <Lock size={16} className="text-coral" />{t('password')}
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('enter_password')}
                  required
                />
                <p className="text-xs text-lavender mt-1">{t('password_requirements')}</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                  <Lock size={16} className="text-coral" />{t('confirm_password')}
                </label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder={t('repeat_password')}
                  required
                />
              </div>

              <div className="flex items-start gap-3 px-4 py-3 bg-indigo rounded-xl border-2 border-lavender-20 text-sm">
                <Info size={18} className="text-coral mt-0.5 shrink-0" />
                <p className="text-lavender">{t('register_info')}</p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
                className="font-bold px-4"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <CircleNotch size={20} className="animate-spin" />{t('loading')}...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus size={20} />{t('create_account')}
                  </span>
                )}
              </Button>
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
