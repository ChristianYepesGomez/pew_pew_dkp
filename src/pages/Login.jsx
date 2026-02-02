import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import CatLogo from '../components/Layout/CatLogo'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { t, language, changeLanguage } = useLanguage()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)
    if (!result.success) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="mb-4 flex justify-center"><CatLogo size={80} /></div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-purple mb-2">{t('guild_name')}</h2>
            <p className="text-gray-600">{t('login_title')}</p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              <i className="fas fa-exclamation-circle mr-2"></i>{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
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

            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                <i className="fas fa-lock mr-2"></i>{t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none bg-white text-gray-900"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</> : <><i className="fas fa-sign-in-alt mr-2"></i>{t('login')}</>}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link to="/forgot-password" className="text-midnight-purple font-semibold hover:text-midnight-bright-purple">
              <i className="fas fa-key mr-2"></i>{t('forgot_password')}
            </Link>
          </div>
        </div>
      </div>

      {/* Language selector at bottom - standard position like Google/Microsoft login pages */}
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

export default Login
