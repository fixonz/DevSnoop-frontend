import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink, MessageCircle, TrendingUp, Star, Wallet, X } from 'lucide-react';
import { useDevapp, fetchPumpFunTrends } from '@devfunlabs/web-sdk';
import { io } from 'socket.io-client';
import { Connection, PublicKey } from '@solana/web3.js';

const socket = io('wss://ws.dev.fun/app-a9a79a90906b540da651');

export default function TokenDetail() {
  const { mint } = useParams();
  const navigate = useNavigate();
  
  // Get userWallet from Devapp - hooks must be called unconditionally
  const devappHook = useDevapp();
  const userWallet = devappHook?.userWallet || null;

  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [topChatters, setTopChatters] = useState([]);
  const [isChatConnected, setIsChatConnected] = useState(false);
  const [chatterRatings, setChatterRatings] = useState({});
  const [holderBalances, setHolderBalances] = useState({});
  const [tokenSupply, setTokenSupply] = useState(0);
  const [chatterBalances, setChatterBalances] = useState({});
  const [walletSolBalances, setWalletSolBalances] = useState({});
  const [isFirstCoinBought, setIsFirstCoinBought] = useState({});
  const [topChattersSortBy, setTopChattersSortBy] = useState('messages');
  const [selectedChatter, setSelectedChatter] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userMessageCounts, setUserMessageCounts] = useState({});
  const [userAddresses, setUserAddresses] = useState({});
  const [holderHistory, setHolderHistory] = useState({});
  const [solanaTrackerTxs, setSolanaTrackerTxs] = useState(null);
  const [solanaTrackerTxsLoading, setSolanaTrackerTxsLoading] = useState(false);
  const [solanaTrackerPnl, setSolanaTrackerPnl] = useState(null);
  const [solanaTrackerPnlLoading, setSolanaTrackerPnlLoading] = useState(false);
  const [txLoadError, setTxLoadError] = useState(null);
  const [modalView, setModalView] = useState('transactions');
  const [firstBuyers, setFirstBuyers] = useState(new Set());
  const [topHolders, setTopHolders] = useState(new Set());
  const [devFundedWallets, setDevFundedWallets] = useState(new Set());
  const [creatorAddress, setCreatorAddress] = useState(null);
  const [devWalletsLoaded, setDevWalletsLoaded] = useState(false);
  const [tokenCreationTime, setTokenCreationTime] = useState(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [recentTraders, setRecentTraders] = useState({});
  const [lastAutoRefresh, setLastAutoRefresh] = useState(null);
  const [autoRefreshCount, setAutoRefreshCount] = useState(0);
  const [liveTransactions, setLiveTransactions] = useState([]);

  // Define all loader functions BEFORE useEffect (required for build)
  // Using useCallback to ensure functions are stable for useEffect dependencies
  
  // Helper function for fetching Helius transactions
  const fetchHeliusTransactionsOnly = async (tokenMint, walletAddress) => {
    try {
      // Use direct Helius API call (no proxy needed)
      if (walletAddress) {
        const directUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=10d64fda-22a9-4d18-9209-712683742a1d&type=SWAP&limit=100`;
        const directResponse = await fetch(directUrl);
        if (!directResponse.ok) return [];
        const directData = await directResponse.json();
        return Array.isArray(directData) ? directData : (directData.transactions || []);
      }
      
      return [];
    } catch (error) {
      console.error('Helius transactions fetch failed:', error);
      return [];
    }
  };

  const loadRecentTransactions = useCallback(async () => {
    try {
      console.log('🔍 Loading recent transactions via Helius API...');
      const recentTxs = await fetchHeliusTransactionsOnly(mint, null);

      const traders = {};
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

      recentTxs.forEach(tx => {
        if (!tx.walletAddress || !tx.time) return;

        const txTime = new Date(tx.time).getTime();
        if (txTime < fiveMinutesAgo) return;

        if (!traders[tx.walletAddress] || txTime > traders[tx.walletAddress].timestamp) {
          traders[tx.walletAddress] = {
            type: tx.type,
            timestamp: txTime,
            amount: tx.amount || 0
          };
        }
      });

      setRecentTraders(traders);
      console.log(`✅ Updated recent traders: ${Object.keys(traders).length} active wallets (Helius-powered)`);
    } catch (error) {
      console.error('Failed to load recent transactions:', error);
    }
  }, [mint]);

  const loadToken = useCallback(async () => {
    try {
      // Load token data from DexScreener or other sources
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        setToken({
          id: mint,
          symbol: pair.baseToken?.symbol || 'Unknown',
          name: pair.baseToken?.name || 'Unknown Token',
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
          volume24h: parseFloat(pair.volume?.h24) || 0,
          marketCap: parseFloat(pair.marketCap) || 0,
          totalHolders: parseInt(pair.holders) || 0,
          image: pair.baseToken?.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${pair.baseToken?.symbol}`,
          liquidity: parseFloat(pair.liquidity?.usd) || 0
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load token:', error);
      setLoading(false);
    }
  }, [mint]);

  const loadTokenSupply = useCallback(async () => {
    // Implementation for loading token supply
    setTokenSupply(1000000); // Placeholder
  }, []);

  const loadChatterRatings = useCallback(async () => {
    // Implementation for loading chatter ratings
  }, []);

  const loadHolderBalances = useCallback(async () => {
    // Implementation for loading holder balances
  }, []);

  const loadHistoricalMessages = useCallback(async () => {
    try {
      console.log('📚 Loading archived messages from Prisma API...');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/messages/${mint}?limit=100`);
      if (response.ok) {
        const messages = await response.json();
        console.log('📚 Loaded', messages.length, 'archived messages from Prisma API');
        setChatMessages(messages.slice(-100));
      } else {
        console.warn('📚 Failed to load messages from API:', response.status);
      }
    } catch (error) {
      console.error('📚 Failed to load historical messages:', error);
    }
  }, [mint]);

  const loadFirstBuyers = useCallback(async () => {
    // Implementation for loading first buyers
  }, []);

  const loadTopHolders = useCallback(async () => {
    // Implementation for loading top holders
  }, []);

  const loadDevFundedWallets = useCallback(async () => {
    // Implementation for loading dev funded wallets
  }, []);

  useEffect(() => {
    setChatMessages([]);
    setTopChatters([]);
    setUserMessageCounts({});
    setUserAddresses({});
    setChatterBalances({});
    setWalletSolBalances({});
    setIsFirstCoinBought({});
    setRecentTraders({});
    setLiveTransactions([]);

    loadToken();
    loadTokenSupply();
    loadChatterRatings();
    loadHolderBalances();
    loadHistoricalMessages();
    loadFirstBuyers();
    loadTopHolders();
    loadDevFundedWallets();
    loadRecentTransactions();

    const roomId = `pumpfun-${mint}`;
    socket.emit('join', roomId);
    setIsChatConnected(true);
    console.log(`📡 Connected to PumpFun livestream for ${mint}`);

    const handleNewMessage = async message => {
      const messageTokenId = message.roomId?.replace('pumpfun-', '') || '';

      if (messageTokenId !== mint) {
        console.log('Ignoring message from different token:', messageTokenId);
        return;
      }

      try {
        // Store message via Prisma API
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/messages/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...message,
            tokenId: mint
          })
        });
        
        if (!response.ok) {
          console.warn('Failed to store message via API:', response.status);
        }
      } catch (error) {
        console.error('Failed to persist message:', error);
      }

      setChatMessages(prev => {
        const newMessages = [...prev, message].slice(-100);
        return newMessages;
      });

      setUserMessageCounts(prev => ({
        ...prev,
        [message.username]: (prev[message.username] || 0) + 1
      }));

      if (message.userAddress) {
        setUserAddresses(prev => ({
          ...prev,
          [message.username]: message.userAddress
        }));
      }
    };

    socket.on('pumpfun:newMessage', handleNewMessage);

    return () => {
      socket.emit('leave', roomId);
      socket.off('pumpfun:newMessage', handleNewMessage);
      setIsChatConnected(false);
      console.log(`📡 Disconnected from PumpFun livestream for ${mint}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4AA] mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold mb-4">Loading Token...</h2>
          <p className="text-gray-400">Please wait while we fetch the token data.</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Token Not Found</h2>
          <p className="text-gray-400 mb-6">The token you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-[#00D4AA] text-black font-bold rounded-lg hover:bg-[#00D4AA]/80 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <img 
              src={token?.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiM4QjVDRkYiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJjZW50cmFsIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iYm9sZCI+PzwvdGV4dD4KPC9zdmc+'} 
              alt={token?.name || 'Token'} 
              className="w-12 h-12 rounded-full border-2 border-[#00D4AA]" 
            />
            <div>
              <h1 className="text-3xl font-bold">{token?.symbol || 'Loading...'}</h1>
              <p className="text-gray-400">{token?.name || 'Loading...'}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isChatConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {isChatConnected ? 'LIVE' : 'DISCONNECTED'}
            </span>
          </div>
        </div>

        {/* Token Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#00D4AA]/20 to-[#00D4AA]/5 border border-[#00D4AA]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-[#00D4AA] mb-2">
              <TrendingUp className="w-4 h-4" />
              <span>PRICE</span>
            </div>
            <div className="text-2xl font-bold text-white">${token?.price?.toFixed(6) || '0.000000'}</div>
            <div className={`text-sm ${(token?.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(token?.priceChange24h || 0) >= 0 ? '+' : ''}{(token?.priceChange24h || 0).toFixed(2)}%
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-950/30 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-yellow-400 mb-2">
              <Wallet className="w-4 h-4" />
              <span>HOLDERS</span>
            </div>
            <div className="text-2xl font-bold text-white">{token?.totalHolders || 0}</div>
            <div className="text-sm text-gray-400">Total</div>
          </div>
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/30 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-purple-400 mb-2">
              <MessageCircle className="w-4 h-4" />
              <span>MESSAGES</span>
            </div>
            <div className="text-2xl font-bold text-white">{chatMessages.length}</div>
            <div className="text-sm text-gray-400">Live Chat</div>
          </div>
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-950/30 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
              <Star className="w-4 h-4" />
              <span>VOLUME 24H</span>
            </div>
            <div className="text-2xl font-bold text-white">${(token?.volume24h || 0).toLocaleString()}</div>
            <div className="text-sm text-gray-400">24h Volume</div>
          </div>
        </div>

        {/* Live Chat Section */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-[#00D4AA] mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Live Chat Analysis
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Chatters */}
            <div>
              <h4 className="text-sm font-bold text-gray-400 mb-3">TOP CHATTERS</h4>
              <div className="space-y-2">
                {Object.entries(userMessageCounts)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([username, count]) => (
                    <div key={username} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
                          {username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{username}</span>
                      </div>
                      <div className="text-[#00D4AA] font-bold">{count}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Recent Messages */}
            <div>
              <h4 className="text-sm font-bold text-gray-400 mb-3">RECENT MESSAGES</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {chatMessages.slice(-10).map((message, index) => (
                  <div key={index} className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[#00D4AA] font-medium text-sm">{message.username}</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm">{message.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}