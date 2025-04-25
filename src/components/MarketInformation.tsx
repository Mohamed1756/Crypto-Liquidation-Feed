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

export const MarketInformation: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  useEffect(() => {
    // Simulated API call to fetch market data
    const fetchMarketData = async () => {
      setIsLoading(true);
      
      // In a real implementation, this would be an API call
      // For now, using dummy data
      setTimeout(() => {
        setMarketData({
          totalOI: 12.7, // In billions
          dailyVolume: 45.3, // In billions
          dominanceData: [
            { symbol: 'BTC', percentage: 42.3 },
            { symbol: 'ETH', percentage: 28.7 },
            { symbol: 'SOL', percentage: 8.2 },
            { symbol: 'Others', percentage: 20.8 }
          ],
          marketTrend: 'bullish',
          fundingHealth: 'positive',
          lastUpdated: new Date()
        });
        setIsLoading(false);
      }, 1500);
    };

    fetchMarketData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

 

  return (
    <Box>
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
                <StatArrow type="increase" />
                5.2% since yesterday
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
                <StatArrow type="decrease" />
                2.3% since yesterday
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