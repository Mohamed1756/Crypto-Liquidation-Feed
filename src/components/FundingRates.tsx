import { RestClientV5 } from 'bybit-api';

// Define types
interface FundingRate {
  symbol: string;
  coin: string;
  lastFundingRate: number;
  nextFundingTime: number;
  exchange: string;
}

// Extract coin name from symbol (e.g., BTCUSDT -> BTC)
const extractCoin = (symbol: string): string => {
  if (symbol.includes('-')) {
    // OKX format: BTC-USDT-SWAP or BTC-USD-SWAP
    return symbol.split('-')[0];
  }
  // Binance/Bybit format: BTCUSDT
  return symbol.replace(/USDT$/, '');
};

export async function fetchFundingRates(targetCoins: string[] = ['BTC', 'ETH', 'SOL']): Promise<FundingRate[]> {
  const allRates: FundingRate[] = [];
  const okxSymbols = targetCoins.map(coin => `${coin}-USDT-SWAP`);

  // 1. Fetch Binance funding rates
  try {
    const binanceResponse = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
    const binanceData = await binanceResponse.json();
    const binanceRates = binanceData
      .filter((rate: any) => {
        const coin = extractCoin(rate.symbol);
        return rate.symbol.endsWith('USDT') && targetCoins.includes(coin);
      })
      .map((rate: any) => ({
        symbol: rate.symbol,
        coin: extractCoin(rate.symbol),
        lastFundingRate: parseFloat(rate.lastFundingRate) * 100, // Convert to percentage
        nextFundingTime: rate.nextFundingTime,
        exchange: 'Binance'
      }));
    
    allRates.push(...binanceRates);
  } catch (error) {
    console.error('Error fetching Binance data:', error);
  }

  // 2. Fetch Bybit funding rates
  try {
    const client = new RestClientV5({ testnet: false });
    const bybitSymbols = targetCoins.map(coin => `${coin}USDT`);
    
    for (const symbol of bybitSymbols) {
      try {
        const bybitResponse = await client.getFundingRateHistory({
          category: 'linear',
          symbol,
          limit: 1,
        });

        if (bybitResponse.result?.list?.length > 0) {
          const rates = bybitResponse.result.list.map((rate: any) => ({
            symbol: rate.symbol,
            coin: extractCoin(rate.symbol),
            lastFundingRate: parseFloat(rate.fundingRate) * 100, // Convert to percentage
            nextFundingTime: parseInt(rate.fundingTime),
            exchange: 'Bybit'
          }));
          allRates.push(...rates);
        }
      } catch (error) {
        console.error(`Error fetching Bybit data for ${symbol}:`, error);
      }
    }
  } catch (error) {
    console.error('Error with Bybit client:', error);
  }

  // 3. Fetch OKX funding rates
  try {
    for (const symbol of okxSymbols) {
      try {
        const okxResponse = await fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${symbol}`);
        const okxData = await okxResponse.json();
        
        if (okxData.data && okxData.data.length > 0) {
          const rateData = okxData.data[0];
          const coin = extractCoin(rateData.instId);
          
          if (targetCoins.includes(coin)) {
            allRates.push({
              symbol: rateData.instId,
              coin,
              lastFundingRate: parseFloat(rateData.fundingRate) * 100, // Convert to percentage
              nextFundingTime: parseInt(rateData.nextFundingTime),
              exchange: 'OKX'
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching OKX data for ${symbol}:`, error);
      }
    }
  } catch (error) {
    console.error('Error fetching OKX data:', error);
  }

  // 4. Fetch Hyperliquid funding rates
  try {
    const hyperliquidResponse = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'metaAndAssetCtxs'
      })
    });
    
    const hyperliquidData = await hyperliquidResponse.json();
    
    if (Array.isArray(hyperliquidData) && hyperliquidData.length > 1 && Array.isArray(hyperliquidData[1])) {
      const coinIndices: Record<string, number> = {
        'BTC': 0,
        'ETH': 1,
        'SOL': 2
      };
      
      for (const coin of targetCoins) {
        const index = coinIndices[coin];
        if (index !== undefined && hyperliquidData[1][index] && hyperliquidData[1][index].funding !== undefined) {
          const fundingRate = parseFloat(hyperliquidData[1][index].funding) * 100;
          
          if (!isNaN(fundingRate)) {
            const currentTime = Date.now();
            const nextFundingTime = currentTime + (8 * 60 * 60 * 1000); // 8 hours in milliseconds
            
            allRates.push({
              symbol: `${coin}USDT`,
              coin,
              lastFundingRate: fundingRate,
              nextFundingTime: nextFundingTime,
              exchange: 'Hyperliquid'
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Hyperliquid data:', error);
  }

  

  return allRates;
}