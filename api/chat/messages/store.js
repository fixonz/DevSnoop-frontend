// Vercel API route: /api/chat/messages - handles both storing and fetching messages
import { chatMessageQueries } from '../../lib/dbQueries.js';

export default async function handler(req, res) {
  // Handle GET requests for fetching messages
  if (req.method === 'GET') {
    try {
      const { tokenId } = req.query;
      const { limit = 100 } = req.query;
      
      if (!tokenId) {
        return res.status(400).json({ error: 'Token ID is required' });
      }

      const messages = await chatMessageQueries.getByTokenId(tokenId, parseInt(limit));
      res.status(200).json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
  // Handle POST requests for storing messages
  else if (req.method === 'POST') {
    try {
      const messageData = req.body;
      
      if (!messageData.tokenId || !messageData.message) {
        return res.status(400).json({ error: 'Token ID and message are required' });
      }

      const message = await chatMessageQueries.create({
        roomId: messageData.roomId || messageData.tokenId,
        message: messageData.message,
        tokenId: messageData.tokenId,
        username: messageData.username || 'Anonymous',
        timestamp: messageData.timestamp || Date.now().toString(),
        messageType: messageData.messageType || 'REGULAR',
        userAddress: messageData.userAddress || null,
        profileImage: messageData.profileImage || null,
        swapData: messageData.swapData || null,
        isFirstBuyer: messageData.isFirstBuyer || false,
        isTopHolder: messageData.isTopHolder || false,
        holderRank: messageData.holderRank || null
      });

      res.status(201).json(message);
    } catch (error) {
      console.error('Error storing message:', error);
      res.status(500).json({ error: 'Failed to store message' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}