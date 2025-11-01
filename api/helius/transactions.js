// Vercel serverless function for Helius API - handles token transfer and transaction queries
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
    const { wallet, mint, type = 'SWAP', limit = 100 } = req.query;
    const apiKey = process.env.HELIUS_API_KEY || '10d64fda-22a9-4d18-9209-712683742a1d';

    if (!wallet && !mint) {
      return res.status(400).json({ error: 'Missing wallet or mint parameter' });
    }

    let url;
    let method = 'GET';
    let body = null;
    
    if (wallet) {
      // Fetch transactions for a specific wallet
      url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${apiKey}&limit=${limit}`;
      if (type) {
        url += `&type=${type}`;
      }
    } else if (mint) {
      // Fetch token metadata
      url = `https://api.helius.xyz/v0/token-metadata?api-key=${apiKey}`;
      method = 'POST';
      body = JSON.stringify({
        mintAddresses: [mint]
      });
    } else {
      return res.status(400).json({ error: 'Either wallet or mint must be provided' });
    }

    console.log(`?? Fetching Helius transactions for ${wallet ? `wallet: ${wallet}` : `mint: ${mint}`}`);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body && { body })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Helius API error: ${response.status} - ${errorText}`);
      throw new Error(`Helius API error: ${response.status}`);
    }

    let data = await response.json();

    // If fetching wallet transactions, filter by type if specified
    if (wallet && type && Array.isArray(data)) {
      data = data.filter(tx => {
        // Check if transaction type matches
        if (type === 'SWAP') {
          return tx.type === 'SWAP' || tx.tokenTransfers?.length > 0;
        }
        return tx.type === type;
      });
    }

    // Limit results
    if (Array.isArray(data)) {
      data = data.slice(0, parseInt(limit));
    }

    console.log(`? Successfully fetched ${Array.isArray(data) ? data.length : 'transaction'} data from Helius`);
    res.status(200).json(data);

  } catch (error) {
    console.error('Helius transactions API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.message
    });
  }
}
