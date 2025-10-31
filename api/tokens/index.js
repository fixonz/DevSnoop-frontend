// Vercel API route: /api/tokens
import { tokenQueries } from '../lib/dbQueries.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { mint, symbol, name, image, price, marketCap, priceChange24h, totalHolders, volume24h } = req.body;
      
      if (!mint) {
        return res.status(400).json({ error: 'Token mint address is required' });
      }

      // Check if token exists
      const existingToken = await tokenQueries.getByMint(mint);

      if (existingToken) {
        // Update existing token
        const updated = await tokenQueries.update(existingToken.id, {
          symbol: symbol || existingToken.symbol,
          name: name || existingToken.name,
          imageUrl: image || existingToken.imageUrl,
          price: price !== undefined ? price : existingToken.price,
          marketCap: marketCap !== undefined ? marketCap : existingToken.marketCap,
          priceChange24h: priceChange24h !== undefined ? priceChange24h : existingToken.priceChange24h,
          holdersCount: totalHolders !== undefined ? totalHolders : existingToken.holdersCount,
          volume24h: volume24h !== undefined ? volume24h : existingToken.volume24h,
          updatedAt: new Date()
        });

        res.json(updated);
      } else {
        // Create new token
        const newToken = await tokenQueries.create({
          mint,
          devWallet: mint.slice(0, 8) + '...',
          symbol: symbol || null,
          name: name || null,
          imageUrl: image || null,
          price: price || null,
          marketCap: marketCap || null,
          priceChange24h: priceChange24h || null,
          holdersCount: totalHolders || 0,
          volume24h: volume24h || null,
          traceStatus: 'pending'
        });

        res.status(201).json(newToken);
      }
    } catch (error) {
      console.error('Error creating token:', error);
      res.status(500).json({ error: 'Failed to create token' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
