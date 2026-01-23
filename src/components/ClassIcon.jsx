// WoW Class Icons Component
// Uses inline SVG data for each class icon

const CLASS_ICONS = {
  Warrior: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#C79C6E">
      <path d="M32 8L8 20v24l24 12 24-12V20L32 8zm0 4l20 10v20l-20 10-20-10V22l20-10zm-8 16l8-8 8 8-8 8-8-8z"/>
    </svg>
  ),
  Paladin: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#F58CBA">
      <path d="M32 6l-8 16h-8l16 20-4 16 12-8 12 8-4-16 16-20h-8L32 6zm0 8l5 10h7l-10 12 3 10-7-5-7 5 3-10-10-12h7l5-10z"/>
    </svg>
  ),
  Hunter: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#ABD473">
      <path d="M32 8L12 28l8 8 4-4v16l8 8 8-8V32l4 4 8-8L32 8zm0 8l12 12-4 4-4-4v20l-4 4-4-4V28l-4 4-4-4 12-12z"/>
    </svg>
  ),
  Rogue: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#FFF569">
      <path d="M32 8l-6 12-14 2 10 10-2 14 12-6 12 6-2-14 10-10-14-2-6-12zm0 8l4 8 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1 4-8z"/>
    </svg>
  ),
  Priest: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#FFFFFF">
      <circle cx="32" cy="20" r="8"/>
      <path d="M32 28c-8 0-16 4-16 12v16h32V40c0-8-8-12-16-12z"/>
    </svg>
  ),
  Shaman: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#0070DE">
      <path d="M32 8l-4 8H16l8 12-4 8 12-4 12 4-4-8 8-12H36l-4-8zm0 10l2 4h6l-4 6 2 4-6-2-6 2 2-4-4-6h6l2-4z"/>
      <rect x="28" y="42" width="8" height="14"/>
    </svg>
  ),
  Mage: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#69CCF0">
      <circle cx="32" cy="16" r="6"/>
      <path d="M32 24l-8 8v24h16V32l-8-8zm-4 12h8v16h-8V36z"/>
    </svg>
  ),
  Warlock: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#9482C9">
      <circle cx="32" cy="18" r="6"/>
      <path d="M24 26l-8 16 8 8 8-8-4-8 4-8h-8zm16 0l8 16-8 8-8-8 4-8-4-8h8z"/>
    </svg>
  ),
  Druid: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#FF7D0A">
      <circle cx="32" cy="20" r="8"/>
      <path d="M32 28l-12 8v20h8V42h8v14h8V36l-12-8z"/>
    </svg>
  ),
  DeathKnight: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#C41F3B">
      <path d="M32 8l-8 12v8l8 8 8-8v-8l-8-12zm0 8l4 6v6l-4 4-4-4v-6l4-6z"/>
      <rect x="28" y="36" width="8" height="20"/>
    </svg>
  ),
  Monk: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#00FF96">
      <circle cx="32" cy="18" r="6"/>
      <path d="M32 26l-8 6-4 8 4 4 8-4v16h8V40l8 4 4-4-4-8-8-6z"/>
    </svg>
  ),
  DemonHunter: (
    <svg viewBox="0 0 64 64" width="24" height="24" fill="#A330C9">
      <path d="M32 8l-12 16 4 8 8-4 8 4 4-8L32 8zm-16 24l-4 8 8 8 4-4-8-12zm32 0l-8 12 4 4 8-8-4-8z"/>
      <rect x="28" y="44" width="8" height="12"/>
    </svg>
  )
};

export default function ClassIcon({ className, size = 24 }) {
  const icon = CLASS_ICONS[className] || CLASS_ICONS.Warrior;

  return (
    <span className="class-icon" style={{ display: 'inline-flex', alignItems: 'center', width: size, height: size }}>
      {icon}
    </span>
  );
}
