import { createContext, useState, useEffect } from 'react'
import { t } from '../utils/translations'

export const LanguageContext = createContext()

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'es'
  })

  useEffect(() => {
    localStorage.setItem('language', language)
    document.documentElement.lang = language
  }, [language])

  const changeLanguage = (newLang) => {
    if (newLang === 'es' || newLang === 'en') {
      setLanguage(newLang)
    }
  }

  const translate = (key) => t(key, language)

  const value = {
    language,
    changeLanguage,
    t: translate,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
