import { useState } from 'react';
import { usersAPI } from '../../services/api';

export default function AdjustDKPModal({ user, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const amountNum = parseInt(amount);
    if (isNaN(amountNum)) {
      setError('Invalid amount');
      setLoading(false);
      return;
    }

    try {
      await usersAPI.adjustDKP(user.id, amountNum, reason);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to adjust DKP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Adjust DKP - {user.characterName || user.username}</h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <p style={{ color: '#8b8d98', marginBottom: '1rem' }}>
          Current DKP: <strong style={{ color: '#ffd700' }}>{user.currentDkp || 0}</strong>
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Amount (use negative for deduction)</label>
            <input
              type="number"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50 or -25"
              required
            />
          </div>

          <div className="form-group">
            <label>Reason</label>
            <input
              type="text"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Manual adjustment"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-success" disabled={loading}>
              {loading ? 'Applying...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
