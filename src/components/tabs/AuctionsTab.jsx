import { useState, useEffect } from 'react';
import { auctionsAPI } from '../../services/api';

export default function AuctionsTab({ user }) {
  const [activeAuction, setActiveAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadActiveAuction();
  }, []);

  const loadActiveAuction = async () => {
    try {
      const response = await auctionsAPI.getActive();
      setActiveAuction(response.data.auction);
    } catch (error) {
      console.error('Failed to load auction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    setError('');

    const amount = parseInt(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid bid amount');
      return;
    }

    try {
      await auctionsAPI.placeBid(activeAuction.id, amount);
      setBidAmount('');
      loadActiveAuction();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to place bid');
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="loader"></div></div>;
  }

  return (
    <div className="tab-content active">
      <div className="content-header">
        <h2>Active Auction</h2>
        {(user.role === 'admin' || user.role === 'officer') && (
          <button className="btn btn-primary">+ Create Auction</button>
        )}
      </div>

      {!activeAuction ? (
        <div className="auction-empty">
          <p>No active auctions at the moment</p>
        </div>
      ) : (
        <div className="auction-active">
          <div className="auction-item">
            <div className="item-info">
              <span className="item-icon">⚔️</span>
              <div>
                <h3 className="item-name legendary">{activeAuction.itemName}</h3>
                <p className="item-meta">Minimum bid: {activeAuction.minimumBid} DKP</p>
              </div>
            </div>
          </div>

          {activeAuction.bids && activeAuction.bids.length > 0 && (
            <div className="bids-list">
              <h4>Current Bids</h4>
              {activeAuction.bids.map((bid, index) => (
                <div key={index} className="bid-item">
                  <span className="bidder">{bid.characterName || bid.username}</span>
                  <span className="bid-amount">{bid.amount} DKP</span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handlePlaceBid} className="bid-form">
            {error && <div className="error-message">{error}</div>}
            <input
              type="number"
              placeholder="Your bid"
              className="input"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              min={activeAuction.minimumBid}
            />
            <button type="submit" className="btn btn-success">
              Place Bid
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
