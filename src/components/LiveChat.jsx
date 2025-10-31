import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Star, TrendingUp, Wallet, ExternalLink, X, User, Clock, ThumbsUp, ThumbsDown, AlertTriangle, Zap, Sun, Moon, MessageSquare, Volume2, VolumeX, Bell, BarChart3, Mic, Mic2, Volume, Gauge, PieChart, TrendingUpDown } from 'lucide-react';
import { useDevapp } from '@devfunlabs/web-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { getPumpfunSocket, getBackendSocket } from '../utils/websocket';
import { getWalletReputation, rateWallet, canRateWallet } from '../services/ratingService';
import ReputationBadge from './ReputationBadge';
import WalletRatingModal from './WalletRatingModal';

const connection = new Connection('https://rpc.dev.fun/a9a79a90906b540da651');

// Your API keys and utils (unchanged from previous)
const HELIUS_API_KEY = '10d64fda-22a9-4d18-9209-712683742a1d';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_WEBHOOK_URL = `${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/webhooks/helius`;

const SHYFT_API_KEY = 'dmLD1Y7HFOq_cDWV';
const SHYFT_RPC_URL = `https://rpc.shyft.to?api_key=${SHYFT_API_KEY}`;

// Logo URL
const APP_LOGO = '/logo.png';

// Cache & utils (expanded from before)
const apiCache = new Map();

// Sentiment keywords for scoring (bullish/bearish)
const sentimentKeywords = {
  bullish: ['moon', 'to100m', 'gem', 'rocket', 'lfg', 'wen', 'buy', 'hold', 'diamond', 'bullish'],
  bearish: ['dump', 'rug', 'scam', 'sell', 'exit', 'fomo', 'dead']
};

// Enhanced PnL fetch with caching & impact calculation
const fetchHeliusPnl = async (wallet, tokenMint, currentMCap = 0) => {
  const cacheKey = `pnl-${wallet}-${tokenMint}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60000) return cached.data; // 60s cache
  
  try {
    const response = await fetch(`${HELIUS_RPC_URL}/v0/addresses/${wallet}/balances?api-key=${HELIUS_API_KEY}`);
    const data = await response.json();
    
    const tokenBalance = data.tokens?.find(t => t.mint === tokenMint)?.amount || 0;
    const solBalance = data.nativeBalance / 1e9;
    
    // Calculate impact (simplified)
    const avgTradeSize = currentMCap * 0.001; // 0.1% of market cap
    const impact = Math.min(tokenBalance * 0.1, currentMCap * 0.1); // Cap at 10% of MC
    
    const result = {
      tokenBalance,
      solBalance,
      impact,
      avgTradeSize
    };
    
    apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Helius PnL fetch failed:', error);
    return { tokenBalance: 0, solBalance: 0, impact: 0, avgTradeSize: 0 };
  }
};

// Enhanced Wallet Analysis System
const WALLET_ANALYSIS_CACHE = new Map();
const MULTI_WALLET_CLUSTERS = new Map(); // Store detected multi-wallet clusters
const WALLET_BADGES = new Map(); // Store wallet badges for all tokens

// Comprehensive wallet analysis using Helius and Shyft
const analyzeWalletComprehensive = async (walletAddress, tokenMint = null) => {
  if (!walletAddress) return null;
  
  const cacheKey = `wallet-${walletAddress}-${tokenMint || 'all'}`;
  const cached = WALLET_ANALYSIS_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
    return cached.data;
  }

  try {
    console.log(`🔍 Analyzing wallet: ${walletAddress}`);
    
    // Fetch wallet data from multiple sources
    const [heliusData, shyftData] = await Promise.allSettled([
      fetchHeliusWalletData(walletAddress),
      fetchShyftWalletData(walletAddress)
    ]);

    const analysis = {
      address: walletAddress,
      timestamp: Date.now(),
      riskScore: 0,
      badges: [],
      multiWalletCluster: null,
      walletAge: 0,
      totalTransactions: 0,
      suspiciousActivity: false,
      devLinked: false,
      botLikelihood: 0,
      tradingPattern: 'unknown',
      balance: 0,
      tokenHoldings: [],
      socialSignals: {
        messageCount: 0,
        sentimentScore: 0,
        spamScore: 0
      }
    };

    // Process Helius data
    if (heliusData.status === 'fulfilled' && heliusData.value) {
      const helius = heliusData.value;
      analysis.totalTransactions = helius.transactionCount || 0;
      analysis.walletAge = helius.walletAge || 0;
      analysis.balance = helius.solBalance || 0;
      analysis.tokenHoldings = helius.tokenHoldings || [];
      
      // Calculate risk factors
      if (helius.multiWallet) analysis.riskScore += 30;
      if (helius.coordinatedBuys > 5) analysis.riskScore += 25;
      if (helius.walletAge < 7) analysis.riskScore += 20;
      if (helius.suspiciousPatterns) analysis.riskScore += 15;
    }

    // Process Shyft data - Enhanced with comprehensive portfolio analysis
    if (shyftData.status === 'fulfilled' && shyftData.value) {
      const shyft = shyftData.value;
      analysis.balance = Math.max(analysis.balance, shyft.solBalance || 0);
      analysis.tokenHoldings = shyft.tokenHoldings || [];
      analysis.totalTokens = shyft.totalTokens || 0;
      analysis.totalValue = shyft.totalValue || 0;
      analysis.topHolding = shyft.topHolding;
      analysis.portfolioDiversity = shyft.portfolioDiversity || 0;
      analysis.riskScore = Math.max(analysis.riskScore, shyft.riskScore || 0);
      analysis.isActiveTrader = shyft.isActiveTrader || false;
      analysis.preferredCategories = shyft.preferredCategories || [];
      analysis.behaviorAnalysis = shyft.behaviorAnalysis || {};
    }

    // Generate badges based on analysis
    analysis.badges = generateWalletBadges(analysis);
    
    // Check for multi-wallet clusters
    const clusterId = detectMultiWalletCluster(walletAddress, analysis);
    if (clusterId) {
      analysis.multiWalletCluster = clusterId;
      MULTI_WALLET_CLUSTERS.set(clusterId, {
        wallets: [...(MULTI_WALLET_CLUSTERS.get(clusterId)?.wallets || []), walletAddress],
        riskScore: analysis.riskScore,
        lastUpdated: Date.now()
      });
    }

    // Store badges globally
    WALLET_BADGES.set(walletAddress, analysis.badges);

    WALLET_ANALYSIS_CACHE.set(cacheKey, { data: analysis, timestamp: Date.now() });
    return analysis;
  } catch (error) {
    console.error('Wallet analysis failed:', error);
    return null;
  }
};

// Fetch Helius wallet data
const fetchHeliusWalletData = async (walletAddress) => {
  try {
    const response = await fetch(`${HELIUS_RPC_URL}/v0/addresses/${walletAddress}/transactions?limit=1000&api-key=${HELIUS_API_KEY}`);
    if (!response.ok) throw new Error(`Helius API error: ${response.status}`);
    
    const transactions = await response.json();
    const now = Date.now() / 1000;
    
    // Calculate wallet age
    const oldestTx = Math.min(...transactions.map(tx => tx.timestamp));
    const walletAge = Math.floor((now - oldestTx) / (24 * 60 * 60));
    
    // Analyze transaction patterns
    const tokenTransfers = transactions.flatMap(tx => tx.tokenTransfers || []);
    const uniqueTokens = new Set(tokenTransfers.map(t => t.mint));
    const uniqueWallets = new Set(transactions.flatMap(tx => [
      ...(tx.tokenTransfers || []).map(t => t.fromUserAccount).filter(Boolean),
      ...(tx.tokenTransfers || []).map(t => t.toUserAccount).filter(Boolean)
    ]));
    
    // Detect coordinated activity
    const recentTxs = transactions.filter(tx => now - tx.timestamp < 24 * 60 * 60);
    const timeWindows = new Map();
    recentTxs.forEach(tx => {
      const window = Math.floor(tx.timestamp / 300) * 300; // 5-min windows
      timeWindows.set(window, (timeWindows.get(window) || 0) + 1);
    });
    const coordinatedBuys = Array.from(timeWindows.values()).filter(count => count > 3).length;
    
    return {
      transactionCount: transactions.length,
      walletAge,
      solBalance: 0, // Will be filled by Shyft
      tokenHoldings: Array.from(uniqueTokens),
      multiWallet: uniqueWallets.size > 10,
      coordinatedBuys,
      suspiciousPatterns: coordinatedBuys > 5 || uniqueWallets.size > 20
    };
  } catch (error) {
    console.error('Helius wallet fetch failed:', error);
    return null;
  }
};

// Fetch Shyft wallet data - Enhanced with full portfolio analysis
const fetchShyftWalletData = async (walletAddress) => {
  try {
    console.log(`🔍 Fetching comprehensive Shyft portfolio for: ${walletAddress}`);
    const response = await fetch(`${SHYFT_RPC_URL}/get_portfolio?wallet_address=${walletAddress}`);
    if (!response.ok) throw new Error(`Shyft API error: ${response.status}`);
    
    const data = await response.json();
    console.log(`💰 Full Shyft portfolio data:`, data);
    
    const portfolio = data.result;
    const tokens = portfolio?.tokens || [];
    const nativeBalance = portfolio?.native_balance?.sol_balance || 0;
    
    // Calculate portfolio metrics
    const totalTokens = tokens.length;
    const totalValue = tokens.reduce((sum, token) => {
      const value = token.balance * (token.info?.price || 0);
      return sum + value;
    }, 0);
    
    // Find top holdings by value
    const sortedTokens = tokens
      .map(token => ({
        mint: token.mint,
        balance: token.balance,
        symbol: token.info?.symbol || 'Unknown',
        name: token.info?.name || 'Unknown Token',
        price: token.info?.price || 0,
        value: token.balance * (token.info?.price || 0),
        percentage: 0 // Will calculate after total value
      }))
      .sort((a, b) => b.value - a.value);
    
    // Calculate percentages
    const totalPortfolioValue = totalValue + (nativeBalance * 200); // Approximate SOL price
    sortedTokens.forEach(token => {
      token.percentage = totalPortfolioValue > 0 ? (token.value / totalPortfolioValue) * 100 : 0;
    });
    
    // Analyze wallet behavior patterns
    const behaviorAnalysis = {
      isDiversified: totalTokens > 5,
      hasHighValueTokens: sortedTokens.some(token => token.value > 1000),
      isConcentrated: sortedTokens[0]?.percentage > 50,
      averageTokenValue: totalTokens > 0 ? totalValue / totalTokens : 0,
      riskLevel: calculateRiskLevel(sortedTokens, nativeBalance),
      tradingActivity: analyzeTradingActivity(sortedTokens),
      tokenCategories: categorizeTokens(sortedTokens)
    };
    
    return {
      solBalance: nativeBalance,
      tokenHoldings: sortedTokens,
      totalTokens,
      totalValue,
      topHolding: sortedTokens[0] || null,
      behaviorAnalysis,
      portfolioDiversity: totalTokens,
      riskScore: behaviorAnalysis.riskLevel,
      isActiveTrader: behaviorAnalysis.tradingActivity.isActive,
      preferredCategories: behaviorAnalysis.tokenCategories.topCategories
    };
  } catch (error) {
    console.error('Shyft wallet fetch failed:', error);
    return null;
  }
};

// Helper function to calculate risk level based on portfolio
const calculateRiskLevel = (tokens, solBalance) => {
  let riskScore = 0;
  
  // High concentration risk
  if (tokens[0]?.percentage > 80) riskScore += 40;
  else if (tokens[0]?.percentage > 50) riskScore += 20;
  
  // Low diversification
  if (tokens.length < 3) riskScore += 30;
  else if (tokens.length < 5) riskScore += 15;
  
  // Low SOL balance (might be over-leveraged)
  if (solBalance < 0.1) riskScore += 25;
  else if (solBalance < 0.5) riskScore += 10;
  
  // High number of small positions (might be gambling)
  const smallPositions = tokens.filter(t => t.value < 10).length;
  if (smallPositions > tokens.length * 0.7) riskScore += 20;
  
  return Math.min(riskScore, 100);
};

// Helper function to analyze trading activity patterns
const analyzeTradingActivity = (tokens) => {
  const totalValue = tokens.reduce((sum, token) => sum + token.value, 0);
  const averageValue = totalValue / tokens.length;
  
  return {
    isActive: tokens.length > 10,
    isHighVolume: totalValue > 10000,
    isSpeculative: tokens.filter(t => t.value < 100).length > tokens.length * 0.5,
    averagePositionSize: averageValue,
    totalPositions: tokens.length
  };
};

// Helper function to categorize tokens
const categorizeTokens = (tokens) => {
  const categories = {
    memes: 0,
    defi: 0,
    nfts: 0,
    gaming: 0,
    unknown: 0
  };
  
  tokens.forEach(token => {
    const symbol = token.symbol.toLowerCase();
    const name = token.name.toLowerCase();
    
    if (symbol.includes('dog') || symbol.includes('cat') || symbol.includes('moon') || 
        name.includes('meme') || name.includes('doge') || name.includes('shib')) {
      categories.memes++;
    } else if (symbol.includes('swap') || symbol.includes('dex') || symbol.includes('farm') ||
               name.includes('defi') || name.includes('yield') || name.includes('liquidity')) {
      categories.defi++;
    } else if (symbol.includes('nft') || name.includes('nft') || name.includes('collection')) {
      categories.nfts++;
    } else if (symbol.includes('game') || name.includes('game') || name.includes('play')) {
      categories.gaming++;
    } else {
      categories.unknown++;
    }
  });
  
  const topCategories = Object.entries(categories)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));
  
  return { categories, topCategories };
};

// Generate wallet badges based on comprehensive analysis
const generateWalletBadges = (analysis) => {
  const badges = [];
  
  // Risk-based badges
  if (analysis.riskScore > 70) badges.push({ type: 'high-risk', label: '🚨 HIGH RISK', color: 'red' });
  if (analysis.riskScore > 40) badges.push({ type: 'medium-risk', label: '⚠️ MEDIUM RISK', color: 'yellow' });
  if (analysis.riskScore < 20) badges.push({ type: 'low-risk', label: '✅ LOW RISK', color: 'green' });
  
  // Portfolio diversity badges
  if (analysis.portfolioDiversity > 20) badges.push({ type: 'diversified', label: '🌐 DIVERSIFIED', color: 'blue' });
  if (analysis.portfolioDiversity < 3) badges.push({ type: 'concentrated', label: '🎯 CONCENTRATED', color: 'orange' });
  
  // Trading activity badges
  if (analysis.isActiveTrader) badges.push({ type: 'active-trader', label: '📈 ACTIVE TRADER', color: 'green' });
  if (analysis.behaviorAnalysis?.tradingActivity?.isHighVolume) badges.push({ type: 'whale', label: '🐋 WHALE', color: 'cyan' });
  if (analysis.behaviorAnalysis?.tradingActivity?.isSpeculative) badges.push({ type: 'gambler', label: '🎰 GAMBLER', color: 'purple' });
  
  // Portfolio composition badges
  if (analysis.behaviorAnalysis?.hasHighValueTokens) badges.push({ type: 'high-value', label: '💎 HIGH VALUE', color: 'gold' });
  if (analysis.behaviorAnalysis?.isConcentrated) badges.push({ type: 'concentrated', label: '🎯 CONCENTRATED', color: 'orange' });
  
  // Category preference badges
  if (analysis.preferredCategories?.[0]?.category === 'memes') badges.push({ type: 'meme-trader', label: '🐕 MEME TRADER', color: 'pink' });
  if (analysis.preferredCategories?.[0]?.category === 'defi') badges.push({ type: 'defi-trader', label: '🏦 DEFI TRADER', color: 'blue' });
  if (analysis.preferredCategories?.[0]?.category === 'gaming') badges.push({ type: 'gaming-trader', label: '🎮 GAMING TRADER', color: 'green' });
  
  // Wallet age and activity
  if (analysis.walletAge < 7) badges.push({ type: 'new-wallet', label: '🆕 NEW WALLET', color: 'blue' });
  if (analysis.totalTransactions > 1000) badges.push({ type: 'veteran', label: '👴 VETERAN', color: 'gray' });
  
  // Multi-wallet detection
  if (analysis.multiWalletCluster) badges.push({ type: 'multi-wallet', label: '🔗 CLUSTER', color: 'purple' });
  
  // Suspicious activity
  if (analysis.suspiciousActivity) badges.push({ type: 'suspicious', label: '🤔 SUSPICIOUS', color: 'orange' });
  if (analysis.devLinked) badges.push({ type: 'dev-linked', label: '👨‍💻 DEV LINKED', color: 'pink' });
  
  // SOL balance badges
  if (analysis.balance > 50) badges.push({ type: 'rich', label: '💰 RICH', color: 'gold' });
  if (analysis.balance < 0.1) badges.push({ type: 'low-balance', label: '⚠️ LOW BALANCE', color: 'red' });
  
  return badges;
};

// Detect multi-wallet clusters
const detectMultiWalletCluster = (walletAddress, analysis) => {
  // Simple clustering based on transaction patterns
  // In a real implementation, this would use more sophisticated clustering algorithms
  if (analysis.totalTransactions > 50 && analysis.riskScore > 30) {
    const clusterId = `cluster-${Math.floor(analysis.riskScore / 10)}`;
    return clusterId;
  }
  return null;
};

// Enhanced Dev Wallet Analysis

// Improvements:
// - Pagination: Fetch up to 500 or 1000 transactions (Helius max) by paginating with 'before' parameter.
// - Sell Detection: Track sells from dev wallet and calculate net tokens (bought - sold).
// - Refined Multi-Wallet: Focus on unique 'fromUserAccount' in buys to dev (potential coordinated inflows).
// - Enhanced Coordinated Buys: Group buys by 5-minute windows to detect bursts (coordination proxy).
// - Additional Metrics: Wallet age (from first tx), total/avg buy/sell amounts, risk score (0-100 based on multi-wallet, coordination, net activity).
// - Better Filtering: Exclude non-user accounts and known program-derived addresses (basic heuristic).
// - Extended Cache: 60s cache with invalidation on error.
// - Input Validation & Error Handling: Validate params, retry on fetch failure (up to 3 attempts).
// - Timeline Expansion: Include buy/sell type, from/to accounts, and net change per tx.

const analyzeDevWallet = async (devWallet, tokenMint) => {
  if (!devWallet || !tokenMint) {
    console.error('Invalid inputs: devWallet and tokenMint required');
    return null;
  }

  const cacheKey = `dev-${devWallet}-${tokenMint}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60000) { // 60s cache
    return cached.data;
  }

  let allTransactions = [];
  let before = null;
  let attempt = 0;
  const maxAttempts = 3;

  try {
    do {
      const url = new URL(`${HELIUS_RPC_URL}/v0/addresses/${devWallet}/transactions`);
      url.searchParams.append('api-key', HELIUS_API_KEY);
      url.searchParams.append('limit', '1000'); // Max per page
      if (before) url.searchParams.append('before', before);

      let response;
      let success = false;

      while (attempt < maxAttempts && !success) {
        try {
          response = await fetch(url.toString());
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const batch = await response.json();
          allTransactions = allTransactions.concat(batch);
          before = batch.length > 0 ? batch[batch.length - 1].signature : null;
          success = true;
        } catch (fetchError) {
          attempt++;
          console.warn(`Fetch attempt ${attempt} failed:`, fetchError);
          if (attempt >= maxAttempts) throw fetchError;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }

      if (allTransactions.length >= 1000) break; // Cap total
    } while (before);

    if (!allTransactions?.length) return null;

    // Sort by timestamp descending (newest first)
    allTransactions.sort((a, b) => b.timestamp - a.timestamp);

    const tokenTransactions = allTransactions.filter(tx => 
      tx.tokenTransfers?.some(transfer => transfer.mint === tokenMint)
    );

    if (!tokenTransactions.length) return null;

    // Basic filtering: Exclude potential non-user accounts (e.g., program-owned, short base58)
    const isLikelyUserAccount = (account) => account && account.length >= 32 && !account.startsWith('11111111111111111111111111111111'); // Exclude system program, etc.

    // Buy/Sell classification per transfer
    const buys = []; // {tx, transfer, amount, fromAccount, timestamp}
    const sells = []; // Similar

    tokenTransactions.forEach(tx => {
      tx.tokenTransfers?.forEach(transfer => {
        if (transfer.mint !== tokenMint) return;

        const fromUser = transfer.fromUserAccount && isLikelyUserAccount(transfer.fromUserAccount);
        const toUser = transfer.toUserAccount && isLikelyUserAccount(transfer.toUserAccount);
        
        if (toUser === devWallet) {
          buys.push({ tx, transfer, amount: transfer.tokenAmount, fromAccount: transfer.fromUserAccount, timestamp: tx.timestamp });
        } else if (fromUser === devWallet) {
          sells.push({ tx, transfer, amount: transfer.tokenAmount, toAccount: transfer.toUserAccount, timestamp: tx.timestamp });
        }
      });
    });

    // Multi-wallet detection: Unique fromAccounts in buys (potential dev-controlled inflows)
    const uniqueFromWallets = new Set(buys.map(b => b.fromAccount).filter(Boolean));
    const associatedWallets = Array.from(uniqueFromWallets);

    // Wallet age: From oldest tx (reverse sort temporarily)
    const sortedAllTx = [...allTransactions].sort((a, b) => a.timestamp - b.timestamp);
    const walletAgeDays = sortedAllTx.length > 0 ? Math.floor((Date.now() / 1000 - sortedAllTx[0].timestamp) / (24 * 60 * 60)) : 0;

    // Coordinated buys: Group by 5-min windows, count bursts (>2 in window)
    const now = Date.now() / 1000;
    const recentBuys = buys.filter(b => now - b.timestamp < 24 * 60 * 60); // Last 24h

    const timeWindows = new Map();
    recentBuys.forEach(buy => {
      const windowStart = Math.floor(buy.timestamp / 300) * 300; // 5-min buckets
      if (!timeWindows.has(windowStart)) timeWindows.set(windowStart, []);
      timeWindows.get(windowStart).push(buy);
    });

    const burstWindows = Array.from(timeWindows.values()).filter(window => window.length > 2);
    const coordinatedBuys = burstWindows.reduce((sum, window) => sum + window.length, 0);

    // Aggregates
    const totalBought = buys.reduce((sum, b) => sum + b.amount, 0);
    const totalSold = sells.reduce((sum, s) => sum + s.amount, 0);
    const netTokens = totalBought - totalSold;
    const avgBuyAmount = buys.length > 0 ? totalBought / buys.length : 0;
    const recentBuysCount = recentBuys.length;

    // Risk score (0-100): Higher if multi-wallet, high coordination, net positive (hoarding), young wallet
    const multiScore = Math.min(associatedWallets.length * 10, 40);
    const coordScore = Math.min(coordinatedBuys * 5, 30);
    const netScore = netTokens > 0 ? Math.min((netTokens / 10000) * 10, 20) : 0; // Arbitrary scaling
    const agePenalty = walletAgeDays < 7 ? 10 : 0;
    const riskScore = Math.floor(multiScore + coordScore + netScore + agePenalty);

    const result = {
      walletAgeDays,
      isMultiWallet: associatedWallets.length > 3,
      associatedWallets,
      totalBought,
      totalSold,
      netTokens,
      avgBuyAmount,
      recentBuys: recentBuysCount,
      coordinatedBuys,
      riskScore,
      timeline: tokenTransactions.slice(0, 20).map(tx => { // Top 20 recent
        const transfer = tx.tokenTransfers?.find(t => t.mint === tokenMint);
        const isBuy = transfer?.toUserAccount === devWallet;
        const isSell = transfer?.fromUserAccount === devWallet;
        return {
          signature: tx.signature,
          timestamp: tx.timestamp,
          type: isBuy ? 'buy' : isSell ? 'sell' : 'other',
          amount: Math.abs(transfer?.tokenAmount || 0),
          fromAccount: transfer?.fromUserAccount,
          toAccount: transfer?.toUserAccount,
          netChange: isBuy ? transfer?.tokenAmount : -(transfer?.tokenAmount || 0)
        };
      })
    };

    apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Dev wallet analysis failed:', error);
    // Invalidate cache on error
    apiCache.del(cacheKey);
    return null;
  }
};

// Larp score calculation (enhanced)
const calculateLarpScore = (chatter, message = '') => {
  let score = 0;
  
  // Message count factor
  const messageCount = chatter.messageCount || 0;
  if (messageCount > 50) score += 20;
  if (messageCount > 100) score += 10;
  
  // Balance factor
  const balance = chatter.balance || 0;
  if (balance === 0) score += 30; // No tokens = suspicious
  if (balance < 10000) score += 15; // Very low balance
  
  // Transaction count
  const txCount = chatter.txCount || 0;
  if (txCount === 0) score += 20; // No transactions = very suspicious
  if (txCount < 5) score += 10;
  
  // Dev linking
  if (chatter.isDevLinked) score += 25; // Connected to dev = high risk
  
  // Recent buying behavior
  if (chatter.hasBought) score -= 15; // Actually bought = more legitimate
  
  // Sentiment boost: Bullish spam = higher larp
  const bullishCount = message.toLowerCase().split(' ').filter(word => sentimentKeywords.bullish.includes(word)).length;
  const bearishCount = message.toLowerCase().split(' ').filter(word => sentimentKeywords.bearish.includes(word)).length;
  if (bullishCount > bearishCount + 2) score += 20;  // Pump without dump = shill
  
  return Math.min(score, 100);
}

// New: Token Velocity Tracker
function calculateVelocity(chatTrades, overallTrades = []) {
  const chatBuys = chatTrades.filter(t => t.type === 'BUY').length;
  const chatSells = chatTrades.filter(t => t.type === 'SELL').length;
  const chatRatio = chatBuys / (chatBuys + chatSells + 1) * 100;  // % Bullish in chat
  
  const overallBuys = overallTrades.filter(t => t.isBuy).length;
  const overallSells = overallTrades.filter(t => !t.isBuy).length;
  const overallRatio = overallBuys / (overallBuys + overallSells + 1) * 100;
  
  const pressure = chatRatio - overallRatio;  // Positive = chat more bullish
  
  return {
    chatRatio: Math.round(chatRatio),
    overallRatio: Math.round(overallRatio),
    pressure: pressure > 0 ? `+${pressure.toFixed(0)}% Bull` : `${pressure.toFixed(0)}% Bear`,
    color: pressure > 10 ? 'text-green-400' : pressure < -10 ? 'text-red-400' : 'text-yellow-400'
  };
}

// New: Mute/alert state (localStorage for persistence) - now handled in component state

// New: Heatmap component
const ChatHeatmap = ({ topChatters }) => (
  <div className="grid grid-cols-3 gap-4 mt-4">
    {topChatters.map((c, i) => {
      const score = calculateLarpScore(c);
      const color = score > 70 ? 'bg-red-500' : score > 40 ? 'bg-yellow-500' : 'bg-green-500';
      return (
        <div key={i} className="flex flex-col items-center text-center">
          <span className="text-xs font-bold text-white mb-1">{c.username}</span>
          <div className={`w-full h-6 rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
          <span className={`text-xs mt-1 ${color.includes('red') ? 'text-red-400' : color.includes('yellow') ? 'text-yellow-400' : 'text-green-400'}`}>
            {score}%
          </span>
        </div>
      );
    })}
  </div>
);

// Enhanced modal with comprehensive wallet analysis
const EnhancedModal = ({ isOpen, onClose, selectedChatter, tokenId, tokenAnalysis, chatterBalances, userMessageCounts, formatBalance, mutedWallets, toggleMute, walletAnalysis, onRateWallet }) => {
  const [activeTab, setActiveTab] = useState('Profile');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  if (!isOpen || !selectedChatter) return null;
  
  const { username, address } = selectedChatter;
  const pnl = chatterBalances[address]?.pnl;
  const velocity = calculateVelocity([]);
  const analysis = walletAnalysis?.[address];
  const badges = WALLET_BADGES.get(address) || [];
  
  const tabs = [
    { id: 'Profile', label: 'Profile', icon: User },
    { id: 'Trades', label: 'Trades', icon: TrendingUp },
    { id: 'Analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'History', label: 'History', icon: Clock }
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border-2 border-purple-500/50 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden backdrop-blur-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Enhanced Header */}
        <div className="relative p-6 border-b border-purple-500/30 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 rounded-t-3xl" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <img 
                  src={APP_LOGO} 
                  alt="Logo" 
                  className="w-8 h-8 rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <div className="text-white font-black text-lg hidden">CS</div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text">
                  {username}
                </h3>
                <p className="text-sm text-gray-400 font-mono">{address.slice(0, 8)}...{address.slice(-8)}</p>
              </div>
            </div>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-3 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors border border-red-500/30" 
              onClick={onClose}
            >
              <X className="w-6 h-6 text-red-400" />
            </motion.button>
          </div>
          
          {/* Badges Row */}
          <div className="flex flex-wrap gap-2 mt-4">
            {badges.map((badge, idx) => (
              <motion.span
                key={idx}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  badge.color === 'red' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                  badge.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                  badge.color === 'green' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                  badge.color === 'blue' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                  badge.color === 'purple' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                  badge.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                  badge.color === 'orange' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                  badge.color === 'pink' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' :
                  'bg-gray-500/20 text-gray-300 border-gray-500/30'
                }`}
              >
                {badge.label}
              </motion.span>
            ))}
            {isAnalyzing && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30"
              >
                🔍 Analyzing...
              </motion.span>
            )}
          </div>
        </div>
        
        {/* Enhanced Tabs */}
        <div className="flex border-b border-zinc-700 bg-zinc-800/50">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <motion.button 
                key={tab.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm transition-all ${
                  activeTab === tab.id 
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </motion.button>
            );
          })}
        </div>
        
        {/* Tab Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'Profile' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                  <span className="text-gray-400 text-sm">Messages</span>
                  <div className="text-2xl font-black text-purple-400">{userMessageCounts[username] || 0}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                  <span className="text-gray-400 text-sm">Balance</span>
                  <div className="text-2xl font-black text-green-400">{formatBalance(chatterBalances[address]?.balance || 0)}</div>
                </div>
                {pnl && (
                  <>
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                      <span className="text-gray-400 text-sm">PnL</span>
                      <div className={`text-2xl font-black ${pnl.netSolPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl.netSolPnL >= 0 ? '+' : ''}{pnl.netSolPnL.toFixed(2)} SOL
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                      <span className="text-gray-400 text-sm">Trades</span>
                      <div className="text-2xl font-black text-blue-400">{pnl.transactionCount}</div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Enhanced Wallet Analysis Summary */}
              {analysis && (
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 border border-blue-500/30">
                  <h4 className="text-lg font-bold text-blue-400 mb-3">Portfolio Analysis</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-400">Risk Score</span>
                      <div className={`font-bold ${analysis.riskScore > 70 ? 'text-red-400' : analysis.riskScore > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {analysis.riskScore}/100
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Tokens</span>
                      <div className="font-bold text-white">{analysis.totalTokens || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Portfolio Value</span>
                      <div className="font-bold text-white">${(analysis.totalValue || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Diversity</span>
                      <div className="font-bold text-white">{analysis.portfolioDiversity || 0} tokens</div>
                    </div>
                  </div>
                  
                  {/* Top Holding */}
                  {analysis.topHolding && (
                    <div className="bg-black/20 rounded-lg p-3 mb-3">
                      <h5 className="text-sm font-bold text-purple-400 mb-2">Top Holding</h5>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-bold text-white">{analysis.topHolding.symbol}</div>
                          <div className="text-xs text-gray-400">{analysis.topHolding.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-400">${analysis.topHolding.value.toFixed(2)}</div>
                          <div className="text-xs text-gray-400">{analysis.topHolding.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Trading Categories */}
                  {analysis.preferredCategories && analysis.preferredCategories.length > 0 && (
                    <div className="bg-black/20 rounded-lg p-3">
                      <h5 className="text-sm font-bold text-cyan-400 mb-2">Preferred Categories</h5>
                      <div className="flex flex-wrap gap-2">
                        {analysis.preferredCategories.slice(0, 3).map((category, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                            {category.category.toUpperCase()} ({category.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Velocity in chat */}
              <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-xl p-4 border border-cyan-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-cyan-400 font-bold">Chat Velocity</span>
                  <TrendingUpDown className="w-5 h-5 text-cyan-400" />
                </div>
                <div className={`text-lg font-black ${velocity.color}`}>
                  {velocity.pressure}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'Trades' && (
            <div className="space-y-4">
              <h4 className="text-lg font-bold text-white">Trading Activity</h4>
              {pnl ? (
                <div className="space-y-3">
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total PnL</span>
                      <span className={`font-bold ${pnl.netSolPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl.netSolPnL >= 0 ? '+' : ''}{pnl.netSolPnL.toFixed(4)} SOL
                      </span>
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Transaction Count</span>
                      <span className="font-bold text-blue-400">{pnl.transactionCount}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400">No trading data available</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'Analysis' && (
            <div className="space-y-4">
              <h4 className="text-lg font-bold text-white">Detailed Analysis</h4>
              {analysis ? (
                <div className="space-y-4">
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <h5 className="font-bold text-purple-400 mb-2">Risk Assessment</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Overall Risk</span>
                        <span className={`font-bold ${analysis.riskScore > 70 ? 'text-red-400' : analysis.riskScore > 40 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {analysis.riskScore}/100
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${analysis.riskScore > 70 ? 'bg-red-500' : analysis.riskScore > 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${analysis.riskScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <h5 className="font-bold text-blue-400 mb-2">Wallet Characteristics</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Age</span>
                        <div className="font-bold text-white">{analysis.walletAge} days</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Activity</span>
                        <div className="font-bold text-white">{analysis.totalTransactions} txs</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Multi-Wallet</span>
                        <div className="font-bold text-white">{analysis.multiWalletCluster ? 'Yes' : 'No'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Suspicious</span>
                        <div className="font-bold text-white">{analysis.suspiciousActivity ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400">Analysis in progress...</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'History' && (
            <div className="space-y-4">
              <h4 className="text-lg font-bold text-white">Message History</h4>
              <div className="space-y-2">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Messages</span>
                    <span className="font-bold text-purple-400">{userMessageCounts[username] || 0}</span>
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Sentiment Score</span>
                    <span className="font-bold text-green-400">+{Math.floor(Math.random() * 20)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Enhanced Footer */}
        <div className="flex gap-3 p-6 border-t border-purple-500/30 bg-zinc-800/50">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleMute(address)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
              mutedWallets.has(address) 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                : 'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}
          >
            <Volume className="w-5 h-5" />
            {mutedWallets.has(address) ? 'Unmute' : 'Mute'}
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRateWallet && onRateWallet(address, username)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold"
          >
            <Star className="w-5 h-5" />
            Rate Wallet
          </motion.button>
          <motion.a 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href={`https://solscan.io/account/${address}`} 
            target="_blank"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold"
          >
            <ExternalLink className="w-5 h-5" />
            Solscan
          </motion.a>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LiveChat = ({ tokenId, tokenAnalysis, onMessageUpdate }) => {

  // State management
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [topChatters, setTopChatters] = useState([]);
  const [chatterBalances, setChatterBalances] = useState({});
  const [userMessageCounts, setUserMessageCounts] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [selectedChatter, setSelectedChatter] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [userReputations, setUserReputations] = useState({});
  const [currentUserWallet, setCurrentUserWallet] = useState(null);
  const [darkMode, setDarkMode] = useState(true);  // New: Theme toggle
  const [sentimentScores, setSentimentScores] = useState({});  // New: Per-chatter sentiment
  const [liveTrades, setLiveTrades] = useState([]);  // New: Live trade feed
  const [mutedWallets, setMutedWallets] = useState(new Set(JSON.parse(localStorage.getItem('mutedWallets') || '[]')));
  const [velocity, setVelocity] = useState({ chatRatio: 50, pressure: 'Neutral' });
  const messagesEndRef = useRef(null);

  // Helper functions
  const formatBalance = (balance) => {
    if (balance >= 1e9) return `${(balance / 1e9).toFixed(2)}B`;
    if (balance >= 1e6) return `${(balance / 1e6).toFixed(2)}M`;
    if (balance >= 1e3) return `${(balance / 1e3).toFixed(2)}K`;
    return balance.toFixed(2);
  };

  const truncateUsername = (username) => {
    if (username.length > 20) {
      return `${username.slice(0, 6)}...${username.slice(-6)}`;
    }
    return username;
  };

  const validateWalletAddress = (address) => {
    try {
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  };

  const [userAddresses, setUserAddresses] = useState({});
  const [devWalletAnalysis, setDevWalletAnalysis] = useState(null);
  const [walletAnalysis, setWalletAnalysis] = useState({});
  const [analyzingWallets, setAnalyzingWallets] = useState(new Set());

  // Check if a wallet is part of the dev cluster
  const isClusterWallet = (walletAddress) => {
    if (!devWalletAnalysis?.associatedWallets || !walletAddress) return false;
    return devWalletAnalysis.associatedWallets.includes(walletAddress);
  };

  // Analyze wallet comprehensively
  const analyzeWallet = async (walletAddress) => {
    if (!walletAddress || analyzingWallets.has(walletAddress)) return;
    
    setAnalyzingWallets(prev => new Set([...prev, walletAddress]));
    
    try {
      const analysis = await analyzeWalletComprehensive(walletAddress, tokenId);
      if (analysis) {
        setWalletAnalysis(prev => ({
          ...prev,
          [walletAddress]: analysis
        }));
      }
    } catch (error) {
      console.error('Wallet analysis failed:', error);
    } finally {
      setAnalyzingWallets(prev => {
        const newSet = new Set(prev);
        newSet.delete(walletAddress);
        return newSet;
      });
    }
  };

  // Store message via API fallback
  const storeMessageViaAPI = async (message, tokenId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/messages/store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: message.roomId || tokenId,
          message: message.message,
          tokenId: tokenId,
          username: message.username,
          timestamp: message.timestamp || Date.now().toString(),
          messageType: message.messageType || 'REGULAR',
          userAddress: message.userAddress,
          profileImage: message.profileImage
        })
      });
      
      if (response.ok) {
        console.log('💾 Message stored via API');
        return true;
      } else {
        throw new Error(`API storage failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('API storage error:', error.message);
      throw error;
    }
  };

  // WebSocket connection and message handling
  useEffect(() => {
    if (!tokenId) return;

    // Get both WebSocket connections
    const pumpfunSocket = getPumpfunSocket();
    const backendSocket = getBackendSocket();
    const roomId = tokenId; // Use tokenId directly as the room ID
    const backendRoomId = `pumpfun-${tokenId}`; // Backend uses this format
    
    console.log('🔍 Token ID (room ID):', tokenId);
    console.log('🔍 Backend room ID:', backendRoomId);
    
    // Join backend room for historical messages (only if backend socket is available)
    if (backendSocket) {
      backendSocket.emit('join', backendRoomId);
    }
    
    // Join PumpFun room using the token address as room ID
    pumpfunSocket.emit('join', roomId);
    
    // Check connection status
    const checkConnection = () => {
      const pumpfunConnected = pumpfunSocket.connected;
      const backendConnected = backendSocket ? backendSocket.connected : true; // Backend is optional
      setIsConnected(pumpfunConnected && backendConnected);
      
      if (pumpfunConnected && backendConnected) {
        console.log('✅ PumpFun connection active - Ready for chat');
      } else {
        console.log(`⚠️ Connection status - PumpFun: ${pumpfunConnected}, Backend: ${backendConnected}`);
      }
    };
    
    checkConnection();
    const connectionInterval = setInterval(checkConnection, 5000);

    const handleNewMessage = (message) => {
      console.log('📨 New PumpFun message received:', message);
      
      // Check if this message is for the current token
      const isForCurrentToken = message.roomId === tokenId;
      
      if (!isForCurrentToken) {
        console.log('📨 Ignoring message for different token');
        return;
      }

      console.log('📨 Processing message for current token:', tokenId);
      setMessages(prev => [...prev, message].slice(-100));
      
      // Store message via Prisma API
      storeMessageViaAPI(message, tokenId).then(() => {
        console.log('💾 Message stored via Prisma API');
        if (onMessageUpdate) onMessageUpdate();
      }).catch(apiError => {
        console.warn('API storage failed:', apiError.message);
        if (onMessageUpdate) onMessageUpdate();
      });
      
      // Update message counts
      setUserMessageCounts(prev => ({
        ...prev,
        [message.username]: (prev[message.username] || 0) + 1
      }));
      
      // Track online users and their addresses
      if (message.userAddress && validateWalletAddress(message.userAddress)) {
        setUserAddresses(prev => ({
          ...prev,
          [message.username]: message.userAddress
        }));
        
        setOnlineUsers(prev => new Set([...prev, message.userAddress]));
        
        // Analyze wallet comprehensively
        analyzeWallet(message.userAddress);
      }

      // Update top chatters
      setTopChatters(prev => {
        const updated = [...prev];
        const existing = updated.find(c => c.username === message.username);
        if (existing) {
          existing.count++;
        } else {
          updated.push({ username: message.username, count: 1, address: message.userAddress });
        }
        return updated.sort((a, b) => b.count - a.count).slice(0, 3);
      });
      
      // Fetch PnL data for this user and token
      if (message.userAddress) {
        fetchHeliusPnl(message.userAddress, tokenId, tokenAnalysis?.marketCap || 0).then(pnlData => {
          if (pnlData) {
            setChatterBalances(prev => ({
              ...prev,
              [message.userAddress]: {
                balance: message.tokenBalance || pnlData.tokenBalance,
                pnl: pnlData,
                username: message.username,
                timestamp: Date.now()
              }
            }));
          }
        }).catch(error => {
          console.error('Failed to fetch PnL for user:', message.userAddress, error);
        });

        // Sentiment analysis
        const bullishCount = message.message.toLowerCase().split(' ').filter(word => sentimentKeywords.bullish.includes(word)).length;
        const bearishCount = message.message.toLowerCase().split(' ').filter(word => sentimentKeywords.bearish.includes(word)).length;
        const sentiment = bullishCount - bearishCount;
        
        setSentimentScores(prev => ({
          ...prev,
          [message.userAddress]: (prev[message.userAddress] || 0) + sentiment
        }));
      }
    };

    // Listen for historical messages from backend
    if (backendSocket) {
      backendSocket.on('historicalMessages', (historicalMessages) => {
        console.log('📚 Historical messages received:', historicalMessages.length);
        try {
        const msgCounts = {};
        const addresses = {};
        historicalMessages.forEach(msg => {
          msgCounts[msg.username] = (msgCounts[msg.username] || 0) + 1;
          if (msg.user_address && validateWalletAddress(msg.user_address)) {
            addresses[msg.username] = msg.user_address;
          }
        });
        setUserMessageCounts(msgCounts);
        setUserAddresses(addresses);
        
        const sorted = Object.entries(msgCounts)
          .map(([username, count]) => ({ username, count, address: addresses[username] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        setTopChatters(sorted);
        
        setMessages(historicalMessages.slice(-50));
      } catch (error) {
        console.error('Failed to load historical messages:', error);
      }
    });
    }

    // Load historical messages from database and backend API
    const loadHistoricalMessages = async () => {
      try {
        let historicalMessages = [];
        
        // Load from Prisma API
        console.log('📚 Loading historical messages from API...');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/messages/${tokenId}?limit=100`);
        if (response.ok) {
          const apiMessages = await response.json();
          if (apiMessages && apiMessages.length > 0) {
            historicalMessages = apiMessages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp || Date.now(),
              messageType: msg.messageType || 'REGULAR',
              userAddress: msg.userAddress || '',
              profileImage: msg.profileImage || '',
              tokenBalance: msg.tokenBalance || 0,
              solBalance: msg.solBalance || 0,
              tokenPercentage: msg.tokenPercentage || null
            }));
            console.log('📚 Loaded', historicalMessages.length, 'messages from API');
          }
        } else {
          console.warn('📚 API fallback failed:', response.status, response.statusText);
        }
        
        if (historicalMessages.length > 0) {
          // Process message counts and addresses
          const msgCounts = {};
          const addresses = {};
          historicalMessages.forEach(msg => {
            msgCounts[msg.username] = (msgCounts[msg.username] || 0) + 1;
            if (msg.userAddress && validateWalletAddress(msg.userAddress)) {
              addresses[msg.username] = msg.userAddress;
            }
          });
          
          setUserMessageCounts(msgCounts);
          setUserAddresses(addresses);
          
          const sorted = Object.entries(msgCounts)
            .map(([username, count]) => ({ username, count, address: addresses[username] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
          setTopChatters(sorted);
          
          setMessages(historicalMessages.reverse().slice(-100));
          console.log('📚 Historical messages loaded and processed successfully');
        } else {
          console.log('📚 No historical messages found for this token');
        }
      } catch (error) {
        console.error('📚 Failed to load historical messages:', error);
      }
    };

    loadHistoricalMessages();

    // Listen for new messages from backend
    if (backendSocket) {
      backendSocket.on('pumpfun:newMessage', handleNewMessage);
    }

    // Listen for various possible message event names from PumpFun
    pumpfunSocket.on('pumpfun:newMessage', handleNewMessage);
    pumpfunSocket.on('message', handleNewMessage);
    pumpfunSocket.on('chat', handleNewMessage);
    pumpfunSocket.on('newMessage', handleNewMessage);
    pumpfunSocket.on('pumpfun:message', handleNewMessage);
    pumpfunSocket.on('pumpfun:chat', handleNewMessage);
    pumpfunSocket.on('livestream:message', handleNewMessage);
    pumpfunSocket.on('livestream:chat', handleNewMessage);

    return () => {
      clearInterval(connectionInterval);
      
      if (backendSocket) {
        backendSocket.emit('leave', backendRoomId);
        backendSocket.off('historicalMessages');
        backendSocket.off('pumpfun:newMessage', handleNewMessage);
      }
      
      pumpfunSocket.emit('leave', roomId);
      pumpfunSocket.off('pumpfun:newMessage', handleNewMessage);
      pumpfunSocket.off('message', handleNewMessage);
      pumpfunSocket.off('chat', handleNewMessage);
      pumpfunSocket.off('newMessage', handleNewMessage);
      pumpfunSocket.off('pumpfun:message', handleNewMessage);
      pumpfunSocket.off('pumpfun:chat', handleNewMessage);
      pumpfunSocket.off('livestream:message', handleNewMessage);
      pumpfunSocket.off('livestream:chat', handleNewMessage);
      
      setIsConnected(false);
    };
  }, [tokenId, tokenAnalysis, onMessageUpdate]);

  // Live trade webhook listener
  useEffect(() => {
    const backendSocket = getBackendSocket();
    
    // Skip if backend socket is not available
    if (!backendSocket) {
      console.log('🔌 Backend socket not available, skipping live trade listener');
      return undefined;
    }
    
    const handleLiveTrade = (trade) => {
      console.log('🔔 Live trade from webhook:', trade);
      
      setLiveTrades(prev => [trade, ...prev].slice(0, 10));
      
      // If trade.wallet in chatters, badge next message
      if (userAddresses && Object.values(userAddresses).includes(trade.wallet)) {
        const username = Object.entries(userAddresses).find(([u, a]) => a === trade.wallet)?.[0];
        if (username) {
          console.log(`🎯 Webhook trade by chatter: ${username} - ${trade.isBuy ? 'BUY' : 'SELL'} ${trade.amount}`);
        }
      }
    };

    backendSocket.on('liveTrade', handleLiveTrade);
    return () => backendSocket.off('liveTrade');
  }, [userAddresses]);

  // Dev wallet analysis when creator address is available
  useEffect(() => {
    if (tokenAnalysis?.creatorAddress && tokenId) {
      console.log('🔍 Analyzing dev wallet:', tokenAnalysis.creatorAddress);
      analyzeDevWallet(tokenAnalysis.creatorAddress, tokenId).then(analysis => {
        if (analysis) {
          console.log('📊 Dev wallet analysis result:', analysis);
          setDevWalletAnalysis(analysis);
        }
      }).catch(error => {
        console.warn('Dev wallet analysis failed:', error);
        setDevWalletAnalysis(null);
      });
    }
  }, [tokenAnalysis?.creatorAddress, tokenId]);

  const toggleMute = (wallet) => {
    setMutedWallets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wallet)) {
        newSet.delete(wallet);
      } else {
        newSet.add(wallet);
      }
      localStorage.setItem('mutedWallets', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  const openChatterModal = (chatter) => {
    setSelectedChatter(chatter);
    setIsModalOpen(true);
  };

  // Make renderTopChatter clickable
  const renderTopChatterClickable = (chatter, idx) => (
    <div key={chatter.username} onClick={() => openChatterModal(chatter)} className="cursor-pointer">
      {renderTopChatter(chatter, idx)}
    </div>
  );

  // Enhanced top chatter rendering with glassmorphism
  const renderTopChatter = (chatter, idx) => {
    const larpScore = calculateLarpScore(chatter);
    const isHighRisk = larpScore > 70;
    const isMediumRisk = larpScore > 40;
    
    const rankColors = [
      'from-yellow-400 via-yellow-500 to-orange-500',
      'from-gray-300 via-gray-400 to-gray-500',
      'from-orange-600 via-orange-700 to-red-600'
    ];
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: idx * 0.1, duration: 0.5 }}
        whileHover={{ scale: 1.02, y: -2 }}
        className={`group relative rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all ${
          idx === 0 
            ? 'bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 border-yellow-500/50 hover:border-yellow-400/70' 
            : idx === 1 
            ? 'bg-gradient-to-r from-zinc-800/50 to-zinc-700/50 border-zinc-600/50 hover:border-purple-500/50'
            : 'bg-gradient-to-r from-orange-900/30 to-orange-800/20 border-orange-500/50 hover:border-orange-400/70'
        } ${isHighRisk ? 'ring-2 ring-red-500/30' : ''} backdrop-blur-sm border`}
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/10 to-white/5 rounded-2xl opacity-50" />
        
        {/* Content */}
        <div className="relative z-10">
          {/* Badges */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`relative w-10 h-10 rounded-xl bg-gradient-to-r ${rankColors[idx]} flex items-center justify-center font-black text-lg shadow-lg`}>
                {idx + 1}
              </div>
              <div>
                <span className="text-lg font-black text-white">{truncateUsername(chatter.username)}</span>
                {isHighRisk && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs text-red-400 ml-2 px-2 py-1 bg-red-500/20 rounded-full"
                  >
                    ⚠️ HIGH RISK
                  </motion.span>
                )}
              </div>
              {mutedWallets.has(chatter.address) && (
                <VolumeX className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                {chatter.count} msgs
              </span>
              {chatter.address && (
                <span className="text-xs text-gray-400 font-mono">
                  {chatter.address.slice(0, 4)}...{chatter.address.slice(-4)}
                </span>
              )}
            </div>
          </div>
          
          {/* Heatmap bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-300 font-medium">Larp Risk</span>
              <span className={`font-black ${isHighRisk ? 'text-red-400' : isMediumRisk ? 'text-yellow-400' : 'text-green-400'}`}>
                {larpScore}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 overflow-hidden">
              <motion.div 
                className={`h-full rounded-full ${isHighRisk ? 'bg-red-500' : isMediumRisk ? 'bg-yellow-500' : 'bg-green-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(larpScore, 100)}%` }}
                transition={{ duration: 1, delay: idx * 0.2 }}
              />
            </div>
          </div>
          
          {/* Mute/alert buttons */}
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                toggleMute(chatter.address);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg transition-all ${
                mutedWallets.has(chatter.address) 
                  ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                  : 'bg-green-500/30 text-green-400 border border-green-500/50'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              {mutedWallets.has(chatter.address) ? 'Unmute' : 'Mute'}
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs bg-yellow-500/30 text-yellow-400 rounded-lg border border-yellow-500/50 transition-all"
            >
              <Bell className="w-4 h-4" />
              Alert
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Enhanced message rendering with glassmorphism bubbles
  const renderMessageBubble = (msg, idx) => {
    const isOwn = msg.userAddress === currentUserWallet;
    const larpScore = calculateLarpScore({ 
      messageCount: userMessageCounts[msg.username] || 0, 
      balance: msg.tokenBalance || 0,
      txCount: 0,
      isDevLinked: false,
      hasBought: false
    }, msg.message);
    const isMuted = mutedWallets.has(msg.userAddress);
    
    // Calculate sentiment
    const bullishCount = msg.message.toLowerCase().split(' ').filter(word => sentimentKeywords.bullish.includes(word)).length;
    const bearishCount = msg.message.toLowerCase().split(' ').filter(word => sentimentKeywords.bearish.includes(word)).length;
    const sentiment = bullishCount - bearishCount;
    
    if (isMuted) return null;  // Hide muted
    
    return (
      <motion.div
        key={msg.id || idx}
        initial={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.4, delay: idx * 0.05 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 sm:mb-4`}
      >
        <div className={`relative max-w-[85%] sm:max-w-[80%] rounded-xl sm:rounded-2xl p-3 sm:p-4 backdrop-blur-xl border transition-all group ${
          isOwn 
            ? 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white border-purple-500/30' 
            : 'bg-gradient-to-r from-gray-700/80 to-gray-600/80 text-gray-100 border-gray-500/30'
        } ${larpScore > 80 ? 'ring-2 ring-red-500/50 shadow-lg shadow-red-500/20' : 'shadow-lg'}`}>
          {/* Glassmorphism overlay */}
          <div className={`absolute inset-0 rounded-2xl ${
            isOwn 
              ? 'bg-gradient-to-br from-white/10 via-transparent to-white/5' 
              : 'bg-gradient-to-br from-white/5 via-transparent to-white/10'
          }`} />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm">
                  {isOwn ? 'You' : truncateUsername(msg.username)}
                </span>
                {/* Sentiment badges */}
                {sentiment > 2 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs px-2 py-1 bg-green-500/30 text-green-300 rounded-full border border-green-500/50"
                  >
                    🔥 Bullish
                  </motion.span>
                )}
                {sentiment < -2 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-xs px-2 py-1 bg-blue-500/30 text-blue-300 rounded-full border border-blue-500/50"
                  >
                    ❄️ Bearish
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 opacity-70" />
                <span className="text-xs opacity-70">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                {larpScore > 80 && (
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </motion.div>
                )}
              </div>
            </div>
            
            {/* Message */}
            <p className="text-sm break-words mb-3 font-medium">{msg.message}</p>
            
            {/* Enhanced Badges row with comprehensive wallet data */}
            <div className="flex items-center gap-2 flex-wrap">
              {msg.tokenBalance > 0 && (
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded-full border border-green-500/30">
                  💰 {msg.tokenBalance.toFixed(2)} tokens
                </span>
              )}
              {msg.solBalance > 0 && (
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                  💎 {msg.solBalance.toFixed(2)} SOL
                </span>
              )}
              {msg.tokenPercentage && (
                <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                  📊 {msg.tokenPercentage}%
                </span>
              )}
              
              {/* Enhanced wallet analysis badges */}
              {msg.userAddress && walletAnalysis[msg.userAddress] && (
                <>
                  {walletAnalysis[msg.userAddress].totalTokens > 10 && (
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                      🌐 {walletAnalysis[msg.userAddress].totalTokens} tokens
                    </span>
                  )}
                  {walletAnalysis[msg.userAddress].totalValue > 1000 && (
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">
                      💎 ${(walletAnalysis[msg.userAddress].totalValue / 1000).toFixed(1)}K
                    </span>
                  )}
                  {walletAnalysis[msg.userAddress].isActiveTrader && (
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded-full border border-green-500/30">
                      📈 ACTIVE
                    </span>
                  )}
                  {walletAnalysis[msg.userAddress].preferredCategories?.[0] && (
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                      {walletAnalysis[msg.userAddress].preferredCategories[0].category.toUpperCase()}
                    </span>
                  )}
                </>
              )}
              
              {larpScore > 80 && (
                <motion.span 
                  animate={{ pulse: [1, 1.1, 1] }}
                  className="text-xs px-2 py-1 bg-red-500/30 text-red-300 rounded-full border border-red-500/50"
                >
                  🚨 LARP?
                </motion.span>
              )}
              
              {/* Wallet Analysis Badges */}
              {msg.userAddress && WALLET_BADGES.get(msg.userAddress)?.map((badge, idx) => (
                <motion.span
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`text-xs px-2 py-1 rounded-full border ${
                    badge.color === 'red' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                    badge.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                    badge.color === 'green' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                    badge.color === 'blue' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                    badge.color === 'purple' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                    badge.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                    badge.color === 'orange' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                    badge.color === 'pink' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' :
                    'bg-gray-500/20 text-gray-300 border-gray-500/30'
                  }`}
                >
                  {badge.label}
                </motion.span>
              ))}
              
              {/* Analyzing indicator */}
              {msg.userAddress && analyzingWallets.has(msg.userAddress) && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30"
                >
                  🔍 Analyzing...
                </motion.span>
              )}
              {isClusterWallet(msg.userAddress) && (
                <motion.span 
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-xs px-2 py-1 bg-yellow-500/30 text-yellow-300 rounded-full border border-yellow-500/50"
                >
                  🔗 CLUSTER
                </motion.span>
              )}
              {msg.tokenBalance === 0 && msg.solBalance === 0 && (
                <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">
                  ⚠️ NO TOKENS
                </span>
              )}
            </div>
            
            {/* Reactions */}
            <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
              >
                <ThumbsUp className="w-4 h-4" />
                <span>React</span>
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
              >
                <ThumbsDown className="w-4 h-4" />
              </motion.button>
            </div>
            
            {/* Velocity context if trade-related */}
            {msg.isTrade && (
              <div className="mt-2 text-xs px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30 inline-block">
                {velocity.pressure}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Enhanced Live ticker
  const renderTicker = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="relative mb-6 overflow-hidden rounded-2xl"
    >
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 via-blue-900/40 to-cyan-900/40 backdrop-blur-xl border border-white/10" />
      
      <div className="relative z-10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="text-sm font-bold text-gray-300">Live Trades</span>
        </div>
        <div className="flex animate-scroll whitespace-nowrap gap-3">
          {liveTrades.length > 0 ? (
            liveTrades.map((trade, idx) => (
              <motion.div 
                key={idx}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl mx-2 border backdrop-blur-sm ${
                  trade.type === 'BUY' 
                    ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span className="text-xs font-bold">{trade.username} {trade.type}</span>
                {trade.impact > 0.1 && <span className="text-xs">🐋</span>}
                <span className="text-xs opacity-80">(${trade.impact?.toFixed(2) || '0.00'} impact)</span>
              </motion.div>
            ))
          ) : (
            <div className="text-center w-full py-4">
              <span className="text-xs text-gray-400">No trades yet...</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  // Filter messages: Hide muted
  const filteredMessages = messages.filter(msg => !mutedWallets.has(msg.userAddress));

  // Enhanced Header with glassmorphism
  const renderHeader = () => (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="relative mb-4 sm:mb-8"
    >
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 rounded-2xl sm:rounded-3xl backdrop-blur-xl border border-white/10" />
      
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 lg:p-8 gap-4 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl shadow-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <img 
              src={APP_LOGO} 
              alt="ChatScan" 
              className="w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <div className="text-white font-black text-lg sm:text-xl hidden">CS</div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text truncate">
              Live Chat Radar
            </h2>
            <p className="text-gray-300 text-xs sm:text-sm mt-1 truncate">
              Token: {tokenId?.slice(0, 6)}...{tokenId?.slice(-4)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Connection badges */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-500/20 rounded-full border border-blue-500/30 backdrop-blur-sm"
          >
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-blue-400">Helius</span>
          </motion.div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border backdrop-blur-sm ${
              isConnected 
                ? 'bg-green-500/20 border-green-500/30' 
                : 'bg-red-500/20 border-red-500/30'
            }`}
          >
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className={`text-xs font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </motion.div>
          {/* Theme toggle */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setDarkMode(!darkMode)}
            className="p-3 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-white/10 backdrop-blur-sm"
          >
            {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );

  // Enhanced Token velocity badge
  const velocityBadge = (
    <motion.div 
      whileHover={{ scale: 1.05 }}
      className={`px-4 py-2 rounded-xl backdrop-blur-sm border ${velocity.color} bg-opacity-20`}
    >
      <div className="flex items-center gap-2">
        <TrendingUpDown className="w-4 h-4" />
        <span className="text-xs font-bold">Chat Velocity: {velocity.pressure}</span>
      </div>
    </motion.div>
  );

  // Update velocity on trade/message changes
  useEffect(() => {
    setVelocity(calculateVelocity(liveTrades));  // From liveTrades state
  }, [liveTrades]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white' 
        : 'bg-gradient-to-br from-gray-100 via-white to-gray-100 text-black'
    }`}>
      {/* Enhanced Background Effects */}
      {darkMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {/* Animated background particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: 0,
                scale: 0,
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: [0, 0.6, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                delay: Math.random() * 5,
                ease: "easeInOut",
              }}
            />
          ))}
          
          {/* Floating orbs */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={`orb-${i}`}
              className="absolute w-24 h-24 rounded-full opacity-10"
              style={{
                background: `radial-gradient(circle, ${
                  i % 2 === 0 ? 'rgba(168, 85, 247, 0.3)' : 'rgba(236, 72, 153, 0.3)'
                } 0%, transparent 70%)`,
              }}
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                scale: 0,
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                delay: Math.random() * 10,
                ease: "easeInOut",
              }}
            />
          ))}
          
          {/* Enhanced gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-transparent to-pink-900/15" />
          <div className="absolute inset-0 bg-gradient-to-tl from-blue-900/10 via-transparent to-cyan-900/10" />
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 p-2 sm:p-4 lg:p-6 xl:p-8">
        {/* Enhanced Header */}
        {renderHeader()}
        
        {/* Token Analysis with velocity */}
        {tokenAnalysis && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative mb-6"
          >
            {/* Glassmorphism background */}
            <div className="absolute inset-0 bg-gradient-to-r from-gray-800/30 via-gray-900/30 to-gray-800/30 rounded-2xl backdrop-blur-xl border border-white/10" />
            
            <div className="relative z-10 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text">
                  📊 Analysis Radar
                </h3>
                {velocityBadge}
              </div>
            </div>
          </motion.div>
        )}

        {/* Enhanced Top Chatters */}
        {topChatters.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-4 sm:mb-6"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              <h3 className="text-lg sm:text-xl font-black text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text">
                Top Chatters
              </h3>
            </div>
            <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
              {topChatters.map((c, i) => renderTopChatterClickable(c, i))}
            </div>
            <ChatHeatmap topChatters={topChatters} />
          </motion.div>
        )}

        {/* Enhanced Live Ticker */}
        {renderTicker()}

        {/* Enhanced Chat container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative mb-4"
        >
          {/* Glassmorphism background */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800/40 via-gray-900/40 to-gray-800/40 rounded-xl sm:rounded-2xl backdrop-blur-xl border border-white/10" />
          
          <div className="relative z-10 p-3 sm:p-6 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            <div className="absolute top-4 right-4 flex gap-2 z-20">
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full bg-purple-500/20 hover:bg-purple-500/40 transition-colors"
              >
                <Mic className="w-4 h-4 text-purple-400" />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full bg-blue-500/20 hover:bg-blue-500/40 transition-colors"
              >
                <Volume className="w-4 h-4 text-blue-400" />
              </motion.button>
            </div>
            
            {filteredMessages.length === 0 ? (
              <div className="text-center py-16">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <MessageCircle className="w-20 h-20 mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400 text-lg font-medium">No messages yet</p>
                  <p className="text-gray-500 text-sm mt-2">Join the action!</p>
                </motion.div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((msg, idx) => renderMessageBubble(msg, idx))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </motion.div>
      </div>

      {/* Enhanced Modal */}
      <EnhancedModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        selectedChatter={selectedChatter} 
        tokenId={tokenId} 
        tokenAnalysis={tokenAnalysis}
        chatterBalances={chatterBalances}
        userMessageCounts={userMessageCounts}
        formatBalance={formatBalance}
        mutedWallets={mutedWallets}
        toggleMute={toggleMute}
        walletAnalysis={walletAnalysis}
        onRateWallet={(wallet, username) => {
          setRatingTarget({ wallet, username });
          setIsRatingModalOpen(true);
        }}
      />
      
      {/* Wallet Rating Modal - Global Ratings */}
      <WalletRatingModal
        isOpen={isRatingModalOpen}
        onClose={() => {
          setIsRatingModalOpen(false);
          setRatingTarget(null);
        }}
        targetWallet={ratingTarget?.wallet}
        targetUsername={ratingTarget?.username}
        tokenId={null} // Global ratings - no tokenId
      />
    </div>
  );
};

export default LiveChat;
