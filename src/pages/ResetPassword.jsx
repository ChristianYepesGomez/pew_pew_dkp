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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4"><i className="fas fa-lock text-midnight-purple"></i></div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-purple mb-2">{t('reset_password')}</h2>
            <p className="text-gray-600">{t('reset_password_desc')}</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          {message && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
              <i className="fas fa-check-circle mr-2"></i>{message}
            </div>
          )}

          {!message && (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-lock mr-2"></i>{t('new_password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none bg-white text-gray-900"
                  required
                  minLength={6}
                />
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-2">
                  <i className="fas fa-lock mr-2"></i>{t('confirm_password')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none bg-white text-gray-900"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</> : <><i className="fas fa-save mr-2"></i>{t('change_password')}</>}
              </button>
            </form>
          )}

          <div className="text-center mt-6">
            <Link to="/login" className="text-midnight-purple font-semibold hover:text-midnight-bright-purple">
              <i className="fas fa-arrow-left mr-2"></i>{t('back_to_login')}
            </Link>
          </div>
        </div>
      </div>

      {/* Language selector at bottom */}
      <div className="mt-6">
        <button
          onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
          className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
        >
          <i className="fas fa-globe"></i>
          {language === 'es' ? 'English' : 'Español'}
        </button>
      </div>
    </div>
  )
}

export default ResetPassword
