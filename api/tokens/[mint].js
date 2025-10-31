// Vercel API route: /api/tokens/[mint]
import { tokenQueries } from '../../lib/dbQueries.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { mint } = req.query;
      
      if (!mint) {
        return res.status(400).json({ error: 'Token mint address is required' });
      }

      let token = await tokenQueries.getByMint(mint);
      
      if (!token) {
        // Return a default token structure if not found
        token = {
          mint: mint,
          symbol: null,
          name: null,
          imageUrl: null,
          price: null,
          marketCap: null,
          priceChange24h: null,
          holdersCount: 0,
          volume24h: null,
          riskScore: 0,
          tokenAnalysis: {}
        };
      } else {
        // Format response to match frontend expectations
        token = {
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          image: token.imageUrl,
          price: token.price ? parseFloat(token.price) : null,
          marketCap: token.marketCap ? parseFloat(token.marketCap) : null,
          priceChange24h: token.priceChange24h ? parseFloat(token.priceChange24h) : null,
          totalHolders: token.holdersCount || 0,
          volume24h: token.volume24h ? parseFloat(token.volume24h) : null,
          riskScore: token.riskScore || 0,
          tokenAnalysis: token.tokenAnalysis || {}
        };
      }
      
      res.status(200).json(token);
    } catch (error) {
      console.error('Error fetching token:', error);
      res.status(500).json({ error: 'Failed to fetch token' });
    }
  } else if (req.method === 'POST') {
    try {
      const { mint } = req.query;
      const tokenData = req.body;
      
      if (!mint) {
        return res.status(400).json({ error: 'Token mint address is required' });
      }

      // Check if token exists
      const existingToken = await tokenQueries.getByMint(mint);

      if (existingToken) {
        // Update existing token
        const updated = await tokenQueries.update(existingToken.id, {
          symbol: tokenData.symbol || existingToken.symbol,
          name: tokenData.name || existingToken.name,
          imageUrl: tokenData.image || existingToken.imageUrl,
          price: tokenData.price !== undefined ? tokenData.price : existingToken.price,
          marketCap: tokenData.marketCap !== undefined ? tokenData.marketCap : existingToken.marketCap,
          priceChange24h: tokenData.priceChange24h !== undefined ? tokenData.priceChange24h : existingToken.priceChange24h,
          holdersCount: tokenData.totalHolders !== undefined ? tokenData.totalHolders : existingToken.holdersCount,
          volume24h: tokenData.volume24h !== undefined ? tokenData.volume24h : existingToken.volume24h,
          updatedAt: new Date()
        });

        res.json(updated);
      } else {
        // Create new token
        const newToken = await tokenQueries.create({
          mint,
          devWallet: tokenData.devWallet || mint.slice(0, 8) + '...',
          symbol: tokenData.symbol || null,
          name: tokenData.name || null,
          imageUrl: tokenData.image || null,
          price: tokenData.price || null,
          marketCap: tokenData.marketCap || null,
          priceChange24h: tokenData.priceChange24h || null,
          holdersCount: tokenData.totalHolders || 0,
          volume24h: tokenData.volume24h || null,
          traceStatus: 'pending'
        });

        res.status(201).json(newToken);
      }
    } catch (error) {
      console.error('Error updating token:', error);
      res.status(500).json({ error: 'Failed to update token' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
