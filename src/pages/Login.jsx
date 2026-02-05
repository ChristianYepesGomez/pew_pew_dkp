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
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Language toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="px-3 py-1 rounded-lg border border-midnight-bright-purple text-midnight-silver hover:bg-midnight-bright-purple hover:bg-opacity-20 transition-all"
          >
            {language === 'es' ? '🇪🇸' : '🇬🇧'}
          </button>
        </div>

        {/* Main card */}
        <div className="bg-midnight-deepblue bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl border border-midnight-bright-purple overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center border-b border-midnight-bright-purple border-opacity-30 bg-gradient-to-b from-midnight-purple/20 to-transparent">
            <div className="mb-4 flex justify-center">
              <CatLogo size={70} />
            </div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-glow mb-1">{t('guild_name')}</h2>
            <p className="text-midnight-silver text-sm">{t('login_title')}</p>
          </div>

          {/* Form */}
          <div className="p-6">
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-midnight-silver text-sm font-semibold mb-2">
                  <i className="fas fa-user mr-2 text-midnight-glow"></i>{t('username')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                  placeholder={t('enter_username')}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-midnight-silver text-sm font-semibold mb-2">
                  <i className="fas fa-lock mr-2 text-midnight-glow"></i>{t('password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-midnight-purple bg-opacity-30 border border-midnight-bright-purple border-opacity-30 text-white placeholder-gray-500 focus:outline-none focus:border-midnight-glow transition-all"
                  placeholder={t('enter_password')}
                  required
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-4 px-4 rounded-lg hover:shadow-lg hover:shadow-midnight-glow/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {loading ? (
                  <><i className="fas fa-circle-notch fa-spin mr-2"></i>{t('loading')}...</>
                ) : (
                  <><i className="fas fa-sign-in-alt mr-2"></i>{t('login')}</>
                )}
              </button>
            </form>

            {/* Links */}
            <div className="text-center mt-6 pt-6 border-t border-midnight-bright-purple border-opacity-20 space-y-3">
              <Link
                to="/forgot-password"
                className="text-midnight-silver hover:text-midnight-glow transition-colors block text-sm"
              >
                <i className="fas fa-key mr-2"></i>{t('forgot_password')}
              </Link>
              <p className="text-midnight-silver">
                {t('no_account')}{' '}
                <Link to="/register" className="text-midnight-glow font-semibold hover:underline">
                  {t('register')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
