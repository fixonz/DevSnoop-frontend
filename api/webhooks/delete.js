// Vercel serverless function for deleting webhooks
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

    // In production, you would look up the webhook ID from your database
    // For now, we'll return success (you'll need to implement proper webhook management)
    console.log('Webhook deletion requested for:', { userId, tokenMint });

    res.status(200).json({ 
      success: true, 
      message: 'Webhook deletion requested' 
    });

  } catch (error) {
    console.error('Webhook deletion error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
