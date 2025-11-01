// Vercel serverless function for receiving Helius webhooks
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = req.body;
    
    // Process the webhook data
    console.log('?? Received Helius webhook:', {
      type: webhookData.type,
      signature: webhookData.signature,
      hasTokenTransfers: !!webhookData.tokenTransfers,
      tokenTransferCount: webhookData.tokenTransfers?.length || 0
    });

    // Handle array of webhook events (Helius can send multiple events)
    const events = Array.isArray(webhookData) ? webhookData : [webhookData];

    for (const event of events) {
      const { type, signature, slot, timestamp, nativeTransfers, tokenTransfers } = event;
      
      // Process SWAP transactions
      if (type === 'SWAP' && tokenTransfers && tokenTransfers.length > 0) {
        for (const transfer of tokenTransfers) {
          // Extract trade details
          const tradeData = {
            signature,
            slot,
            timestamp: timestamp || new Date().toISOString(),
            mint: transfer.mint,
            fromUser: transfer.fromUserAccount,
            toUser: transfer.toUserAccount,
            tokenAmount: transfer.tokenAmount,
            tokenAmountString: transfer.tokenAmountString,
            decimals: transfer.tokenAmounts?.length > 0 ? transfer.tokenAmounts[0]?.decimals : 9,
            isBuy: transfer.fromUserAccount === '11111111111111111111111111111111', // System program indicates buy
            wallet: transfer.fromUserAccount === '11111111111111111111111111111111' 
              ? transfer.toUserAccount 
              : transfer.fromUserAccount,
            type: 'SWAP'
          };

          console.log('?? Trade detected:', {
            mint: tradeData.mint,
            wallet: tradeData.wallet,
            isBuy: tradeData.isBuy,
            tokenAmount: tradeData.tokenAmountString || tradeData.tokenAmount,
            signature: tradeData.signature
          });

          // Store transaction in database if needed
          // TODO: Add database storage here if you want to persist transactions
          
          // The webhook data will be used by the frontend via polling or WebSocket
          // For real-time updates, you would need to emit this via Socket.IO
          // However, since this is a serverless function, you might need a separate
          // service to handle WebSocket connections
        }
      }
      
      // Process regular token transfers (not SWAPs)
      if (type === 'TOKEN_TRANSFER' && tokenTransfers && tokenTransfers.length > 0) {
        for (const transfer of tokenTransfers) {
          const transferData = {
            signature,
            slot,
            timestamp: timestamp || new Date().toISOString(),
            mint: transfer.mint,
            fromUser: transfer.fromUserAccount,
            toUser: transfer.toUserAccount,
            tokenAmount: transfer.tokenAmount,
            tokenAmountString: transfer.tokenAmountString,
            decimals: transfer.tokenAmounts?.length > 0 ? transfer.tokenAmounts[0]?.decimals : 9,
            type: 'TOKEN_TRANSFER'
          };

          console.log('?? Token transfer detected:', {
            mint: transferData.mint,
            from: transferData.fromUser,
            to: transferData.toUser,
            amount: transferData.tokenAmountString || transferData.tokenAmount,
            signature: transferData.signature
          });
        }
      }
    }

    res.status(200).json({ 
      success: true,
      processed: events.length,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('? Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}
