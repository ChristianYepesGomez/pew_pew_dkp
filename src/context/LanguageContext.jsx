import { createContext, useState, useEffect } from 'react'
import { translations } from '../utils/translations'

export const LanguageContext = createContext()

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'es')

  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  const changeLanguage = (lang) => {
    if (lang === 'es' || lang === 'en') setLanguage(lang)
  }

  const t = (key) => translations[language]?.[key] || key

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}