import { useState, useEffect } from 'react';
import { warcraftLogsAPI, usersAPI } from '../../services/api';

export default function AdminTab({ users, onUsersUpdate }) {
  const [wclUrl, setWclUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [wclError, setWclError] = useState('');
  const [wclSuccess, setWclSuccess] = useState('');
  const [configSuccess, setConfigSuccess] = useState('');
  const [wclHistory, setWclHistory] = useState([]);
  const [config, setConfig] = useState({});
  const [showAnomalies, setShowAnomalies] = useState(false);

  useEffect(() => {
    loadConfig();
    loadWCLHistory();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await warcraftLogsAPI.getConfig();
      setConfig(response.data.config);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadWCLHistory = async () => {
    try {
      const response = await warcraftLogsAPI.getHistory(10);
      setWclHistory(response.data);
    } catch (error) {
      console.error('Failed to load WCL history:', error);
    }
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    setWclError('');
    setWclSuccess('');
    setPreview(null);
    setProcessing(true);

    try {
      const response = await warcraftLogsAPI.preview(wclUrl);
      setPreview(response.data);
      setShowAnomalies(false);
    } catch (error) {
      setWclError(error.response?.data?.error || 'Failed to process log');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;

    setProcessing(true);
    setWclError('');

    try {
      await warcraftLogsAPI.confirm({
        reportCode: preview.report.code,
        reportTitle: preview.report.title,
        startTime: preview.report.startTime,
        endTime: preview.report.endTime,
        region: preview.report.region,
        guildName: preview.report.guildName,
        participants: preview.participants,
      });

      setWclSuccess(`DKP assigned! ${preview.summary.matched} players received ${preview.dkp_calculation.dkp_per_player} DKP.`);
      setPreview(null);
      setWclUrl('');
      loadWCLHistory();
      onUsersUpdate();
    } catch (error) {
      setWclError(error.response?.data?.error || 'Failed to confirm DKP assignment');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfigUpdate = async (key, value) => {
    try {
      await warcraftLogsAPI.updateConfig(key, value);
      loadConfig();
      setConfigSuccess('Configuration saved');
      setTimeout(() => setConfigSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to update config');
    }
  };

  return (
    <div className="tab-content active">
      <div className="admin-grid">

        <div className="admin-card">
          <h3>📊 Warcraft Logs</h3>
          <p className="card-description">Process raid logs and assign DKP automatically</p>

          {wclError && <div className="error-message">{wclError}</div>}
          {wclSuccess && <div className="success-message">{wclSuccess}</div>}

          <form onSubmit={handlePreview}>
            <input
              type="text"
              placeholder="Paste Warcraft Logs URL"
              className="input"
              value={wclUrl}
              onChange={(e) => setWclUrl(e.target.value)}
              disabled={processing}
            />
            <button type="submit" className="btn btn-primary" disabled={processing || !wclUrl}>
              {processing ? 'Processing...' : 'Process Log'}
            </button>
          </form>

          {preview && (
            <div className="wcl-preview">
              <h4>Preview: {preview.report.title}</h4>

              <div className="preview-summary">
                <div className="preview-stat">
                  <span className="stat-label">Participants:</span>
                  <span className="stat-value">{preview.report.participantCount}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">Bosses Killed:</span>
                  <span className="stat-value">{preview.report.bossesKilled || 0} / {preview.report.totalBosses || 0}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">DKP per player:</span>
                  <span className="stat-value green">{preview.dkp_calculation.dkp_per_player}</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">Matched:</span>
                  <span className="stat-value">{preview.summary.matched} / {preview.summary.total_participants}</span>
                </div>
              </div>

              {preview.anomalies && preview.anomalies.length > 0 && (
                <div className="anomalies-container">
                  <button
                    className="anomalies-toggle"
                    onClick={() => setShowAnomalies(!showAnomalies)}
                  >
                    ⚠️ {preview.anomalies.length} Anomalies Detected {showAnomalies ? '▲' : '▼'}
                  </button>
                  {showAnomalies && (
                    <div className="anomalies-list">
                      {preview.anomalies.map((anomaly, index) => (
                        <div key={index} className="anomaly-item">
                          <span className="anomaly-type">{anomaly.type}:</span>
                          <span className="anomaly-message">{anomaly.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="preview-actions">
                <button
                  className="btn btn-success"
                  onClick={handleConfirm}
                  disabled={processing}
                >
                  Confirm & Assign DKP
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPreview(null)}
                  disabled={processing}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="admin-card">
          <h3>± Manual Adjustment</h3>
          <p className="card-description">Adjust DKP for specific members</p>
          <select className="input">
            <option>Select member</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.characterName || user.username}
              </option>
            ))}
          </select>
          <div className="input-group">
            <input type="number" placeholder="Amount" className="input" />
            <input type="text" placeholder="Reason" className="input" />
          </div>
          <button className="btn btn-secondary">Apply</button>
        </div>

        <div className="admin-card">
          <h3>⚙️ Configuration</h3>
          <p className="card-description">DKP system settings</p>

          {configSuccess && <div className="success-message">{configSuccess}</div>}

          {config.raid_attendance_dkp && (
            <div className="config-item">
              <label>Base DKP per raid:</label>
              <input
                type="number"
                value={config.raid_attendance_dkp.value}
                onChange={(e) => handleConfigUpdate('raid_attendance_dkp', e.target.value)}
                className="input-small"
              />
            </div>
          )}

          {config.boss_kill_bonus && (
            <div className="config-item">
              <label>DKP per boss:</label>
              <input
                type="number"
                value={config.boss_kill_bonus.value}
                onChange={(e) => handleConfigUpdate('boss_kill_bonus', e.target.value)}
                className="input-small"
              />
            </div>
          )}
        </div>

        <div className="admin-card full-width">
          <h3>📜 Recent Processed Logs</h3>
          <div className="logs-list">
            {wclHistory.length === 0 ? (
              <p style={{ color: '#8b8d98', textAlign: 'center', padding: '1rem' }}>
                No logs processed yet
              </p>
            ) : (
              wclHistory.map((log) => (
                <div key={log.id} className="log-item">
                  <div>
                    <span className="log-title">{log.report_title}</span>
                    <span className="log-date"> - {new Date(log.processed_at).toLocaleDateString()}</span>
                  </div>
                  <span className="log-participants">{log.participants_count} participants</span>
                  <span className="log-dkp">+{log.dkp_assigned} DKP assigned</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
