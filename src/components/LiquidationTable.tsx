import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Tbody, Tr, Td, Box, HStack, Text, 
  Badge, Thead, Th, TableContainer
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiquidationStore } from '../store/liquidationStore';
import useSound from 'use-sound';

const MotionTr = motion(Tr);

interface Props {
  compact?: boolean;
  soundEnabled: boolean; 
  onNewLiquidation: (data: { amount: number; symbol: string }) => void;
  minAmount: number;
}

export const LiquidationTable: React.FC<Props> = ({ soundEnabled, minAmount }) => {
  const liquidations = useLiquidationStore((state) => state.liquidations);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [playPing] = useSound('/ping.mp3', {
    sprite: { secondPart: [1000, 1000] },
  });

  const filteredAndSortedLiquidations = useMemo(() => 
    liquidations
      .filter(l => l.value >= minAmount)
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()),
    [liquidations, minAmount]
  );

  useEffect(() => {
    if (soundEnabled && filteredAndSortedLiquidations.length > 0) {
      playPing({ id: 'secondPart' });
    }
  }, [filteredAndSortedLiquidations.length, playPing, soundEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
            <AnimatePresence initial={false} presenceAffectsLayout={false}>
              {filteredAndSortedLiquidations.slice(0, 50).map((liquidation) => (
                <LiquidationRow 
                  key={`${liquidation.timestamp.toMillis()}-${liquidation.symbol}-${liquidation.value}`}
                  liquidation={liquidation} 
                  currentTime={currentTime} 
                />
              ))}
            </AnimatePresence>
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const LiquidationRow: React.FC<{ liquidation: any, currentTime: number }> = React.memo(({ liquidation, currentTime }) => {
  const timeAgoInSeconds = Math.max(0, Math.floor((currentTime - liquidation.timestamp.toMillis()) / 1000));
  const displayTime = timeAgoInSeconds < 60 ? `${timeAgoInSeconds}s` : `${Math.floor(timeAgoInSeconds/60)}m`;
  
  const isHighValue = liquidation.value > 100000;
  const bgColor = liquidation.side === 'BUY' ? 'brand.softGreen' : 'brand.softRed';
  const textColor = liquidation.side === 'BUY' ? 'brand.mutedGreen' : 'brand.mutedRed';

  return (
    <MotionTr
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      bg={bgColor}
      borderLeftWidth="2px"
      borderLeftColor={textColor}
      fontSize="11px"
      transition={{ duration: 0.1 }}
    >
      <Td px={1} py={1} borderRight="1px solid" borderColor="brand.border">
        <HStack spacing={1}>
          <Text fontWeight="700" color="brand.ink">{liquidation.symbol.replace('USDT', '')}</Text>
          <Badge fontSize="8px" variant="premium" opacity={0.5}>{liquidation.exchange.slice(0,3)}</Badge>
        </HStack>
      </Td>
      <Td isNumeric px={1} py={1} borderRight="1px solid" borderColor="brand.border" fontFamily="mono">
        <Text color="brand.ink">{liquidation.price < 1 ? liquidation.price.toFixed(4) : liquidation.price.toFixed(2)}</Text>
      </Td>
      <Td isNumeric px={1} py={1} borderRight="1px solid" borderColor="brand.border" fontFamily="mono">
        <Text fontWeight={isHighValue ? "700" : "500"} color={isHighValue ? "brand.turquoise" : "brand.ink"}>
          {liquidation.value >= 1000000 
            ? `$${(liquidation.value/1000000).toFixed(1)}M` 
            : liquidation.value >= 1000 
              ? `$${(liquidation.value/1000).toFixed(1)}K`
              : `$${Math.round(liquidation.value)}`
          }
        </Text>
      </Td>
      <Td isNumeric px={1} py={1} fontFamily="mono" color="brand.mutedInk" fontSize="10px">
        {displayTime}
      </Td>
    </MotionTr>
  );
});