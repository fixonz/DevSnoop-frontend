// Vercel serverless function for Helius wallet balance queries
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
    const { wallet, token } = req.query;
    const apiKey = process.env.HELIUS_API_KEY || '10d64fda-22a9-4d18-9209-712683742a1d';

    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet parameter' });
    }

    let url;
    
    if (token) {
      // Fetch token balance for specific mint
      console.log(`?? Fetching Helius token balance for wallet: ${wallet}, token: ${token}`);
      url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      // Use RPC call for token balance
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-balance-check',
          method: 'getTokenAccountsByOwner',
          params: [
            wallet,
            {
              mint: token
            },
            {
              encoding: 'jsonParsed'
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Helius RPC error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Helius RPC error');
      }

      const balance = data.result?.value?.[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
      const rawBalance = data.result?.value?.[0]?.account?.data?.parsed?.info?.tokenAmount?.amount || '0';
      
      console.log(`? Successfully fetched Helius token balance for ${wallet}`);
      
      res.status(200).json({
        result: {
          balance: balance,
          rawBalance: rawBalance,
          mint: token,
          wallet: wallet
        }
      });
    } else {
      // Fetch SOL balance
      console.log(`?? Fetching Helius SOL balance for wallet: ${wallet}`);
      url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'balance-check',
          method: 'getBalance',
          params: [wallet]
        })
      });

      if (!response.ok) {
        throw new Error(`Helius RPC error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Helius RPC error');
      }

      const balance = (data.result?.value || 0) / 1000000000; // Convert lamports to SOL
      
      console.log(`? Successfully fetched Helius SOL balance for ${wallet}`);
      
      res.status(200).json({
        result: {
          balance: balance,
          rawBalance: data.result?.value || 0,
          wallet: wallet
        }
      });
    }

  } catch (error) {
    console.error('Helius balance API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch balance',
      details: error.message
    });
  }
}
