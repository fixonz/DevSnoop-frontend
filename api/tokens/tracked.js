// Vercel API route: /api/tokens/tracked
import { trackedTokenQueries } from '../../lib/dbQueries.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const trackedTokens = await trackedTokenQueries.getAll();
      res.status(200).json(trackedTokens);
    } catch (error) {
      console.error('Error fetching tracked tokens:', error);
      res.status(500).json({ error: 'Failed to fetch tracked tokens' });
    }
  } else if (req.method === 'POST') {
    try {
      const { tokenAddress, addedBy } = req.body;
      
      if (!tokenAddress) {
        return res.status(400).json({ error: 'Token address is required' });
      }

      // Check if already tracked
      let trackedToken = await trackedTokenQueries.getByAddress(tokenAddress);
      
      if (trackedToken) {
        return res.json(trackedToken);
      }

      // Create new tracked token
      trackedToken = await trackedTokenQueries.create({
        tokenAddress,
        addedBy: addedBy || 'anonymous'
      });

      res.status(201).json(trackedToken);
    } catch (error) {
      console.error('Error adding tracked token:', error);
      res.status(500).json({ error: 'Failed to add tracked token' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { mint } = req.query;
      
      if (!mint) {
        return res.status(400).json({ error: 'Token mint is required' });
      }

      await trackedTokenQueries.delete(mint);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error removing tracked token:', error);
      res.status(500).json({ error: 'Failed to remove tracked token' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
