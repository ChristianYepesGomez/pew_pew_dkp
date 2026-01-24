import { useState } from 'react';
import { authAPI } from '../../services/api';

export default function ChangePasswordModal({ onClose, onSuccess, lang = 'es' }) {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validations
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError(lang === 'es' ? 'Por favor completa todos los campos' : 'Please fill all fields');
      setLoading(false);
      return;
    }

    if (formData.newPassword.length < 6) {
      setError(lang === 'es' ? 'La nueva contraseña debe tener al menos 6 caracteres' : 'New password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError(lang === 'es' ? 'Las contraseñas no coinciden' : 'Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await authAPI.changePassword(formData.currentPassword, formData.newPassword);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || (lang === 'es' ? 'Error al cambiar la contraseña' : 'Error changing password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fas fa-key"></i> {lang === 'es' ? 'Cambiar Contraseña' : 'Change Password'}
          </h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>
              <i className="fas fa-lock"></i> {lang === 'es' ? 'Contraseña Actual' : 'Current Password'}
            </label>
            <input
              type="password"
              className="input"
              value={formData.currentPassword}
              onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-key"></i> {lang === 'es' ? 'Nueva Contraseña' : 'New Password'}
            </label>
            <input
              type="password"
              className="input"
              value={formData.newPassword}
              onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
              required
              minLength={6}
            />
            <small style={{ color: '#888', fontSize: '0.85rem' }}>
              {lang === 'es' ? 'Mínimo 6 caracteres' : 'Minimum 6 characters'}
            </small>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-check-circle"></i> {lang === 'es' ? 'Confirmar Nueva Contraseña' : 'Confirm New Password'}
            </label>
            <input
              type="password"
              className="input"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              required
              minLength={6}
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (lang === 'es' ? 'Cambiando...' : 'Changing...') : (lang === 'es' ? 'Cambiar Contraseña' : 'Change Password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
