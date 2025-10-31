// Optimized Dashboard loading function
const loadTokensOptimized = async () => {
  try {
    let allTokenAddresses = [];

    if (devbaseClient) {
      const trackedTokens = await devbaseClient.listEntities('trackedTokens');
      allTokenAddresses = trackedTokens.map(t => t.tokenAddress);
    }

    if (allTokenAddresses.length === 0) {
      const trending = await fetchPumpFunTrends();
      allTokenAddresses = trending.slice(0, 15).map(t => t.mint);
    }

    console.log(`🚀 Loading ${allTokenAddresses.length} tokens with parallel processing...`);

    // Process tokens in parallel batches to avoid rate limiting
    const BATCH_SIZE = 5; // Process 5 tokens at once
    const tokensWithDetails = [];
    
    for (let i = 0; i < allTokenAddresses.length; i += BATCH_SIZE) {
      const batch = allTokenAddresses.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allTokenAddresses.length / BATCH_SIZE)}: ${batch.length} tokens`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (address) => {
        // Check cache first
        let cachedToken = null;
        if (devbaseClient) {
          try {
            const existingTokens = await devbaseClient.listEntities('tokens', {
              filter: { mint: address }
            });
            cachedToken = existingTokens[0];
          } catch (error) {
            // No cached data
          }
        }

        // Use cached data if available
        if (cachedToken && cachedToken.symbol && cachedToken.symbol !== 'Unknown') {
          return {
            id: address,
            mint: address,
            symbol: cachedToken.symbol || 'Unknown',
            name: cachedToken.name || 'Unknown Token',
            price: parseFloat(cachedToken.price) || 0,
            priceChange24h: parseFloat(cachedToken.price_change_24h) || 0,
            volume24h: parseFloat(cachedToken.volume_24h) || 0,
            marketCap: parseFloat(cachedToken.market_cap) || 0,
            image: cachedToken.image_url || `https://img.icons8.com/color/96/000000/bitcoin.png`,
            liquidity: parseFloat(cachedToken.liquidity) || 0,
            totalHolders: cachedToken.holders_count || 0,
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
              image: data.image_uri || null,
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
              image: data.image_url || null,
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

        // Save to database if we have a devbase client
        if (devbaseClient) {
          try {
            const existingTokens = await devbaseClient.listEntities('tokens', {
              filter: { mint: address }
            });
            
            if (existingTokens.length > 0) {
              await devbaseClient.updateEntity('tokens', existingTokens[0].id, {
                symbol: enhancedData.symbol,
                name: enhancedData.name,
                image_url: enhancedData.image,
                holders_count: enhancedData.totalHolders,
                market_cap: enhancedData.marketCap,
                price: enhancedData.price,
                price_change_24h: enhancedData.priceChange24h,
                volume_24h: enhancedData.volume24h,
                liquidity: enhancedData.liquidity,
                market_activity: enhancedData.marketActivity
              });
            } else {
              await devbaseClient.createEntity('tokens', {
                mint: address,
                symbol: enhancedData.symbol,
                name: enhancedData.name,
                image_url: enhancedData.image,
                holders_count: enhancedData.totalHolders,
                market_cap: enhancedData.marketCap,
                price: enhancedData.price,
                price_change_24h: enhancedData.priceChange24h,
                volume_24h: enhancedData.volume24h,
                liquidity: enhancedData.liquidity,
                market_activity: enhancedData.marketActivity
              });
            }
          } catch (error) {
            console.error('💾 Failed to save token data for', address, error);
          }
        }

        return enhancedData;
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      tokensWithDetails.push(...batchResults.filter(result => result));

      // Add delay between batches to prevent rate limiting
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

    setLoading(false);
  } catch (error) {
    console.error('Failed to load tokens', error);
    setLoading(false);
  }
};
