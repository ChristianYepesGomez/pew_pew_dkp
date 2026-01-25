import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import { authAPI } from '../services/api'

const ForgotPassword = () => {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { t, language, changeLanguage } = useLanguage()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      await authAPI.forgotPassword(username)
      setMessage(t('password_reset_sent'))
    } catch (err) {
      setError(err.response?.data?.error || t('error_generic'))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <button onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')} className="text-midnight-silver hover:text-midnight-glow">
            {language === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
          </button>
        </div>

        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4"><i className="fas fa-key text-midnight-purple"></i></div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-purple mb-2">{t('forgot_password')}</h2>
            <p className="text-gray-600">{t('forgot_password_desc')}</p>
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

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                <i className="fas fa-user mr-2"></i>{t('username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none bg-white text-gray-900"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</> : <><i className="fas fa-paper-plane mr-2"></i>{t('send_reset_link')}</>}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link to="/login" className="text-midnight-purple font-semibold hover:text-midnight-bright-purple">
              <i className="fas fa-arrow-left mr-2"></i>{t('back_to_login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
