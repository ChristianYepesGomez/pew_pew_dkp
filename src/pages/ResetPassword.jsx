import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { useLanguage } from '../hooks/useLanguage'
import { authAPI } from '../services/api'
import CatLogo from '../components/Layout/CatLogo'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'

const ResetPassword = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { t, language, changeLanguage } = useLanguage()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError(t('passwords_dont_match'))
      return
    }

    if (password.length < 6) {
      setError(t('password_too_short'))
      return
    }

    setLoading(true)

    try {
      await authAPI.resetPassword(token, password)
      setMessage(t('password_reset_success'))
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || t('error_generic'))
    }
    setLoading(false)
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
          <CatLogo size={220} />

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-coral">{t('reset_password')}</h2>
            <p className="text-lavender text-sm">{t('reset_password_desc')}</p>
          </div>

          <div className="w-full">
            {error && (
              <div className="w-full bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <WarningCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="w-full bg-teal/20 border border-teal text-teal px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <CheckCircle size={20} />
                <span>{message}</span>
              </div>
            )}

            {!message ? (
              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
                <div className="w-full flex flex-col gap-2">
                  <label className="block text-cream text-sm font-semibold px-2">
                    {t('new_password')}
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('password_placeholder')}
                    required
                    minLength={6}
                  />
                </div>

                <div className="w-full flex flex-col gap-2">
                  <label className="block text-cream text-sm font-semibold px-2">
                    {t('confirm_password')}
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('password_placeholder')}
                    required
                    minLength={6}
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
                    <span>{t('change_password')}</span>
                  )}
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        <p className="text-lavender text-center text-sm mt-6">
          <Link to="/login" className="text-coral font-semibold hover:underline">
            {t('back_to_login')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default ResetPassword
