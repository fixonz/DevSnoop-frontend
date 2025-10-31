// Vercel serverless function for receiving Helius webhooks
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = req.body;
    
    // Process the webhook data
    console.log('Received Helius webhook:', webhookData);

    // Extract trade information
    const { type, signature, slot, timestamp, nativeTransfers, tokenTransfers } = webhookData;
    
    if (type === 'SWAP' && tokenTransfers && tokenTransfers.length > 0) {
      const transfer = tokenTransfers[0];
      
      // Extract trade details
      const tradeData = {
        signature,
        slot,
        timestamp,
        mint: transfer.mint,
        fromUser: transfer.fromUserAccount,
        toUser: transfer.toUserAccount,
        tokenAmount: transfer.tokenAmount,
        isBuy: transfer.fromUserAccount === '11111111111111111111111111111111', // System program
        wallet: transfer.fromUserAccount === '11111111111111111111111111111111' ? transfer.toUserAccount : transfer.fromUserAccount
      };

      // Emit to Socket.IO room (you'll need to implement this)
      // For now, just log the trade
      console.log('Trade detected:', tradeData);

      // You can emit this to your frontend via Socket.IO or store in database
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
