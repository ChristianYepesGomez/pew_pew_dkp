import { useState, useEffect } from 'react';
import { calendarAPI } from '../../services/api';
import './CalendarTab.css';

export default function CalendarTab({ user, lang = 'es' }) {
  const [availability, setAvailability] = useState([]);
  const [weekStart, setWeekStart] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'cards'
  const [loading, setLoading] = useState(true);
  const [weekOverview, setWeekOverview] = useState(null);

  useEffect(() => {
    initCalendar();
  }, []);

  const initCalendar = () => {
    const today = new Date();
    const monday = getMonday(today);
    setWeekStart(formatDate(monday));
  };

  useEffect(() => {
    if (weekStart) {
      loadAvailability();
      if (user.role === 'admin' || user.role === 'officer') {
        loadWeekOverview();
      }
    }
  }, [weekStart]);

  const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const response = await calendarAPI.getMyAvailability(weekStart);
      setAvailability(response.data);
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeekOverview = async () => {
    try {
      const response = await calendarAPI.getWeekOverview(weekStart);
      setWeekOverview(response.data);
    } catch (error) {
      console.error('Error loading week overview:', error);
    }
  };

  const updateAvailability = async (dayOfWeek, status) => {
    try {
      await calendarAPI.updateAvailability(weekStart, dayOfWeek, status);
      loadAvailability();
      if (user.role === 'admin' || user.role === 'officer') {
        loadWeekOverview();
      }
    } catch (error) {
      console.error('Error updating availability:', error);
    }
  };

  const navigateWeek = (direction) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + (direction * 7));
    setWeekStart(formatDate(date));
  };

  const getDKPEarned = () => {
    return availability.filter(d => d.status === 'confirmed').length;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return 'fa-check-circle';
      case 'declined': return 'fa-times-circle';
      case 'tentative': return 'fa-question-circle';
      default: return 'fa-calendar';
    }
  };

  const getStatusText = (status) => {
    const texts = {
      confirmed: lang === 'es' ? 'Confirmado' : 'Confirmed',
      declined: lang === 'es' ? 'Rechazado' : 'Declined',
      tentative: lang === 'es' ? 'Tentativo' : 'Tentative',
      default: lang === 'es' ? 'Click para confirmar' : 'Click to confirm'
    };
    return texts[status] || texts.default;
  };

  if (loading) {
    return <div className="loading">{lang === 'es' ? 'Cargando...' : 'Loading...'}</div>;
  }

  const confirmedDays = availability.filter(d => d.status === 'confirmed').length;
  const totalDays = availability.length;
  const progressPercentage = (confirmedDays / totalDays) * 100;

  return (
    <div className="calendar-container">
      {/* Header with navigation */}
      <div className="calendar-header">
        <div className="calendar-controls">
          <button className="btn btn-sm" onClick={() => navigateWeek(-1)}>
            <i className="fas fa-chevron-left"></i>
          </button>
          <span className="week-display">
            {new Date(weekStart).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US')}
          </span>
          <button className="btn btn-sm" onClick={() => navigateWeek(1)}>
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>

        <select
          className="view-selector"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
        >
          <option value="week">{lang === 'es' ? 'Vista Semanal' : 'Week View'}</option>
          <option value="cards">{lang === 'es' ? 'Vista Tarjetas' : 'Card View'}</option>
        </select>
      </div>

      {/* DKP Progress Bar */}
      <div className="dkp-progress-container">
        <div className="dkp-progress-header">
          <span>
            <i className="fas fa-trophy"></i> {lang === 'es' ? 'Esta semana' : 'This week'}
          </span>
          <span className="dkp-earned">
            {getDKPEarned()} DKP {lang === 'es' ? 'ganados' : 'earned'}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          >
            {confirmedDays}/{totalDays}
          </div>
        </div>
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="week-view-grid">
          {availability.map(day => (
            <div
              key={day.dayOfWeek}
              className={`week-day-card ${day.status || ''}`}
              onClick={() => updateAvailability(day.dayOfWeek, 'confirmed')}
            >
              <div className="day-badge">{day.dayName}</div>
              <div className="day-icon">
                <i className={`fas ${getStatusIcon(day.status)}`}></i>
              </div>
              <div className="day-status">{getStatusText(day.status)}</div>
              {day.status === 'confirmed' && (
                <div className="dkp-badge">+1 DKP</div>
              )}
              <div className="raid-time">
                <i className="fas fa-clock"></i> {day.raidTime}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="cards-view-grid">
          {availability.map(day => (
            <div key={day.dayOfWeek} className="raid-day-card">
              <div className="card-header">
                <div className="day-badge-large">{day.dayName.substring(0, 3).toUpperCase()}</div>
                <div className="raid-time">
                  <i className="fas fa-clock"></i> {day.raidTime}
                </div>
              </div>
              <div className="card-actions">
                <button
                  className={`action-btn confirm ${day.status === 'confirmed' ? 'active' : ''}`}
                  onClick={() => updateAvailability(day.dayOfWeek, 'confirmed')}
                >
                  <i className="fas fa-check-circle"></i>
                  <span>{lang === 'es' ? 'Asistiré' : 'Confirmed'}</span>
                  <span className="dkp-indicator">+1 DKP</span>
                </button>
                <button
                  className={`action-btn tentative ${day.status === 'tentative' ? 'active' : ''}`}
                  onClick={() => updateAvailability(day.dayOfWeek, 'tentative')}
                >
                  <i className="fas fa-question-circle"></i>
                  <span>{lang === 'es' ? 'Tentativo' : 'Tentative'}</span>
                </button>
                <button
                  className={`action-btn decline ${day.status === 'declined' ? 'active' : ''}`}
                  onClick={() => updateAvailability(day.dayOfWeek, 'declined')}
                >
                  <i className="fas fa-times-circle"></i>
                  <span>{lang === 'es' ? 'No asistiré' : 'Declined'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Overview */}
      {(user.role === 'admin' || user.role === 'officer') && weekOverview && (
        <div className="week-overview">
          <h4>{lang === 'es' ? 'Resumen de Asistencia' : 'Attendance Overview'}</h4>
          <div className="overview-summary">
            {weekOverview.raidDays && weekOverview.raidDays.map(day => (
              <div key={day.dayOfWeek} className="day-summary">
                <div className="summary-count">{day.confirmed}</div>
                <div className="summary-label">
                  {day.dayName} - {lang === 'es' ? 'confirmados' : 'confirmed'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
