// Chat service for frontend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app';

export const getUserSwapActivity = async (userAddress, tokenId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/swap-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress,
        tokenId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch swap activity');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching swap activity:', error);
    return {
      isActiveTrader: false,
      recentSwaps: [],
      totalVolume: 0,
      lastAction: null,
      lastActionTime: null
    };
  }
};

export const getSwapAlerts = async (tokenId, limit = 20) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/swap-alerts/${tokenId}?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch swap alerts');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching swap alerts:', error);
    return [];
  }
};

export const subscribeToSwapAlerts = (tokenId, callback) => {
  // This would connect to your WebSocket for real-time updates
  // Implementation depends on your WebSocket setup
  console.log(`Subscribing to swap alerts for token: ${tokenId}`);
  
  // Mock implementation - replace with actual WebSocket connection
  return {
    unsubscribe: () => {
      console.log(`Unsubscribing from swap alerts for token: ${tokenId}`);
    }
  };
};
