import React, { useEffect, useMemo } from 'react';
import {
  Table, Tbody, Tr, Td, Box, HStack, Text,
  Badge, Thead, Th, TableContainer
} from '@chakra-ui/react';
import type { Liquidation } from '../types/liquidation';
import { useFundingStore } from '../store/fundingStore';
import { useLiquidationStore } from '../store/liquidationStore';
import { LinkIcon, WarningTwoIcon } from '@chakra-ui/icons';
import { playLiquidationSound, initAudio } from '../utils/audioEngine';


interface Props {
  compact?: boolean;
  soundEnabled: boolean;
  onNewLiquidation?: (data: { amount: number; symbol: string }) => void;
  minAmount: number;
  liquidations?: Liquidation[];
}

export const LiquidationTable: React.FC<Props> = React.memo(({ soundEnabled, minAmount, liquidations: incomingLiquidations }) => {
  const liveLiquidations = useLiquidationStore((state) => state.liquidations);
  const liquidations = incomingLiquidations || liveLiquidations;

  useEffect(() => {
    // Warm up the audio context on user interaction if sound is enabled
    if (soundEnabled) {
      initAudio();
    }
  }, [soundEnabled]);

  const { displayLiquidations, linkedIds, algoHuntIds } = useMemo(() => {
    const list = liquidations
      .filter(l => l.value >= minAmount)
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
      
    const linked = new Set<string>();
    const algoHunt = new Set<string>();

    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      const baseSymbol = current.symbol.replace(/USDT|USD/g, '');
      let hasLink = false;
      let algoHuntBatch = [current.id];

      // Check within a 100ms window down the list
      for (let j = i + 1; j < list.length; j++) {
        const other = list[j];
        const timeDiff = current.timestamp.toMillis() - other.timestamp.toMillis();
        
        if (timeDiff > 100) {
          break; // Optimization: stop if time delta > 100ms
        }
        
        const otherBase = other.symbol.replace(/USDT|USD/g, '');
        
        // 1. Cross-Exchange Sync (same symbol, diff exchange, same side, similar price)
        if (!linked.has(current.id) && !linked.has(other.id)) {
          if (
            baseSymbol === otherBase &&
            current.exchange !== other.exchange &&
            current.side === other.side &&
            Math.abs(current.price - other.price) / current.price < 0.002 // 0.2% variance allowed for index price differences
          ) {
            hasLink = true;
            linked.add(other.id);
          }
        }

        // 2. Stop Hunt footprint (same symbol, same side, incredibly tight 10ms burst)
        if (!algoHunt.has(current.id)) {
          if (timeDiff <= 10 && baseSymbol === otherBase && current.side === other.side) {
            algoHuntBatch.push(other.id);
          }
        }
      }
      
      if (hasLink) {
        linked.add(current.id);
      }
      
      if (algoHuntBatch.length >= 5) {
        algoHuntBatch.forEach(id => algoHunt.add(id));
      }
    }

    return { displayLiquidations: list, linkedIds: linked, algoHuntIds: algoHunt };
  }, [liquidations, minAmount]);

  const firstLiquidationId = displayLiquidations[0]?.id;

  useEffect(() => {
    if (soundEnabled && firstLiquidationId) {
      const topEvent = displayLiquidations[0];
      if (topEvent) {
        playLiquidationSound(topEvent.price, topEvent.value, topEvent.side);
      }
    }
  }, [firstLiquidationId, soundEnabled, displayLiquidations]);

  return (
    <Box height="100%" display="flex" flexDirection="column">
      <TableContainer
        flex="1"
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': { width: '2px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.05)' },
        }}
      >
        <Table variant="simple" size="xs" width="100%" style={{ tableLayout: 'fixed' }}>
          <Thead position="sticky" top={0} zIndex={1} bg="brand.paper">
            <Tr borderBottom="1px solid" borderColor="brand.border">
              <Th width="30%" color="brand.mutedInk" px={1} py={2} fontSize="9px" fontFamily="mono">ASSET</Th>
              <Th width="25%" isNumeric color="brand.mutedInk" px={1} py={2} fontSize="9px" fontFamily="mono">PRICE</Th>
              <Th width="25%" isNumeric color="brand.mutedInk" px={1} py={2} fontSize="9px" fontFamily="mono">VALUE</Th>
              <Th width="20%" isNumeric color="brand.mutedInk" px={1} py={2} fontSize="9px" fontFamily="mono">TIME</Th>
            </Tr>
          </Thead>
          <Tbody>
            {displayLiquidations.slice(0, 50).map((liquidation) => (
              <LiquidationRow
                key={`${liquidation.id}`}
                liquidation={liquidation}
                isLinked={linkedIds.has(liquidation.id)}
                isAlgoHunt={algoHuntIds.has(liquidation.id)}
              />
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
});


const LiquidationRow: React.FC<{ liquidation: Liquidation; isLinked?: boolean; isAlgoHunt?: boolean; }> = React.memo(({ liquidation, isLinked, isAlgoHunt }) => {
  const displayTime = liquidation.timestamp.toFormat('HH:mm:ss');
  
  const rawRates = useFundingStore(s => s.rawRates);
  const baseSymbol = liquidation.symbol.replace(/USDT|USD/g, '');
  const fundingRate = rawRates[baseSymbol] || 0;
  
  // If longing is overcrowded (funding > 0.04%), and a massive long is wiped, it's a LONG CAPITULATION
  const isLongCapitulation = liquidation.side === 'SELL' && fundingRate > 0.0004 && liquidation.value >= 100000;
  
  // If shorting is overcrowded (funding < -0.02%), and a massive short is wiped, it's a SHORT SQUEEZE
  const isShortSqueeze = liquidation.side === 'BUY' && fundingRate < -0.0002 && liquidation.value >= 100000;

  const isSqueeze = isLongCapitulation || isShortSqueeze;

  const isHighValue = liquidation.value >= 100000;
  const isMegaValue = liquidation.value >= 1000000;
  
  // Normal colors
  let bgColor = liquidation.side === 'BUY' ? 'brand.softGreen' : 'brand.softRed';
  let textColor = liquidation.side === 'BUY' ? 'brand.mutedGreen' : 'brand.mutedRed';
  let amountColor = textColor;
  
  // If capitulation/squeeze, boldly invert the row style (e.g., solid red bg, white text)
  if (isSqueeze) {
    bgColor = liquidation.side === 'BUY' ? 'brand.mutedGreen' : 'brand.mutedRed';
    textColor = 'brand.paper';
    amountColor = 'brand.paper';
  }

  return (
    <Tr
      bg={bgColor}
      borderLeftWidth="2px"
      borderLeftColor={isSqueeze ? 'brand.ink' : textColor}
      fontSize="11px"
      position="relative"
      boxShadow={isLinked ? 'inset 0 0 10px 1px rgba(0,0,0,0.05)' : 'none'}
      sx={(isLinked || isAlgoHunt) ? {
        'td': {
          borderTop: '1px dashed',
          borderBottom: '1px dashed',
          borderColor: isAlgoHunt ? 'brand.mutedRed' : 'brand.ink'
        }
      } : {}}
      transition="all 0.2s"
    >
      <Td px={1} py={1} borderRight="1px solid" borderColor="brand.border">
        <HStack spacing={1}>
          <Text fontWeight="700" color="brand.ink">{liquidation.symbol.replace('USDT', '')}</Text>
          <Box
            fontSize="7px"
            fontWeight="900"
            bg="brand.ink"
            color="brand.paper"
            px={1}
            borderRadius="0"
            opacity={0.8}
          >
            {liquidation.exchange.slice(0, 3).toUpperCase()}
          </Box>
          {isSqueeze && (
            <Badge
              variant="solid"
              bg={isLongCapitulation ? 'brand.ink' : 'brand.paper'}
              color={isLongCapitulation ? 'brand.paper' : 'brand.ink'}
              fontSize="7px"
              px={1}
              py={1}
              borderRadius="0"
              fontWeight="900"
              title={`Market consensus was wrong. Overcrowded side getting wiped. (Funding: ${(fundingRate*100).toFixed(3)}%)`}
            >
              {isLongCapitulation ? 'LONG CAPITULATION' : 'SHORT SQUEEZE'}
            </Badge>
          )}
          {isAlgoHunt && !isSqueeze && (
            <Badge
              variant="solid"
              bg="brand.mutedRed"
              color="brand.paper"
              fontSize="7px"
              px={1}
              py={1}
              borderRadius="0"
              fontWeight="900"
              display="flex"
              alignItems="center"
              gap={1}
              title="Batched high-frequency liquidations detected. Likely systematic liquidity grab."
            >
              <WarningTwoIcon boxSize="6px" /> LIQUIDITY GRAB
            </Badge>
          )}
          {isLinked && !isAlgoHunt && (
            <Badge
              variant="solid"
              bg="brand.ink"
              color="brand.paper"
              fontSize="7px"
              px={1}
              py={1}
              borderRadius="0"
              fontWeight="900"
              display="flex"
              alignItems="center"
              gap={1}
              title="Cross-Exchange Wipeout Sync"
            >
              <LinkIcon boxSize="6px" /> SYNC
            </Badge>
          )}
          {isHighValue && (
            <Badge
              variant="solid"
              bg="brand.turquoise"
              color="brand.paper"
              fontSize="7px"
              px={1}
              borderRadius="0"
              fontWeight="900"
            >
              WHALE
            </Badge>
          )}
        </HStack>
      </Td>
      <Td isNumeric px={1} py={1} borderRight="1px solid" borderColor="brand.border" fontFamily="mono">
        <Text color="brand.ink">{liquidation.price < 1 ? liquidation.price.toFixed(4) : liquidation.price.toFixed(2)}</Text>
      </Td>
      <Td isNumeric px={1} py={1} borderRight="1px solid" borderColor="brand.border" fontFamily="mono">
        <Text
          fontWeight={isMegaValue ? "900" : isHighValue ? "800" : "500"}
          color={isSqueeze ? amountColor : (isHighValue ? "brand.turquoise" : "brand.ink")}
          textDecoration={isMegaValue ? "underline" : "none"}
        >
          {liquidation.value >= 1000000
            ? `$${(liquidation.value / 1000000).toFixed(2)}M`
            : liquidation.value >= 1000
              ? `$${(liquidation.value / 1000).toFixed(1)}K`
              : `$${Math.round(liquidation.value)}`
          }
        </Text>
      </Td>
      <Td isNumeric px={1} py={1} fontFamily="mono" color="brand.mutedInk" fontSize="10px">
        {displayTime}
      </Td>
    </Tr>
  );
});