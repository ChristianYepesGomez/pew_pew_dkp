import { useState } from 'react';
import AddMemberModal from '../modals/AddMemberModal';
import AdjustDKPModal from '../modals/AdjustDKPModal';
import ResetPasswordModal from '../modals/ResetPasswordModal';
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

export default function RosterTab({ users, user: currentUser, onUsersUpdate, lang = 'es' }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [adjustUser, setAdjustUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);

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
                </td>
                {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        className="btn-icon"
                        title={lang === 'es' ? 'Ajustar DKP' : 'Adjust DKP'}
                        onClick={() => setAdjustUser(user)}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className="btn-icon btn-warning"
                        title={lang === 'es' ? 'Resetear Contraseña' : 'Reset Password'}
                        onClick={() => setResetPasswordUser(user)}
                      >
                        <i className="fas fa-key"></i>
                      </button>
                    </div>
                  </td>
                )}
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

      {resetPasswordUser && (
        <ResetPasswordModal
          userId={resetPasswordUser.id}
          characterName={resetPasswordUser.characterName || resetPasswordUser.username}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={() => {
            alert(lang === 'es' ? '¡Contraseña reseteada exitosamente!' : 'Password reset successfully!');
            setResetPasswordUser(null);
          }}
          lang={lang}
        />
      )}
    </div>
  );
}
