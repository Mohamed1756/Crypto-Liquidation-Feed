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
import { ReplayDatasetMenu } from './components/ReplayDatasetMenu';
import { ReplayModePanel } from './components/ReplayModePanel';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { useLiquidationStore } from './store/liquidationStore';
import { useEffect, useMemo, useState } from 'react';
import { FundingRatesTab } from './components/FundingRatesTab';
import { LiquidationClusters } from './components/LiquidationClusters';
import { ParticleHeatmap } from './components/ParticleHeatmap';
import { InlineHelp } from './components/InlineHelp';
import { useConnectionStore } from './store/connectionStore';
import { useCascadeStore } from './store/cascadeStore';
import { useEntropyStore } from './store/entropyStore';
import { useAnomalyStore } from './store/anomalyStore';
import { loadAnalyticsModel, startAnalyticsRuntime } from './analytics/client';
import { useActiveFeed } from './hooks/useActiveFeed';
import type { Liquidation } from './types/liquidation';



import React from 'react';

type Exchange = 'BINANCE' | 'BYBIT' | 'OKX';

// Isolate high-frequency re-renders into a dedicated component.
// This prevents the entire App.tsx (and its heavy children) from re-rendering 50 times a second.
const formatNotional = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value)}`;
};

const HeaderMetrics = React.memo(({ liquidations, isReplay }: { liquidations?: Liquidation[]; isReplay?: boolean }) => {
  const liveTotalValue = useLiquidationStore((state) => state.totalValue);
  const liveStats = useLiquidationStore((state) => state.stats);

  const replayStats = useMemo(() => {
    if (!liquidations) {
      return null;
    }

    let totalValue = 0;
    let buyCount = 0;
    let sellCount = 0;
    let largestLiquidation: Liquidation | null = null;

    liquidations.forEach((liquidation) => {
      totalValue += liquidation.value;
      if (liquidation.side === 'BUY') {
        buyCount += 1;
      } else {
        sellCount += 1;
      }

      if (!largestLiquidation || liquidation.value > largestLiquidation.value) {
        largestLiquidation = liquidation;
      }
    });

    return {
      totalValue,
      buyCount,
      sellCount,
      largestLiquidation,
    };
  }, [liquidations]);

  const totalValue = replayStats?.totalValue ?? liveTotalValue;
  const buyCount = replayStats?.buyCount ?? liveStats.buyCount;
  const sellCount = replayStats?.sellCount ?? liveStats.sellCount;
  const largestLiquidation = replayStats?.largestLiquidation ?? liveStats.largestLiquidation;
  const battleLabel = 'BATTLE';
  const topLabel = 'TOP LIQ';
  const cumulativeLabel = isReplay ? 'WINDOW TOTAL' : 'TOTAL';

  return (
    <HStack spacing={6} fontSize="11px" color="brand.mutedInk" fontWeight="700" fontFamily="mono" flexWrap="wrap">
      <VStack align="start" spacing={0}>
        <HStack spacing={1} align="center">
          <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em">{battleLabel}</Text>
          <InlineHelp title={battleLabel} body={isReplay ? 'Short liquidations versus long liquidations inside the active replay window.' : 'Raw count of short liquidations versus long liquidations. Green tracks short liquidations, red tracks long liquidations.'} />
        </HStack>
        <HStack spacing={1}>
          <Text color="brand.mutedGreen" fontSize="16px" fontWeight="900" title="Shorts Liquidated">{buyCount}</Text>
          <Text color="brand.border" fontSize="14px">:</Text>
          <Text color="brand.mutedRed" fontSize="16px" fontWeight="900" title="Longs Liquidated">{sellCount}</Text>
        </HStack>
      </VStack>
      <VStack align="start" spacing={0}>
        <HStack spacing={1} align="center">
          <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em">{topLabel}</Text>
          <InlineHelp title={topLabel} body={isReplay ? 'Largest single liquidation visible inside the active replay window.' : 'Largest single liquidation print seen since the current page session started.'} />
        </HStack>
        <Text color="brand.ink" fontSize="16px">
          {largestLiquidation ? formatNotional(largestLiquidation.value) : '-'}
        </Text>
      </VStack>
      <VStack align="start" spacing={0}>
        <HStack spacing={1} align="center">
          <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em">{cumulativeLabel}</Text>
          <InlineHelp title={cumulativeLabel} body={isReplay ? 'Total notional inside the currently replayed window.' : 'Running notional value of all liquidations processed by the live feed.'} />
        </HStack>
        <Text color="brand.ink" fontSize="16px">{formatNotional(totalValue)}</Text>
      </VStack>
    </HStack>
  );
});

const CascadeRiskMeter = React.memo(() => {
  const { riskPercent, totalValue500ms } = useCascadeStore();
  
  const isHighRisk = riskPercent >= 50;
  const isCriticalRisk = riskPercent >= 80;
  const riskLabel = isCriticalRisk ? 'CASCADE' : isHighRisk ? 'STRESS' : 'QUIET';
  
  const color = isCriticalRisk ? 'brand.mutedRed' : (isHighRisk ? 'brand.mutedGreen' : 'brand.ink');
  
  return (
    <VStack align="start" spacing={0} ml={2}>
      <HStack spacing={1} align="center">
        <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em" color={isCriticalRisk ? 'brand.mutedRed' : 'brand.mutedInk'} transition="color 0.3s">
          CASCADE RISK (500ms)
        </Text>
        <InlineHelp title="CASCADE RISK" body="Dollar notional liquidated in the last 500 milliseconds. Rising values suggest forced liquidations are chaining into each other." />
      </HStack>
      <HStack align="center" spacing={3}>
        <Text color={color} fontSize="16px" fontWeight="900" transition="color 0.3s" style={isCriticalRisk ? { animation: 'pulseGlow 0.5s infinite alternate' } : {}}>
          {riskPercent}%
        </Text>
        <Box w="60px" h="6px" bg="rgba(0,0,0,0.05)" border="1px solid" borderColor="brand.border">
          <Box h="100%" w={`${riskPercent}%`} bg={color} transition="width 0.1s linear, background-color 0.3s" />
        </Box>
        <Text fontSize="8px" color={color} fontWeight="900" animation={isCriticalRisk ? 'pulseGlow 1s infinite alternate' : undefined}>
          {isCriticalRisk ? `$${(totalValue500ms / 1000000).toFixed(2)}M PACE` : riskLabel}
        </Text>
      </HStack>
    </VStack>
  );
});

const ChaosMeter = React.memo(() => {
  const { entropyPercent, marketState } = useEntropyStore();
  
  const isHighChaos = entropyPercent >= 60;
  const isCriticalChaos = entropyPercent >= 85;
  
  const color = isCriticalChaos ? 'brand.mutedRed' : (isHighChaos ? 'brand.mutedGreen' : 'brand.ink');
  
  return (
    <VStack align="start" spacing={0} ml={2}>
      <HStack spacing={1} align="center">
        <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em" color={isCriticalChaos ? 'brand.mutedRed' : 'brand.mutedInk'} transition="color 0.3s">
          MARKET CHAOS (ENTROPY)
        </Text>
        <InlineHelp title="MARKET CHAOS" body="Shannon entropy of the millisecond gaps between liquidation prints, blended with burstiness and long-gap pressure. Higher readings mean the tape is fragmented and liquidity is thinning." />
      </HStack>
      <HStack align="center" spacing={3}>
        <Text color={color} fontSize="16px" fontWeight="900" transition="color 0.3s" style={isCriticalChaos ? { animation: 'pulseGlow 0.5s infinite alternate' } : {}}>
          {entropyPercent}%
        </Text>
        <Box w="60px" h="6px" bg="rgba(0,0,0,0.05)" border="1px solid" borderColor="brand.border">
          <Box h="100%" w={`${entropyPercent}%`} bg={color} transition="width 0.1s linear, background-color 0.3s" />
        </Box>
        <Text fontSize="8px" color={color} fontWeight="900" animation={isCriticalChaos ? 'pulseGlow 1s infinite alternate' : undefined}>
          {marketState}
        </Text>
      </HStack>
    </VStack>
  );
});

const AnomalyMeter = React.memo(() => {
  const {
    zScore,
    anomalyPercent,
    severity,
    baselineReady,
    warmupEpochs,
    epochsRequired,
    leadingSignal,
    mlModelReady,
    mlAnomalyPercent,
  } = useAnomalyStore();

  const isExtreme = severity === 'EXTREME';
  const isElevated = severity === 'ELEVATED';
  const color = !baselineReady
    ? 'brand.mutedInk'
    : isExtreme
      ? 'brand.mutedRed'
      : isElevated
        ? 'brand.turquoise'
        : 'brand.ink';
  const fillPercent = baselineReady
    ? anomalyPercent
    : Math.min(100, Math.round((warmupEpochs / epochsRequired) * 100));
  const displayValue = baselineReady ? zScore.toFixed(2) : `${warmupEpochs}/${epochsRequired}`;
  const detail = mlModelReady
    ? `AE ${mlAnomalyPercent}%`
    : baselineReady
      ? leadingSignal.toUpperCase()
      : 'BUILDING BASELINE';
  const labelSuffix = mlModelReady
    ? (baselineReady ? '(Z + AE)' : '(WARMUP + AE)')
    : (baselineReady ? '(Z)' : '(WARMUP)');

  return (
    <VStack align="start" spacing={0} ml={2} maxW="190px">
      <HStack spacing={1} align="center">
        <Text opacity={0.6} fontSize="8px" letterSpacing="0.05em" color={color} transition="color 0.3s">
          ORDER FLOW ANOMALY {labelSuffix}
        </Text>
        <InlineHelp title="ORDER FLOW ANOMALY" body="Browser-side anomaly score for the current minute. It compares pace, concentration, imbalance, and size structure against the rolling baseline. Warmup means the baseline is still being built." />
      </HStack>
      <HStack align="center" spacing={3}>
        <Text color={color} fontSize="16px" fontWeight="900" transition="color 0.3s">
          {displayValue}
        </Text>
        <Box w="60px" h="6px" bg="rgba(0,0,0,0.05)" border="1px solid" borderColor="brand.border">
          <Box h="100%" w={`${fillPercent}%`} bg={color} transition="width 0.2s linear, background-color 0.3s" />
        </Box>
        <Text fontSize="8px" color={color} fontWeight="900" whiteSpace="nowrap" title={mlModelReady ? `${leadingSignal} | Autoencoder ${mlAnomalyPercent}%` : leadingSignal}>
          {detail}
        </Text>
      </HStack>
    </VStack>
  );
});

const ConnectionStatusIndicator = React.memo(({ exchanges }: { exchanges: string[] }) => {
  const status = useConnectionStore(state => state.getOverallHealth(exchanges).status);
  const isStale = useConnectionStore(state => state.getOverallHealth(exchanges).isStale);

  let text = 'LIVE';
  let bg = 'brand.ink';
  let color = 'brand.paper';
  // Small glowing indicator
  let glow = 'none';

  if (status === 'DISCONNECTED' || exchanges.length === 0) {
    text = 'OFFLINE';
    bg = 'brand.mutedRed';
    color = 'brand.ink';
  } else if (status === 'RECONNECTING' || isStale) {
    text = 'RECONNECTING...';
    bg = 'brand.mutedRed';
    color = 'brand.ink';
    glow = '0 0 8px 1px var(--chakra-colors-brand-mutedRed)';
  } else if (status === 'CONNECTED') {
    glow = '0 0 8px 1px var(--chakra-colors-brand-mutedGreen)';
  }

  return (
    <Tag 
      variant="premium" 
      borderColor="brand.ink" 
      borderWidth="2px" 
      bg={bg} 
      color={color} 
      py={1} 
      px={3}
      boxShadow={glow}
      transition="all 0.3s"
      letterSpacing="0.05em"
      fontWeight="900"
    >
      {text}
    </Tag>
  );
});

const TerminalGlow = React.memo(({ exchanges }: { exchanges: string[] }) => {
  const status = useConnectionStore(state => state.getOverallHealth(exchanges).status);
  const isStale = useConnectionStore(state => state.getOverallHealth(exchanges).isStale);
  const isDanger = (isStale || status === 'RECONNECTING' || status === 'DISCONNECTED') && exchanges.length > 0;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
      bg="brand.mutedRed"
      opacity={isDanger ? 0.04 : 0}
      transition="opacity 0.4s ease-in-out"
      zIndex={9999}
      style={{
        animation: isDanger ? 'pulseGlow 2s infinite alternate' : 'none'
      }}
    />
  );
});

function App() {
  // Exchanges
  const availableExchanges: Exchange[] = ['BINANCE', 'BYBIT', 'OKX'];
  const [selectedExchanges, setSelectedExchanges] = useState<Exchange[]>(['BINANCE', 'BYBIT', 'OKX']);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [minLiquidationValue, setMinLiquidationValue] = useState(1000); // Default to 1k filter
  const [showReplayPanel, setShowReplayPanel] = useState(false);
  const { mode, usingReplay, tapeLiquidations, clusterLiquidations } = useActiveFeed();

  const toggleExchange = (exchange: Exchange) => {
    if (selectedExchanges.includes(exchange)) {
      if (selectedExchanges.length > 1) {
        setSelectedExchanges(selectedExchanges.filter(e => e !== exchange));
      }
    } else {
      setSelectedExchanges([...selectedExchanges, exchange]);
    }
  };

  useEffect(() => {
    startAnalyticsRuntime();
    loadAnalyticsModel();
  }, []);

  useEffect(() => {
    if (mode !== 'LIVE') {
      setShowReplayPanel(true);
    }
  }, [mode]);

  return (
    <WebSocketProvider exchanges={selectedExchanges}>
      <TerminalGlow exchanges={selectedExchanges} />
      <Box
        bg="brand.paper"
        minH="100vh"
        h={{ base: 'auto', lg: '100vh' }}
        px={{ base: 4, lg: 3 }}
        py={2}
        display="flex"
        flexDirection="column"
        overflow={{ base: 'visible', lg: 'hidden' }}
      >
        {/* Technical Minimal Header */}
        <Flex justify="space-between" align="center" py={2} mb={3} borderBottom="2px solid" borderColor="brand.ink" gap={4} flexWrap="wrap">
          <Flex align="center" gap={8} wrap="wrap">
            <VStack align="start" spacing={0} minW={{ base: '100%', xl: '180px' }}>
              <Text fontSize="10px" fontWeight="900" color="brand.ink" letterSpacing="0.08em">
                CRYPTO LIQUIDATION FEED
              </Text>
              <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">
                Liquidations, funding, clusters, replay
              </Text>
            </VStack>
            <HeaderMetrics liquidations={tapeLiquidations} isReplay={usingReplay} />
            <CascadeRiskMeter />
            <ChaosMeter />
            <AnomalyMeter />
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
              onClick={() => setShowReplayPanel((value) => !value)}
              bg={showReplayPanel || usingReplay ? 'brand.ink' : 'transparent'}
              color={showReplayPanel || usingReplay ? 'brand.paper' : 'brand.ink'}
              _hover={{ bg: 'brand.ink', color: 'brand.paper' }}
            >
              REPLAY
            </Button>

            <ReplayDatasetMenu />

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
                      <Text color="brand.ink">GREEN: SHORTS FORCED OUT</Text>
                    </HStack>
                    <HStack>
                      <Box w="8px" h="8px" bg="brand.mutedRed" />
                      <Text color="brand.ink">RED: LONGS FORCED OUT</Text>
                    </HStack>
                    <HStack>
                      <Box w="8px" h="8px" bg="brand.turquoise" />
                      <Text color="brand.ink">TURQUOISE: WHALE-SIZED FLOW</Text>
                    </HStack>
                    <Text opacity={0.6} pt={2} color="brand.mutedInk">Replay uses the loaded dataset instead of the live feed.</Text>
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

            <ConnectionStatusIndicator exchanges={selectedExchanges} />
          </Flex>
        </Flex>

        {(showReplayPanel || usingReplay) && (
          <Box mb={3} flexShrink={0}>
            <ReplayModePanel />
          </Box>
        )}

        <Flex direction="column" gap={3} flex="1" minH={0}>
          {/* Dashboard View */}
          <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align="stretch" flex="1" minH={0} overflow="hidden">
            {/* Top Opportunities / Funding Rates */}
            <Box flex="1.4" minW={0} minH={0} overflow="hidden" borderRight={{ base: 'none', lg: '1px solid' }} borderColor="brand.border" pr={{ base: 0, lg: 4 }}>
              <FundingRatesTab />
            </Box>

            {/* Analytics & Rolling Tape */}
            <Flex flex="1" direction="column" gap={0} minW={{ base: '100%', lg: '420px' }} maxW="480px" minH={0}>
              <Box flex="1" borderBottom="1px solid" borderColor="brand.border" pb={3} overflow="hidden" minH={0}>
                <HStack justify="space-between" mb={2}>
                  <HStack spacing={1}>
                    <Text fontSize="10px" fontWeight="900" color="brand.ink" letterSpacing="wider">
                      {usingReplay ? 'REPLAY CLUSTERS' : 'LIQUIDATION CLUSTERS'}
                    </Text>
                    <InlineHelp title="LIQUIDATION CLUSTERS" body="High-density liquidation zones grouped by price. When price trades back into them, they often act like magnets or trigger secondary cascades." placement="left" />
                  </HStack>
                </HStack>
                <LiquidationClusters minAmount={minLiquidationValue} liquidations={clusterLiquidations} />
              </Box>
              
              <Box flex="1.2" pt={3} overflow="hidden" minH={0}>
                <HStack spacing={1} mb={2}>
                  <Text fontSize="10px" fontWeight="900" color="brand.ink" letterSpacing="wider">
                    {usingReplay ? 'REPLAY LIQUIDATION STREAM' : 'LIVE LIQUIDATION STREAM'}
                  </Text>
                  <InlineHelp title="LIQUIDATION STREAM" body="Latest liquidation prints with pattern flags such as sync wipes, squeezes, and clustered liquidity grabs." placement="left" />
                </HStack>
                <LiquidationTable
                  soundEnabled={soundEnabled && !usingReplay}
                  compact={true}
                  minAmount={minLiquidationValue}
                  liquidations={tapeLiquidations}
                />
              </Box>
            </Flex>
          </Flex>

          {/* Spatial Tape */}
          <Box w="100%" flexShrink={0}>
            <ParticleHeatmap liquidations={tapeLiquidations} />
          </Box>
        </Flex>
      </Box>
    </WebSocketProvider>
  );
}



export default App;