// Vercel serverless function for Helius API - fetches token transfer transactions
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
    const { wallet, token, type = 'SWAP', limit = 100 } = req.query;
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '10d64fda-22a9-4d18-9209-712683742a1d';

    if (!wallet && !token) {
      return res.status(400).json({ error: 'Missing wallet or token parameter' });
    }

    let url;
    if (wallet) {
      // Fetch transactions for a specific wallet
      console.log(`?? Fetching Helius transactions for wallet: ${wallet}, type: ${type}`);
      url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&type=${type}&limit=${limit}`;
    } else if (token) {
      // Fetch transactions for a specific token
      console.log(`?? Fetching Helius transactions for token: ${token}, type: ${type}`);
      url = `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}&mintAddresses=${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`? Successfully fetched Helius transactions`);

    // Format response for consistency
    const transactions = Array.isArray(data) ? data : (data.transactions || []);
    
    res.status(200).json({
      result: transactions,
      success: true,
      count: transactions.length
    });

  } catch (error) {
    console.error('Helius transactions API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.message
    });
  }
}
