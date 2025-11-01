// Vercel serverless function for Helius API - handles wallet and token balance queries
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
    const { wallet, mint } = req.query;
    const apiKey = process.env.HELIUS_API_KEY || '10d64fda-22a9-4d18-9209-712683742a1d';

    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet parameter' });
    }

    // Fetch wallet balance from Helius Enhanced API
    const url = `https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=${apiKey}`;

    console.log(`?? Fetching Helius balance for wallet: ${wallet}${mint ? `, token: ${mint}` : ''}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Helius API error: ${response.status} - ${errorText}`);
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filter by token mint if provided
    if (mint && data.tokens) {
      const tokenBalance = data.tokens.find(token => token.mint === mint);
      if (tokenBalance) {
        return res.status(200).json({
          balance: tokenBalance.amount,
          decimals: tokenBalance.decimals,
          mint: tokenBalance.mint,
          solBalance: data.nativeBalance || 0
        });
      }
      return res.status(200).json({
        balance: 0,
        decimals: 0,
        mint: mint,
        solBalance: data.nativeBalance || 0
      });
    }

    console.log(`? Successfully fetched Helius balance for ${wallet}`);
    res.status(200).json(data);

  } catch (error) {
    console.error('Helius balance API proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch balance',
      details: error.message
    });
  }
}
