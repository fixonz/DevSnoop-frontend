// Vercel serverless function for receiving Helius webhooks
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = req.body;
    
    // Process the webhook data - Helius can send arrays of transactions
    const transactions = Array.isArray(webhookData) ? webhookData : [webhookData];
    
    console.log(`Received Helius webhook with ${transactions.length} transaction(s)`);

    // Process each transaction
    const processedTrades = [];
    
    for (const tx of transactions) {
      const { type, signature, slot, timestamp, nativeTransfers, tokenTransfers } = tx;
      
      // Handle SWAP transactions
      if (type === 'SWAP' && tokenTransfers && tokenTransfers.length > 0) {
        for (const transfer of tokenTransfers) {
          const tradeData = {
            signature,
            slot,
            timestamp,
            mint: transfer.mint,
            fromUser: transfer.fromUserAccount,
            toUser: transfer.toUserAccount,
            tokenAmount: transfer.tokenAmount,
            isBuy: transfer.fromUserAccount === '11111111111111111111111111111111' || 
                   transfer.fromUserAccount === 'So11111111111111111111111111111111111111112', // System program or wrapped SOL
            wallet: transfer.fromUserAccount === '11111111111111111111111111111111' || 
                    transfer.fromUserAccount === 'So11111111111111111111111111111111111111112' 
                      ? transfer.toUserAccount 
                      : transfer.fromUserAccount
          };
          
          processedTrades.push(tradeData);
          console.log('Trade detected:', tradeData);
        }
      }
      
      // Handle TRANSFER transactions
      if (type === 'TRANSFER' && tokenTransfers && tokenTransfers.length > 0) {
        for (const transfer of tokenTransfers) {
          const transferData = {
            signature,
            slot,
            timestamp,
            mint: transfer.mint,
            fromUser: transfer.fromUserAccount,
            toUser: transfer.toUserAccount,
            tokenAmount: transfer.tokenAmount,
            type: 'TRANSFER'
          };
          
          console.log('Token transfer detected:', transferData);
          // Process transfer if needed
        }
      }
    }

    // Here you could:
    // 1. Store in database
    // 2. Emit to Socket.IO rooms
    // 3. Trigger real-time updates

    res.status(200).json({ 
      success: true, 
      processed: processedTrades.length,
      trades: processedTrades 
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}
