import es from './es.json';
import en from './en.json';

const translations = { es, en };

export const getCurrentLanguage = () => localStorage.getItem('lang') || 'en';

export const setLanguage = (lang) => {
  localStorage.setItem('lang', lang);
};

export const t = (key) => {
  const lang = getCurrentLanguage();
  const keys = key.split('.');
  let value = translations[lang];

  for (const k of keys) {
    value = value?.[k];
  }

  return value || key;
};
