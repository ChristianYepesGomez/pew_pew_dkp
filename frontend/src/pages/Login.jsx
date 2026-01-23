import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { t, language, changeLanguage } = useLanguage()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(credentials)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.error)
    }

    setLoading(false)
  }

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Language Selector */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="text-midnight-silver hover:text-midnight-glow transition-colors"
          >
            {language === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
          </button>
        </div>

        {/* Login Card */}
        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-2xl shadow-2xl p-8">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              <i className="fas fa-shield-alt text-midnight-purple"></i>
            </div>
            <h2 className="text-2xl font-cinzel font-bold text-midnight-purple mb-2">
              {t('guild_name')}
            </h2>
            <p className="text-gray-600">{t('login_title')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              <i className="fas fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="mb-4">
              <label htmlFor="username" className="block text-gray-700 font-semibold mb-2">
                <i className="fas fa-user mr-2"></i>
                {t('username')}
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                placeholder={t('username')}
                required
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-gray-700 font-semibold mb-2">
                <i className="fas fa-lock mr-2"></i>
                {t('password')}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-midnight-purple focus:ring-2 focus:ring-midnight-purple focus:outline-none transition-all bg-white text-gray-900"
                placeholder={t('password')}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fas fa-circle-notch fa-spin mr-2"></i>
                  {t('loading')}...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-2"></i>
                  {t('login')}
                </>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              {t('no_account')}{' '}
              <Link
                to="/register"
                className="text-midnight-purple font-semibold hover:text-midnight-bright-purple transition-colors"
              >
                {t('register_here')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
