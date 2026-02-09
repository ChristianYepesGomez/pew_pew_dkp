import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Key, User, PaperPlaneRight, CircleNotch, WarningCircle, CheckCircle, Info, ArrowLeft } from '@phosphor-icons/react'
import { useLanguage } from '../hooks/useLanguage'
import { authAPI } from '../services/api'
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

        <div className="bg-lavender-12 rounded-2xl overflow-hidden">
          <div className="p-8 text-center border-b border-lavender-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo flex items-center justify-center border-2 border-lavender-20">
              <Key size={32} className="text-coral" />
            </div>
            <h2 className="text-2xl font-bold text-coral mb-2">{t('forgot_password')}</h2>
            <p className="text-lavender text-sm">{t('forgot_password_desc')}</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <WarningCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="bg-teal/20 border border-teal text-teal px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <CheckCircle size={20} />
                <span>{message}</span>
              </div>
            )}

            {resetToken && (
              <div className="bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
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
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                    <User size={16} className="text-coral" />{t('username_or_email')}
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
                    <span className="flex items-center justify-center gap-2">
                      <PaperPlaneRight size={20} />{t('send_reset_link')}
                    </span>
                  )}
                </Button>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-lavender text-sm">{t('check_email_instructions')}</p>
              </div>
            )}

            <div className="text-center mt-6 pt-6 border-t border-lavender-20">
              <Link
                to="/login"
                className="text-lavender hover:text-cream transition-colors text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />{t('back_to_login')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
