import React, { useState, useEffect, useMemo } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Box, useColorModeValue, Select, HStack, Input, IconButton, Text } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiquidationStore } from '../store/liquidationStore';
import { CloseIcon } from '@chakra-ui/icons';
import useSound from 'use-sound';

const MotionTr = motion(Tr);

interface Props {
  compact?: boolean;
  soundEnabled: boolean;  
}

export const LiquidationTable: React.FC<Props> = ({ compact = false, soundEnabled }) => {
  const liquidations = useLiquidationStore((state) => state.liquidations);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const bgColor = useColorModeValue('white', 'gray.800');

  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState('');
  const [minLiquidationSize, setMinLiquidationSize] = useState(0);

  const [playPing] = useSound('/ping.mp3', {
    sprite: {
      secondPart: [1000, 1000], // Adjust the start time and duration as needed
    },
  });

  const sortedLiquidations = useMemo(() => 
    [...liquidations].sort((a, b) => 
      b.timestamp.toMillis() - a.timestamp.toMillis()
    ),
    [liquidations]
  );

  const availableCoins = useMemo(() => 
    Array.from(new Set(liquidations.map(l => l.symbol)))
    .sort(),
    [liquidations]
  );

  const filteredLiquidations = useMemo(() => {
    const searchTerm = filterInput.toLowerCase();
    return sortedLiquidations.filter(l => {
      const matchesSelectedCoins = selectedCoins.length === 0 || selectedCoins.includes(l.symbol);
      const matchesSearch = searchTerm === '' || 
        l.symbol.toLowerCase().includes(searchTerm) ||
        l.side.toLowerCase().includes(searchTerm) ||
        l.price.toString().includes(searchTerm) ||
        l.value.toString().includes(searchTerm);
      const matchesSize = l.value >= minLiquidationSize;
      return matchesSelectedCoins && matchesSearch && matchesSize;
    });
  }, [sortedLiquidations, selectedCoins, filterInput, minLiquidationSize]);

  useEffect(() => {
    if (soundEnabled && filteredLiquidations.length > 0) {
      playPing({ id: 'secondPart' });
    }
  }, [filteredLiquidations, playPing, soundEnabled]);  // Only play sound when soundEnabled is true

  return (
    <Box>
      <HStack mb={4} spacing={4}>
        <Input 
          placeholder="Search..."
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
          {availableCoins.filter(coin => !selectedCoins.includes(coin)).map(coin => (
            <option key={coin} value={coin}>{coin}</option>
          ))}
        </Select>
        <Input 
          type="text" 
          placeholder="Min Size" 
          value={minLiquidationSize === 0 ? "" : minLiquidationSize.toString()} // Handle the case when the value is 0
          onChange={(e) => {
            const value = e.target.value;
            // Allow only numeric input (including empty string for backspace)
            if (/^\d*$/.test(value)) {
              setMinLiquidationSize(value === "" ? 0 : Number(value));
            }
          }}
          width="200px"
        />
      </HStack>

      <HStack mb={4} spacing={2} flexWrap="wrap">
        {selectedCoins.map(coin => (
          <HStack key={coin} bg="gray.100" _dark={{ bg: 'gray.700' }} px={3} py={1} borderRadius="md">
            <Text>{coin}</Text>
            <IconButton
              aria-label="Remove filter"
              icon={<CloseIcon />}
              size="xs"
              variant="ghost"
              onClick={() => setSelectedCoins(coins => coins.filter(c => c !== coin))}
            />
          </HStack>
        ))}
      </HStack>

      <Box ref={tableRef} position="relative" borderRadius="xl" boxShadow="lg" overflow="auto" maxHeight="450px">
        <Box overflowX="auto" width="100%">
          <Table variant="simple" size={compact ? "sm" : "md"}>
            <Thead position="sticky" top={0} zIndex={1} bg={bgColor}>
              <Tr>
                <Th fontSize="sm">Symbol</Th>
                <Th fontSize="sm">Side</Th>
                <Th fontSize="sm" isNumeric>Price</Th>
                <Th fontSize="sm" isNumeric>Value</Th>
                <Th fontSize="sm">Time</Th>
              </Tr>
            </Thead>
            <Tbody>
              <AnimatePresence initial={false} mode="sync">
                {filteredLiquidations.map((liquidation) => (
                  <MotionTr
                    key={`${liquidation.timestamp.toISO()}-${liquidation.symbol}-${liquidation.price}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    bg={liquidation.side === 'BUY' ? 'green.100' : 'red.100'}
                    _dark={{ bg: liquidation.side === 'BUY' ? 'green.900' : 'red.900' }}
                  >
                    <Td>
                      <Text fontWeight="bold">{liquidation.symbol}</Text>
                    </Td>
                    <Td>{liquidation.side}</Td>
                    <Td isNumeric>
                      {parseFloat(liquidation.price.toString()).toFixed(2)}
                    </Td>
                    <Td isNumeric>
                      {parseFloat(liquidation.value.toString()).toFixed(2)}
                    </Td>
                    <Td>{liquidation.timestamp.toFormat('HH:mm:ss')}</Td>
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