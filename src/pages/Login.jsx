import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import CatLogo from '../components/Layout/CatLogo'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'

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

        <div className="flex flex-col items-center justify-start bg-lavender-12 rounded-3xl overflow-hidden p-10 space-y-8">
            <CatLogo size={280} />

            {error && (
              <div className="w-full bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
                <WarningCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
              <div className="w-full flex flex-col gap-2">
                <label className="block text-cream text-sm font-semibold px-2">
                  {t('username')}
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('enter_username')}
                  required
                />
              </div>

              <div className="w-full space-y-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-cream text-sm font-semibold">
                      {t('password')}
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-sm"
                    >
                      {t('forgot_password')}
                    </Link>
                  </div>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('enter_password')}
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
                  <span>{t('login')}</span>
                )}
              </Button>
            </form>
        </div>

        <p className="text-lavender text-center mt-6">
          {t('no_account')}{' '}
          <Link to="/register" className="text-coral font-semibold hover:underline">
            {t('register')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login
