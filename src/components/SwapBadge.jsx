import React, { useState, useEffect } from 'react';
import { getUserSwapActivity } from '../services/chatService';

const SwapBadge = ({ userAddress, tokenId, className = '' }) => {
  const [swapActivity, setSwapActivity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSwapActivity = async () => {
      if (!userAddress || !tokenId) return;
      
      try {
        setIsLoading(true);
        const activity = await getUserSwapActivity(userAddress, tokenId);
        setSwapActivity(activity);
      } catch (error) {
        console.error('Error fetching swap activity:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSwapActivity();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSwapActivity, 30000);
    return () => clearInterval(interval);
  }, [userAddress, tokenId]);

  if (isLoading || !swapActivity) {
    return null;
  }

  const { 
    lastAction, 
    lastActionTime, 
    isActiveTrader, 
    isFirstBuyer, 
    isTopHolder, 
    holderRank 
  } = swapActivity;
  
  // Don't show badge if no recent activity
  if (!lastAction || !lastActionTime) {
    return null;
  }

  // Check if activity is recent (within last 5 minutes)
  const isRecent = Date.now() - lastActionTime < 300000; // 5 minutes
  
  // Show badges even if not recent for special statuses
  const showBadges = isRecent || isFirstBuyer || isTopHolder;
  
  if (!showBadges) {
    return null;
  }

  const badges = [];

  // First buyer badge (always show if they are one)
  if (isFirstBuyer) {
    badges.push({
      text: '🥇 FIRST BUYER',
      style: {
        backgroundColor: '#F59E0B', // Gold
        color: 'white',
        border: '1px solid #D97706'
      },
      tooltip: 'First buyer of this token'
    });
  }

  // Top holder badge (always show if they are one)
  if (isTopHolder) {
    badges.push({
      text: `🏆 TOP ${holderRank || '10'} HOLDER`,
      style: {
        backgroundColor: '#8B5CF6', // Purple
        color: 'white',
        border: '1px solid #7C3AED'
      },
      tooltip: `Top ${holderRank || 10} holder of this token`
    });
  }

  // Recent trading badge
  if (isRecent && lastAction) {
    const getTradingBadge = () => {
      if (lastAction === 'buy') {
        return {
          text: '🟢 BUYING',
          style: {
            backgroundColor: '#10B981', // Green
            color: 'white',
            border: '1px solid #059669'
          }
        };
      } else if (lastAction === 'sell') {
        return {
          text: '🔴 SELLING',
          style: {
            backgroundColor: '#EF4444', // Red
            color: 'white',
            border: '1px solid #DC2626'
          }
        };
      }
      return {
        text: '⚪ TRADING',
        style: {
          backgroundColor: '#6B7280', // Gray
          color: 'white',
          border: '1px solid #4B5563'
        }
      };
    };

    const tradingBadge = getTradingBadge();
    const timeAgo = Math.floor((Date.now() - lastActionTime) / 1000);
    const timeText = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;
    
    badges.push({
      ...tradingBadge,
      tooltip: `${lastAction.toUpperCase()} detected ${timeText}`
    });
  }

  return (
    <div className={`badge-container ${className}`} style={{ display: 'inline-flex', gap: '4px', marginLeft: '4px' }}>
      {badges.map((badge, index) => (
        <div
          key={index}
          className="swap-badge"
          style={{
            ...badge.style,
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'inline-block',
            cursor: 'help',
            animation: isRecent ? 'pulse 2s infinite' : 'none'
          }}
          title={badge.tooltip}
        >
          {badge.text}
        </div>
      ))}
    </div>
  );
};

// CSS for pulse animation
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
  }
`;
document.head.appendChild(style);

export default SwapBadge;
