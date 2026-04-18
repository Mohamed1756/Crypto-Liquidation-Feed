import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Tbody, Tr, Td, Box, HStack, Text, 
  Badge, Thead, Th, TableContainer
} from '@chakra-ui/react';
import { useLiquidationStore } from '../store/liquidationStore';
import useSound from 'use-sound';


interface Props {
  compact?: boolean;
  soundEnabled: boolean; 
  onNewLiquidation?: (data: { amount: number; symbol: string }) => void;
  minAmount: number;
}

export const LiquidationTable: React.FC<Props> = React.memo(({ soundEnabled, minAmount }) => {
  const liquidations = useLiquidationStore((state) => state.liquidations);

  const [playPing] = useSound('/ping.mp3', {
    sprite: { secondPart: [1000, 1000] },
  });

  const filteredAndSortedLiquidations = useMemo(() => 
    liquidations
      .filter(l => l.value >= minAmount)
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()),
    [liquidations, minAmount]
  );

  const firstLiquidationId = filteredAndSortedLiquidations[0]?.id;

  useEffect(() => {
    if (soundEnabled && firstLiquidationId) {
      playPing({ id: 'secondPart' });
    }
  }, [firstLiquidationId, playPing, soundEnabled]);

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
            {filteredAndSortedLiquidations.slice(0, 50).map((liquidation) => (
              <LiquidationRow 
                key={`${liquidation.id}`}
                liquidation={liquidation} 
              />
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
});


const LiquidationRow: React.FC<{ liquidation: any }> = React.memo(({ liquidation }) => {
  const displayTime = liquidation.timestamp.toFormat('HH:mm:ss');
  
  const isHighValue = liquidation.value >= 100000;
  const isMegaValue = liquidation.value >= 1000000;
  const bgColor = liquidation.side === 'BUY' ? 'brand.softGreen' : 'brand.softRed';
  const textColor = liquidation.side === 'BUY' ? 'brand.mutedGreen' : 'brand.mutedRed';

  return (
    <Tr
      bg={bgColor}
      borderLeftWidth="2px"
      borderLeftColor={textColor}
      fontSize="11px"
      position="relative"
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
            {liquidation.exchange.slice(0,3).toUpperCase()}
          </Box>
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
          fontWeight={isHighValue ? "900" : "500"} 
          color={isHighValue ? "brand.turquoise" : "brand.ink"}
          textDecoration={isMegaValue ? "underline" : "none"}
        >
          {liquidation.value >= 1000000 
            ? `$${(liquidation.value/1000000).toFixed(2)}M` 
            : liquidation.value >= 1000 
              ? `$${(liquidation.value/1000).toFixed(1)}K`
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