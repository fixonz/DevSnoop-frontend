// Vercel serverless function for SHYFT API - handles both wallet and token balance
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wallet, token, network = 'mainnet-beta', type = 'wallet' } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet parameter' });
    }

    let url;
    if (type === 'token' && token) {
      console.log(`🔍 Fetching SHYFT token balance for wallet: ${wallet}, token: ${token}`);
      url = `https://api.shyft.to/sol/v1/wallet/token_balance?network=${network}&wallet=${wallet}&token=${token}`;
    } else {
      console.log(`🔍 Fetching SHYFT wallet balance for wallet: ${wallet}`);
      url = `https://api.shyft.to/sol/v1/wallet/balance?network=${network}&wallet=${wallet}`;
    }

    // Fetch from SHYFT API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': process.env.SHYFT_API_KEY || 'dmLD1Y7HFOq_cDWV'
      }
    });

    if (!response.ok) {
      throw new Error(`SHYFT API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched SHYFT ${type} balance for ${wallet}`);

    res.status(200).json(data);

  } catch (error) {
    console.error('SHYFT balance API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch balance',
      details: error.message
    });
  }
}
