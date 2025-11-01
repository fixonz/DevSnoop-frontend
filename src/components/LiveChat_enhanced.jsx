import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Star, TrendingUp, Wallet, ExternalLink, X, User, Clock, ThumbsUp, ThumbsDown, AlertTriangle, Zap, Sun, Moon, MessageSquare, Volume2, VolumeX, Bell, BarChart3, Mic, Mic2, Volume, Gauge, PieChart, TrendingUpDown } from 'lucide-react';
import { useDevapp } from '@devfunlabs/web-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { getPumpfunSocket } from '../utils/websocket';
import { getWalletReputation, rateWallet, canRateWallet } from '../services/ratingService';
import ReputationBadge from './ReputationBadge';
import WalletRatingModal from './WalletRatingModal';
import { getRecentTransactions, getSolBalance } from '../utils/solanaWeb3';

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

// Enhanced PnL fetch with caching & impact calculation - Now using Web3.js
const fetchHeliusPnl = async (wallet, tokenMint, currentMCap = 0) => {
  const cacheKey = `pnl-${wallet}-${tokenMint}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60000) return cached.data; // 60s cache
  
  try {
    // Use Web3.js for SOL balance (faster, more reliable)
    const solData = await getSolBalance(wallet).catch(() => ({ balance: 0 }));
    const solBalance = solData.balance || 0;
    
    // For token balance, we'd need the token mint - use fallback to direct API if needed
    // This is a simplified version - can be enhanced with getTokenBalance from Web3.js
    const tokenBalance = 0; // Will be populated elsewhere if needed
    
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
    console.error('PnL fetch failed:', error);
    return { tokenBalance: 0, solBalance: 0, impact: 0, avgTradeSize: 0 };
  }
};

// Dev wallet analysis (enhanced) - Updated to use Web3.js where possible
const analyzeDevWallet = async (devWallet, tokenMint) => {
  const cacheKey = `dev-${devWallet}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) return cached.data; // 30s cache
  
  try {
    // Try Web3.js first, fallback to enhanced API for token transfer details
    let transactions = [];
    try {
      transactions = await getRecentTransactions(devWallet, 50);
    } catch (error) {
      // Fallback to enhanced API for detailed token transfer data
      const response = await fetch(`https://api.helius.xyz/v0/addresses/${devWallet}/transactions?api-key=${HELIUS_API_KEY}&limit=50`);
      if (response.ok) {
        transactions = await response.json();
      }
    }
    
    if (!transactions?.length) return null;
    
    const tokenTransactions = transactions.filter(tx => 
      tx.tokenTransfers?.some(transfer => transfer.mint === tokenMint)
    );
    
    // Multi-wallet detection
    const associatedWallets = new Set();
    tokenTransactions.forEach(tx => {
      tx.tokenTransfers?.forEach(transfer => {
        if (transfer.fromUserAccount) associatedWallets.add(transfer.fromUserAccount);
        if (transfer.toUserAccount) associatedWallets.add(transfer.toUserAccount);
      });
    });
    
    // Coordinated buys detection
    const recentBuys = tokenTransactions
      .filter(tx => tx.tokenTransfers?.some(t => t.toUserAccount === devWallet))
      .slice(0, 10);
    
    const coordinatedBuys = recentBuys.filter(tx => {
      const timestamp = new Date(tx.timestamp * 1000);
      const now = new Date();
      return (now - timestamp) < 24 * 60 * 60 * 1000; // Last 24h
    });
    
    const result = {
      isMultiWallet: associatedWallets.size > 3,
      associatedWallets: Array.from(associatedWallets),
      recentBuys: recentBuys.length,
      coordinatedBuys: coordinatedBuys.length,
      timeline: recentBuys.map(tx => ({
        signature: tx.signature,
        timestamp: tx.timestamp,
        amount: tx.tokenTransfers?.find(t => t.toUserAccount === devWallet)?.tokenAmount || 0
      }))
    };
    
    apiCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Dev wallet analysis failed:', error);
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
  if (balance < 1000) score += 15; // Very low balance
  
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

// New: Mute/alert state (localStorage for persistence)
const mutedWallets = new Set(JSON.parse(localStorage.getItem('mutedWallets') || '[]'));
const toggleMute = (wallet) => {
  if (mutedWallets.has(wallet)) {
    mutedWallets.delete(wallet);
  } else {
    mutedWallets.add(wallet);
  }
  localStorage.setItem('mutedWallets', JSON.stringify(Array.from(mutedWallets)));
};

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

// Enhanced modal with tabs & pie chart
const EnhancedModal = ({ isOpen, onClose, selectedChatter, tokenId, tokenAnalysis, chatterBalances, userMessageCounts, formatBalance }) => {
  if (!isOpen || !selectedChatter) return null;
  
  const { username, address } = selectedChatter;
  const pnl = chatterBalances[address]?.pnl;
  const velocity = calculateVelocity([]);  // From state
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border-2 border-purple-500/50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with logo & close */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/30 bg-gradient-to-r from-purple-900/50 to-blue-900/50">
          <div className="flex items-center gap-3">
            <img src={APP_LOGO} alt="Logo" className="w-8 h-8 rounded-full" />
            <h3 className="text-xl font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
              {username} Profile
            </h3>
          </div>
          <button className="p-2 rounded-full bg-purple-500/20 hover:bg-purple-500/40 transition-colors" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          {['Profile', 'Trades', 'History'].map(tab => (
            <button key={tab} className="flex-1 py-3 font-bold text-sm transition-colors">
              {tab}
            </button>
          ))}
        </div>
        
        {/* Content: Profile tab */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">Messages</span>
              <div className="font-bold text-purple-400">{userMessageCounts[username] || 0}</div>
            </div>
            <div>
              <span className="text-zinc-400">Balance</span>
              <div className="font-bold text-green-400">{formatBalance(chatterBalances[address]?.balance)}</div>
            </div>
            {pnl && (
              <>
                <div>
                  <span className="text-zinc-400">PnL</span>
                  <div className={`font-bold ${pnl.netSolPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnl.netSolPnL >= 0 ? '+' : ''}{pnl.netSolPnL.toFixed(2)} SOL
                  </div>
                </div>
                <div>
                  <span className="text-zinc-400">Trades</span>
                  <div className="font-bold text-blue-400">{pnl.transactionCount}</div>
                </div>
              </>
            )}
          </div>
          
          {/* Pie chart for holdings (simple SVG) */}
          <div className="relative">
            <PieChart className="w-16 h-16 mx-auto" />
            {/* Add SVG path for pie slices based on holdings % */}
          </div>
          
          {/* Velocity in chat */}
          <div className="p-3 bg-gradient-to-r from-blue-900/30 to-green-900/30 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-400">Chat Velocity</span>
              <TrendingUpDown className="w-4 h-4" />
            </div>
            <div className={`text-sm font-bold ${velocity.color}`}>
              {velocity.pressure}
            </div>
          </div>
          
          {/* Mute/alert buttons */}
          <div className="flex gap-2">
            <button className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
              mutedWallets.has(address) ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            }`}>
              <Volume className="w-4 h-4" />
              {mutedWallets.has(address) ? 'Unmute' : 'Mute'}
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg">
              <Bell className="w-4 h-4" />
              Alert
            </button>
          </div>
          
          {/* Wallet address */}
          <div className="text-xs font-mono bg-zinc-900 rounded p-2 overflow-auto">
            {address}
          </div>
        </div>
        
        {/* Footer: Solscan & chart */}
        <div className="flex gap-2 p-4 border-t border-purple-500/30">
          <a href={`https://solscan.io/account/${address}`} className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg">
            <ExternalLink className="w-4 h-4" />
            Solscan
          </a>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg">
            <BarChart3 className="w-4 h-4" />
            Chart
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LiveChat = ({ tokenId, tokenAnalysis, onMessageUpdate }) => {
  let devbaseClient = null;
  try {
    const devapp = useDevapp();
    devbaseClient = devapp?.devbaseClient;
  } catch (error) {
    console.warn('Devapp not available:', error);
  }

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

  // Mute/alert in top chatters
  const renderTopChatter = (chatter, idx) => (
    <motion.div 
      key={chatter.username} 
      whileHover={{ scale: 1.02 }}
      className="group relative bg-gradient-to-r from-zinc-800 to-zinc-700 rounded-xl p-3 border border-zinc-600/50 hover:border-purple-500/50 transition-all"
    >
      {/* Badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-black ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-zinc-300' : 'text-orange-500'}`}>
            #{idx + 1}
          </span>
          <span className="text-base font-bold text-white">{truncateUsername(chatter.username)}</span>
          {mutedWallets.has(chatter.address) && <VolumeX className="w-4 h-4 text-red-500" />}
        </div>
        <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
          {chatter.count} msgs
        </span>
      </div>
      
      {/* Heatmap bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-zinc-400">Larp Risk</span>
          <span className="text-purple-400">{calculateLarpScore(chatter)}%</span>
        </div>
        <div className={`h-2 rounded-full bg-gradient-to-r from-red-500 to-green-500`}>
          <motion.div 
            className="h-full bg-red-500 rounded-full" 
            initial={{ width: 0 }}
            animate={{ width: `${calculateLarpScore(chatter)}%` }}
          />
        </div>
      </div>
      
      {/* Mute/alert buttons */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => toggleMute(chatter.address)}
          className={`flex-1 flex items-center justify-center gap-1 py-1 text-xs rounded ${mutedWallets.has(chatter.address) ? 'bg-red-500/30 text-red-400' : 'bg-green-500/30 text-green-400'}`}
        >
          <Volume2 className="w-3 h-3" />
          {mutedWallets.has(chatter.address) ? 'Unmute' : 'Mute'}
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.95 }}
          className="flex-1 flex items-center justify-center gap-1 py-1 text-xs bg-yellow-500/30 text-yellow-400 rounded"
        >
          <Bell className="w-3 h-3" />
          Alert
        </motion.button>
      </div>
    </motion.div>
  );

  // Enhanced message rendering with bubbles & reactions
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
    
    if (isMuted) return null;  // Hide muted
    
    return (
      <motion.div
        key={msg.id || idx}
        initial={{ opacity: 0, x: isOwn ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`max-w-[80%] p-3 rounded-2xl relative ${
          isOwn 
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
            : 'bg-gradient-to-r from-zinc-700 to-zinc-600 text-zinc-200'
        } ${larpScore > 80 ? 'ring-2 ring-red-500/30' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-xs">
              {isOwn ? 'You' : truncateUsername(msg.username)}
            </span>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 opacity-70" />
              <span className="text-xs opacity-70">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              {larpScore > 80 && <AlertTriangle className="w-4 h-4 text-red-500" />}
            </div>
          </div>
          
          {/* Message */}
          <p className="text-sm break-words">{msg.message}</p>
          
          {/* Badges row */}
          <div className="flex items-center gap-2 mt-2">
            {msg.tokenBalance > 0 && (
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                {msg.tokenBalance.toFixed(2)} tokens
              </span>
            )}
            {msg.solBalance > 0 && (
              <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                {msg.solBalance.toFixed(2)} SOL
              </span>
            )}
            {msg.tokenPercentage && (
              <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                {msg.tokenPercentage}%
              </span>
            )}
            {larpScore > 80 && (
              <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                ?? LARP?
              </span>
            )}
          </div>
          
          {/* Reactions */}
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button whileTap={{ scale: 0.9 }} className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100">
              <ThumbsUp className="w-4 h-4" />
              <span>React</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100">
              <ThumbsDown className="w-4 h-4" />
            </motion.button>
          </div>
          
          {/* Velocity context if trade-related */}
          {msg.isTrade && <div className="mt-1 text-xs px-2 py-1 bg-blue-500/20 rounded-full">{velocity.pressure}</div>}
        </div>
      </motion.div>
    );
  };

  // New: Live ticker
  const renderTicker = () => (
    <div className="relative overflow-hidden bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-2 mb-4">
      <div className="flex animate-scroll whitespace-nowrap">
        {liveTrades.map((trade, idx) => (
          <div key={idx} className={`inline-flex items-center gap-2 px-3 py-2 rounded-full mx-2 ${
            trade.type === 'BUY' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
          }`}>
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold">{trade.username} {trade.type} {trade.impact > 0.1 ? '??' : ''}</span>
            <span className="text-xs">(${trade.impact.toFixed(2)} impact)</span>
          </div>
        ))}
        {liveTrades.length === 0 && <span className="px-4 py-2 text-xs text-zinc-500">No trades yet...</span>}
      </div>
    </div>
  );

  // Filter messages: Hide muted
  const filteredMessages = messages.filter(msg => !mutedWallets.has(msg.userAddress));

  // Header with logo & theme toggle
  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <img src={APP_LOGO} alt="ChatScan" className="w-10 h-10 rounded-full shadow-lg" />
        <div>
          <h2 className="text-xl font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            Live Chat Radar
          </h2>
          <p className="text-xs text-zinc-400">Token: {tokenId?.slice(0, 8)}...</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Connection badges */}
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 rounded-full">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-xs text-blue-400">Helius</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-full ${isConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className={`text-xs font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
        {/* Theme toggle */}
        <motion.button whileHover={{ scale: 1.1 }} onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
        </motion.button>
      </div>
    </div>
  );

  // Token velocity badge in analysis section
  const velocityBadge = (
    <div className={`px-3 py-2 rounded-full ${velocity.color} bg-opacity-20 border border-opacity-50`}>
      <div className="flex items-center gap-1">
        <TrendingUpDown className="w-4 h-4" />
        <span className="text-xs font-bold">Chat Velocity: {velocity.pressure}</span>
      </div>
    </div>
  );

  // Update velocity on trade/message changes
  useEffect(() => {
    setVelocity(calculateVelocity(liveTrades));  // From liveTrades state
  }, [liveTrades]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-black'} transition-colors`}>
      {/* Header with logo */}
      {renderHeader()}
      
      {/* Token Analysis with velocity */}
      {tokenAnalysis && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-zinc-800/50 rounded-xl p-4 mb-4 border border-zinc-700/50"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-black text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text">
              Analysis Radar
            </h3>
            {velocityBadge}
          </div>
          {/* ... (existing grid) */}
        </motion.div>
      )}

      {/* Top Chatters with heatmap */}
      {topChatters.length > 0 && (
        <div className="mb-4">
          <h3 className="text-lg font-black mb-3 flex items-center gap-2 text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            <Star className="w-5 h-5" />
            Top 3 + Heatmap
          </h3>
          <div className="space-y-3">
            {topChatters.map((c, i) => renderTopChatter(c, i))}
          </div>
          <ChatHeatmap topChatters={topChatters} />
        </div>
      )}

      {/* Chat container with bubbles */}
      <div className="bg-zinc-800/30 rounded-xl p-4 mb-4 max-h-96 overflow-y-auto relative">
        <div className="absolute top-2 right-2 flex gap-2">
          <button className="p-1 rounded-full bg-mic-500/20"><Mic className="w-4 h-4" /></button>
          <button className="p-1 rounded-full bg-volume-500/20"><Volume className="w-4 h-4" /></button>
        </div>
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-500">No messages yet. Join the action!</p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => renderMessageBubble(msg, idx))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Use EnhancedModal instead of old one */}
      <EnhancedModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        selectedChatter={selectedChatter} 
        tokenId={tokenId} 
        tokenAnalysis={tokenAnalysis}
        chatterBalances={chatterBalances}
        userMessageCounts={userMessageCounts}
        formatBalance={formatBalance}
      />
    </div>
  );
};

export default LiveChat;
