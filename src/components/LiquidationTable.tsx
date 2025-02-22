import React, { useState, useEffect, useMemo } from 'react';
import { Table, Tbody, Tr,Td, Box, useColorModeValue, Select, HStack, Input, IconButton, Text, Tooltip } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiquidationStore } from '../store/liquidationStore';
import { CloseIcon } from '@chakra-ui/icons';
import { FaCoins, FaDollarSign } from 'react-icons/fa';
import useSound from 'use-sound';

const MotionTr = motion(Tr);

interface Props {
  compact?: boolean;
  soundEnabled: boolean;  
}

export const LiquidationTable: React.FC<Props> = ({ compact = false, soundEnabled }) => {
  const liquidations = useLiquidationStore((state) => state.liquidations);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const bgColor = useColorModeValue('white', 'gray.800');

  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState('');
  const [minLiquidationSize, setMinLiquidationSize] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      <HStack mb={4} spacing={4} flexWrap="wrap">
        <Input 
          placeholder="Search..."
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
          width="150px"
          size={compact ? "sm" : "md"}
        />
        <Select
          placeholder="Add coin filter"
          value=""
          onChange={(e) => {
            if (e.target.value && !selectedCoins.includes(e.target.value)) {
              setSelectedCoins([...selectedCoins, e.target.value]);
            }
          }}
          width="150px"
          size={compact ? "sm" : "md"}
        >
          {availableCoins.filter(coin => !selectedCoins.includes(coin)).map(coin => (
            <option key={coin} value={coin}>{coin}</option>
          ))}
        </Select>
        <Input 
          type="text" 
          placeholder="Min Size $" 
          value={minLiquidationSize === 0 ? "" : minLiquidationSize.toString()}
          onChange={(e) => {
            const value = e.target.value;
            if (/^\d*$/.test(value)) {
              setMinLiquidationSize(value === "" ? 0 : Number(value));
            }
          }}
          width="150px"
          size={compact ? "sm" : "md"}
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
          <Table variant="simple" size={compact ? "sm" : "md"} width="100%">
            <Tbody>
              <AnimatePresence initial={false} mode="sync">
                {filteredLiquidations.map((liquidation, index) => (
                  <LiquidationRow 
                    key={`${liquidation.timestamp.toISO()}-${liquidation.symbol}-${liquidation.price}`} 
                    liquidation={liquidation} 
                    currentTime={currentTime} 
                    index={index} 
                  />
                ))}
              </AnimatePresence>
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
};

const LiquidationRow: React.FC<{ liquidation: any, currentTime: number, index: number }> = ({ liquidation, currentTime, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [lastDisplayedMilestone, setLastDisplayedMilestone] = useState<number | null>(null);

  const timeAgoInSeconds = Math.floor((currentTime - liquidation.timestamp.toMillis()) / 1000);
  const timeAgoInMinutes = Math.floor(timeAgoInSeconds / 60);
  const displayTime = timeAgoInSeconds < 60 ? `${timeAgoInSeconds}s`  : `${timeAgoInMinutes}m`; 
  const isHighValue = liquidation.value > 3000;

    // Time display logic
    const shouldDisplayTime = timeAgoInSeconds < 60 || timeAgoInSeconds % 60 === 0;
  
    useEffect(() => {
      if (shouldDisplayTime) {
        setLastDisplayedMilestone(timeAgoInMinutes);
      }
    }, [shouldDisplayTime, timeAgoInMinutes]);
  
    const isMilestoneLeader = timeAgoInSeconds < 60 || (timeAgoInSeconds % 60 === 0 && timeAgoInMinutes !== lastDisplayedMilestone);
  
    // Enhanced number formatting with better handling of small numbers
  const formatNumber = (num: number, isPrice: boolean = false) => {
    // For prices, we want more precision for very small numbers
    if (isPrice) {
      if (num === 0) return '0';
      if (num < 0.01) return num.toFixed(4); // Show 4 decimals for very small prices
      if (num < 1) return num.toFixed(2).replace('0.', '.');
      if (num < 100) return num.toFixed(2);
      if (num < 1000) return num.toFixed(1);
      return Math.round(num).toString();
    }
    
    // For values (amounts)
    if (num >= 1000) return Math.round(num).toString();
    if (num >= 100) return num.toFixed(1);
    if (num < 1) return num.toFixed(2).replace('0.', '.');
    return num.toFixed(2);
  };
  

  // Remove USDT suffix from symbol
  const formatSymbol = (symbol: string) => {
    return symbol.replace('USDT', '');
  };
  

  const highValueStyle = {
    fontWeight: "900",
    fontFamily: "Rajdhani",
    fontSize: "1.2em",
    color: "purple.500",
    textShadow: "0 0 1px rgba(128, 0, 128, 0.3)",
    _dark: {
      color: "purple.200"
    }
  };

  const regularStyle = {
    fontWeight: "400",
    fontSize: "0.9em",
    color: "gray.600",
    _dark: {
      color: "gray.300"
    }
  };

  return (
    <MotionTr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      bg={liquidation.side === 'BUY' ? 'green.100' : 'red.100'}
      _dark={{ bg: liquidation.side === 'BUY' ? 'green.900' : 'red.900' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
    <Td width="25%">
        <HStack spacing="2">
          {/* Add the Binance logo here */}
          <img 
            src="/bnb.svg" 
            alt="Binance" 
            width="14" 
            height="14" 
            style={{ opacity: 1 }} 
          />
          <Text {...(isHighValue ? highValueStyle : regularStyle)}>
            {formatSymbol(liquidation.symbol)}
          </Text>
        </HStack>
      </Td>
      <Td isNumeric width="25%">
        <Text {...(isHighValue ? highValueStyle : regularStyle)}>
          {formatNumber(liquidation.price, true)} {/* Pass true for price formatting */}
        </Text>
      </Td>
      <Td isNumeric width="25%">
        <Tooltip>
          <Text display="flex" alignItems="center">
            {isHovered 
              ? <>
                <FaCoins style={{ marginRight: '4px' }} />
                {(() => {
                  const quantity = parseFloat(liquidation.quantity.toString());
                  return quantity < 1 ? 
                    quantity.toFixed(4).replace('0.', '.') : 
                    Number.isInteger(quantity) ? 
                      quantity.toString() : 
                      quantity.toFixed(2);
                })()}
              </>
              : <>
                <FaDollarSign 
                  style={{ 
                    marginRight: '4px', 
                    color: isHighValue ? 'var(--chakra-colors-purple-500)' : 'var(--chakra-colors-gray-400)'
                  }} 
                />
                <Text
                  as="span"
                  {...(isHighValue ? highValueStyle : regularStyle)}
                >
                  {formatNumber(liquidation.value)}
                </Text>
              </>
            }
          </Text>
        </Tooltip>
      </Td>
      <Td width="25%">
        {isMilestoneLeader && timeAgoInSeconds >= 0 && 
          <Text 
            {...(isHighValue ? {} : regularStyle)}
          >
            {displayTime}
          </Text>
        }
      </Td>
    </MotionTr>

    
  );
};