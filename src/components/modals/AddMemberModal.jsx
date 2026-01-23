import { useState } from 'react';
import { authAPI } from '../../services/api';

export default function AddMemberModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    characterName: '',
    characterClass: 'Warrior',
    raidRole: 'DPS',
    spec: 'Arms'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.register(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Member</h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              className="input"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="input"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Character Name</label>
            <input
              type="text"
              className="input"
              value={formData.characterName}
              onChange={(e) => setFormData({...formData, characterName: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Class</label>
            <select
              className="input"
              value={formData.characterClass}
              onChange={(e) => setFormData({...formData, characterClass: e.target.value})}
            >
              <option>Warrior</option>
              <option>Paladin</option>
              <option>Hunter</option>
              <option>Rogue</option>
              <option>Priest</option>
              <option>Shaman</option>
              <option>Mage</option>
              <option>Warlock</option>
              <option>Druid</option>
            </select>
          </div>

          <div className="form-group">
            <label>Spec</label>
            <select
              className="input"
              value={formData.spec}
              onChange={(e) => setFormData({...formData, spec: e.target.value})}
            >
              <option>Arms</option>
              <option>Fury</option>
              <option>Protection</option>
              <option>Holy</option>
              <option>Retribution</option>
              <option>Beast Mastery</option>
              <option>Marksmanship</option>
              <option>Survival</option>
              <option>Assassination</option>
              <option>Combat</option>
              <option>Subtlety</option>
              <option>Discipline</option>
              <option>Shadow</option>
              <option>Elemental</option>
              <option>Enhancement</option>
              <option>Restoration</option>
              <option>Arcane</option>
              <option>Fire</option>
              <option>Frost</option>
              <option>Affliction</option>
              <option>Demonology</option>
              <option>Destruction</option>
              <option>Balance</option>
              <option>Feral</option>
            </select>
          </div>

          <div className="form-group">
            <label>Raid Role</label>
            <select
              className="input"
              value={formData.raidRole}
              onChange={(e) => setFormData({...formData, raidRole: e.target.value})}
            >
              <option>Tank</option>
              <option>Healer</option>
              <option>DPS</option>
            </select>
          </div>


          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
