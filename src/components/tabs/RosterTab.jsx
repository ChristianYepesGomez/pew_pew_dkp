const CLASS_COLORS = {
  'Warrior': 'warrior',
  'Priest': 'priest',
  'Rogue': 'rogue',
  'Mage': 'mage',
  'Paladin': 'paladin',
  'Warlock': 'warlock',
  'Hunter': 'hunter',
  'Druid': 'druid',
  'Shaman': 'shaman',
};

export default function RosterTab({ users, user: currentUser }) {
  return (
    <div className="tab-content active">
      <div className="content-header">
        <h2>Raid Roster</h2>
        {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
          <div className="actions">
            <button className="btn btn-primary">+ Add Member</button>
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="roster-table">
          <thead>
            <tr>
              <th>Character</th>
              <th>Class</th>
              <th>Role</th>
              <th>Current DKP</th>
              <th>Lifetime</th>
              {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
                <th>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="character">
                    <span className={`char-name ${CLASS_COLORS[user.characterClass] || ''}`}>
                      {user.characterName || user.username}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="class-badge">{user.characterClass}</span>
                </td>
                <td>
                  <span className={`role-badge ${user.raidRole?.toLowerCase() || 'dps'}`}>
                    {user.raidRole || 'DPS'}
                  </span>
                </td>
                <td className="dkp-value">{user.currentDkp || 0}</td>
                <td className="lifetime-value">{user.lifetimeGained || 0}</td>
                {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
                  <td>
                    <button className="btn-icon" title="Adjust DKP">±</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
