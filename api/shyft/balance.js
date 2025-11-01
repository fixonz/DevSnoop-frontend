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
    const { wallet, token, network = 'mainnet-beta', type } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet parameter' });
    }

    const apiKey = process.env.SHYFT_API_KEY || process.env.VITE_SHYFT_API_KEY || 'dmLD1Y7HFOq_cDWV';
    let url;
    
    // Determine query type: if token is provided, fetch token balance; otherwise SOL balance
    if (token || type === 'token') {
      if (!token) {
        return res.status(400).json({ error: 'Missing token parameter for token balance query' });
      }
      
      console.log(`🔍 Fetching SHYFT token balance for wallet: ${wallet}, token: ${token}`);
      url = `https://api.shyft.to/sol/v1/wallet/token_balance?network=${network}&wallet=${wallet}&token=${token}`;
    } else {
      console.log(`🔍 Fetching SHYFT SOL balance for wallet: ${wallet}`);
      url = `https://api.shyft.to/sol/v1/wallet/balance?network=${network}&wallet=${wallet}`;
    }

    // Fetch from SHYFT API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SHYFT API error: ${response.status} ${response.statusText}`, errorText);
      
      // Return a structured error but still attempt to provide useful response
      if (response.status === 429) {
        return res.status(429).json({
          error: 'Rate limited',
          details: 'SHYFT API rate limit exceeded. Please try again later.',
          success: false
        });
      }
      
      throw new Error(`SHYFT API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Normalize response format
    const normalizedData = {
      success: true,
      result: data.result || data,
      // For token balance, ensure balance field exists
      ...(token ? {
        result: {
          balance: data.result?.balance || data.balance || 0,
          ...data.result
        }
      } : {})
    };
    
    console.log(`✅ Successfully fetched SHYFT ${token ? 'token' : 'wallet'} balance for ${wallet}`);

    res.status(200).json(normalizedData);

  } catch (error) {
    console.error('SHYFT balance API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch balance',
      details: error.message,
      success: false
    });
  }
}
