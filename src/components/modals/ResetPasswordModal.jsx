import { useState } from 'react';
import { authAPI } from '../../services/api';

export default function ResetPasswordModal({ userId, characterName, onClose, onSuccess, lang = 'es' }) {
  const [newPassword, setNewPassword] = useState(`${characterName}_pewpew`);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (newPassword.length < 6) {
      setError(lang === 'es' ? 'La contraseña debe tener al menos 6 caracteres' : 'Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await authAPI.resetPassword(userId, newPassword);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || (lang === 'es' ? 'Error al resetear la contraseña' : 'Error resetting password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fas fa-key"></i> {lang === 'es' ? 'Resetear Contraseña' : 'Reset Password'}
          </h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="alert alert-warning" style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '5px' }}>
          <i className="fas fa-exclamation-triangle"></i>{' '}
          {lang === 'es'
            ? `Vas a resetear la contraseña de ${characterName}`
            : `You are about to reset the password for ${characterName}`}
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>
              <i className="fas fa-key"></i> {lang === 'es' ? 'Nueva Contraseña' : 'New Password'}
            </label>
            <input
              type="text"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
            <small style={{ color: '#888', fontSize: '0.85rem' }}>
              {lang === 'es'
                ? 'Por defecto: nombre_pewpew. El usuario puede cambiarla después.'
                : 'Default: name_pewpew. User can change it later.'}
            </small>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-warning" disabled={loading}>
              {loading ? (lang === 'es' ? 'Reseteando...' : 'Resetting...') : (lang === 'es' ? 'Resetear Contraseña' : 'Reset Password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
