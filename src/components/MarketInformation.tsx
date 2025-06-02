// components/MarketInformation.tsx
import React, { useState, useEffect } from 'react';
import {
  Box, VStack, HStack, Stat, StatLabel, StatNumber, StatHelpText, 
  StatArrow, SimpleGrid, Skeleton, Text, Badge, Tooltip, Divider
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';

// Define types for market data
interface MarketData {
  totalOI: number;
  dailyVolume: number;
  dominanceData: { symbol: string; percentage: number }[];
  marketTrend: 'bullish' | 'bearish' | 'neutral';
  fundingHealth: 'positive' | 'negative' | 'neutral';
  lastUpdated: Date;
}

// API endpoints configuration
const API_ENDPOINTS = {
  OPEN_INTEREST: 'https://api.coingecko.com/api/v3/derivatives/exchanges',
  VOLUME: 'https://api.coingecko.com/api/v3/global',
  DOMINANCE: 'https://api.coingecko.com/api/v3/global',
  FUNDING_RATES: 'https://fapi.binance.com/fapi/v1/premiumIndex'
};

export const MarketInformation: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch data from multiple APIs in parallel
        const [volumeData, dominanceData, fundingData] = await Promise.all([
          fetch(API_ENDPOINTS.VOLUME).then(res => res.json()),
          fetch(API_ENDPOINTS.DOMINANCE).then(res => res.json()),
          fetch(API_ENDPOINTS.FUNDING_RATES).then(res => res.json())
        ]);

        // Calculate market trend based on 24h price changes
        const btcChange = dominanceData.data.market_cap_percentage.btc_24h_change;
        const ethChange = dominanceData.data.market_cap_percentage.eth_24h_change;
        const marketTrend = (btcChange > 2 && ethChange > 2) ? 'bullish' : 
                          (btcChange < -2 || ethChange < -2) ? 'bearish' : 'neutral';

        // Calculate funding health (simplified)
        const averageFunding = fundingData.reduce((acc: number, curr: any) => 
          acc + parseFloat(curr.lastFundingRate), 0) / fundingData.length;
        const fundingHealth = averageFunding > 0 ? 'positive' : averageFunding < 0 ? 'negative' : 'neutral';

        setMarketData({
          totalOI: volumeData.data.total_derivatives_volume_24h / 1000000000, // Convert to billions
          dailyVolume: volumeData.data.total_volume / 1000000000, // Convert to billions
          dominanceData: [
            { symbol: 'BTC', percentage: Math.round(dominanceData.data.market_cap_percentage.btc * 10) / 10 },
            { symbol: 'ETH', percentage: Math.round(dominanceData.data.market_cap_percentage.eth * 10) / 10 },
            { symbol: 'SOL', percentage: Math.round(dominanceData.data.market_cap_percentage.sol * 10) / 10 || 0 },
            { symbol: 'Others', percentage: Math.round(
              (100 - 
               dominanceData.data.market_cap_percentage.btc - 
               dominanceData.data.market_cap_percentage.eth - 
               (dominanceData.data.market_cap_percentage.sol || 0)) * 10
            ) / 10 }
          ],
          marketTrend,
          fundingHealth,
          lastUpdated: new Date()
        });
      } catch (err) {
        console.error('Failed to fetch market data:', err);
        setError('Failed to load market data. Please try again later.');
        // Fallback to dummy data if API fails
        setMarketData({
          totalOI: 12.7,
          dailyVolume: 45.3,
          dominanceData: [
            { symbol: 'BTC', percentage: 42.3 },
            { symbol: 'ETH', percentage: 28.7 },
            { symbol: 'SOL', percentage: 8.2 },
            { symbol: 'Others', percentage: 20.8 }
          ],
          marketTrend: 'neutral',
          fundingHealth: 'neutral',
          lastUpdated: new Date()
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      {error && (
        <Text color="red.500" mb={4}>
          {error} Using cached data.
        </Text>
      )}
      
      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height="100px" borderRadius="md" />
          ))}
        </SimpleGrid>
      ) : marketData && (
        <VStack spacing={6} align="stretch">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Stat bg="whiteAlpha.200" p={4} borderRadius="md" boxShadow="sm">
              <StatLabel>Total Open Interest</StatLabel>
              <HStack>
                <StatNumber>${marketData.totalOI.toFixed(1)}B</StatNumber>
                <Tooltip label="Total value of all open positions across major exchanges">
                  <InfoIcon boxSize={4} color="gray.500" />
                </Tooltip>
              </HStack>
              <StatHelpText>
                {marketData.marketTrend === 'bullish' ? (
                  <StatArrow type="increase" />
                ) : marketData.marketTrend === 'bearish' ? (
                  <StatArrow type="decrease" />
                ) : null}
                {marketData.marketTrend !== 'neutral' ? 'Market is ' + marketData.marketTrend : 'Market is neutral'}
              </StatHelpText>
            </Stat>
            
            <Stat bg="whiteAlpha.200" p={4} borderRadius="md" boxShadow="sm">
              <StatLabel>24h Trading Volume</StatLabel>
              <HStack>
                <StatNumber>${marketData.dailyVolume.toFixed(1)}B</StatNumber>
                <Tooltip label="Total trading volume in the last 24 hours">
                  <InfoIcon boxSize={4} color="gray.500" />
                </Tooltip>
              </HStack>
              <StatHelpText>
                {marketData.fundingHealth === 'positive' ? (
                  <StatArrow type="increase" />
                ) : marketData.fundingHealth === 'negative' ? (
                  <StatArrow type="decrease" />
                ) : null}
                {marketData.fundingHealth !== 'neutral' ? 'Funding rates are ' + marketData.fundingHealth : 'Funding rates are neutral'}
              </StatHelpText>
            </Stat>
          </SimpleGrid>
          
          <Box bg="whiteAlpha.200" p={4} borderRadius="md" boxShadow="sm">
            <Text fontWeight="medium" mb={2}>Market Dominance</Text>
            <SimpleGrid columns={4} spacing={2}>
              {marketData.dominanceData.map(item => (
                <Stat key={item.symbol} size="sm">
                  <StatLabel>{item.symbol}</StatLabel>
                  <StatNumber fontSize="lg">{item.percentage}%</StatNumber>
                </Stat>
              ))}
            </SimpleGrid>
          </Box>
          
          <HStack justify="space-between" bg="whiteAlpha.200" p={4} borderRadius="md" boxShadow="sm">
            <VStack align="start">
              <Text fontWeight="medium">Market Sentiment</Text>
              <Badge colorScheme={marketData.marketTrend === 'bullish' ? 'green' : marketData.marketTrend === 'bearish' ? 'red' : 'gray'} px={2} py={1}>
                {marketData.marketTrend.toUpperCase()}
              </Badge>
            </VStack>
            <Divider orientation="vertical" height="40px" />
            <VStack align="start">
              <Text fontWeight="medium">Funding Rate Health</Text>
              <Badge colorScheme={marketData.fundingHealth === 'positive' ? 'green' : marketData.fundingHealth === 'negative' ? 'red' : 'gray'} px={2} py={1}>
                {marketData.fundingHealth.toUpperCase()}
              </Badge>
            </VStack>
          </HStack>
          
          <Text fontSize="xs" color="gray.500" textAlign="right">
            Last updated: {marketData.lastUpdated.toLocaleTimeString()}
          </Text>
        </VStack>
      )}
    </Box>
  );
};