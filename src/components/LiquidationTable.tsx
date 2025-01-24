import React, { useState, useEffect, useMemo } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Box, useColorModeValue, Select, HStack, Input, IconButton, Text, useBreakpointValue } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiquidationStore } from '../store/liquidationStore';
import { CloseIcon } from '@chakra-ui/icons';

const MotionTr = motion(Tr);

interface Props {
  compact?: boolean;
}

export const LiquidationTable: React.FC<Props> = ({ compact = false }) => {
  const liquidations = useLiquidationStore((state) => state.liquidations);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const bgColor = useColorModeValue('white', 'gray.800');

  // Add new state
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState('');

  // Sort liquidations by timestamp descending (latest first)
  const sortedLiquidations = useMemo(() => 
    [...liquidations].sort((a, b) => 
      b.timestamp.toMillis() - a.timestamp.toMillis()
    ),
    [liquidations]
  );

  // Get unique coins from liquidations
  const availableCoins = useMemo(() => 
    Array.from(new Set(liquidations.map(l => l.symbol)))
    .sort(),
    [liquidations]
  );

  // Filter logic
  const filteredLiquidations = useMemo(() => 
    sortedLiquidations.filter(l => 
      selectedCoins.length === 0 || selectedCoins.includes(l.symbol)
    ),
    [sortedLiquidations, selectedCoins]
  );

  // Handle scroll events
  const handleScroll = () => {
    if (tableRef.current) {
      const { scrollTop } = tableRef.current;
      const isAtTop = scrollTop < 50;
      setShouldAutoScroll(isAtTop);
    }
  };

  // Auto-scroll only if user was at top
  useEffect(() => {
    if (tableRef.current && shouldAutoScroll) {
      tableRef.current.scrollTop = 0; // Always keep the newest entries in view
    }
  }, [sortedLiquidations, shouldAutoScroll]);

  function getAnimationScale(value: number): number {
    if (value >= 1000000) return 1.15; // Very large liquidations
    if (value >= 500000) return 1.12;  // Large liquidations
    if (value >= 100000) return 1.08;  // Medium liquidations
    if (value >= 50000) return 1.05;   // Small-medium liquidations
    return 1;                          // Small liquidations
  }

  return (
    <Box>
      <HStack mb={4} spacing={4}>
        <Input 
          placeholder="Search coins..."
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
          width="200px"
        />
        <Select
          placeholder="Add coin filter"
          value=""
          onChange={(e) => {
            if (e.target.value && !selectedCoins.includes(e.target.value)) {
              setSelectedCoins([...selectedCoins, e.target.value]);
            }
          }}
        >
          {availableCoins
            .filter(coin => 
              coin.toLowerCase().includes(filterInput.toLowerCase()) &&
              !selectedCoins.includes(coin)
            )
            .map(coin => (
              <option key={coin} value={coin}>{coin}</option>
            ))
          }
        </Select>
      </HStack>
      
      <HStack mb={4} spacing={2} flexWrap="wrap">
        {selectedCoins.map(coin => (
          <HStack 
            key={coin}
            bg="gray.100"
            _dark={{ bg: 'gray.700' }}
            px={3}
            py={1}
            borderRadius="md"
          >
            <Text>{coin}</Text>
            <IconButton
              aria-label="Remove filter"
              icon={<CloseIcon />}
              size="xs"
              variant="ghost"
              onClick={() => setSelectedCoins(coins => 
                coins.filter(c => c !== coin)
              )}
            />
          </HStack>
        ))}
      </HStack>

      <Box 
        ref={tableRef}
        onScroll={handleScroll}
        position="relative"
        borderRadius="xl" 
        boxShadow="lg" 
        overflow="auto"
        maxHeight="600px" // Fixed height
        transition="all 0.2s"
        _hover={{ boxShadow: "xl" }}
        css={{
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '4px',
          },
        }}
      >
        <Box overflowX="auto" width="100%">
          <Table variant="simple" size={compact ? "sm" : "md"}>
            <Thead position="sticky" top={0} zIndex={1} bg={bgColor}>
              <Tr>
                <Th fontSize="sm">Symbol</Th>
                <Th fontSize="sm">Side</Th>
                <Th fontSize="sm" isNumeric display={{ base: 'none', md: 'table-cell' }}>Quantity</Th>
                <Th fontSize="sm" isNumeric>Price</Th>
                <Th fontSize="sm" isNumeric>Value</Th>
                <Th fontSize="sm" display={{ base: 'none', md: 'table-cell' }}>Time</Th>
              </Tr>
            </Thead>
            <Tbody>
              <AnimatePresence initial={false} mode="sync">
                {filteredLiquidations.map((liquidation) => (
                  <MotionTr
                    key={`${liquidation.timestamp.toISO()}-${liquidation.symbol}-${liquidation.price}`}
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: 1,
                      scale: getAnimationScale(liquidation.value),
                      transition: {
                        type: "spring",
                        duration: 0.3
                      }
                    }}
                    exit={{ opacity: 0 }}
                    bg={liquidation.side === 'BUY' ? 'green.100' : 'red.100'}
                    _dark={{
                      bg: liquidation.side === 'BUY' ? 'green.900' : 'red.900',
                    }}
                    sx={{
                      'td': {
                        fontSize: { base: 'sm', md: 'md' },
                        padding: { base: '8px 4px', md: '12px 16px' }
                      }
                    }}
                  >
                    <Td>{liquidation.symbol}</Td>
                    <Td>{liquidation.side}</Td>
                    <Td display={{ base: 'none', md: 'table-cell' }} isNumeric>{liquidation.quantity}</Td>
                    <Td isNumeric>{liquidation.price}</Td>
                    <Td isNumeric>{liquidation.value}</Td>
                    <Td display={{ base: 'none', md: 'table-cell' }}>{liquidation.timestamp.toFormat('HH:mm:ss')}</Td>
                  </MotionTr>
                ))}
              </AnimatePresence>
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
};