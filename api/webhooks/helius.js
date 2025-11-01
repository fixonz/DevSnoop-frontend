// Vercel serverless function for receiving Helius webhooks
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = Array.isArray(req.body) ? req.body : [req.body];
    
    console.log(`?? Received Helius webhook with ${webhookData.length} transaction(s)`);

    // Process each transaction in the webhook
    for (const transaction of webhookData) {
      const { type, signature, slot, timestamp, nativeTransfers, tokenTransfers, accountData } = transaction;
      
      // Process SWAP transactions
      if (type === 'SWAP' || (tokenTransfers && tokenTransfers.length > 0)) {
        // Handle multiple token transfers
        for (const transfer of tokenTransfers || []) {
          const tradeData = {
            signature,
            slot,
            timestamp: timestamp || Math.floor(Date.now() / 1000),
            mint: transfer.mint,
            fromUser: transfer.fromUserAccount,
            toUser: transfer.toUserAccount,
            tokenAmount: transfer.tokenAmount,
            decimals: transfer.tokenAmountDecimal || 0,
            // Determine if it's a buy (minting) or sell (burning)
            isBuy: transfer.tokenAmount > 0 && transfer.toUserAccount !== '11111111111111111111111111111111',
            wallet: transfer.fromUserAccount === '11111111111111111111111111111111' 
              ? transfer.toUserAccount 
              : transfer.fromUserAccount,
            type: 'SWAP'
          };

          console.log('?? Trade detected:', {
            mint: tradeData.mint,
            wallet: tradeData.wallet,
            amount: tradeData.tokenAmount,
            isBuy: tradeData.isBuy
          });

          // Store transaction in database if needed
          // You can add Prisma queries here to store transactions
          // await transactionQueries.create(tradeData);
        }
      }

      // Process native SOL transfers
      if (nativeTransfers && nativeTransfers.length > 0) {
        for (const transfer of nativeTransfers) {
          console.log('?? Native transfer detected:', {
            signature,
            from: transfer.fromUserAccount,
            to: transfer.toUserAccount,
            amount: transfer.amount
          });
        }
      }

      // Process token transfers (general)
      if (tokenTransfers && tokenTransfers.length > 0) {
        for (const transfer of tokenTransfers) {
          if (type !== 'SWAP') {
            console.log('?? Token transfer detected:', {
              signature,
              mint: transfer.mint,
              from: transfer.fromUserAccount,
              to: transfer.toUserAccount,
              amount: transfer.tokenAmount
            });
          }
        }
      }
    }

    res.status(200).json({ 
      success: true,
      processed: webhookData.length 
    });

  } catch (error) {
    console.error('? Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}
