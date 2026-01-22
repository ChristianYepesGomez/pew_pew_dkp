import { useState, useEffect } from 'react';
import { dkpAPI } from '../../services/api';

export default function HistoryTab({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      const response = await dkpAPI.getHistory(user.id);
      setHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="loader"></div></div>;
  }

  return (
    <div className="tab-content active">
      <div className="content-header">
        <h2>DKP History</h2>
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#8b8d98' }}>
            No history records found
          </p>
        ) : (
          history.map((item) => (
            <div key={item.id} className="history-item">
              <span className="history-date">
                {new Date(item.createdAt).toLocaleString()}
              </span>
              <span className="history-user">
                {item.characterName || item.username}
              </span>
              <span className="history-action">{item.reason}</span>
              <span className="history-item-name">{item.description || '-'}</span>
              <span className={`history-amount ${item.amount >= 0 ? 'positive' : 'negative'}`}>
                {item.amount >= 0 ? '+' : ''}{item.amount} DKP
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
