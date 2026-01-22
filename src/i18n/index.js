import es from './es.json';
import en from './en.json';

const translations = { es, en };

let currentLang = localStorage.getItem('lang') || 'en';

export const setLanguage = (lang) => {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  window.location.reload();
};

export const t = (key) => {
  const keys = key.split('.');
  let value = translations[currentLang];

  for (const k of keys) {
    value = value?.[k];
  }

  return value || key;
};

export const getCurrentLanguage = () => currentLang;
