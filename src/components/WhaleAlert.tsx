import React, { useMemo } from 'react';
import { 
  Box, Flex, Text, VStack, HStack, Table, Tbody, Tr, Td, Badge, TableContainer
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiquidationStore } from '../store/liquidationStore';

const MotionTr = motion(Tr);

export const WhaleAlertTable: React.FC<{ compact?: boolean, soundEnabled: boolean }> = () => {
  const liquidations = useLiquidationStore((state) => state.liquidations);
  
  const whaleLiquidations = useMemo(() => {
    return [...liquidations]
      .filter(l => l.value >= 100000) // Whale threshold
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
      .slice(0, 20);
  }, [liquidations]);

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
        <Table variant="simple" size="xs" width="100%">
          <Tbody>
            <AnimatePresence initial={false}>
              {whaleLiquidations.map((l) => (
                <WhaleRow key={`${l.timestamp.toMillis()}-${l.symbol}`} liquidation={l} />
              ))}
            </AnimatePresence>
            {whaleLiquidations.length === 0 && (
              <Tr>
                <Td py={8} textAlign="center">
                  <Text color="brand.mutedInk" fontSize="10px" fontFamily="mono" opacity={0.5}>WAITING FOR SIGNALS</Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const WhaleRow: React.FC<{ liquidation: any }> = ({ liquidation }) => {
  const isBuy = liquidation.side === 'BUY';
  const color = isBuy ? 'brand.mutedGreen' : 'brand.mutedRed';
  
  return (
    <MotionTr
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      borderBottom="1px solid"
      borderColor="brand.border"
      _hover={{ bg: 'rgba(0,0,0,0.01)' }}
    >
      <Td py={2} px={1}>
        <Flex justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <HStack spacing={2}>
              <Text fontWeight="700" color="brand.ink" fontSize="11px">{liquidation.symbol}</Text>
              <Badge variant="premium" fontSize="8px">{liquidation.exchange}</Badge>
            </HStack>
            <Text fontSize="9px" color="brand.mutedInk" fontFamily="mono">
              {liquidation.timestamp.toLocaleString({ hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          </VStack>
          <Box textAlign="right">
            <Text fontWeight="700" color={color} fontSize="12px" fontFamily="mono">
              ${(liquidation.value / 1000).toFixed(0)}K
            </Text>
            <Text fontSize="8px" color="brand.mutedInk" fontWeight="600">{liquidation.side}</Text>
          </Box>
        </Flex>
      </Td>
    </MotionTr>
  );
};
