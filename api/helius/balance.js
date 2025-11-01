// Vercel serverless function for Helius API - handles both wallet SOL balance and token balance queries
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
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '10d64fda-22a9-4d18-9209-712683742a1d';
    const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet parameter' });
    }

    let result = {};

    if (type === 'token' && token) {
      // Fetch token balance for specific token
      console.log(`?? Fetching Helius token balance for wallet: ${wallet}, token: ${token}`);
      
      try {
        const response = await fetch(HELIUS_RPC_URL, {
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
          throw new Error(`Helius RPC error: ${data.error.message || 'Unknown error'}`);
        }

        // Extract token balance from response
        const tokenAccounts = data.result?.value || [];
        if (tokenAccounts.length === 0) {
          result = {
            result: {
              balance: 0,
              mint: token,
              wallet: wallet
            },
            success: true
          };
        } else {
          const tokenAccount = tokenAccounts[0];
          const tokenAmount = tokenAccount.account?.data?.parsed?.info?.tokenAmount;
          
          result = {
            result: {
              balance: tokenAmount?.uiAmount || 0,
              mint: token,
              wallet: wallet,
              decimals: tokenAmount?.decimals || 0,
              amount: tokenAmount?.amount || '0'
            },
            success: true
          };
        }
      } catch (error) {
        console.error('Helius token balance fetch failed:', error);
        return res.status(500).json({
          error: 'Failed to fetch token balance',
          details: error.message
        });
      }
    } else {
      // Fetch SOL balance
      console.log(`?? Fetching Helius SOL balance for wallet: ${wallet}`);
      
      try {
        const response = await fetch(HELIUS_RPC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'sol-balance-check',
            method: 'getBalance',
            params: [wallet]
          })
        });

        if (!response.ok) {
          throw new Error(`Helius RPC error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(`Helius RPC error: ${data.error.message || 'Unknown error'}`);
        }

        // Convert lamports to SOL
        const lamports = data.result?.value || 0;
        const solBalance = lamports / 1e9;

        result = {
          result: {
            balance: solBalance,
            wallet: wallet,
            lamports: lamports
          },
          success: true
        };
      } catch (error) {
        console.error('Helius SOL balance fetch failed:', error);
        return res.status(500).json({
          error: 'Failed to fetch SOL balance',
          details: error.message
        });
      }
    }

    console.log(`? Successfully fetched Helius ${type} balance for ${wallet}`);
    res.status(200).json(result);

  } catch (error) {
    console.error('Helius balance API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch balance',
      details: error.message
    });
  }
}
