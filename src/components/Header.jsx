import { useState } from 'react';
import { t, getCurrentLanguage, setLanguage } from '../i18n';

export default function Header({ user, onLogout }) {
  const [lang, setLang] = useState(getCurrentLanguage());
  const [showLangMenu, setShowLangMenu] = useState(false);

  const changeLang = (newLang) => {
    setLanguage(newLang);
    setLang(newLang);
    setShowLangMenu(false);
    window.location.reload();
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
          <div className="lang-dropdown">
            <button onClick={() => setShowLangMenu(!showLangMenu)} className="btn-icon" title="Language">
              {lang === 'en' ? '🇬🇧' : '🇪🇸'}
            </button>
            {showLangMenu && (
              <div className="lang-menu">
                <button onClick={() => changeLang('en')} className="lang-option">
                  🇬🇧 English
                </button>
                <button onClick={() => changeLang('es')} className="lang-option">
                  🇪🇸 Español
                </button>
              </div>
            )}
          </div>
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
