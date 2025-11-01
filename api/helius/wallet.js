// Vercel serverless function for Helius wallet queries
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
    const { address, type = 'transactions' } = req.query;
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '10d64fda-22a9-4d18-9209-712683742a1d';
    
    if (!address) {
      return res.status(400).json({ error: 'Missing address parameter' });
    }

    let url;
    if (type === 'transactions') {
      // Fetch transactions
      url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=1000&type=SWAP,TRANSFER`;
    } else if (type === 'balances') {
      // Fetch balances
      url = `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${HELIUS_API_KEY}`;
    } else if (type === 'token-transfers') {
      // Fetch token transfers only
      url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=1000&type=TRANSFER`;
    } else {
      return res.status(400).json({ error: 'Invalid type parameter. Use: transactions, balances, or token-transfers' });
    }

    console.log(`?? Fetching Helius ${type} for address: ${address}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`? Successfully fetched Helius ${type} for ${address}`);

    res.status(200).json(data);

  } catch (error) {
    console.error('Helius wallet API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch wallet data',
      details: error.message
    });
  }
}
