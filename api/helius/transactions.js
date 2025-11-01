// Vercel serverless function for Helius transaction queries
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

    if (wallet) {
      // Fetch transactions for a wallet using Helius Enhanced Transactions API
      console.log(`?? Fetching Helius transactions for wallet: ${wallet}, type: ${type}`);
      
      const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${apiKey}&type=${type}&limit=${limit}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Helius API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`? Successfully fetched Helius transactions for wallet ${wallet}`);
      
      return res.status(200).json({
        result: data,
        count: Array.isArray(data) ? data.length : (data.transactions?.length || 0),
        success: true
      });
    } else if (mint) {
      // For mint addresses, use token metadata or search transactions related to the token
      console.log(`?? Fetching Helius token metadata for mint: ${mint}`);
      
      // Use Helius RPC for token metadata
      const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-metadata',
          method: 'getTokenMetadata',
          params: [[mint]]
        })
      });

      if (!response.ok) {
        throw new Error(`Helius RPC error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Helius RPC error');
      }
      
      console.log(`? Successfully fetched Helius token metadata for ${mint}`);
      
      return res.status(200).json({
        result: data.result || data,
        count: 1,
        success: true
      });
    }

  } catch (error) {
    console.error('Helius transactions API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.message,
      success: false
    });
  }
}
