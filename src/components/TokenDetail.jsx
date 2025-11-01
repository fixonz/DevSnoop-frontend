import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Star, TrendingUp, Wallet, ExternalLink, X, Send, User, RefreshCw, Copy, Check, Play, Video } from 'lucide-react';
import { useDevapp, fetchPumpFunTrends } from '@devfunlabs/web-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { getPumpfunSocket } from '../utils/websocket';

const connection = new Connection('https://rpc.dev.fun/a9a79a90906b540da651');

const HELIUS_API_KEY = '10d64fda-22a9-4d18-9209-712683742a1d';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const SHYFT_API_KEY = 'dmLD1Y7HFOq_cDWV';
const SHYFT_RPC_URL = `https://rpc.shyft.to?api_key=${SHYFT_API_KEY}`;

// Helper function to fetch comprehensive token data from PumpFun v3 API via proxy
async function fetchPumpFunV3Data(mint) {
  // Try proxy server first with retry logic
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/pumpfun/coins/${mint}`);
      if (response.ok) {
        const data = await response.json();
        console.log('🎯 Fetched PumpFun v3 data via proxy for', mint, ':', data);
        return data;
      } else {
        console.log(`Proxy server attempt ${attempt} returned error:`, response.status, response.statusText);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    } catch (error) {
      console.log(`Proxy server attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  console.log('All proxy attempts failed, trying direct API...');
  
  // Fallback: Try API proxy
  try {
    const proxyUrl = `${import.meta.env.VITE_API_URL}/api/pumpfun/coins/${mint}`;
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const data = await response.json();
      console.log('🎯 Fetched PumpFun v3 data via proxy for', mint, ':', data);
      return data;
    }
  } catch (error) {
    console.log('Failed to fetch PumpFun v3 data via proxy for', mint, error);
  }
  return null;
}

// Helper function to fetch market activity data
async function fetchMarketActivity(poolId) {
  // Try proxy server first
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/swap/v1/pools/${poolId}/market-activity`);
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Fetched market activity via proxy for', poolId, ':', data);
      return data;
    }
  } catch (error) {
    console.log('Proxy server not available for market activity, trying direct API...', error);
  }

  // Fallback: Try direct API
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/market-activity/${poolId}`);
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Fetched market activity directly for', poolId, ':', data);
      return data;
    }
  } catch (error) {
    console.log('Failed to fetch market activity for', poolId, error);
  }
  return null;
}

// Helper function to fetch clips from PumpFun via proxy (limit to 2)
async function fetchClips(mint) {
  // Try proxy server first with retry logic
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/clips/${mint}?limit=2&clipType=HIGHLIGHT`);
      if (response.ok) {
        const data = await response.json();
        console.log('🎬 Fetched clips via proxy for', mint, ':', data);
        // Limit to first 2 clips and format them
        return (data.clips || []).slice(0, 2).map(clip => ({
          id: clip.clipId,
          title: clip.title || `Clip ${clip.clipId.split('_')[0]}`,
          duration: clip.duration,
          mp4Url: clip.mp4Url || clip.playlistUrl,
          thumbnailUrl: clip.thumbnailUrl,
          startTime: clip.startTime,
          endTime: clip.endTime,
          clipType: clip.clipType
        }));
      } else {
        console.log(`Clips proxy server attempt ${attempt} returned error:`, response.status, response.statusText);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    } catch (error) {
      console.log(`Clips proxy server attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  console.log('All clips proxy attempts failed, trying direct API...');

  // Fallback: Try direct API
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/pumpfun/clips/${mint}?limit=2&clipType=HIGHLIGHT`);
    if (response.ok) {
      const data = await response.json();
      console.log('🎬 Fetched clips directly for', mint, ':', data);
      // Limit to first 2 clips and format them
      return (data.clips || []).slice(0, 2).map(clip => ({
        id: clip.clipId,
        title: clip.title || `Clip ${clip.clipId.split('_')[0]}`,
        duration: clip.duration,
        mp4Url: clip.mp4Url || clip.playlistUrl,
        thumbnailUrl: clip.thumbnailUrl,
        startTime: clip.startTime,
        endTime: clip.endTime,
        clipType: clip.clipType
      }));
    }
  } catch (error) {
    console.log('Failed to fetch clips for', mint, error);
  }
  return [];
}

// Cache for wallet balances to avoid repeated API calls
const balanceCache = new Map();
const CACHE_DURATION = 10000; // 10 seconds cache

// Persistent cache using localStorage
const getCachedBalance = (walletAddress, tokenId) => {
  try {
    const cacheKey = `balance_${walletAddress}_${tokenId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Failed to read from localStorage cache:', error);
  }
  return null;
};

const setCachedBalance = (walletAddress, tokenId, data) => {
  try {
    const cacheKey = `balance_${walletAddress}_${tokenId}`;
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage cache:', error);
  }
};

// Delay function for rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// All tokens have 1B supply, so no need to fetch metadata

// Removed PnL function - now using fetchWalletAssets for balance only

async function getTokenBalance(walletAddress, tokenMint) {
  try {
    // Try Helius API endpoint first
    const heliusResponse = await fetch(`${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/helius/balance?wallet=${walletAddress}&token=${tokenMint}&type=token`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (heliusResponse.ok) {
      const heliusData = await heliusResponse.json();
      return heliusData.result?.balance || 0;
    }
    
    // Fallback to direct RPC call
    let response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'balance-check',
        method: 'getTokenAccountsByOwner',
        params: [walletAddress, {
          mint: tokenMint
        }, {
          encoding: 'jsonParsed'
        }]
      })
    });
    
    if (!response.ok && response.status === 429) {
      console.log('⚠️ Helius rate limited, trying SHYFT...');
      response = await fetch(SHYFT_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'balance-check',
          method: 'getTokenAccountsByOwner',
          params: [walletAddress, {
            mint: tokenMint
          }, {
            encoding: 'jsonParsed'
          }]
        })
      });
    }
    
    const data = await response.json();
    if (data.result?.value?.length === 0) {
      return 0;
    }
    
    const balance = data.result?.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
    return balance;
  } catch (error) {
    console.error('Token balance check failed:', error);
    return 0;
  }
}

export default function TokenDetail({ tokenId, tokenAnalysis, creatorAddress, onBack }) {
  // Use passed tokenAnalysis if available, otherwise fetch data
  const [localTokenData, setLocalTokenData] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(!tokenAnalysis);
  
  // Use tokenAnalysis if provided, otherwise use local data
  const currentTokenData = tokenAnalysis || localTokenData;
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [chatterBalances, setChatterBalances] = useState({});
  const [topChatters, setTopChatters] = useState([]);
  const [sortBy, setSortBy] = useState('messages');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingBalances, setLoadingBalances] = useState(new Set());
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [videoPlayer, setVideoPlayer] = useState({ isOpen: false, clips: [], currentClip: 0 });
  const [marketActivity, setMarketActivity] = useState(null);
  const messagesEndRef = useRef(null);
  
  let devbaseClient = null;
  try {
    const { devbaseClient: client } = useDevapp();
    devbaseClient = client;
  } catch (error) {
    console.log('Devapp not available:', error.message);
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Copy wallet address to clipboard
  const copyWalletAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy address:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // Function to get token status for display
  const getTokenStatus = (tokenBalance, tokenPercentage, solBalance) => {
    if (tokenBalance === 0 || tokenBalance === null || tokenBalance === undefined) {
      // Check if they also have no SOL - mark as LARP
      if (solBalance === 0 || solBalance === null || solBalance === undefined) {
        return { status: 'LARP', color: 'bg-red-600/20 text-red-300' };
      }
      return { status: 'NO TOKENS', color: 'bg-red-500/20 text-red-400' };
    } else if (tokenPercentage < 0.01) {
      return { status: 'SOLD', color: 'bg-yellow-500/20 text-yellow-400' };
    } else {
      return { status: `${tokenPercentage.toFixed(2)}%`, color: 'bg-green-500/20 text-green-400' };
    }
  };

  // Function to check if user is creator
  const isCreator = (userAddress) => {
    return creatorAddress && userAddress === creatorAddress;
  };

  // Function to get user role badge
  const getUserRoleBadge = (userAddress) => {
    if (isCreator(userAddress)) {
      return { role: 'DEV', color: 'bg-blue-500/20 text-blue-400' };
    }
    return null;
  };

  // Video player functions
  const openVideoPlayer = async () => {
    setVideoPlayer({ isOpen: true, clips: [], currentClip: 0 });
    
    // Fetch clips for this token
    const clips = await fetchClips(tokenId);
    setVideoPlayer(prev => ({ ...prev, clips }));
  };

  const closeVideoPlayer = () => {
    setVideoPlayer({ isOpen: false, clips: [], currentClip: 0 });
  };

  const nextClip = () => {
    setVideoPlayer(prev => ({
      ...prev,
      currentClip: (prev.currentClip + 1) % prev.clips.length
    }));
  };

  const prevClip = () => {
    setVideoPlayer(prev => ({
      ...prev,
      currentClip: prev.currentClip === 0 ? prev.clips.length - 1 : prev.currentClip - 1
    }));
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load historical messages
  const loadHistoricalMessages = async () => {
    try {
      console.log('📚 Loading historical messages for token:', tokenId);
      
      // First try to load from database
      if (devbaseClient) {
        try {
          console.log('📚 Loading archived messages from database...');
          const dbMessages = await devbaseClient.listEntities('chatMessages', {
            filter: { tokenId: tokenId },
            limit: 100,
            sort: { timestamp: 'desc' }
          });
          
          if (dbMessages && dbMessages.length > 0) {
            const formattedMessages = dbMessages.map(msg => ({
              id: msg.id,
              username: msg.username || 'Anonymous',
              userAddress: msg.userAddress,
              message: msg.message,
              timestamp: msg.timestamp,
              tokenBalance: 0, // Will be updated when wallet data loads
              profileImage: msg.profileImage || `https://img.icons8.com/color/96/000000/user.png`,
              solBalance: 0
            }));
            setMessages(formattedMessages);
            console.log('📚 Loaded', formattedMessages.length, 'archived messages from database');
            return;
          }
        } catch (dbError) {
          console.warn('📚 Database query failed, trying API fallback:', dbError.message);
        }
      }
      
      // If no database messages or database failed, try backend API
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/messages/${tokenId}?limit=100`);
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const historicalMessages = await response.json();
            console.log('📚 Loaded historical messages from backend:', historicalMessages.length);
            if (historicalMessages.length > 0) {
              // Convert database messages to the format expected by the component
              const formattedMessages = historicalMessages.map(msg => ({
                id: msg.id,
                username: msg.username || 'Anonymous',
                userAddress: msg.userAddress,
                message: msg.message,
                timestamp: msg.timestamp,
                tokenBalance: 0, // Will be updated when wallet data loads
                profileImage: msg.profileImage || `https://img.icons8.com/color/96/000000/user.png`,
                solBalance: 0
              }));
              setMessages(formattedMessages);
              return;
            }
          }
        }
      } catch (apiError) {
        console.log('📚 Backend API not available, using local storage fallback');
      }
      
      // Fallback: Load from localStorage
      const storageKey = `chat_messages_${tokenId}`;
      const storedMessages = localStorage.getItem(storageKey);
      if (storedMessages) {
        try {
          const historicalMessages = JSON.parse(storedMessages);
          console.log('📚 Loaded historical messages from localStorage:', historicalMessages.length);
          if (historicalMessages.length > 0) {
            setMessages(historicalMessages);
          }
        } catch (parseError) {
          console.error('📚 Failed to parse stored messages:', parseError);
        }
      } else {
        console.log('📚 No historical messages found');
      }
    } catch (error) {
      console.error('📚 Failed to load historical messages:', error);
    }
  };

  useEffect(() => {
    if (!tokenId) return;
    
    // Load historical messages first
    loadHistoricalMessages();
    
    const socket = getPumpfunSocket();
    const roomId = `pumpfun-${tokenId}`;
    
    console.log('🔍 Attempting to join PumpFun room:', roomId);
    console.log('🔍 Socket connected status:', socket.connected);
    
    // Join room immediately (socket is already connected)
    socket.emit('join', roomId);
    setIsConnected(true);
    console.log('✅ Joined PumpFun room:', roomId);
    
    // Fetch market activity data
    const loadMarketActivity = async () => {
      try {
        // First get the bonding curve ID from PumpFun v3 API
        const pumpFunData = await fetchPumpFunV3Data(tokenId);
        if (pumpFunData?.bonding_curve) {
          const activity = await fetchMarketActivity(pumpFunData.bonding_curve);
          setMarketActivity(activity);
          console.log('📊 Market activity loaded:', activity);
        }
      } catch (error) {
        console.log('Failed to load market activity:', error);
      }
    };
    
    loadMarketActivity();

    const handleNewMessage = async (message) => {
      console.log('📡 New message received:', message);
      
      // Handle both room ID formats: direct token ID or pumpfun-{tokenId}
      const messageTokenId = message.roomId?.replace('pumpfun-', '') || message.roomId || '';
      const currentTokenId = roomId.replace('pumpfun-', '');
      
      // Only process messages for this token
      if (messageTokenId !== currentTokenId) {
        console.log('🚫 Message not for this token, ignoring. Expected:', currentTokenId, 'Got:', messageTokenId);
        return;
      }

      const newMessage = {
        id: `${message.timestamp}-${Math.random()}`,
        username: message.username || 'Anonymous',
        userAddress: message.userAddress,
        message: message.message || message.text || '',
        timestamp: message.timestamp || Date.now(),
        tokenBalance: message.tokenBalance || 0,
        profileImage: message.profileImage || `https://img.icons8.com/color/96/000000/user.png`,
        // Wallet assets will be added after fetching
        solBalance: 0
      };

      setMessages(prev => {
        const updatedMessages = [...prev, newMessage];
        
        // Save to localStorage as fallback
        try {
          const storageKey = `chat_messages_${tokenId}`;
          localStorage.setItem(storageKey, JSON.stringify(updatedMessages.slice(-100))); // Keep last 100 messages
        } catch (storageError) {
          console.warn('Failed to save message to localStorage:', storageError);
        }
        
        return updatedMessages;
      });

      // Fetch wallet assets if wallet address is available
      if (message.userAddress) {
        console.log('🔍 Fetching wallet assets for user:', message.userAddress);
        
        // Add to loading state
        setLoadingBalances(prev => new Set([...prev, message.userAddress]));
        
        // Fetch wallet assets (SOL balance and token balance)
        fetchWalletAssets(message.userAddress).then(walletData => {
          console.log('💰 Wallet assets for user:', message.userAddress, walletData);
          
          // Update the message with wallet data
          setMessages(prev => prev.map(msg => 
            msg.userAddress === message.userAddress && msg.timestamp === newMessage.timestamp
              ? {
                  ...msg,
                  tokenBalance: parseFloat(walletData.tokenBalance) || 0,
                  solBalance: parseFloat(walletData.solBalance) || 0,
                  tokenPercentage: parseFloat(walletData.tokenPercentage) || 0
                }
              : msg
          ));
          
          // Update chatter balances
          setChatterBalances(prev => ({
            ...prev,
            [message.userAddress]: {
              balance: parseFloat(walletData.tokenBalance) || 0,
              solBalance: parseFloat(walletData.solBalance) || 0,
              tokenPercentage: parseFloat(walletData.tokenPercentage) || 0,
              username: message.username,
              timestamp: walletData.timestamp
            }
          }));
        }).catch(error => {
          console.error('Failed to fetch wallet assets for user:', message.userAddress, error);
        }).finally(() => {
          // Remove from loading state
          setLoadingBalances(prev => {
            const newSet = new Set(prev);
            newSet.delete(message.userAddress);
            return newSet;
          });
        });
      }

      // Store message in database (optional)
      if (devbaseClient) {
        try {
          await devbaseClient.createEntity('chatMessages', {
            roomId: roomId,
            message: newMessage.message,
            tokenId: tokenId,
            username: newMessage.username,
            timestamp: newMessage.timestamp.toString(),
            messageType: 'pumpfun',
            userAddress: newMessage.userAddress,
            profileImage: newMessage.profileImage
          });
          console.log('💾 Message stored in database');
        } catch (error) {
          console.warn('Database not available, message stored in memory only:', error.message);
        }
      } else {
        console.log('💾 Message stored in memory (no database client)');
      }
    };

    // Listen for various possible message event names
    socket.on('pumpfun:newMessage', handleNewMessage);
    socket.on('message', handleNewMessage);
    socket.on('chat', handleNewMessage);
    socket.on('newMessage', handleNewMessage);
    socket.on('pumpfun:message', handleNewMessage);
    socket.on('pumpfun:chat', handleNewMessage);
    socket.on('livestream:message', handleNewMessage);
    socket.on('livestream:chat', handleNewMessage);

    // Test message removed - ready for live data

    return () => {
      socket.emit('leave', roomId);
      socket.off('pumpfun:newMessage', handleNewMessage);
      socket.off('message', handleNewMessage);
      socket.off('chat', handleNewMessage);
      socket.off('newMessage', handleNewMessage);
      socket.off('pumpfun:message', handleNewMessage);
      socket.off('pumpfun:chat', handleNewMessage);
      socket.off('livestream:message', handleNewMessage);
      socket.off('livestream:chat', handleNewMessage);
    };
  }, [tokenId, devbaseClient]);

  // Calculate top chatters
  useEffect(() => {
    const chatterCounts = {};
    messages.forEach(msg => {
      if (msg.userAddress) {
        if (!chatterCounts[msg.userAddress]) {
          chatterCounts[msg.userAddress] = {
            username: msg.username,
            userAddress: msg.userAddress,
            messageCount: 0,
            balance: chatterBalances[msg.userAddress]?.balance || 0,
            solBalance: chatterBalances[msg.userAddress]?.solBalance || 0
          };
        }
        chatterCounts[msg.userAddress].messageCount++;
      }
    });

    const sortedChatters = Object.values(chatterCounts)
      .sort((a, b) => {
        switch (sortBy) {
          case 'messages':
            return b.messageCount - a.messageCount;
          case 'balance':
            return b.balance - a.balance;
          default:
            return b.messageCount - a.messageCount;
        }
      })
      .slice(0, 3);

    setTopChatters(sortedChatters);
  }, [messages, chatterBalances, sortBy]);

  const getUserBagStatus = (userAddress) => {
    const balance = chatterBalances[userAddress]?.balance || 0;
    
    if (balance > 0) {
      return { status: `${balance.toLocaleString()}`, color: 'text-green-400' };
    } else {
      return { status: 'NO BAG', color: 'text-gray-400' };
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatBalance = (balance) => {
    if (balance >= 1000000) {
      return (balance / 1000000).toFixed(1) + 'M';
    } else if (balance >= 1000) {
      return (balance / 1000).toFixed(1) + 'K';
    } else {
      return balance.toFixed(2);
    }
  };

  // Fetch wallet assets using SHYFT API with caching
  const fetchWalletAssets = async (walletAddress) => {
    try {
      console.log('🔍 Fetching wallet assets for:', walletAddress);
      
      // Check persistent cache first
      const cached = getCachedBalance(walletAddress, tokenId);
      if (cached) {
        console.log('📦 Using persistent cached balance data for', walletAddress);
        return cached;
      }
      
      // Check memory cache as fallback
      const cacheKey = `${walletAddress}-${tokenId}`;
      const memoryCached = balanceCache.get(cacheKey);
      if (memoryCached && (Date.now() - memoryCached.timestamp) < CACHE_DURATION) {
        console.log('📦 Using memory cached balance data for', walletAddress);
        return memoryCached;
      }
      
      // Add delay to respect rate limits (5 seconds)
      const delayTime = 5000; // 5 seconds
      console.log(`⏳ Waiting ${delayTime}ms before API call...`);
      await delay(delayTime);
      
      // Fetch SOL balance using SHYFT API proxy (fallback to Helius)
      let solBalance = 0;
      try {
        const solResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/shyft/balance?network=mainnet-beta&wallet=${walletAddress}&type=wallet`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (solResponse.ok) {
          const solData = await solResponse.json();
          solBalance = solData.result?.balance || 0;
        } else {
          console.log('⚠️ SHYFT SOL balance API failed, trying Helius fallback...');
          // Fallback to Helius API
          const heliusResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/helius/balance?wallet=${walletAddress}&type=wallet`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          if (heliusResponse.ok) {
            const heliusData = await heliusResponse.json();
            solBalance = heliusData.result?.balance || 0;
          } else {
            console.log('⚠️ Helius SOL balance API also failed:', heliusResponse.status);
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch SOL balance:', error);
      }
      
      // Fetch token balance using SHYFT API proxy (with correct endpoint)
      const tokenResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/shyft/balance?network=mainnet-beta&wallet=${walletAddress}&token=${tokenId}&type=token`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      let tokenBalance = 0;
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        tokenBalance = tokenData.result?.balance || 0;
      } else {
        console.log('⚠️ SHYFT token balance API failed, trying Helius fallback...');
        // Fallback to Helius API
        try {
          const heliusResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/helius/balance?wallet=${walletAddress}&token=${tokenId}&type=token`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          if (heliusResponse.ok) {
            const heliusData = await heliusResponse.json();
            tokenBalance = heliusData.result?.balance || 0;
          } else {
            // Final fallback to RPC method
            tokenBalance = await getTokenBalance(walletAddress, tokenId);
          }
        } catch (heliusError) {
          console.error('Helius fallback failed:', heliusError);
          // Final fallback to RPC method
          tokenBalance = await getTokenBalance(walletAddress, tokenId);
        }
      }
      
      // All tokens have 1B supply, so calculate percentage directly
      const totalSupply = 1000000000; // 1 billion
      
      // Calculate percentage of total supply
      let tokenPercentage = 0;
      if (tokenBalance > 0) {
        tokenPercentage = (tokenBalance / totalSupply) * 100;
        console.log('📊 Calculated percentage for', tokenBalance, 'tokens:', tokenPercentage.toFixed(2) + '%');
      }
      
      const walletData = {
        solBalance,
        tokenBalance,
        tokenPercentage,
        totalSupply,
        timestamp: Date.now()
      };
      
      // Cache the result in both memory and persistent storage
      balanceCache.set(cacheKey, walletData);
      setCachedBalance(walletAddress, tokenId, walletData);
      
      console.log('💰 SHYFT wallet assets for', walletAddress, ':', {
        solBalance: solBalance.toFixed(4),
        tokenBalance: tokenBalance.toFixed(2),
        tokenPercentage: tokenPercentage.toFixed(2) + '%',
        totalSupply: '1B (hardcoded)',
        tokenMint: tokenId
      });
      
      return walletData;
      
    } catch (error) {
      console.error('❌ Failed to fetch wallet assets for', walletAddress, error);
      return {
        solBalance: 0,
        tokenBalance: 0,
        timestamp: Date.now()
      };
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-6">
        {/* Back Button and Video Player */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
            Back to Dashboard
          </button>
          
          <button
            onClick={openVideoPlayer}
            className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors"
            title="Watch archived stream"
          >
            <Play className="w-4 h-4" />
            <span className="hidden sm:inline">Watch Stream</span>
          </button>
        </div>

        {/* Enhanced Token Profile Card with Full Background */}
        <div className="relative border border-purple-500/30 rounded-lg overflow-hidden min-h-[300px] mb-4 sm:mb-6">
          {/* Full thumbnail as background */}
          {currentTokenData?.streamThumbnail && (
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" 
                 style={{ backgroundImage: `url(${currentTokenData.streamThumbnail})` }}>
              {/* Dark overlay for better text readability */}
              <div className="absolute inset-0 bg-black/50"></div>
            </div>
          )}
          
          {/* Fallback gradient background if no thumbnail */}
          {!currentTokenData?.streamThumbnail && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-teal-500/20"></div>
          )}
          
          {/* Content overlay */}
          <div className="relative z-10 p-6 sm:p-8 h-full flex flex-col justify-between">
            {/* Top section with token info and LIVE status */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{currentTokenData?.symbol || 'Loading...'}</h1>
                <p className="text-gray-300 text-lg">{currentTokenData?.name || 'Unknown Token'}</p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* LIVE badge and viewer count */}
                {currentTokenData?.isLive && (
                  <div className="flex items-center gap-2">
                    <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                      LIVE
                    </div>
                    {currentTokenData?.numParticipants > 0 && (
                      <div className="bg-black/80 text-white text-xs px-3 py-1 rounded-full">
                        👥 {currentTokenData?.numParticipants}
                      </div>
                    )}
                  </div>
                )}
                
                <button 
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                  onClick={() => window.open(`https://pump.fun/${tokenId}`, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">VIEW ON PUMP.FUN</span>
                  <span className="sm:hidden">PUMP.FUN</span>
                </button>
              </div>
            </div>
            
            {/* Bottom section with Market Cap */}
            <div className="text-center">
              <div className="text-gray-300 text-sm sm:text-base mb-2">Market Cap</div>
              <div className="text-white font-bold text-4xl sm:text-6xl mb-2 drop-shadow-lg">
                ${currentTokenData?.marketCap ? formatBalance(currentTokenData.marketCap) : '0'}
              </div>
              <div className="text-gray-400 text-xs sm:text-sm">Fully Diluted Valuation</div>
            </div>
          </div>
        </div>

        {/* Live Chat Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">LIVE CHAT</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-purple-500/20 text-purple-400 px-2 py-1 sm:px-3 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-500 rounded-full animate-pulse" />
              <span className="hidden sm:inline">PUMPFUN LIVESTREAM</span>
              <span className="sm:hidden">PUMPFUN</span>
            </div>
            <div className="bg-blue-500/20 text-blue-400 px-2 py-1 sm:px-3 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="hidden sm:inline">HELIUS ENHANCED</span>
              <span className="sm:hidden">HELIUS</span>
            </div>
            <div className="bg-green-500/20 text-green-400 px-2 py-1 sm:px-3 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="hidden sm:inline">STREAM CONNECTED</span>
              <span className="sm:hidden">CONNECTED</span>
            </div>
          </div>
        </div>
        <p className="text-gray-400 text-sm mb-6">Real-time from pump.fun</p>

        {/* Market Activity */}
        {marketActivity && marketActivity['24h'] && (
          <div className="mb-6 p-4 bg-gradient-to-r from-zinc-800/50 to-zinc-900/50 border border-zinc-700 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-bold text-white">24H Market Activity</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  ${marketActivity['24h'].volumeUSD ? (marketActivity['24h'].volumeUSD / 1000).toFixed(1) + 'K' : '0'}
                </div>
                <div className="text-xs text-zinc-500">Volume</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${marketActivity['24h'].priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {marketActivity['24h'].priceChangePercent >= 0 ? '+' : ''}{marketActivity['24h'].priceChangePercent?.toFixed(2) || '0'}%
                </div>
                <div className="text-xs text-zinc-500">Price Change</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {marketActivity['24h'].numTxs || 0}
                </div>
                <div className="text-xs text-zinc-500">Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-pink-400">
                  {marketActivity['24h'].numBuys || 0}:{marketActivity['24h'].numSells || 0}
                </div>
                <div className="text-xs text-zinc-500">Buy/Sell</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Users:</span>
                <span className="text-blue-400 font-bold">{marketActivity['24h'].numUsers || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Buyers:</span>
                <span className="text-green-400 font-bold">{marketActivity['24h'].numBuyers || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Sellers:</span>
                <span className="text-red-400 font-bold">{marketActivity['24h'].numSellers || 0}</span>
              </div>
            </div>
          </div>
        )}

        {/* Top 3 Chatters */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-bold text-white">TOP 3</h3>
          </div>
          
          <div className="space-y-2">
            {topChatters.map((chatter, index) => (
              <div key={chatter.userAddress} className="flex items-center justify-between py-2 px-3 bg-zinc-800/30 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 font-bold text-sm">#{index + 1}</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://pump.fun/profile/${chatter.userAddress}?tab=balances`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 font-medium text-sm transition-colors"
                    >
                      {chatter.username && chatter.username.length > 20 
                        ? `${chatter.username.slice(0, 6)}...${chatter.username.slice(-6)}`
                        : chatter.username
                      }
                    </a>
                    {(() => {
                      const roleBadge = getUserRoleBadge(chatter.userAddress);
                      return roleBadge ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadge.color}`}>
                          {roleBadge.role}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <span className="text-gray-400 text-xs">
                  {chatter.messageCount} msgs
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="bg-black border border-zinc-800 rounded-lg p-3 sm:p-4 max-h-80 sm:max-h-96 overflow-y-auto">
          <div className="space-y-2 sm:space-y-3">
            {messages.map((message) => {
              const bagStatus = getUserBagStatus(message.userAddress);
              const balance = chatterBalances[message.userAddress];
              const isLoading = loadingBalances.has(message.userAddress);
              
              return (
                <div 
                  key={message.id} 
                  className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800/70 transition-colors cursor-pointer"
                  onClick={() => {
                    if (message.userAddress) {
                      setSelectedUser({
                        username: message.username,
                        userAddress: message.userAddress,
                        messageCount: 1, // Will be updated with actual count
                        balance: parseFloat(message.tokenBalance) || 0,
                        solBalance: parseFloat(message.solBalance) || 0,
                        tokenPercentage: parseFloat(message.tokenPercentage) || 0
                      });
                    }
                  }}
                >
                  <img 
                    src={message.profileImage} 
                    alt={message.username} 
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                      <span className="text-green-400 font-medium text-xs sm:text-sm truncate">
                        {message.username && message.username.length > 20 
                          ? `${message.username.slice(0, 6)}...${message.username.slice(-6)}`
                          : message.username
                        }
                      </span>
                      {(() => {
                        const roleBadge = getUserRoleBadge(message.userAddress);
                        return roleBadge ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadge.color}`}>
                            {roleBadge.role}
                          </span>
                        ) : null;
                      })()}
                      <span className="text-gray-500 text-xs">{formatTime(message.timestamp)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full bg-gray-700 ${bagStatus.color} hidden sm:inline`}>
                        {bagStatus.status}
                      </span>
                      
                      {/* Loading State */}
                      {isLoading && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                          Loading...
                        </span>
                      )}
                      
                      {/* Token Status - Mobile Optimized */}
                      {!isLoading && (
                        (() => {
                          const tokenStatus = getTokenStatus(message.tokenBalance, message.tokenPercentage, message.solBalance);
                          return (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${tokenStatus.color}`}>
                              {tokenStatus.status}
                            </span>
                          );
                        })()
                      )}
                      
                      {/* SOL Balance - Mobile Optimized */}
                      {!isLoading && message.solBalance > 0 && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                          {message.solBalance.toFixed(2)} SOL
                        </span>
                      )}
                      
                    </div>
                    <p className="text-white text-xs sm:text-sm break-words">{message.message}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Enhanced User Profile Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-zinc-900 border border-purple-500/30 rounded-lg p-4 sm:p-6 max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-white truncate">User Profile: {selectedUser.username}</h3>
              <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg flex items-center gap-1 text-sm disabled:opacity-50"
                  onClick={() => {
                    // Refresh user data
                    if (selectedUser.userAddress) {
                      setLoadingBalances(prev => new Set([...prev, selectedUser.userAddress]));
                      fetchWalletAssets(selectedUser.userAddress).then(walletData => {
                        // Update selected user data
                        setSelectedUser(prev => ({
                          ...prev,
                          balance: parseFloat(walletData.tokenBalance) || 0,
                          solBalance: parseFloat(walletData.solBalance) || 0,
                          tokenPercentage: parseFloat(walletData.tokenPercentage) || 0
                        }));
                        
                        // Update all chat messages for this user
                        setMessages(prev => prev.map(msg => 
                          msg.userAddress === selectedUser.userAddress
                            ? {
                                ...msg,
                                tokenBalance: parseFloat(walletData.tokenBalance) || 0,
                                solBalance: parseFloat(walletData.solBalance) || 0,
                                tokenPercentage: parseFloat(walletData.tokenPercentage) || 0
                              }
                            : msg
                        ));
                        
                        // Update chatter balances
                        setChatterBalances(prev => ({
                          ...prev,
                          [selectedUser.userAddress]: {
                            balance: parseFloat(walletData.tokenBalance) || 0,
                            solBalance: parseFloat(walletData.solBalance) || 0,
                            tokenPercentage: parseFloat(walletData.tokenPercentage) || 0,
                            username: selectedUser.username,
                            timestamp: walletData.timestamp
                          }
                        }));
                      }).finally(() => {
                        setLoadingBalances(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(selectedUser.userAddress);
                          return newSet;
                        });
                      });
                    }
                  }}
                  disabled={loadingBalances.has(selectedUser?.userAddress)}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingBalances.has(selectedUser?.userAddress) ? 'animate-spin' : ''}`} />
                  {loadingBalances.has(selectedUser?.userAddress) ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - User Info & Balances */}
              <div className="space-y-4">
                <div className="bg-zinc-800/50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-white mb-4">Profile Information</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="text-gray-500 text-sm">Username</div>
                      <div className="text-green-400 font-medium">
                        {selectedUser.username && selectedUser.username.length > 20
                          ? `${selectedUser.username.slice(0, 6)}...${selectedUser.username.slice(-6)}`
                          : selectedUser.username
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-sm">Wallet Address</div>
                      <div className="bg-zinc-700 p-2 rounded text-sm text-gray-300 font-mono break-all flex items-center justify-between gap-2">
                        <span className="flex-1">{selectedUser.userAddress}</span>
                        <button
                          onClick={() => copyWalletAddress(selectedUser.userAddress)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-zinc-600"
                          title="Copy address"
                        >
                          {copiedAddress ? (
                            <>
                              <Check className="w-3 h-3 text-green-400" />
                              <span className="text-green-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800/50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-white mb-4">Current Holdings</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 text-sm">Token Percentage</div>
                      <div className="text-orange-400 font-medium text-lg">
                        {(selectedUser.tokenPercentage || 0).toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-sm">SOL Balance</div>
                      <div className="text-blue-400 font-medium text-lg">
                        {(selectedUser.solBalance || 0).toFixed(4)} SOL
                      </div>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <div className="text-gray-500 text-sm">Portfolio Value</div>
                      <div className="text-purple-400 font-medium text-lg">
                        ${((selectedUser.balance || 0) * (tokenAnalysis?.price || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Wallet Analysis */}
              <div className="space-y-4">
                <div className="bg-zinc-800/50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-white mb-4">Wallet Analysis</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-sm">Holdings Size</span>
                      <span className={`text-sm font-medium ${
                        (selectedUser.balance || 0) > 1000000 ? 'text-green-400' : 
                        (selectedUser.balance || 0) > 100000 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(selectedUser.balance || 0) > 1000000 ? 'Whale' : 
                         (selectedUser.balance || 0) > 100000 ? 'Dolphin' : 'Minnow'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-sm">SOL Balance</span>
                      <span className={`text-sm font-medium ${
                        (selectedUser.solBalance || 0) > 10 ? 'text-green-400' : 
                        (selectedUser.solBalance || 0) > 1 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(selectedUser.solBalance || 0) > 10 ? 'High' : 
                         (selectedUser.solBalance || 0) > 1 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-sm">Token Position</span>
                      <span className={`text-sm font-medium ${
                        (selectedUser.balance || 0) > 0 ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {(selectedUser.balance || 0) > 0 ? 'Holding' : 'Not Holding'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Messages Section */}
            <div className="mt-6">
              <div className="bg-zinc-800/50 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-white mb-4">Historical Messages</h4>
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {messages
                    .filter(msg => msg.userAddress === selectedUser.userAddress)
                    .map((message, index) => (
                      <div key={`${message.id}-${index}`} className="bg-zinc-700/50 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <img 
                            src={message.profileImage} 
                            alt={message.username} 
                            className="w-6 h-6 rounded-full" 
                          />
                          <span className="text-green-400 font-medium text-sm">
                            {message.username && message.username.length > 20 
                              ? `${message.username.slice(0, 6)}...${message.username.slice(-6)}`
                              : message.username
                            }
                          </span>
                          {(() => {
                            const roleBadge = getUserRoleBadge(message.userAddress);
                            return roleBadge ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadge.color}`}>
                                {roleBadge.role}
                              </span>
                            ) : null;
                          })()}
                          <span className="text-gray-500 text-xs">{formatTime(message.timestamp)}</span>
                          
                          {/* Message badges */}
                          {(() => {
                            const tokenStatus = getTokenStatus(message.tokenBalance, message.tokenPercentage, message.solBalance);
                            return (
                              <span className={`text-xs px-2 py-0.5 rounded ${tokenStatus.color}`}>
                                {tokenStatus.status}
                              </span>
                            );
                          })()}
                          {message.solBalance > 0 && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                              {message.solBalance.toFixed(2)} SOL
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm">{message.message}</p>
                      </div>
                    ))
                  }
                  {messages.filter(msg => msg.userAddress === selectedUser.userAddress).length === 0 && (
                    <div className="text-gray-500 text-center py-4">
                      No messages found from this user
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button 
                className="flex-1 bg-gradient-to-r from-purple-500 to-teal-500 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:from-purple-600 hover:to-teal-600 transition-all"
                onClick={() => window.open(`https://solscan.io/account/${selectedUser.userAddress}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                View on Solscan
              </button>
              <button 
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:from-blue-600 hover:to-cyan-600 transition-all"
                onClick={() => window.open(`https://dexscreener.com/solana/${tokenId}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                View Token Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      <AnimatePresence>
        {videoPlayer.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeVideoPlayer}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-zinc-900 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Archived Stream</h3>
                </div>
                <button
                  onClick={closeVideoPlayer}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Video Container */}
              <div className="flex-1 p-4">
                <div className="w-full h-full bg-black rounded-lg overflow-hidden relative">
                  {videoPlayer.clips.length > 0 ? (
                    <div className="w-full h-full flex flex-col">
                      {/* Video Player */}
                      <div className="flex-1 relative">
                        <video
                          key={videoPlayer.currentClip}
                          className="w-full h-full object-cover"
                          controls
                          autoPlay
                          muted
                          poster={videoPlayer.clips[videoPlayer.currentClip]?.thumbnailUrl}
                        >
                          <source src={videoPlayer.clips[videoPlayer.currentClip]?.mp4Url} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        
                        {/* Navigation Arrows */}
                        {videoPlayer.clips.length > 1 && (
                          <>
                            <button
                              onClick={prevClip}
                              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <button
                              onClick={nextClip}
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Clip Info */}
                      <div className="bg-zinc-800 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">
                              {videoPlayer.clips[videoPlayer.currentClip]?.title || `Clip ${videoPlayer.currentClip + 1} of ${videoPlayer.clips.length}`}
                            </p>
                            <p className="text-gray-400 text-sm">
                              Duration: {Math.floor((videoPlayer.clips[videoPlayer.currentClip]?.duration || 0) / 60)}m {((videoPlayer.clips[videoPlayer.currentClip]?.duration || 0) % 60)}s
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {videoPlayer.clips.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setVideoPlayer(prev => ({ ...prev, currentClip: index }))}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  index === videoPlayer.currentClip ? 'bg-purple-400' : 'bg-gray-600'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">No clips available</p>
                        <p className="text-gray-500 text-sm mt-2">This token doesn't have any archived clips</p>
                        <a
                          href={`https://pump.fun/coin/${tokenId}?archivedFilter=active&clip=`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors text-sm"
                        >
                          <Video className="w-4 h-4" />
                          Check PumpFun for clips
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-700">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-400">
                      {videoPlayer.clips.length > 0 ? `Showing ${videoPlayer.clips.length} recent clips` : 'No clips available'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {videoPlayer.clips.length > 0 ? 'Showing preview clips only' : 'This token has no archived clips'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {videoPlayer.clips.length > 0 && (
                      <a
                        href={`https://pump.fun/coin/${tokenId}?archivedFilter=active&clip=`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors text-sm"
                      >
                        <Video className="w-4 h-4" />
                        View All Clips
                      </a>
                    )}
                    <a
                      href={`https://pump.fun/coin/${tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in PumpFun
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}