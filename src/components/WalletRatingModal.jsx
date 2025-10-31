import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { rateWallet, canRateWallet, getWalletReputation } from '../services/ratingService';

const RATING_TYPES = {
  LEGIT: 'legit',
  TROLL: 'troll', 
  FAKE: 'fake',
  DILIGENT: 'diligent',
  SUSPICIOUS: 'suspicious'
  // WHALE is auto-assigned, not user-voted
};

const RATING_DESCRIPTIONS = {
  [RATING_TYPES.LEGIT]: 'Genuine trader with real activity',
  [RATING_TYPES.DILIGENT]: 'Consistent and reliable trader',
  [RATING_TYPES.SUSPICIOUS]: 'Questionable activity or behavior',
  [RATING_TYPES.TROLL]: 'Disruptive or unhelpful behavior',
  [RATING_TYPES.FAKE]: 'Fake account or bot'
};

const WalletRatingModal = ({ 
  isOpen, 
  onClose, 
  targetWallet, 
  targetUsername, 
  tokenId, // Not used for global ratings, but kept for compatibility
  onRatingSubmit
}) => {
  const { ready, authenticated, login, user } = usePrivy();
  const [selectedRating, setSelectedRating] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [raterWallet, setRaterWallet] = useState(null);

  // Get wallet address from Privy user
  useEffect(() => {
    if (ready && authenticated && user) {
      // Get wallet address from Privy user
      const wallet = user.wallet?.address || user.linkedAccounts?.find(acc => acc.type === 'wallet')?.address;
      if (wallet) {
        setRaterWallet(wallet);
      }
    }
  }, [ready, authenticated, user]);

  useEffect(() => {
    if (isOpen && targetWallet && raterWallet) {
      checkCanRate();
      fetchReputation();
    }
  }, [isOpen, targetWallet, raterWallet]);

  const checkCanRate = async () => {
    try {
      const result = await canRateWallet(raterWallet, targetWallet);
      setCanRate(result);
    } catch (error) {
      console.error('Error checking rating eligibility:', error);
      setCanRate(false);
    }
  };

  const fetchReputation = async () => {
    try {
      const rep = await getWalletReputation(targetWallet);
      setReputation(rep);
    } catch (error) {
      console.error('Error fetching reputation:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRating || !canRate || !raterWallet) return;

    try {
      setIsSubmitting(true);
      
      // Use global rating (tokenId is null for global ratings)
      const result = await rateWallet(raterWallet, targetWallet, selectedRating, null);
      
      if (onRatingSubmit) {
        await onRatingSubmit(raterWallet, targetWallet, selectedRating);
      }
      
      // Refresh reputation
      await fetchReputation();
      
      alert('✅ Global wallet rating submitted successfully!');
      setSelectedRating('');
      onClose();
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Error logging in:', error);
      alert('Failed to login. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Rate Wallet (Global)</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Authentication check */}
        {!ready ? (
          <div className="text-center py-4">
            <div className="text-zinc-400">Loading...</div>
          </div>
        ) : !authenticated ? (
          <div className="text-center py-4">
            <div className="text-zinc-400 mb-4">Please login to rate wallets</div>
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Login with Privy
            </button>
          </div>
        ) : !raterWallet ? (
          <div className="text-center py-4">
            <div className="text-zinc-400 mb-4">Please connect a wallet to rate</div>
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {/* Target wallet info */}
            <div className="mb-4">
              <div className="text-sm text-zinc-400 mb-1">Rating Wallet:</div>
              <div className="text-white font-mono text-sm">
                {targetUsername || targetWallet.slice(0, 8) + '...'}
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                {targetWallet}
              </div>
              <div className="text-xs text-purple-400 mt-2">
                ⭐ This rating applies globally across all tokens
              </div>
            </div>

            {/* Current reputation */}
            {reputation && reputation.totalRatings > 0 && (
              <div className="mb-4 p-3 bg-zinc-800 rounded">
                <div className="text-sm text-zinc-400 mb-2">Current Global Reputation:</div>
                <div className="text-white">
                  {reputation.totalRatings} rating{reputation.totalRatings !== 1 ? 's' : ''} 
                  {reputation.confidence && ` (Confidence: ${(reputation.confidence * 100).toFixed(0)}%)`}
                </div>
              </div>
            )}

            {/* Rating options */}
            {canRate ? (
              <div className="space-y-3">
                <div className="text-sm text-zinc-400 mb-2">Select rating:</div>
                {Object.entries(RATING_TYPES).map(([key, value]) => (
                  <label key={value} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={selectedRating === value}
                      onChange={(e) => setSelectedRating(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {key.charAt(0) + key.slice(1).toLowerCase()}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {RATING_DESCRIPTIONS[value]}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-zinc-400 mb-2">
                  {reputation && reputation.ratings?.some(r => r.rater === raterWallet) 
                    ? 'You have already rated this wallet globally'
                    : 'Cannot rate this wallet'
                  }
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              {canRate && (
                <button
                  onClick={handleSubmit}
                  disabled={!selectedRating || isSubmitting}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Rating'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletRatingModal;
