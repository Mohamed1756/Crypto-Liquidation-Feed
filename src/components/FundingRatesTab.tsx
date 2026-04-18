import {
  Box,
  Flex,
  Grid,
  Text,
  VStack,
  Button,
  ButtonGroup,
  HStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { 
  RefreshCw,
} from 'lucide-react';

interface FundingRate {
  market_id: number;
  exchange: string;
  symbol: string;
  rate: number;
}

type FundingPeriod = '8h' | '1d' | '7d' | '30d' | '90d' | '180d' | '365d';

const PERIOD_FACTORS: Record<FundingPeriod, number> = {
  '8h': 1,
  '1d': 3,
  '7d': 3 * 7,
  '30d': 3 * 30,
  '90d': 3 * 90,
  '180d': 3 * 180,
  '365d': 3 * 365,
};

const EXCHANGES = ['binance', 'bybit', 'hyperliquid', 'lighter'];

export function FundingRatesTab() {
  const [rates, setRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FundingPeriod>('8h');
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>({ col: 'lighter', dir: 1 });

  const marketData = useMemo(() => {
    const factor = PERIOD_FACTORS[period];
    const markets: Record<string, Record<string, number>> = {};
    rates.forEach(r => {
      if (!markets[r.symbol]) markets[r.symbol] = {};
      markets[r.symbol][r.exchange.toLowerCase()] = r.rate * factor;
    });
    return Object.entries(markets).map(([symbol, cells]) => ({ symbol, cells }));
  }, [rates, period]);

  const sorted = useMemo(() => {
    if (!sort) return marketData;
    return [...marketData].sort((a, b) => {
      const vA = a.cells[sort.col] ?? -999;
      const vB = b.cells[sort.col] ?? -999;
      return (vA - vB) * sort.dir;
    });
  }, [marketData, sort]);

  const fundingArbOpportunities = useMemo(() => {
    return marketData
      .map(({ symbol, cells }) => {
        const available = Object.entries(cells)
          .filter(([ex]) => EXCHANGES.includes(ex));
        
        if (available.length < 2) return null;
        
        const sortedRates = available.sort(([, a], [, b]) => a - b);
        const low = sortedRates[0];
        const high = sortedRates[sortedRates.length - 1];
        const spread = high[1] - low[1];
        
        if (spread <= 0.0001) return null;
        
        return {
          symbol,
          longEx: low[0],
          shortEx: high[0],
          spread,
        };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 5);
  }, [marketData]);

  const carryOpportunities = useMemo(() => {
    return marketData
      .map(({ symbol, cells }) => {
        // Find best exchange to short perp (highest positive funding)
        const best = Object.entries(cells)
          .filter(([ex]) => EXCHANGES.includes(ex))
          .sort(([, a], [, b]) => b - a)[0];
        
        if (!best || best[1] <= 0) return null;
        
        return {
          symbol,
          exchange: best[0],
          rate: best[1],
        };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [marketData]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`https://api.v2.lighter.xyz/funding_rates?period=8h`);
      const data = await resp.json();
      const finalRates = Array.isArray(data) ? data : (data.funding_rates || []);
      setRates(finalRates);
    } catch (e) {
      console.error(e);
      const fallbackResp = await fetch(`https://mainnet.zklighter.elliot.ai/api/v1/funding-rates?period=8h`);
      const fallbackData = await fallbackResp.json();
      setRates(fallbackData.funding_rates || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [period]);

  return (
    <Box height="100%" display="flex" flexDirection="column" bg="brand.paper">
      <Flex justify="space-between" align="center" mb={6}>
        <HStack spacing={4}>
          <Text fontSize="11px" fontWeight="800" color="brand.ink" letterSpacing="wider">FUNDING TAPE</Text>
          <ButtonGroup size="xs" variant="outline" isAttached>
            {(['8h', '1d', '7d', '30d', '90d', '180d', '365d'] as FundingPeriod[]).map((p) => (
              <Button
                key={p}
                onClick={() => setPeriod(p)}
                bg={period === p ? 'brand.ink' : 'transparent'}
                color={period === p ? 'brand.paper' : 'brand.ink'}
                borderColor="brand.ink"
                borderWidth="2px"
                fontSize="8px"
                fontFamily="mono"
                px={2}
                zIndex={period === p ? 2 : 1}
                _hover={{ bg: 'brand.ink', color: 'brand.paper' }}
              >
                {p === '90d' ? '3M' : p === '180d' ? '6M' : p === '365d' ? '1Y' : p.toUpperCase()}
              </Button>
            ))}
          </ButtonGroup>
        </HStack>
        <Button 
          size="xs" 
          variant="solid" 
          bg="brand.ink"
          color="brand.paper"
          borderRadius="0"
          onClick={fetchData} 
          isLoading={loading} 
          leftIcon={<RefreshCw size={10} />}
          _hover={{ bg: 'brand.mutedInk' }}
        >
          REFRESH
        </Button>
      </Flex>

      {/* Arbitrage Opportunities Section */}
      <Box mb={8}>
        <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap={8}>
          {/* Delta Arb (Cash & Carry) */}
          <Box>
            <Text 
              fontSize="10px" 
              fontWeight="900" 
              color="brand.paper" 
              bg="brand.ink" 
              px={2} 
              py={0.5} 
              display="inline-block" 
              mb={3} 
              letterSpacing="0.1em"
            >
              01 // DELTA ARB (SPOT/PERP)
            </Text>
            <Grid templateColumns="repeat(auto-fill, minmax(140px, 1fr))" gap={3}>
              {carryOpportunities.map(opp => (
                <Box key={opp.symbol} p={3} border="1px solid" borderColor="brand.border" _hover={{ bg: 'rgba(0,0,0,0.01)' }}>
                  <Flex justify="space-between" mb={2} align="baseline">
                    <Text fontSize="12px" fontWeight="700" color="brand.ink">{opp.symbol}</Text>
                    <Text fontSize="11px" fontWeight="700" color="brand.mutedRed">+{(opp.rate * 100).toFixed(3)}%</Text>
                  </Flex>
                  <HStack spacing={2} fontSize="8px" fontWeight="600" color="brand.mutedInk" fontFamily="mono">
                    <VStack align="start" spacing={0} flex={1}>
                      <Text opacity={0.5} fontSize="7px">LONG</Text>
                      <Text color="brand.ink">SPOT</Text>
                    </VStack>
                    <Box w="1px" h="12px" bg="brand.border" />
                    <VStack align="start" spacing={0} flex={1}>
                      <Text opacity={0.5} fontSize="7px">SHORT</Text>
                      <Text color="brand.ink">{opp.exchange.toUpperCase()}</Text>
                    </VStack>
                  </HStack>
                </Box>
              ))}
            </Grid>
          </Box>

          {/* Funding Arb (X-Exchange) */}
          <Box>
            <Text 
              fontSize="10px" 
              fontWeight="900" 
              color="brand.paper" 
              bg="brand.ink" 
              px={2} 
              py={0.5} 
              display="inline-block" 
              mb={3} 
              letterSpacing="0.1em"
            >
              02 // FUNDING ARB (X-EXCHANGE)
            </Text>
            <Grid templateColumns="repeat(auto-fill, minmax(140px, 1fr))" gap={3}>
              {fundingArbOpportunities.map(opp => (
                <Box key={opp.symbol} p={3} border="1px solid" borderColor="brand.border" _hover={{ bg: 'rgba(0,0,0,0.01)' }}>
                  <Flex justify="space-between" mb={2} align="baseline">
                    <Text fontSize="12px" fontWeight="700" color="brand.ink">{opp.symbol}</Text>
                    <Text fontSize="11px" fontWeight="700" color="brand.turquoise">+{(opp.spread * 100).toFixed(3)}%</Text>
                  </Flex>
                  <HStack spacing={2} fontSize="8px" fontWeight="600" color="brand.mutedInk" fontFamily="mono">
                    <VStack align="start" spacing={0} flex={1}>
                      <Text opacity={0.5} fontSize="7px">LONG</Text>
                      <Text color="brand.ink">{opp.longEx.toUpperCase()}</Text>
                    </VStack>
                    <Box w="1px" h="12px" bg="brand.border" />
                    <VStack align="start" spacing={0} flex={1}>
                      <Text opacity={0.5} fontSize="7px">SHORT</Text>
                      <Text color="brand.ink">{opp.shortEx.toUpperCase()}</Text>
                    </VStack>
                  </HStack>
                </Box>
              ))}
            </Grid>
          </Box>
        </Grid>
        <Box borderBottom="2px solid" borderColor="brand.border" mt={6} />
      </Box>

      <Box flex="1" overflowY="auto" css={{
        '&::-webkit-scrollbar': { width: '2px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: 'brand.ink' },
      }}>
        <Grid templateColumns="1.5fr repeat(4, 1fr)" borderBottom="2px solid" borderColor="brand.ink" pb={2} mb={2} px={1}>
          <Text fontSize="9px" fontWeight="900" color="brand.ink" fontFamily="mono">ASSET</Text>
          {EXCHANGES.map(ex => (
            <Text 
              key={ex} 
              fontSize="9px" 
              fontWeight="900" 
              color="brand.ink" 
              fontFamily="mono" 
              textAlign="right"
              cursor="pointer"
              pr={1}
              onClick={() => setSort({ col: ex, dir: sort?.col === ex ? (sort.dir * -1 as 1 | -1) : 1 })}
            >
              {ex.toUpperCase()}
            </Text>
          ))}
        </Grid>

        <VStack align="stretch" spacing={0} px={1}>
          {sorted.map(({ symbol, cells }) => (
            <Grid 
              key={symbol} 
              templateColumns="1.5fr repeat(4, 1fr)" 
              py={2} 
              borderBottom="1px solid" 
              borderColor="rgba(0,0,0,0.02)"
              _hover={{ bg: 'rgba(0,0,0,0.01)' }}
            >
              <Text fontSize="11px" fontWeight="600" color="brand.ink">{symbol}</Text>
              {EXCHANGES.map(ex => {
                const val = cells[ex];
                return (
                  <Text 
                    key={ex} 
                    fontSize="11px" 
                    fontFamily="mono" 
                    textAlign="right" 
                    pr={1}
                    color={val === undefined ? 'brand.border' : val > 0 ? 'brand.mutedRed' : 'brand.mutedGreen'}
                  >
                    {val === undefined ? '—' : (val * 100).toFixed(3) + '%'}
                  </Text>
                );
              })}
            </Grid>
          ))}
        </VStack>
      </Box>

      <HStack mt={4} pt={2} borderTop="1px solid" borderColor="brand.border" spacing={4} opacity={0.6}>
        <HStack spacing={1}>
          <Box w="6px" h="6px" bg="brand.mutedRed" />
          <Text fontSize="9px" fontWeight="600">LONG PAYS</Text>
        </HStack>
        <HStack spacing={1}>
          <Box w="6px" h="6px" bg="brand.mutedGreen" />
          <Text fontSize="9px" fontWeight="600">SHORT PAYS</Text>
        </HStack>
      </HStack>
    </Box>
  );
}