import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleNotch, WarningCircle, CheckCircle, Info } from '@phosphor-icons/react'
import { useLanguage } from '../hooks/useLanguage'
import { authAPI } from '../services/api'
import AuthFormHeader from '../components/UI/AuthFormHeader'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'

const ForgotPassword = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState(null)
  const { t, language, changeLanguage } = useLanguage()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setResetToken(null)
    setLoading(true)

    try {
      const response = await authAPI.forgotPassword(usernameOrEmail)
      setMessage(t('password_reset_sent'))
      if (response.data.resetToken) {
        setResetToken(response.data.resetToken)
      }
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

        <div className="flex flex-col justify-start bg-lavender-12 rounded-3xl overflow-hidden p-6 sm:p-10 space-y-8">
          <AuthFormHeader
            title={t('forgot_password')}
            description={t('forgot_password_desc')}
            logoVariant="cat"
          />

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

            {resetToken && (
              <div className="w-full bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                <Info size={20} />
                <span>
                  <strong>Dev mode:</strong>{' '}
                  <Link to={`/reset-password/${resetToken}`} className="underline hover:text-blue-300">
                    Click here to reset password
                  </Link>
                </span>
              </div>
            )}

            {!message ? (
              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
                <div className="w-full flex flex-col gap-2">
                  <label className="block text-cream text-sm font-semibold px-2">
                    {t('username_or_email')}
                  </label>
                  <Input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder={t('username_or_email_placeholder')}
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
                    <span>{t('send_reset_link')}</span>
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

export default ForgotPassword
