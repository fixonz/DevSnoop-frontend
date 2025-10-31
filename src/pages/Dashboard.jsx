import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, X, ExternalLink, MessageCircle, TrendingUp, Star, Globe, Twitter, MessageCircle as Telegram, Users, Play, Video, Plus, Zap } from 'lucide-react';
import { useDevapp, fetchPumpFunTrends } from '@devfunlabs/web-sdk';
import { getBackendSocket } from '../utils/websocket';
import IntroAnimation from '../components/IntroAnimation';
import Onboarding from '../components/Onboarding';

// Helper function to fetch token data from API
async function fetchTokenData(mintAddress) {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tokens/${mintAddress}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to fetch token data:', error);
  }
  return null;
}

// Helper function to format market cap
function formatMarketCap(marketCap) {
  if (marketCap >= 1e9) {
    return `${(marketCap / 1e9).toFixed(1)}B`;
  } else if (marketCap >= 1e6) {
    return `${(marketCap / 1e6).toFixed(1)}M`;
  } else if (marketCap >= 1e3) {
    return `${(marketCap / 1e3).toFixed(1)}K`;
  } else {
    return marketCap.toFixed(0);
  }
}

// Helper function to format holders count
function formatHolders(holders) {
  if (!holders || isNaN(holders)) {
    return '0';
  }
  if (holders >= 1e6) {
    return `${(holders / 1e6).toFixed(1)}M`;
  } else if (holders >= 1e3) {
    return `${(holders / 1e3).toFixed(1)}K`;
  } else {
    return holders.toLocaleString();
  }
}


// Helper function to fetch market activity data
async function fetchMarketActivity(poolId) {
  try {
    console.log('🔍 Fetching market activity for pool:', poolId);
    
    // Try Vercel API route first
    const response = await fetch(`https://chatscanfun.vercel.app/api/market-activity/${poolId}`);
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Market activity data:', data);
      return data;
    }
    
    // Fallback to API proxy
    const proxyResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/market-activity/${poolId}`);
    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      console.log('📊 Market activity data (proxy):', data);
      return data;
    }
  } catch (error) {
    console.log('Failed to fetch market activity for', poolId, error);
  }
  return null;
}

// Helper function to fetch clips from PumpFun
async function fetchClips(mint) {
  try {
    console.log(`🔍 Fetching clips for ${mint}`);
    
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/pumpfun/clips/${mint}?limit=2&clipType=HIGHLIGHT`);
    if (response.ok) {
      const data = await response.json();
      console.log('🎬 Fetched clips:', data);
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

// Helper function to format time ago
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';
  
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { userWallet } = useDevapp();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [sortBy, setSortBy] = useState('messages');
  const [messageCounts, setMessageCounts] = useState({});
  const [tokenCounts, setTokenCounts] = useState({});
  const [totalHolders, setTotalHolders] = useState({});
  const [liveTrades, setLiveTrades] = useState([]);
  const [userAddresses, setUserAddresses] = useState({});

  // Load tokens with parallel processing
  const loadTokens = async () => {
    try {
      setLoadingProgress(10);
      let allTokenAddresses = [];

      // Load tracked tokens from Prisma API
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tokens/tracked`);
        if (response.ok) {
          const trackedTokens = await response.json();
          allTokenAddresses = trackedTokens.map(t => t.tokenAddress);
        }
      } catch (error) {
        console.warn('Failed to load tracked tokens from API:', error);
      }

      setLoadingProgress(20);

      if (allTokenAddresses.length === 0) {
        console.log('🔍 No tracked tokens found, fetching trending tokens...');
        const trending = await fetchPumpFunTrends();
        console.log('📈 Trending data received:', trending);
        
        if (trending && trending.length > 0) {
          allTokenAddresses = trending.slice(0, 15).map(t => t.mint);
          console.log('🎯 Extracted token addresses:', allTokenAddresses);
        } else {
          console.warn('⚠️ No trending tokens found, using fallback tokens');
          // Fallback to some known pump.fun tokens
          allTokenAddresses = [
            'HnbReFumw6zCnqa88iX3ppSkP92FmHs6rS2zCLz6pump',
            'H1KAUGfLpp44nbjkyWn7bgD3KRjdNwapjj3fz6dNpump',
            'CeFiTzYp3Fyg3ae9V8AptGyS9arJ7GAFSY8y4V55pump',
            '9TwMHjLVck28REn4eHFxeqMYKkJBxLqwX8w7rxrdpump',
            '6fNRTr4b7d9ia3vnfjTMYhh3HBBHi9W63L44nzirpump'
          ];
        }
      }

      setLoadingProgress(30);
      console.log(`🚀 Loading ${allTokenAddresses.length} tokens with parallel processing...`);

      // Process tokens in parallel batches
      const BATCH_SIZE = 5;
      const tokensWithDetails = [];
      const totalBatches = Math.ceil(allTokenAddresses.length / BATCH_SIZE);
      
      for (let i = 0; i < allTokenAddresses.length; i += BATCH_SIZE) {
        const batch = allTokenAddresses.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        console.log(`🔄 Processing batch ${batchNumber}/${totalBatches}: ${batch.length} tokens`);
        
        // Update progress based on batch completion
        const batchProgress = 30 + (batchNumber / totalBatches) * 60;
        setLoadingProgress(Math.min(batchProgress, 90));
        
        const batchPromises = batch.map(async (address) => {
          console.log(`🔄 Processing token: ${address}`);
          try {
            // Fetch token data from API
            const tokenData = await fetchTokenData(address);
            if (tokenData) {
              return {
                id: address,
                mint: address,
                symbol: tokenData.symbol || 'Unknown',
                name: tokenData.name || 'Unknown Token',
              price: parseFloat(tokenData.price) || 0,
              priceChange24h: parseFloat(tokenData.priceChange24h) || 0,
              volume24h: parseFloat(tokenData.volume24h) || 0,
              marketCap: parseFloat(tokenData.marketCap) || 0,
              image: tokenData.image || `https://img.icons8.com/color/96/000000/bitcoin.png`,
              liquidity: parseFloat(tokenData.liquidity) || 0,
              totalHolders: tokenData.totalHolders || 0,
              startTime: Date.now(),
              riskScore: 0,
              isRugged: false,
              isJupiterVerified: false,
              top10Percentage: 0,
              devPercentage: 0,
              insiderCount: 0,
              sniperCount: 0,
              totalBuys: 0,
              totalSells: 0,
              totalTxns: 0,
              isLoadingHolders: false,
              isLoadingRisk: false
            };
          }

          // Fetch fresh data
          const tokenDataResult = await fetchTokenData(address);
          let marketActivity = null;
          if (tokenDataResult?.data?.bonding_curve) {
            marketActivity = await fetchMarketActivity(tokenDataResult.data.bonding_curve);
          }

          // Process data based on source
          const baseData = tokenDataResult ? (() => {
            const { source, data } = tokenDataResult;
            
            if (source === 'pumpfun-v3') {
              return {
                symbol: data.symbol || 'Unknown',
                name: data.name || 'Unknown Token',
                price: 0,
                priceChange24h: 0,
                volume24h: 0,
                marketCap: parseFloat(data.usd_market_cap) || 0,
                image: data?.image_uri || null,
                liquidity: 0,
                socials: [
                  ...(data.twitter ? [{ type: 'twitter', url: data.twitter }] : []),
                  ...(data.telegram ? [{ type: 'telegram', url: data.telegram }] : [])
                ],
                websites: data.website ? [{ label: 'Website', url: data.website }] : [],
                twitter: data.twitter || null,
                telegram: data.telegram || null,
                discord: null,
                website: data.website || null,
                fdv: parseFloat(data.market_cap) || 0,
                pairCreatedAt: data.created_timestamp ? new Date(data.created_timestamp).toISOString() : null,
                pairAddress: data.bonding_curve || null,
                dexId: 'pump.fun',
                chainId: 'solana',
                creatorAddress: data.creator || null,
                launchTime: data.created_timestamp ? new Date(data.created_timestamp).getTime() : null,
                isLive: data.is_currently_live || false,
                streamThumbnail: data.thumbnail || null,
                numParticipants: data.num_participants || 0,
                streamStartTime: data.thumbnail_updated_at ? new Date(data.thumbnail_updated_at * 1000).getTime() : null,
                streamId: null,
                totalSupply: data.total_supply || 1000000000000000,
                replyCount: data.reply_count || 0,
                totalHolders: data.reply_count || 0,
                athMarketCap: parseFloat(data.ath_market_cap) || 0,
                lastTradeTime: data.last_trade_timestamp ? new Date(data.last_trade_timestamp).getTime() : null,
                marketActivity: marketActivity
              };
            } else if (source === 'dexscreener') {
              const token = data.pairs?.[0];
              return {
                symbol: token?.baseToken?.symbol || 'Unknown',
                name: token?.baseToken?.name || 'Unknown Token',
                price: parseFloat(token?.priceUsd) || 0,
                priceChange24h: parseFloat(token?.priceChange?.h24) || 0,
                volume24h: parseFloat(token?.volume?.h24) || 0,
                marketCap: parseFloat(token?.marketCap) || 0,
                image: token?.baseToken?.imageUrl || token?.info?.imageUrl || null,
                liquidity: parseFloat(token?.liquidity?.usd) || 0,
                socials: token?.info?.socials || [],
                websites: token?.info?.websites || [],
                twitter: token?.info?.socials?.find(s => s.type === 'twitter')?.url || null,
                telegram: token?.info?.socials?.find(s => s.type === 'telegram')?.url || null,
                discord: token?.info?.socials?.find(s => s.type === 'discord')?.url || null,
                website: token?.info?.websites?.[0]?.url || null,
                fdv: parseFloat(token?.fdv) || 0,
                pairCreatedAt: token?.pairCreatedAt || null,
                pairAddress: token?.pairAddress || null,
                dexId: token?.dexId || null,
                chainId: token?.chainId || null,
                creatorAddress: null,
                launchTime: token?.pairCreatedAt ? new Date(token.pairCreatedAt).getTime() : null,
                isLive: false,
                streamThumbnail: null,
                numParticipants: 0,
                streamStartTime: null,
                streamId: null,
                totalSupply: 1000000000000000,
                replyCount: 0,
                athMarketCap: 0,
                lastTradeTime: null,
                marketActivity: marketActivity
              };
            } else if (source === 'solanatracker') {
              return {
                symbol: data.symbol || 'Unknown',
                name: data.name || 'Unknown Token',
                price: parseFloat(data.price) || 0,
                priceChange24h: parseFloat(data.price_change_24h) || 0,
                volume24h: parseFloat(data.volume_24h) || 0,
                marketCap: parseFloat(data.market_cap) || 0,
                image: data?.image_url || null,
                liquidity: parseFloat(data.liquidity) || 0,
                socials: [],
                websites: [],
                twitter: null,
                telegram: null,
                discord: null,
                website: null,
                fdv: parseFloat(data.market_cap) || 0,
                pairCreatedAt: null,
                pairAddress: null,
                dexId: null,
                chainId: null,
                creatorAddress: null,
                launchTime: null,
                isLive: false,
                streamThumbnail: null,
                numParticipants: 0,
                streamStartTime: null,
                streamId: null,
                totalSupply: 1000000000000000,
                replyCount: 0,
                athMarketCap: 0,
                lastTradeTime: null,
                marketActivity: marketActivity
              };
            } else {
              return {
                symbol: 'Unknown',
                name: 'Unknown Token',
                price: 0,
                priceChange24h: 0,
                volume24h: 0,
                marketCap: 0,
                image: null,
                liquidity: 0,
                socials: [],
                websites: [],
                twitter: null,
                telegram: null,
                discord: null,
                website: null,
                fdv: 0,
                pairCreatedAt: null,
                pairAddress: null,
                dexId: null,
                chainId: null,
                creatorAddress: null,
                launchTime: null,
                isLive: false,
                streamThumbnail: null,
                numParticipants: 0,
                streamStartTime: null,
                streamId: null,
                totalSupply: 1000000000000000,
                replyCount: 0,
                athMarketCap: 0,
                lastTradeTime: null,
                marketActivity: marketActivity
              };
            }
          })() : {
            symbol: 'Unknown',
            name: 'Unknown Token',
            price: 0,
            priceChange24h: 0,
            volume24h: 0,
            marketCap: 0,
            image: null,
            liquidity: 0,
            socials: [],
            websites: [],
            twitter: null,
            telegram: null,
            discord: null,
            website: null,
            fdv: 0,
            pairCreatedAt: null,
            pairAddress: null,
            dexId: null,
            chainId: null,
            creatorAddress: null,
            launchTime: null,
            isLive: false,
            streamThumbnail: null,
            numParticipants: 0,
            streamStartTime: null,
            streamId: null,
            totalSupply: 1000000000000000,
            replyCount: 0,
            athMarketCap: 0,
            lastTradeTime: null,
            marketActivity: marketActivity
          };

          // Create enhanced data
          const enhancedData = {
            id: address,
            mint: address,
            symbol: baseData.symbol,
            name: baseData.name,
            price: baseData.price,
            priceChange24h: baseData.priceChange24h,
            volume24h: baseData.volume24h,
            marketCap: baseData.marketCap,
            image: baseData.image || null,
            liquidity: baseData.liquidity,
            totalHolders: baseData.totalHolders,
            startTime: baseData.launchTime || Date.now(),
            riskScore: 0,
            isRugged: false,
            isJupiterVerified: false,
            top10Percentage: 0,
            devPercentage: 0,
            insiderCount: 0,
            sniperCount: 0,
            totalBuys: 0,
            totalSells: 0,
            totalTxns: 0,
            isLoadingHolders: false,
            isLoadingRisk: false,
            socials: baseData.socials || [],
            websites: baseData.websites || [],
            twitter: baseData.twitter,
            telegram: baseData.telegram,
            discord: baseData.discord,
            website: baseData.website,
            fdv: baseData.fdv,
            pairCreatedAt: baseData.pairCreatedAt,
            pairAddress: baseData.pairAddress,
            dexId: baseData.dexId,
            chainId: baseData.chainId,
            creatorAddress: baseData.creatorAddress,
            launchTime: baseData.launchTime,
            isLive: baseData.isLive,
            streamThumbnail: baseData.streamThumbnail,
            numParticipants: baseData.numParticipants,
            streamStartTime: baseData.streamStartTime,
            streamId: baseData.streamId,
            totalSupply: baseData.totalSupply,
            replyCount: baseData.replyCount,
            athMarketCap: baseData.athMarketCap,
            lastTradeTime: baseData.lastTradeTime,
            marketActivity: baseData.marketActivity,
            messageCount: baseData.replyCount || 0
          };

          // Save to Prisma API
          try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/tokens`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                mint: address,
                ...enhancedData
              })
            });
          } catch (error) {
            console.warn('Failed to save token to API:', error);
          }

          return enhancedData;
          } catch (error) {
            console.error(`❌ Error processing token ${address}:`, error);
            return null;
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        tokensWithDetails.push(...batchResults.filter(result => result));

        // Add delay between batches
        if (i + BATCH_SIZE < allTokenAddresses.length) {
          console.log('⏳ Waiting 1 second before next batch...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const filteredTokens = tokensWithDetails.filter(t => t && t.symbol && t.symbol !== 'Unknown');
      setTokens(filteredTokens);

      const holdersMap = {};
      let totalHoldersCount = 0;
      filteredTokens.forEach(t => {
        const holders = t.totalHolders || 0;
        holdersMap[t.id] = holders;
        totalHoldersCount += holders;
      });
      setTotalHolders(holdersMap);
      
      console.log('📊 Total Holders Calculation:', {
        individualHolders: holdersMap,
        totalCount: totalHoldersCount,
        tokenCount: filteredTokens.length
      });

      console.log('🎉 Loading completed successfully!');
      setLoadingProgress(100);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load tokens', error);
      setLoadingProgress(100);
      setLoading(false);
    }
    
    // Ensure intro animation completes even if there are issues
    setTimeout(() => {
      console.log('⏰ Timeout fallback triggered - forcing completion');
      setLoadingProgress(100);
      setLoading(false);
    }, 3000); // 3 second timeout
  };

  const addToken = async () => {
    if (!newTokenAddress.trim()) return;

    setIsAddingToken(true);
    try {
      // Add token via Prisma API
      await fetch(`${import.meta.env.VITE_API_URL}/api/tokens/tracked`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenAddress: newTokenAddress.trim(),
          addedBy: userWallet || 'anonymous'
        })
      });

      // Subscribe webhook for this token
      const userId = userWallet || 'anon-' + Date.now();
      const webhookUrl = `${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/webhooks/create`;
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tokenMint: newTokenAddress.trim()
        })
      }).then(r => r.json()).then(data => {
        if (data.success) console.log('✅ Webhook subscribed for', newTokenAddress);
      }).catch(err => console.error('Webhook sub failed:', err));

      setNewTokenAddress('');
      await loadTokens();
    } catch (error) {
      console.error('Failed to add token:', error);
      alert('Failed to add token. Please try again.');
    } finally {
      setIsAddingToken(false);
    }
  };

  const removeToken = async (mint) => {
    try {
      // Remove token via Prisma API
      await fetch(`${import.meta.env.VITE_API_URL}/api/tokens/tracked/${mint}`, {
        method: 'DELETE'
      });
      console.log('🗑️ Removed token from tracking:', mint);
      
      // Unsubscribe webhook
      const userId = userWallet || 'anon-' + Date.now();
      const webhookUrl = `${import.meta.env.VITE_API_URL || 'https://chatscanfun.vercel.app'}/api/webhooks/delete`;
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tokenMint: mint })
      }).then(r => r.json()).then(data => {
        if (data.success) console.log('✅ Webhook unsubscribed for', mint);
      }).catch(err => console.error('Webhook unsub failed:', err));

      await loadTokens();
    } catch (error) {
      console.error('Failed to remove token:', error);
    }
  };

  const filteredTokens = tokens.filter(token => {
    if (!token.symbol || token.symbol === 'Unknown' || !token.name || token.name === 'Unknown Token') {
      return false;
    }
    return true;
  });

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    switch (sortBy) {
      case 'messages':
        return (messageCounts[b.mint] || 0) - (messageCounts[a.mint] || 0);
      case 'holders':
        return (b.totalHolders || 0) - (a.totalHolders || 0);
      case 'tokens':
        return (tokenCounts[b.mint] || 0) - (tokenCounts[a.mint] || 0);
      case 'price':
        return (b.price || 0) - (a.price || 0);
      case 'volume':
        return (b.volume24h || 0) - (a.volume24h || 0);
      default:
        return 0;
    }
  });

  const featuredTokens = sortedTokens.slice(0, 3);
  const remainingTokens = sortedTokens.slice(3);

  // Load tokens on mount
  useEffect(() => {
    loadTokens();
  }, []);

  // Check if onboarding was already completed
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (onboardingCompleted === 'true') {
      setShowOnboarding(false);
    }
  }, []);

  // Handle intro completion
  const handleIntroComplete = () => {
    console.log('🎬 Intro animation completed, showing onboarding');
    setShowIntro(false);
    const onboardingCompleted = localStorage.getItem('onboardingCompleted');
    if (onboardingCompleted !== 'true') {
      setShowOnboarding(true);
    }
  };

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    console.log('🎓 Onboarding completed, showing main content');
    localStorage.setItem('onboardingCompleted', 'true');
    setShowOnboarding(false);
  };

  // Live trade webhook listener
  useEffect(() => {
    const backendSocket = getBackendSocket();
    
    // Skip if backend socket is not available
    if (!backendSocket) {
      console.log('🔌 Backend socket not available, skipping live trade listener');
      return;
    }
    
    const handleLiveTrade = (tradeData) => {
      console.log('📈 Live trade received:', tradeData);
      setLiveTrades(prev => [tradeData, ...prev.slice(0, 9)]);
    };

    backendSocket.on('liveTrade', handleLiveTrade);

    return () => {
      backendSocket.off('liveTrade', handleLiveTrade);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white relative overflow-hidden">
      {/* Enhanced Background Effects */}
      {!showIntro && !showOnboarding && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {/* Animated background particles */}
          {[...Array(25)].map((_, i) => (
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
                opacity: [0, 0.8, 0],
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
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={`orb-${i}`}
              className="absolute w-32 h-32 rounded-full opacity-10"
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
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
          <div className="absolute inset-0 bg-gradient-to-tl from-blue-900/10 via-transparent to-cyan-900/10" />
          
          {/* Animated mesh gradient */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 animate-pulse" />
          </div>
        </div>
      )}

      {/* Intro Animation */}
      {showIntro && (
        <IntroAnimation
          onComplete={handleIntroComplete}
          isLoading={loading}
          progress={loadingProgress}
        />
      )}

      {/* Onboarding */}
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {/* Main Content */}
      <div className={`relative z-10 transition-opacity duration-1000 ${showIntro || showOnboarding ? 'opacity-0 pointer-events-none' : 'opacity-100'} p-4 sm:p-6 lg:p-8`}>
      <div className="max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8 sm:mb-12"
        >
          {/* Glassmorphism background */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 rounded-3xl backdrop-blur-xl border border-white/10" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between p-6 sm:p-8 gap-6">
            <div className="flex-1">
              <motion.div 
                className="flex items-center gap-4 mb-2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
              >
                <img 
                  src="/logo.png" 
                  alt="Chat Scan" 
                  className="w-20 h-20 sm:w-24 sm:h-24"
                />
              </motion.div>
              <motion.div 
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <p className="text-gray-300 text-lg sm:text-xl font-medium">See through the noise.</p>
                <div className="bg-gradient-to-r from-gray-700/30 to-gray-600/30 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium w-fit border border-gray-600/40 backdrop-blur-sm">
                </div>
              </motion.div>
            </div>
            {/* Wallet connection handled by Privy - removed button for cleaner UI */}
          </div>
        </motion.div>

        {/* Enhanced Add Token Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="relative mb-8"
        >
          {/* Glassmorphism background */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800/30 via-gray-900/30 to-gray-800/30 rounded-2xl backdrop-blur-xl border border-white/10" />
          
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <div className="flex-1">
                <motion.input
                  type="text"
                  placeholder="Enter token mint address..."
                  value={newTokenAddress}
                  onChange={(e) => setNewTokenAddress(e.target.value)}
                  className="w-full px-6 py-4 bg-black/40 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 backdrop-blur-sm transition-all duration-300 text-lg"
                  whileFocus={{ scale: 1.02 }}
                />
              </div>
              <div className="flex gap-3">
                <motion.select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-4 bg-black/40 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 backdrop-blur-sm transition-all duration-300 min-w-[120px]"
                  whileHover={{ scale: 1.02 }}
                >
                  <option value="messages">📊 Messages</option>
                  <option value="holders">👥 Holders</option>
                  <option value="tokens">🪙 Tokens</option>
                  <option value="price">💰 Price</option>
                  <option value="volume">📈 Volume</option>
                </motion.select>
                <motion.button
                  onClick={addToken}
                  disabled={isAddingToken || !newTokenAddress.trim()}
                  className="group relative bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl transition-all duration-300 font-semibold text-lg overflow-hidden"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10 flex items-center gap-2">
                    {isAddingToken ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add Token
                      </>
                    )}
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Featured Tokens */}
        {featuredTokens.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mb-12"
          >
            <div className="text-center mb-8">
              <motion.h2 
                className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent mb-2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              >
                🪙 TOKENS
              </motion.h2>
              <motion.p 
                className="text-gray-400 text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.4 }}
              >
                Track and analyze token activity
              </motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {featuredTokens.map((token, index) => {
                const cardColors = [
                  'from-blue-500 via-blue-600 to-purple-600', // Primary
                  'from-gray-500 via-gray-600 to-gray-700', // Secondary
                  'from-purple-500 via-purple-600 to-indigo-600' // Tertiary
                ];
                
                return (
                  <motion.div
                    key={token.id}
                    initial={{ opacity: 0, y: 30, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      delay: 1.4 + (index * 0.2),
                      duration: 0.8,
                      ease: "easeOut"
                    }}
                    whileHover={{ 
                      scale: 1.05,
                      rotateY: 5,
                      transition: { duration: 0.3 }
                    }}
                    className="group relative cursor-pointer"
                    onClick={() => navigate(`/token/${token.mint}`)}
                  >
                    {/* Glassmorphism background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/10 to-white/5 rounded-3xl backdrop-blur-xl border border-white/20 group-hover:border-white/30 transition-all duration-500" />
                    
                    {/* Animated gradient border */}
                    <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r ${cardColors[index]} opacity-20 group-hover:opacity-40 transition-opacity duration-500`} />
                    
                    {/* Content */}
                    <div className="relative z-10 p-6 sm:p-8">
                      {/* Header with rank */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${cardColors[index]} flex items-center justify-center text-white font-black text-2xl shadow-lg overflow-hidden`}>
                              {token.image ? (
                                <img 
                                  src={token.image} 
                                  alt={token.symbol || 'Token'} 
                                  className="w-full h-full object-cover rounded-2xl"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${token.image ? 'hidden' : 'flex'}`}>
                                {token.symbol?.charAt(0) || '?'}
                              </div>
                            </div>
                          </div>
                          <div>
                            <h3 className="font-black text-xl text-white">{token.symbol}</h3>
                            <p className="text-gray-300 text-sm">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400 font-medium">
                            {token.marketCap ? `$${formatMarketCap(token.marketCap)}` : 'Loading...'}
                          </div>
                          <div className="text-xs text-gray-500">Market Cap</div>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center py-2 px-3 bg-black/20 rounded-xl">
                          <span className="text-gray-300 font-medium">Market Cap</span>
                          <span className="font-bold text-white">${formatMarketCap(token.marketCap)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-black/20 rounded-xl">
                          <span className="text-gray-300 font-medium">Holders</span>
                          <span className="font-bold text-white">{formatHolders(token.totalHolders)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-3 bg-black/20 rounded-xl">
                          <span className="text-gray-300 font-medium">Messages</span>
                          <span className="font-bold text-white">{messageCounts[token.mint] || 0}</span>
                        </div>
                      </div>

                      {/* Live indicator */}
                      {token.isLive && (
                        <motion.div 
                          className="flex items-center gap-3 text-red-400 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 1.6 + (index * 0.2) }}
                        >
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span className="font-semibold">LIVE</span>
                          <span className="text-red-300 text-sm">({token.numParticipants} viewers)</span>
                        </motion.div>
                      )}
                      
                      {/* Hover effect overlay */}
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500/0 via-pink-500/0 to-cyan-500/0 group-hover:from-purple-500/10 group-hover:via-pink-500/10 group-hover:to-cyan-500/10 transition-all duration-500" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Remaining Tokens */}
        {remainingTokens.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">All Tokens ({remainingTokens.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {remainingTokens.map((token) => (
                <motion.div
                  key={token.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => navigate(`/token/${token.mint}`)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                        {token.symbol?.charAt(0) || '?'}
                      </div>
                      <div>
                        <h3 className="font-semibold">{token.symbol}</h3>
                        <p className="text-gray-400 text-xs">{token.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeToken(token.mint);
                      }}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">MC:</span>
                      <span>${formatMarketCap(token.marketCap)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Holders:</span>
                      <span>{formatHolders(token.totalHolders)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Messages:</span>
                      <span>{messageCounts[token.mint] || 0}</span>
                    </div>
                  </div>

                  {token.isLive && (
                    <div className="mt-2 flex items-center gap-1 text-red-500 text-xs">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                      <span>LIVE</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* No tokens message */}
        {tokens.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">No tokens found</h3>
            <p className="text-gray-400 mb-6">Add some tokens to get started!</p>
            <button
              onClick={() => setNewTokenAddress('')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Add Your First Token
            </button>
          </div>
        )}
        </div>

      </div>
    </div>
  );
}
