export default function TabNavigation({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''} ${tab.isAdmin ? 'admin-tab' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
