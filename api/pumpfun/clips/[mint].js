// Vercel serverless function for PumpFun livestream clips API
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
    const { mint } = req.query;
    const limit = req.query.limit || '2';
    const clipType = req.query.clipType || 'HIGHLIGHT';

    if (!mint) {
      return res.status(400).json({ error: 'Missing mint parameter' });
    }

    console.log(`🔍 Fetching PumpFun clips for mint: ${mint}, limit: ${limit}, type: ${clipType}`);

    // Fetch from PumpFun livestream API
    const response = await fetch(`https://livestream-api.pump.fun/clips/${mint}?limit=${limit}&clipType=${clipType}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://pump.fun/'
      }
    });

    if (!response.ok) {
      throw new Error(`PumpFun clips API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Successfully fetched PumpFun clips for ${mint}`);

    res.status(200).json(data);

  } catch (error) {
    console.error('PumpFun clips API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch PumpFun clips',
      details: error.message
    });
  }
}
