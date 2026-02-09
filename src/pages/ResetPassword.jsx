import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Lock, FloppyDisk, CircleNotch, WarningCircle, CheckCircle, ArrowLeft } from '@phosphor-icons/react'
import { useLanguage } from '../hooks/useLanguage'
import { authAPI } from '../services/api'

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
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="px-4 py-2 rounded-full border-2 border-lavender-20 text-cream text-sm font-semibold hover:bg-lavender-12 transition-colors uppercase"
          >
            {language}
          </button>
        </div>

        <div className="bg-lavender-12 rounded-2xl overflow-hidden">
          <div className="p-8 text-center border-b border-lavender-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo flex items-center justify-center border-2 border-lavender-20">
              <Lock size={32} className="text-coral" />
            </div>
            <h2 className="text-2xl font-bold text-coral mb-2">{t('reset_password')}</h2>
            <p className="text-lavender text-sm">{t('reset_password_desc')}</p>
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

            {!message ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                    <Lock size={16} className="text-coral" />{t('new_password')}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-cream text-sm font-semibold mb-2">
                    <Lock size={16} className="text-coral" />{t('confirm_password')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-coral text-indigo font-bold py-4 px-4 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <CircleNotch size={20} className="animate-spin" />{t('loading')}...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <FloppyDisk size={20} />{t('change_password')}
                    </span>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-lavender text-sm">{t('redirecting_to_login')}</p>
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

export default ResetPassword
