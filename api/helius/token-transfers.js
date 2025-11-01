// Vercel serverless function for Helius token transfers by mint
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
    const { mint, wallet, limit = '100' } = req.query;
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '10d64fda-22a9-4d18-9209-712683742a1d';
    
    if (!mint) {
      return res.status(400).json({ error: 'Missing mint parameter' });
    }

    let url;
    if (wallet) {
      // Fetch transfers for a specific wallet and mint
      url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}&type=TRANSFER`;
    } else {
      // Fetch all transfers for a mint using token metadata
      url = `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`;
    }

    console.log(`?? Fetching Helius token transfers for mint: ${mint}${wallet ? `, wallet: ${wallet}` : ''}`);
    
    const response = await fetch(url, {
      method: wallet ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: wallet ? undefined : JSON.stringify({
        mintAccounts: [mint]
      })
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }

    let data = await response.json();
    
    // If fetching by wallet, filter for the specific mint
    if (wallet && data && Array.isArray(data)) {
      data = data.filter(tx => 
        tx.tokenTransfers?.some(transfer => transfer.mint === mint)
      );
    }

    console.log(`? Successfully fetched Helius token transfers for ${mint}`);

    res.status(200).json(data);

  } catch (error) {
    console.error('Helius token transfers API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch token transfers',
      details: error.message
    });
  }
}
