// Rating service for frontend - GLOBAL WALLET RATINGS
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app';

// Rate a wallet (GLOBAL - no tokenId required)
export const rateWallet = async (raterAddress, targetAddress, rating, tokenId = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ratings/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raterAddress,
        targetAddress,
        rating,
        tokenId: null // Always null - ratings are global, not token-specific
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rate wallet');
    }

    return await response.json();
  } catch (error) {
    console.error('Error rating wallet:', error);
    throw error;
  }
};

// Get wallet reputation (GLOBAL - applies to all tokens)
export const getWalletReputation = async (walletAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ratings/reputation/${walletAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch wallet reputation');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching wallet reputation:', error);
    return {
      address: walletAddress,
      rating: 0,
      totalRatings: 0,
      breakdown: {},
      confidence: 0,
      lastUpdated: Date.now()
    };
  }
};

export const getWalletRating = async (walletAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ratings/wallet/${walletAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch wallet rating');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching wallet rating:', error);
    return {
      address: walletAddress,
      ratings: [],
      totalRatings: 0,
      averageRating: 0,
      lastUpdated: Date.now()
    };
  }
};

export const getTopRatedWallets = async (limit = 50) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ratings/top-rated?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch top rated wallets');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching top rated wallets:', error);
    return [];
  }
};

export const canRateWallet = async (raterAddress, targetAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ratings/can-rate/${raterAddress}/${targetAddress}`);
    
    if (!response.ok) {
      throw new Error('Failed to check rating eligibility');
    }

    const result = await response.json();
    return result.canRate;
  } catch (error) {
    console.error('Error checking rating eligibility:', error);
    return false;
  }
};

export const getRatingTypes = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ratings/types`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch rating types');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching rating types:', error);
    return {
      types: {},
      descriptions: {}
    };
  }
};
