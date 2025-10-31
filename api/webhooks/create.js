// Vercel serverless function for creating webhooks
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, tokenMint } = req.body;

    if (!userId || !tokenMint) {
      return res.status(400).json({ error: 'Missing userId or tokenMint' });
    }

    // Create webhook with Helius
    const heliusResponse = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookURL: `${process.env.VERCEL_URL || 'https://your-app.vercel.app'}/api/webhooks/helius`,
        transactionTypes: ['SWAP'],
        accountAddresses: [tokenMint],
        webhookType: 'enhanced'
      })
    });

    if (!heliusResponse.ok) {
      throw new Error(`Helius webhook creation failed: ${heliusResponse.statusText}`);
    }

    const webhookData = await heliusResponse.json();
    
    // Store webhook ID (in production, use a database)
    // For now, just return success
    console.log('Webhook created:', webhookData);

    res.status(200).json({ 
      success: true, 
      webhookId: webhookData.webhookID,
      message: 'Webhook created successfully' 
    });

  } catch (error) {
    console.error('Webhook creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
