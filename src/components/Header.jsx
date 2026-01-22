import { useState } from 'react';
import { t, getCurrentLanguage } from '../i18n';

export default function Header({ user, onLogout }) {
  const [lang, setLang] = useState(getCurrentLanguage());

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'es' : 'en';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">{t('app.title')}</h1>
        <span className="guild-name">Pew Pew Kittens with Guns</span>
      </div>
      <div className="header-right">
        <div className="user-info">
          <span className="user-name">{user.characterName || user.username}</span>
          <span className="user-dkp">{user.currentDkp || 0} DKP</span>
          <span className={`user-role ${user.role}`}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </span>
          <button onClick={toggleLang} className="btn-icon" title="Language">
            {lang === 'en' ? '🇪🇸' : '🇬🇧'}
          </button>
          <button onClick={onLogout} className="btn-icon" title={t('common.logout')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
