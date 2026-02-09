import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react'
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

          <div className="flex flex-col items-center justify-start bg-lavender-12 rounded-3xl overflow-hidden p-10 space-y-6 text-center">
            <CatLogo size={220} />
            <div className="w-20 h-20 bg-teal/20 rounded-full flex items-center justify-center">
              <CheckCircle size={40} weight="fill" className="text-teal" />
            </div>
            <h2 className="text-2xl font-bold text-coral">{t('registration_success')}</h2>
            <p className="text-lavender">{t('redirecting_to_login')}</p>
          </div>
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

        <div className="flex flex-col items-center justify-start bg-lavender-12 rounded-3xl overflow-hidden p-10 space-y-8">
          <CatLogo size={240} />

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-coral">{t('create_account')}</h2>
            <p className="text-lavender text-sm">{t('register_info')}</p>
          </div>

          <div className="w-full">
            {error && (
              <div className="w-full bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <WarningCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
              <div className="w-full flex flex-col gap-2">
                <label className="block text-cream text-sm font-semibold px-2">
                  {t('username')}
                </label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder={t('enter_username')}
                  required
                />
              </div>

              <div className="w-full flex flex-col gap-2">
                <label className="block text-cream text-sm font-semibold px-2">
                  {t('email')}
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('enter_email')}
                  required
                />
              </div>

              <div className="w-full flex flex-col gap-2">
                <div className="flex items-center justify-between px-2">
                  <label className="text-cream text-sm font-semibold">
                    {t('password')}
                  </label>
                  <span className="text-xs text-lavender">{t('password_requirements')}</span>
                </div>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('enter_password')}
                  required
                />
              </div>

              <div className="w-full flex flex-col gap-2">
                <label className="block text-cream text-sm font-semibold px-2">
                  {t('confirm_password')}
                </label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder={t('repeat_password')}
                  required
                />
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
                  <span>{t('create_account')}</span>
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-lavender text-center text-sm mt-6">
          {t('have_account')}{' '}
          <Link to="/login" className="text-coral font-semibold hover:underline">
            {t('login_here')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Register
