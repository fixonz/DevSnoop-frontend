import React, { useState, useEffect } from 'react';
import { getWalletReputation } from '../services/ratingService';

const ReputationBadge = ({ walletAddress, tokenId, className = '' }) => {
  const [reputation, setReputation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReputation = async () => {
      if (!walletAddress) return;
      
      try {
        setIsLoading(true);
        const rep = await getWalletReputation(walletAddress);
        setReputation(rep);
      } catch (error) {
        console.error('Error fetching reputation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReputation();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchReputation, 60000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (isLoading || !reputation || reputation.totalRatings === 0) {
    return null;
  }

  const { rating, totalRatings, breakdown, confidence, isWhale, whaleData } = reputation;

  // Determine primary badge based on highest count
  const getPrimaryBadge = () => {
    // If user is automatically detected as whale, show whale badge first
    if (isWhale) {
      return { 
        type: 'whale', 
        count: 1, 
        percentage: 100,
        isAutoAssigned: true 
      };
    }
    
    const sortedBreakdown = Object.entries(breakdown)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a);
    
    if (sortedBreakdown.length === 0) return null;
    
    const [type, count] = sortedBreakdown[0];
    return { 
      type, 
      count, 
      percentage: (count / totalRatings) * 100,
      isAutoAssigned: false 
    };
  };

  const primaryBadge = getPrimaryBadge();
  if (!primaryBadge) return null;

  const getBadgeConfig = (type) => {
    const configs = {
      legit: {
        text: '✅ LEGIT',
        style: {
          backgroundColor: '#10B981',
          color: 'white',
          border: '1px solid #059669'
        },
        tooltip: 'Verified legitimate trader'
      },
      whale: {
        text: '🐋 WHALE',
        style: {
          backgroundColor: '#3B82F6',
          color: 'white',
          border: '1px solid #2563EB'
        },
        tooltip: whaleData ? 
          `High volume trader - ${whaleData.totalSolVolume} SOL volume, ${whaleData.whaleScore}/100 whale score` :
          'High volume trader (auto-detected)'
      },
      diligent: {
        text: '💪 DILIGENT',
        style: {
          backgroundColor: '#8B5CF6',
          color: 'white',
          border: '1px solid #7C3AED'
        },
        tooltip: 'Consistent and reliable'
      },
      suspicious: {
        text: '⚠️ SUSPICIOUS',
        style: {
          backgroundColor: '#F59E0B',
          color: 'white',
          border: '1px solid #D97706'
        },
        tooltip: 'Questionable activity'
      },
      troll: {
        text: '🤡 TROLL',
        style: {
          backgroundColor: '#EF4444',
          color: 'white',
          border: '1px solid #DC2626'
        },
        tooltip: 'Disruptive behavior'
      },
      fake: {
        text: '🚫 FAKE',
        style: {
          backgroundColor: '#6B7280',
          color: 'white',
          border: '1px solid #4B5563'
        },
        tooltip: 'Fake account or bot'
      }
    };
    
    return configs[type] || configs.legit;
  };

  const badgeConfig = getBadgeConfig(primaryBadge.type);
  const confidenceLevel = confidence > 0.7 ? 'high' : confidence > 0.3 ? 'medium' : 'low';

  return (
    <div className={`reputation-badge ${className}`} style={{ display: 'inline-flex', gap: '4px', marginLeft: '4px' }}>
      {/* Primary reputation badge */}
      <div
        className="badge"
        style={{
          ...badgeConfig.style,
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'inline-block',
          cursor: 'help',
          position: 'relative'
        }}
        title={`${badgeConfig.tooltip} (${primaryBadge.percentage.toFixed(0)}% of ${totalRatings} votes)`}
      >
        {badgeConfig.text}
        
        {/* Confidence indicator */}
        <div
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: confidenceLevel === 'high' ? '#10B981' : 
                           confidenceLevel === 'medium' ? '#F59E0B' : '#EF4444',
            border: '1px solid white'
          }}
          title={`Confidence: ${(confidence * 100).toFixed(0)}%`}
        />
      </div>

      {/* Rating count badge */}
      {totalRatings > 1 && (
        <div
          className="rating-count"
          style={{
            backgroundColor: '#374151',
            color: 'white',
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: 'bold',
            display: 'inline-block',
            cursor: 'help'
          }}
          title={`${totalRatings} total ratings`}
        >
          {totalRatings}
        </div>
      )}
    </div>
  );
};

export default ReputationBadge;
