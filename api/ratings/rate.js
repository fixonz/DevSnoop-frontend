// Vercel API route: /api/ratings - handles both rating and reputation
import { walletRatingQueries, walletReputationQueries } from '../../lib/dbQueries.js';

// Helper function to verify Privy access token
async function verifyPrivyToken(accessToken) {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const privyAppSecret = process.env.PRIVY_APP_SECRET;
  if (!privyAppSecret) {
    // In development, allow requests without verification
    // In production, this should be required
    console.warn('PRIVY_APP_SECRET not set - skipping token verification');
    return true;
  }

  try {
    // Verify token with Privy API
    const response = await fetch('https://auth.privy.io/api/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${privyAppSecret}`
      },
      body: JSON.stringify({ token: accessToken })
    });

    if (!response.ok) {
      throw new Error('Invalid access token');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying Privy token:', error);
    throw new Error('Failed to verify authentication token');
  }
}

export default async function handler(req, res) {
  // Handle reputation GET requests
  if (req.method === 'GET') {
    try {
      const { walletAddress } = req.query;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }

      const reputation = await walletReputationQueries.getByAddress(walletAddress);
      
      if (!reputation) {
        return res.json({
          walletAddress,
          totalRatings: 0,
          averageRating: 0,
          confidence: 0,
          ratings: []
        });
      }

      // Get individual ratings for this wallet
      const ratings = await walletRatingQueries.getByTargetAddress(walletAddress);
      
      res.json({
        walletAddress: reputation.walletAddress,
        totalRatings: reputation.totalRatings,
        averageRating: parseFloat(reputation.averageRating),
        confidence: calculateConfidence(reputation.totalRatings),
        isWhale: reputation.isWhale,
        whaleScore: parseFloat(reputation.whaleScore),
        ratings: ratings.map(r => ({
          rater: r.raterAddress,
          rating: r.ratingType,
          confidence: r.confidenceScore,
          timestamp: r.createdAt
        }))
      });
    } catch (error) {
      console.error('Error fetching reputation:', error);
      res.status(500).json({ error: 'Failed to fetch reputation' });
    }
  }
  // Handle rating POST requests
  else if (req.method === 'POST') {
    try {
      // Verify Privy authentication token
      const accessToken = req.headers.authorization?.replace('Bearer ', '');
      if (accessToken) {
        try {
          await verifyPrivyToken(accessToken);
        } catch (error) {
          return res.status(401).json({ error: 'Invalid or expired authentication token' });
        }
      } else {
        // In production, require authentication
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({ error: 'Authentication required' });
        }
      }

      const { raterAddress, targetAddress, rating, tokenId } = req.body;

      if (!raterAddress || !targetAddress || !rating) {
        return res.status(400).json({ error: 'Rater address, target address, and rating are required' });
      }

      // Check if rater has already rated this wallet (globally)
      const existingRating = await walletRatingQueries.getByAddresses(raterAddress, targetAddress);
      if (existingRating) {
        return res.status(400).json({ error: 'You have already rated this wallet globally' });
      }

      // Create new rating in database (global - tokenContext is null)
      const newRating = await walletRatingQueries.create({
        raterAddress,
        targetAddress,
        ratingType: rating.toUpperCase(),
        confidenceScore: 50, // Default confidence
        tokenContext: null // Global ratings - no token context
      });

      // Update wallet reputation
      await updateWalletReputation(targetAddress, rating);

      res.status(201).json(newRating);
    } catch (error) {
      console.error('Error rating wallet:', error);
      res.status(500).json({ error: 'Failed to rate wallet' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Helper function to update wallet reputation
async function updateWalletReputation(walletAddress, rating) {
  try {
    // Get current reputation
    let reputation = await walletReputationQueries.getByAddress(walletAddress);
    
    if (!reputation) {
      // Create new reputation record
      reputation = {
        walletAddress,
        totalRatings: 0,
        legitCount: 0,
        trollCount: 0,
        fakeCount: 0,
        diligentCount: 0,
        suspiciousCount: 0,
        averageRating: 0,
        isWhale: false,
        whaleScore: 0
      };
    }

    // Update counts based on rating
    const ratingCounts = {
      LEGIT: 'legitCount',
      TROLL: 'trollCount', 
      FAKE: 'fakeCount',
      DILIGENT: 'diligentCount',
      SUSPICIOUS: 'suspiciousCount'
    };

    const countField = ratingCounts[rating.toUpperCase()];
    if (countField) {
      reputation[countField] = (reputation[countField] || 0) + 1;
    }

    // Update total ratings
    reputation.totalRatings = (reputation.totalRatings || 0) + 1;

    // Calculate new average rating (simplified scoring)
    const ratingScores = {
      LEGIT: 5,
      DILIGENT: 4,
      SUSPICIOUS: 2,
      TROLL: 1,
      FAKE: 0
    };

    const currentScore = (reputation.averageRating || 0) * (reputation.totalRatings - 1);
    const newScore = currentScore + (ratingScores[rating.toUpperCase()] || 0);
    reputation.averageRating = newScore / reputation.totalRatings;

    // Update whale status based on rating patterns
    if (reputation.legitCount > reputation.totalRatings * 0.7) {
      reputation.isWhale = true;
      reputation.whaleScore = Math.min(reputation.averageRating * 20, 100);
    }

    // Save updated reputation
    await walletReputationQueries.upsert(walletAddress, reputation);

  } catch (error) {
    console.error('Error updating wallet reputation:', error);
  }
}

// Helper function to calculate confidence based on number of ratings
function calculateConfidence(totalRatings) {
  if (totalRatings === 0) return 0;
  if (totalRatings === 1) return 0.3;
  if (totalRatings < 5) return 0.5;
  if (totalRatings < 10) return 0.7;
  if (totalRatings < 20) return 0.8;
  return 0.9;
}
