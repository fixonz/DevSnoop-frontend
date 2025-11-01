// Vercel serverless function for receiving Helius webhooks
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookData = req.body;
    
    // Handle array of webhooks or single webhook
    const webhooks = Array.isArray(webhookData) ? webhookData : [webhookData];
    
    console.log(`?? Received ${webhooks.length} Helius webhook(s)`);

    for (const webhook of webhooks) {
      // Extract transaction information
      const { 
        type, 
        signature, 
        slot, 
        timestamp, 
        nativeTransfers = [], 
        tokenTransfers = [],
        accountData = [],
        description
      } = webhook;

      // Process SWAP transactions
      if (type === 'SWAP') {
        console.log(`?? Processing SWAP transaction: ${signature}`);
        
        // Process token transfers
        if (tokenTransfers && tokenTransfers.length > 0) {
          for (const transfer of tokenTransfers) {
            const tradeData = {
              signature,
              slot,
              timestamp: timestamp || Date.now(),
              mint: transfer.mint || transfer.tokenAddress,
              fromUser: transfer.fromUserAccount || transfer.fromTokenAccount,
              toUser: transfer.toUserAccount || transfer.toTokenAccount,
              tokenAmount: transfer.tokenAmount || transfer.amount,
              uiTokenAmount: transfer.uiTokenAmount || transfer.tokenAmount,
              tokenStandard: transfer.tokenStandard,
              isBuy: transfer.fromUserAccount === '11111111111111111111111111111111' || 
                     (transfer.fromTokenAccount && transfer.fromTokenAccount === '11111111111111111111111111111111'),
              wallet: transfer.fromUserAccount === '11111111111111111111111111111111' 
                ? (transfer.toUserAccount || transfer.toTokenAccount)
                : (transfer.fromUserAccount || transfer.fromTokenAccount),
              type: 'SWAP'
            };

            console.log('?? Token transfer detected:', tradeData);
            // Store or emit this data (Socket.IO, database, etc.)
          }
        }

        // Process native SOL transfers
        if (nativeTransfers && nativeTransfers.length > 0) {
          for (const transfer of nativeTransfers) {
            const solTransfer = {
              signature,
              timestamp: timestamp || Date.now(),
              from: transfer.fromUserAccount,
              to: transfer.toUserAccount,
              amount: transfer.amount,
              type: 'NATIVE_TRANSFER'
            };

            console.log('?? SOL transfer detected:', solTransfer);
          }
        }
      }

      // Process TOKEN_TRANSFER transactions
      if (type === 'TOKEN_TRANSFER' || type === 'TRANSFER') {
        console.log(`?? Processing TOKEN_TRANSFER: ${signature}`);
        
        if (tokenTransfers && tokenTransfers.length > 0) {
          for (const transfer of tokenTransfers) {
            const transferData = {
              signature,
              timestamp: timestamp || Date.now(),
              mint: transfer.mint || transfer.tokenAddress,
              from: transfer.fromUserAccount || transfer.fromTokenAccount,
              to: transfer.toUserAccount || transfer.toTokenAccount,
              tokenAmount: transfer.tokenAmount || transfer.amount,
              uiTokenAmount: transfer.uiTokenAmount,
              tokenStandard: transfer.tokenStandard,
              type: 'TOKEN_TRANSFER'
            };

            console.log('?? Token transfer detected:', transferData);
          }
        }
      }

      // Process any account data changes
      if (accountData && accountData.length > 0) {
        console.log(`?? Account data changes detected for ${accountData.length} account(s)`);
        // Process account balance changes, etc.
      }
    }

    res.status(200).json({ 
      success: true, 
      processed: webhooks.length,
      message: `Successfully processed ${webhooks.length} webhook(s)`
    });

  } catch (error) {
    console.error('? Webhook processing error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}
