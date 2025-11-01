/**
 * Solana Web3.js Utility Module
 * 
 * This module uses @solana/web3.js directly for balance queries.
 * Benefits over API proxies:
 * - Lower latency (direct RPC connection)
 * - No third-party API rate limits (beyond RPC node limits)
 * - More detailed account information
 * - Batch multiple queries efficiently
 * - Better error handling and retry logic
 * 
 * Additional Information Web3.js Provides:
 * - Full account data structures
 * - Account ownership and permissions
 * - Token account states (frozen, closed, etc.)
 * - Account rent information
 * - Lamports (raw SOL amount)
 * - Multiple token accounts per wallet
 * - Token mint information
 * - Account space/size
 * - Transaction signatures
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Token Program ID (constant - matches @solana/spl-token)
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Connection instances - can be reused across the app
const RPC_ENDPOINTS = {
  helius: 'https://mainnet.helius-rpc.com/?api-key=10d64fda-22a9-4d18-9209-712683742a1d',
  solana: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
};

// Default connection - can switch based on availability
let defaultConnection = new Connection(RPC_ENDPOINTS.helius, 'confirmed');

/**
 * Get SOL balance for a wallet address
 * @param {string} walletAddress - Public key as string
 * @param {Connection} connection - Optional connection (uses default if not provided)
 * @returns {Promise<{balance: number, lamports: number, owner: string, executable: boolean}>}
 */
export async function getSolBalance(walletAddress, connection = defaultConnection) {
  try {
    const publicKey = new PublicKey(walletAddress);
    
    // Get balance in lamports
    const lamports = await connection.getBalance(publicKey, 'confirmed');
    
    // Get account info for additional details
    const accountInfo = await connection.getAccountInfo(publicKey, 'confirmed');
    
    return {
      balance: lamports / LAMPORTS_PER_SOL, // Convert to SOL
      lamports: lamports,
      owner: accountInfo?.owner?.toBase58() || null,
      executable: accountInfo?.executable || false,
      rentEpoch: accountInfo?.rentEpoch || null,
      dataLength: accountInfo?.data?.length || 0,
    };
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    throw error;
  }
}

/**
 * Get token balance for a specific token mint for a wallet
 * @param {string} walletAddress - Public key as string
 * @param {string} tokenMint - Token mint address
 * @param {Connection} connection - Optional connection
 * @returns {Promise<{balance: number, rawAmount: string, decimals: number, uiAmount: number, tokenAccount: object}>}
 */
export async function getTokenBalance(walletAddress, tokenMint, connection = defaultConnection) {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    const mintPublicKey = new PublicKey(tokenMint);
    
    // Find all token accounts for this wallet and mint
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { mint: mintPublicKey },
      'confirmed'
    );
    
    if (tokenAccounts.value.length === 0) {
      return {
        balance: 0,
        rawAmount: '0',
        decimals: 0,
        uiAmount: 0,
        tokenAccount: null,
        accounts: []
      };
    }
    
    // Get the first token account (most wallets have one per mint)
    const tokenAccount = tokenAccounts.value[0];
    const parsedInfo = tokenAccount.account.data.parsed.info;
    
    return {
      balance: parsedInfo.tokenAmount.uiAmount || 0,
      rawAmount: parsedInfo.tokenAmount.amount,
      decimals: parsedInfo.tokenAmount.decimals,
      uiAmount: parsedInfo.tokenAmount.uiAmount || 0,
      uiAmountString: parsedInfo.tokenAmount.uiAmountString || '0',
      tokenAccount: {
        address: tokenAccount.pubkey.toBase58(),
        mint: parsedInfo.mint,
        owner: parsedInfo.owner,
        state: parsedInfo.state, // 'initialized', 'frozen', etc.
        isNative: parsedInfo.isNative || false,
        closeAuthority: parsedInfo.closeAuthority || null,
        freezeAuthority: parsedInfo.freezeAuthority || null,
      },
      // Return all accounts if wallet has multiple
      accounts: tokenAccounts.value.map(acc => ({
        address: acc.pubkey.toBase58(),
        balance: acc.account.data.parsed.info.tokenAmount.uiAmount || 0,
        rawAmount: acc.account.data.parsed.info.tokenAmount.amount,
      }))
    };
  } catch (error) {
    console.error('Error fetching token balance:', error);
    throw error;
  }
}

/**
 * Get all token balances for a wallet
 * @param {string} walletAddress - Public key as string
 * @param {Connection} connection - Optional connection
 * @returns {Promise<Array<{mint: string, balance: number, decimals: number, tokenAccount: object}>>}
 */
export async function getAllTokenBalances(walletAddress, connection = defaultConnection) {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    
    // Get all token accounts owned by this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: TOKEN_PROGRAM_ID },
      'confirmed'
    );
    
    return tokenAccounts.value.map(account => {
      const parsedInfo = account.account.data.parsed.info;
      
      return {
        mint: parsedInfo.mint,
        balance: parsedInfo.tokenAmount.uiAmount || 0,
        rawAmount: parsedInfo.tokenAmount.amount,
        decimals: parsedInfo.tokenAmount.decimals,
        uiAmountString: parsedInfo.tokenAmount.uiAmountString || '0',
        tokenAccount: {
          address: account.pubkey.toBase58(),
          owner: parsedInfo.owner,
          state: parsedInfo.state,
          isNative: parsedInfo.isNative || false,
        }
      };
    }).filter(token => parseFloat(token.balance) > 0); // Filter out zero balances
  } catch (error) {
    console.error('Error fetching all token balances:', error);
    throw error;
  }
}

/**
 * Get comprehensive wallet information (SOL + all tokens + account details)
 * @param {string} walletAddress - Public key as string
 * @param {string} specificTokenMint - Optional: specific token to include
 * @param {Connection} connection - Optional connection
 * @returns {Promise<{sol: object, tokens: Array, specificToken: object|null}>}
 */
export async function getWalletInfo(walletAddress, specificTokenMint = null, connection = defaultConnection) {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    
    // Batch requests for efficiency
    const [solBalanceData, allTokens, specificTokenData] = await Promise.allSettled([
      getSolBalance(walletAddress, connection),
      getAllTokenBalances(walletAddress, connection),
      specificTokenMint ? getTokenBalance(walletAddress, specificTokenMint, connection) : Promise.resolve(null)
    ]);
    
    return {
      sol: solBalanceData.status === 'fulfilled' ? solBalanceData.value : { balance: 0, error: solBalanceData.reason },
      tokens: allTokens.status === 'fulfilled' ? allTokens.value : [],
      specificToken: specificTokenData.status === 'fulfilled' && specificTokenData.value ? specificTokenData.value : null,
      walletAddress: walletAddress,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error fetching wallet info:', error);
    throw error;
  }
}

/**
 * Get COMPREHENSIVE wallet information including transactions, account states, and everything
 * This is the FULL data fetch for wallet modals
 * @param {string} walletAddress - Public key as string
 * @param {string} specificTokenMint - Optional: specific token to track
 * @param {number} transactionLimit - Number of recent transactions to fetch (default: 20)
 * @param {Connection} connection - Optional connection
 * @returns {Promise<{sol: object, tokens: Array, specificToken: object|null, transactions: Array, accountInfo: object, summary: object}>}
 */
export async function getComprehensiveWalletInfo(
  walletAddress, 
  specificTokenMint = null, 
  transactionLimit = 20,
  connection = defaultConnection
) {
  try {
    const walletPublicKey = new PublicKey(walletAddress);
    
    console.log('?? Fetching comprehensive wallet info for:', walletAddress);
    
    // Batch ALL requests for maximum efficiency
    const [
      solBalanceData,
      allTokens,
      specificTokenData,
      transactionsData,
      accountInfoData,
      mintInfoData
    ] = await Promise.allSettled([
      getSolBalance(walletAddress, connection),
      getAllTokenBalances(walletAddress, connection),
      specificTokenMint ? getTokenBalance(walletAddress, specificTokenMint, connection) : Promise.resolve(null),
      getRecentTransactions(walletAddress, transactionLimit, connection),
      connection.getAccountInfo(walletPublicKey, 'confirmed'),
      specificTokenMint ? getTokenMintInfo(specificTokenMint, connection) : Promise.resolve(null)
    ]);
    
    // Process account info
    const accountInfo = accountInfoData.status === 'fulfilled' && accountInfoData.value ? {
      exists: true,
      owner: accountInfoData.value.owner?.toBase58() || null,
      executable: accountInfoData.value.executable || false,
      rentEpoch: accountInfoData.value.rentEpoch || null,
      lamports: accountInfoData.value.lamports || 0,
      dataLength: accountInfoData.value.data?.length || 0,
    } : { exists: false };
    
    // Process transactions
    const transactions = transactionsData.status === 'fulfilled' ? transactionsData.value : [];
    
    // Calculate wallet summary
    const sol = solBalanceData.status === 'fulfilled' ? solBalanceData.value : { balance: 0 };
    const tokens = allTokens.status === 'fulfilled' ? allTokens.value : [];
    
    // Calculate total token value (if we have price data)
    const totalTokenAccounts = tokens.length;
    const activeTokenAccounts = tokens.filter(t => parseFloat(t.balance) > 0).length;
    
    // Token account states summary
    const tokenStates = {
      initialized: tokens.filter(t => t.tokenAccount?.state === 'initialized').length,
      frozen: tokens.filter(t => t.tokenAccount?.state === 'frozen').length,
      closed: tokens.filter(t => t.tokenAccount?.state === 'closed').length,
    };
    
    const summary = {
      solBalance: sol.balance || 0,
      totalTokens: totalTokenAccounts,
      activeTokens: activeTokenAccounts,
      totalTransactions: transactions.length,
      accountExists: accountInfo.exists,
      accountExecutable: accountInfo.executable,
      tokenStates: tokenStates,
      walletAge: transactions.length > 0 && transactions[transactions.length - 1]?.blockTime 
        ? Math.floor((Date.now() / 1000 - transactions[transactions.length - 1].blockTime) / 86400)
        : null,
    };
    
    return {
      sol: sol,
      tokens: tokens,
      specificToken: specificTokenData.status === 'fulfilled' && specificTokenData.value ? specificTokenData.value : null,
      tokenMintInfo: mintInfoData.status === 'fulfilled' && mintInfoData.value ? mintInfoData.value : null,
      transactions: transactions,
      accountInfo: accountInfo,
      summary: summary,
      walletAddress: walletAddress,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error fetching comprehensive wallet info:', error);
    throw error;
  }
}

/**
 * Get token mint information
 * @param {string} tokenMint - Token mint address
 * @param {Connection} connection - Optional connection
 * @returns {Promise<{supply: number, decimals: number, mintAuthority: string, freezeAuthority: string}>}
 */
export async function getTokenMintInfo(tokenMint, connection = defaultConnection) {
  try {
    const mintPublicKey = new PublicKey(tokenMint);
    
    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey, 'confirmed');
    
    if (!mintInfo.value || !mintInfo.value.data || mintInfo.value.data.program !== 'spl-token') {
      throw new Error('Invalid token mint address');
    }
    
    const parsed = mintInfo.value.data.parsed.info;
    
    return {
      mint: tokenMint,
      supply: parsed.supply,
      decimals: parsed.decimals,
      mintAuthority: parsed.mintAuthority || null,
      freezeAuthority: parsed.freezeAuthority || null,
      isInitialized: parsed.isInitialized || false,
      supplyString: parsed.supplyString || '0',
    };
  } catch (error) {
    console.error('Error fetching token mint info:', error);
    throw error;
  }
}

/**
 * Check if an account exists and is valid
 * @param {string} address - Account address
 * @param {Connection} connection - Optional connection
 * @returns {Promise<boolean>}
 */
export async function accountExists(address, connection = defaultConnection) {
  try {
    const publicKey = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(publicKey, 'confirmed');
    return accountInfo !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get recent transaction signatures for a wallet with detailed transaction data
 * @param {string} walletAddress - Public key as string
 * @param {number} limit - Number of signatures to fetch (default: 10)
 * @param {Connection} connection - Optional connection
 * @param {boolean} includeDetails - Whether to fetch full transaction details (slower but more info)
 * @returns {Promise<Array<{signature: string, slot: number, blockTime: number, confirmationStatus: string, err: any, details?: object}>>}
 */
export async function getRecentTransactions(walletAddress, limit = 10, connection = defaultConnection, includeDetails = false) {
  try {
    const publicKey = new PublicKey(walletAddress);
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit }, 'confirmed');
    
    let transactions = signatures.map(sig => ({
      signature: sig.signature,
      slot: sig.slot,
      blockTime: sig.blockTime,
      confirmationStatus: sig.confirmationStatus,
      err: sig.err || null,
      timestamp: sig.blockTime ? new Date(sig.blockTime * 1000) : null,
    }));
    
    // Optionally fetch detailed transaction info (more expensive but provides full data)
    if (includeDetails && transactions.length > 0) {
      try {
        const detailedTxs = await connection.getParsedTransactions(
          transactions.map(tx => tx.signature),
          { maxSupportedTransactionVersion: 0 }
        );
        
        transactions = transactions.map((tx, idx) => ({
          ...tx,
          details: detailedTxs[idx] ? {
            fee: detailedTxs[idx].meta?.fee || 0,
            status: detailedTxs[idx].meta?.err ? 'failed' : 'success',
            instructions: detailedTxs[idx].transaction?.message?.instructions?.length || 0,
            accounts: detailedTxs[idx].transaction?.message?.accountKeys?.length || 0,
            preBalances: detailedTxs[idx].meta?.preBalances || [],
            postBalances: detailedTxs[idx].meta?.postBalances || [],
            preTokenBalances: detailedTxs[idx].meta?.preTokenBalances || [],
            postTokenBalances: detailedTxs[idx].meta?.postTokenBalances || [],
            logMessages: detailedTxs[idx].meta?.logMessages || [],
          } : null
        }));
      } catch (detailError) {
        console.warn('Failed to fetch transaction details:', detailError);
        // Continue without details
      }
    }
    
    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Switch RPC endpoint (useful for fallback)
 * @param {string} endpointKey - 'helius', 'solana', or 'devnet'
 */
export function switchRpcEndpoint(endpointKey = 'helius') {
  if (RPC_ENDPOINTS[endpointKey]) {
    defaultConnection = new Connection(RPC_ENDPOINTS[endpointKey], 'confirmed');
    console.log(`Switched RPC endpoint to: ${endpointKey}`);
  } else {
    console.warn(`Invalid RPC endpoint: ${endpointKey}`);
  }
}

/**
 * Create a custom connection instance
 * @param {string} rpcUrl - Custom RPC URL
 * @returns {Connection}
 */
export function createConnection(rpcUrl) {
  return new Connection(rpcUrl, 'confirmed');
}

// Export default connection for direct use if needed
export { defaultConnection as connection };
