import {
  Box,
  Flex,
  Text,
  HStack,
  Button,
  Menu,
  VStack,
  MenuButton,
  MenuList,
  MenuItem,
  Tag,
  Spacer,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
} from '@chakra-ui/react';
import {
  ChevronDownIcon,
  CheckCircleIcon,
  QuestionIcon,
} from '@chakra-ui/icons';
import { LiquidationTable } from './components/LiquidationTable';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { useLiquidationStore } from './store/liquidationStore';
import { useState } from 'react';
import { FundingRatesTab } from './components/FundingRatesTab';
import { LiquidationClusters } from './components/LiquidationClusters';



import React from 'react';

type Exchange = 'BINANCE' | 'BYBIT' | 'OKX';

// Isolate high-frequency re-renders into a dedicated component.
// This prevents the entire App.tsx (and its heavy children) from re-rendering 50 times a second.
const HeaderMetrics = React.memo(() => {
  const { totalValue, stats } = useLiquidationStore();
  const { buyCount, sellCount, largestLiquidation } = stats;

  return (
    <HStack spacing={10} fontSize="11px" color="brand.mutedInk" fontWeight="700" fontFamily="mono">
      <VStack align="start" spacing={0}>
        <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em">BATTLE (SHORTS : LONGS)</Text>
        <HStack spacing={1}>
          <Text color="brand.mutedGreen" fontSize="16px" fontWeight="900" title="Shorts Liquidated">{buyCount}</Text>
          <Text color="brand.border" fontSize="14px">:</Text>
          <Text color="brand.mutedRed" fontSize="16px" fontWeight="900" title="Longs Liquidated">{sellCount}</Text>
        </HStack>
      </VStack>
      <VStack align="start" spacing={0}>
        <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em">TOP LIQ</Text>
        <Text color="brand.ink" fontSize="16px">
          {largestLiquidation
            ? largestLiquidation.value >= 1000000
              ? `$${(largestLiquidation.value / 1000000).toFixed(2)}M`
              : largestLiquidation.value >= 1000
                ? `$${(largestLiquidation.value / 1000).toFixed(1)}K`
                : `$${Math.round(largestLiquidation.value)}`
            : '-'}
        </Text>
      </VStack>
      <VStack align="start" spacing={0}>
        <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em">CUMULATIVE</Text>
        <Text color="brand.ink" fontSize="16px">
          {totalValue >= 1000000
            ? `$${(totalValue / 1000000).toFixed(3)}M`
            : totalValue >= 1000
              ? `$${(totalValue / 1000).toFixed(1)}K`
              : `$${Math.round(totalValue)}`}
        </Text>
      </VStack>
    </HStack>
  );
});

function App() {
  // Exchanges
  const availableExchanges: Exchange[] = ['BINANCE', 'BYBIT', 'OKX'];
  const [selectedExchanges, setSelectedExchanges] = useState<Exchange[]>(['BINANCE', 'BYBIT', 'OKX']);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [minLiquidationValue, setMinLiquidationValue] = useState(1000); // Default to 1k filter

  const toggleExchange = (exchange: Exchange) => {
    if (selectedExchanges.includes(exchange)) {
      if (selectedExchanges.length > 1) {
        setSelectedExchanges(selectedExchanges.filter(e => e !== exchange));
      }
    } else {
      setSelectedExchanges([...selectedExchanges, exchange]);
    }
  };

  const statusProps = {
    text: 'LIVE',
    tooltip: 'Connected to exchange websockets',
    colorScheme: 'green',
  };

  return (
    <WebSocketProvider exchanges={selectedExchanges}>
      <Box bg="brand.paper" minH="100vh" px={4} py={2}>
        {/* Technical Minimal Header */}
        <Flex justify="space-between" align="center" py={4} mb={6} borderBottom="2px solid" borderColor="brand.ink">
          <Flex align="center" gap={12}>
            <HeaderMetrics />
          </Flex>

          <Flex align="center" gap={3}>
            <Menu closeOnSelect={false}>
              <MenuButton
                as={Button}
                size="xs"
                variant="solid"
                bg="brand.ink"
                color="brand.paper"
                borderRadius="0"
                rightIcon={<ChevronDownIcon />}
                fontSize="10px"
                fontWeight="900"
                fontFamily="mono"
                px={3}
                _hover={{ bg: 'brand.mutedInk' }}
                _active={{ bg: 'brand.mutedInk' }}
              >
                EXCHANGES [{selectedExchanges.length}]
              </MenuButton>
              <MenuList borderRadius="0" bg="brand.paper" borderColor="brand.ink" borderWidth="2px" boxShadow="none" p={0}>
                {availableExchanges.map(exchange => (
                  <MenuItem
                    key={exchange}
                    onClick={() => toggleExchange(exchange)}
                    closeOnSelect={false}
                    bg="brand.paper"
                    _hover={{ bg: 'brand.ink', color: 'brand.paper' }}
                    fontSize="10px"
                    fontFamily="mono"
                    px={4}
                    py={2}
                  >
                    <Flex align="center" width="100%">
                      <Text fontWeight={selectedExchanges.includes(exchange) ? '700' : '400'}>
                        {exchange}
                      </Text>
                      <Spacer />
                      {selectedExchanges.includes(exchange) && <CheckCircleIcon boxSize="10px" color="inherit" />}
                    </Flex>
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>

            <Button
              size="xs"
              variant="outline"
              borderColor="brand.ink"
              borderWidth="2px"
              borderRadius="0"
              fontSize="10px"
              fontWeight="900"
              fontFamily="mono"
              px={3}
              onClick={() => setSoundEnabled(!soundEnabled)}
              bg="brand.ink"
              color="brand.paper"
              _hover={{ bg: 'brand.ink', color: 'brand.paper' }}
            >
              AUDIO: {soundEnabled ? 'ON' : 'OFF'}
            </Button>

            <Popover placement="bottom-end">
              <PopoverTrigger>
                <Button
                  size="xs"
                  variant="outline"
                  borderColor="brand.ink"
                  borderWidth="2px"
                  borderRadius="0"
                  bg="brand.ink"
                  color="brand.paper"
                  _hover={{ bg: 'brand.ink', color: 'brand.paper' }}

                >
                  <QuestionIcon boxSize="10px" />
                </Button>
              </PopoverTrigger>
              <PopoverContent bg="brand.paper" borderColor="brand.ink" borderRadius="0" boxShadow="none" width="220px" zIndex={10}>
                <PopoverBody p={4} fontSize="10px" fontFamily="mono">
                  <VStack align="start" spacing={3}>
                    <Text fontWeight="800" borderBottom="1px solid" width="100%" pb={1} color="brand.ink">TERMINAL GLOSSARY</Text>
                    <HStack>
                      <Box w="8px" h="8px" bg="brand.mutedGreen" />
                      <Text color="brand.ink">GREEN: SHORT LIQ (BULLISH)</Text>
                    </HStack>
                    <HStack>
                      <Box w="8px" h="8px" bg="brand.mutedRed" />
                      <Text color="brand.ink">RED: LONG LIQ (BEARISH)</Text>
                    </HStack>
                    <HStack>
                      <Box w="8px" h="8px" bg="brand.turquoise" />
                      <Text color="brand.ink">TURQUOISE: LARGE (&gt;100K)</Text>
                    </HStack>
                    <Text opacity={0.6} pt={2} color="brand.mutedInk">BATTLE shows raw relative count.</Text>
                  </VStack>
                </PopoverBody>
              </PopoverContent>
            </Popover>

            <Menu>
              <MenuButton
                as={Button}
                size="xs"
                variant="solid"
                bg="brand.ink"
                color="brand.paper"
                borderRadius="0"
                fontSize="10px"
                fontWeight="900"
                fontFamily="mono"
                px={3}
                _hover={{ bg: 'brand.mutedInk' }}
              >
                FILTER: {minLiquidationValue >= 1000 ? (minLiquidationValue / 1000) + 'K' : minLiquidationValue}
              </MenuButton>
              <MenuList borderRadius="0" bg="brand.paper" borderColor="brand.ink" borderWidth="2px" boxShadow="none" p={0}>
                {[0, 1000, 5000, 10000, 50000, 100000].map(val => (
                  <MenuItem
                    key={val}
                    onClick={() => setMinLiquidationValue(val)}
                    fontSize="10px"
                    fontFamily="mono"
                    _hover={{ bg: 'brand.ink', color: 'brand.paper' }}
                  >
                    ${val >= 1000 ? (val / 1000) + 'K' : val}+
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>

            <Tag variant="premium" borderColor="brand.ink" borderWidth="2px" bg="brand.ink" color="brand.paper" py={1} px={3}>
              {statusProps.text}
            </Tag>
          </Flex>
        </Flex>

        {/* Dashboard View */}
        <Flex direction={{ base: 'column', lg: 'row' }} gap={6} align="stretch" height="calc(100vh - 80px)">
          {/* Top Opportunities / Funding Rates */}
          <Box flex="1.4" minW={0} overflow="hidden" borderRight="1px solid" borderColor="brand.border" pr={6}>
            <FundingRatesTab />
          </Box>

          {/* Analytics & Rolling Tape */}
          <Flex flex="1" direction="column" gap={0} minW={{ base: '100%', lg: '420px' }} maxW="480px">
            <Box flex="1" borderBottom="1px solid" borderColor="brand.border" pb={4} overflow="hidden">
              <HStack justify="space-between" mb={2}>
                <Text fontSize="10px" fontWeight="900" color="brand.ink" letterSpacing="wider">LIQUIDATION CLUSTERS</Text>
                <Popover placement="left" trigger="hover">
                  <PopoverTrigger>
                    <Box cursor="help"><QuestionIcon boxSize="10px" color="brand.mutedInk" /></Box>
                  </PopoverTrigger>
                  <PopoverContent bg="brand.paper" borderColor="brand.ink" borderRadius="0" fontSize="10px" fontFamily="mono" boxShadow="none">
                    <PopoverBody>
                      Clusters represent high-density liquidation pools. When price enters these zones, it often triggers a "chain reaction" leading to sharp reversals or explosive volatility.
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </HStack>
              <LiquidationClusters minAmount={minLiquidationValue} />
            </Box>
            
            <Box flex="1.5" pt={4} overflow="hidden">
              <Text fontSize="10px" fontWeight="900" color="brand.ink" mb={2} letterSpacing="wider">LIVE LIQUIDATION STREAM</Text>
              <LiquidationTable
                soundEnabled={soundEnabled}
                compact={true}
                minAmount={minLiquidationValue}
              />
            </Box>
          </Flex>
        </Flex>
      </Box>
    </WebSocketProvider>
  );
}



export default App;