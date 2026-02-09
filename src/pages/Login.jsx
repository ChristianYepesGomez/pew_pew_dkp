import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleNotch, WarningCircle } from '@phosphor-icons/react'
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
        <div className="flex justify-end mb-4">
          <button
            onClick={() => changeLanguage(language === 'es' ? 'en' : 'es')}
            className="px-4 py-2 rounded-full border-2 border-lavender-20 text-cream text-sm font-semibold hover:bg-lavender-12 transition-colors uppercase"
          >
            {language}
          </button>
        </div>

        <div className="bg-lavender-12 rounded-2xl overflow-hidden p-8 space-y-8">
          <div className="flex justify-center pt-4">
            <CatLogo size={280} />
          </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <WarningCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-cream text-sm font-semibold mb-2">
                  {t('username')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                  placeholder={t('enter_username')}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-cream text-sm font-semibold">
                    {t('password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-lavender hover:text-cream transition-colors text-sm"
                  >
                    {t('forgot_password')}
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-indigo border-2 border-lavender-20 text-cream placeholder:text-lavender focus:outline-none focus:border-lavender transition-colors"
                  placeholder={t('enter_password')}
                  required
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
                  <span>{t('login')}</span>
                )}
              </button>
            </form>

            <div className="text-center mt-6 pt-6 border-t border-lavender-20 space-y-3">
            
              <p className="text-lavender">
                {t('no_account')}{' '}
                <Link to="/register" className="text-coral font-semibold hover:underline">
                  {t('register')}
                </Link>
              </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
