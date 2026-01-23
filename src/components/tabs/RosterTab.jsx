import { useState } from 'react';
import AddMemberModal from '../modals/AddMemberModal';
import AdjustDKPModal from '../modals/AdjustDKPModal';
import ClassIcon from '../ClassIcon';

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

export default function RosterTab({ users, user: currentUser, onUsersUpdate }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [adjustUser, setAdjustUser] = useState(null);

  return (
    <div className="tab-content active">
      <div className="content-header">
        <h2>Raid Roster</h2>
        {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Add Member
            </button>
          </div>
        )}
      </div>

      <div className="table-container">
        <table className="roster-table">
          <thead>
            <tr>
              <th>Character</th>
              <th>Class</th>
              <th>Spec</th>
              <th>Role</th>
              <th>DKPs</th>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClassIcon className={user.characterClass} size={24} />
                    <span className="class-badge">{user.characterClass}</span>
                  </div>
                </td>
                <td>
                  <span className="spec-badge">{user.spec || 'N/A'}</span>
                </td>
                <td>
                  <span className={`role-badge ${user.raidRole?.toLowerCase() || 'dps'}`}>
                    {user.raidRole || 'DPS'}
                  </span>
                </td>
                <td className="dkp-value">
                  {user.currentDkp || 0}
                  {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
                    <button className="btn-icon" title="Adjust DKP" onClick={() => setAdjustUser(user)} style={{marginLeft: '8px'}}>
                      ±
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSuccess={onUsersUpdate}
        />
      )}

      {adjustUser && (
        <AdjustDKPModal
          user={adjustUser}
          onClose={() => setAdjustUser(null)}
          onSuccess={onUsersUpdate}
        />
      )}
    </div>
  );
}
