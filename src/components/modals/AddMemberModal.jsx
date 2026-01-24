import { useState, useEffect } from 'react';
import { authAPI } from '../../services/api';
import { WOW_CLASSES, getWowheadIcon } from '../../constants/wowClasses';
import { t } from '../../i18n';

export default function AddMemberModal({ onClose, onSuccess, lang = 'es' }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    characterName: '',
    characterClass: '',
    raidRole: '',
    spec: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableSpecs, setAvailableSpecs] = useState([]);

  // Auto-generate password when character name changes
  useEffect(() => {
    if (formData.characterName) {
      setFormData(prev => ({ ...prev, password: `${formData.characterName}_pewpew` }));
    }
  }, [formData.characterName]);

  // Update available specs when class changes
  const handleClassChange = (className) => {
    const specs = className ? Object.keys(WOW_CLASSES[className]?.specs || {}) : [];
    setAvailableSpecs(specs);

    setFormData(prev => ({
      ...prev,
      characterClass: className,
      spec: '',
      raidRole: ''
    }));
  };

  // Auto-select role when spec changes
  const handleSpecChange = (specName) => {
    const selectedClass = formData.characterClass;
    const role = selectedClass && specName ? WOW_CLASSES[selectedClass].specs[specName]?.role : '';

    setFormData(prev => ({
      ...prev,
      spec: specName,
      raidRole: role || prev.raidRole
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.characterClass || !formData.spec) {
      setError(lang === 'es' ? 'Por favor selecciona clase y especialización' : 'Please select class and specialization');
      setLoading(false);
      return;
    }

    try {
      await authAPI.register(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || (lang === 'es' ? 'Error al crear miembro' : 'Failed to create member'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{lang === 'es' ? 'Añadir Nuevo Miembro' : 'Add New Member'}</h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>{lang === 'es' ? 'Nombre de Usuario' : 'Username'}</label>
              <input
                type="text"
                className="input"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>{lang === 'es' ? 'Nombre del Personaje' : 'Character Name'}</label>
              <input
                type="text"
                className="input"
                value={formData.characterName}
                onChange={(e) => setFormData({...formData, characterName: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>{lang === 'es' ? 'Contraseña' : 'Password'}</label>
            <input
              type="text"
              className="input"
              value={formData.password}
              readOnly
              style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
            />
            <small style={{ color: '#888', fontSize: '0.85rem' }}>
              {lang === 'es' ? 'Auto-generada como: nombre_pewpew' : 'Auto-generated as: name_pewpew'}
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <i className="fas fa-shield-alt"></i> {lang === 'es' ? 'Clase' : 'Class'}
              </label>
              <select
                className="input"
                value={formData.characterClass}
                onChange={(e) => handleClassChange(e.target.value)}
                required
              >
                <option value="">{lang === 'es' ? '-- Selecciona clase --' : '-- Select class --'}</option>
                {Object.keys(WOW_CLASSES).map(className => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                <i className="fas fa-star"></i> {lang === 'es' ? 'Especialización' : 'Specialization'}
              </label>
              <select
                className="input"
                value={formData.spec}
                onChange={(e) => handleSpecChange(e.target.value)}
                disabled={!formData.characterClass}
                required
              >
                <option value="">{lang === 'es' ? '-- Selecciona especialización --' : '-- Select specialization --'}</option>
                {availableSpecs.map(specName => (
                  <option key={specName} value={specName}>{specName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <i className="fas fa-users"></i> {lang === 'es' ? 'Rol de Raid' : 'Raid Role'}
            </label>
            <select
              className="input"
              value={formData.raidRole}
              onChange={(e) => setFormData({...formData, raidRole: e.target.value})}
              required
            >
              <option value="">{lang === 'es' ? '-- Auto (según spec) --' : '-- Auto (from spec) --'}</option>
              <option value="Tank">🛡️ Tank</option>
              <option value="Healer">✚ Healer</option>
              <option value="DPS">⚔️ DPS</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (lang === 'es' ? 'Creando...' : 'Creating...') : (lang === 'es' ? 'Crear Miembro' : 'Create Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
