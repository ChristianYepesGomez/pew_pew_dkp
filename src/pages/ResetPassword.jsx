import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
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
        {/* Language toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="px-3 py-1 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all min-h-[44px] flex items-center justify-center"
            aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          >
            {language === 'es' ? '🇪🇸' : '🇬🇧'}
          </button>
        </div>

        {/* Main card */}
        <div className="bg-midnight-deepblue bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl border border-midnight-bright-purple overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center border-b border-midnight-bright-purple border-opacity-30 bg-gradient-to-b from-midnight-purple/20 to-transparent">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-midnight-purple bg-opacity-30 flex items-center justify-center border border-midnight-bright-purple">
              <i className="fas fa-lock text-3xl text-midnight-glow"></i>
            </div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-glow mb-2">{t('reset_password')}</h2>
            <p className="text-midnight-silver text-sm">{t('reset_password_desc')}</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2" role="alert">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="bg-green-500 bg-opacity-20 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                <i className="fas fa-check-circle"></i>
                <span>{message}</span>
              </div>
            )}

            {!message ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reset-password" className="block text-midnight-silver text-sm font-semibold mb-2">
                    <i className="fas fa-lock mr-2 text-midnight-glow"></i>{t('new_password')}
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label htmlFor="reset-confirm-password" className="block text-midnight-silver text-sm font-semibold mb-2">
                    <i className="fas fa-lock mr-2 text-midnight-glow"></i>{t('confirm_password')}
                  </label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-4 px-4 rounded-lg hover:shadow-lg hover:shadow-midnight-glow/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none min-h-[44px]"
                >
                  {loading ? (
                    <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
                  ) : (
                    <><i className="fas fa-save mr-2"></i>{t('change_password')}</>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-midnight-silver text-sm">{t('redirecting_to_login')}</p>
              </div>
            )}

            {/* Back to login */}
            <div className="text-center mt-6 pt-6 border-t border-midnight-bright-purple border-opacity-20">
              <Link
                to="/login"
                className="text-midnight-silver hover:text-midnight-glow transition-colors text-sm"
              >
                <i className="fas fa-arrow-left mr-2"></i>{t('back_to_login')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
