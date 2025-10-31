// Vercel serverless function for PumpFun market activity API
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
    const { poolId } = req.query;

    if (!poolId) {
      return res.status(400).json({ error: 'Missing poolId parameter' });
    }

    // Fetch from PumpFun market activity API
    const response = await fetch(`https://swap-api.pump.fun/v1/pools/${poolId}/market-activity`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`PumpFun API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    res.status(200).json(data);

  } catch (error) {
    console.error('PumpFun market activity API proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market activity data',
      details: error.message 
    });
  }
}
