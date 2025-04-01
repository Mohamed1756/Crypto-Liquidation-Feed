import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Tbody, Tr, Td, Box, HStack, Input, IconButton, 
  Text, Tooltip, Grid, VStack, Popover, PopoverTrigger, PopoverContent, 
  PopoverBody, PopoverHeader, PopoverArrow, PopoverCloseButton, Button, 
  useDisclosure, Flex, Badge, Thead, Th, TableContainer, useColorModeValue,
  InputGroup, InputLeftElement,  MenuButton, Menu, MenuItem,
  MenuList, Divider, Tag, TagLabel, TagCloseButton
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiquidationStore } from '../store/liquidationStore';
import { CloseIcon, SearchIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { FaCoins, FaDollarSign, FaFilter } from 'react-icons/fa';
import useSound from 'use-sound';
import { WhaleAlertTable } from './WhaleAlert';

const MotionTr = motion(Tr);

interface Props {
  compact?: boolean;
  soundEnabled: boolean; 
  onNewLiquidation: (data: { amount: number; symbol: string }) => void;

}

export const LiquidationTable: React.FC<Props> = ({ compact = false, soundEnabled }) => {
  const liquidations = useLiquidationStore((state) => state.liquidations);
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState('');
  const [minLiquidationSize, setMinLiquidationSize] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedSize, setSelectedSize] = useState<number | null>(minLiquidationSize || null);

  // Color mode values
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const filterBg = useColorModeValue('gray.50', 'gray.900');
 

  const [playPing] = useSound('/ping.mp3', {
    sprite: { secondPart: [1000, 1000] },
  });

  const sortedLiquidations = useMemo(() => 
    [...liquidations].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()),
    [liquidations]
  );

  const availableCoins = useMemo(() => 
    Array.from(new Set(liquidations.map(l => l.symbol))).sort(),
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
  }, [filteredLiquidations, playPing, soundEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num}`;
  };

  return (
    <Grid 
      templateColumns={{ base: "1fr", lg: "7fr 3fr" }}
      gap={3}
      width="100%"
      maxWidth="1200px" // Reduced maximum width
      mx="auto"
      alignItems="stretch"
    >
      <Box
        borderRadius="md" // Smaller border radius
        boxShadow="md" // Lighter shadow
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        transition="all 0.2s"
        overflow="hidden"
        height={{ base: "auto", lg: "560px" }} // Reduced height
        display="flex"
        flexDirection="column"
      >
        <Box 
          p={3} // Reduced padding
          borderBottomWidth="1px" 
          borderColor={borderColor}
          bg={filterBg}
        >
          <VStack spacing={2} align="stretch">
            <Flex 
              justify="space-between"
              wrap="wrap"
              gap={2}
            >
              <HStack spacing={2} flex="1" maxW={{ base: "100%", md: "auto" }}>
                <InputGroup size="sm" width={{ base: "full", md: "180px" }}>
                  <InputLeftElement pointerEvents='none'>
                    <SearchIcon color='gray.400' fontSize="10px" />
                  </InputLeftElement>
                  <Input 
                    placeholder="Search..."
                    value={filterInput}
                    onChange={(e) => setFilterInput(e.target.value)}
                    borderRadius="md"
                    _focus={{ borderColor: "purple.300", boxShadow: "0 0 0 1px var(--chakra-colors-purple-300)" }}
                  />
                </InputGroup>
                
                <Menu closeOnSelect={false}>
                  <MenuButton 
                    as={Button} 
                    size="sm" 
                    variant="outline"
                    rightIcon={<ChevronDownIcon />}
                    width={{ base: "full", md: "auto" }}
                  >
                    <Flex alignItems="center">
                      <FaFilter size="0.8em" style={{marginRight: '6px'}} />
                      Filter
                      {selectedCoins.length > 0 && (
                        <Badge ml={2} colorScheme="purple" fontSize="0.7em">
                          {selectedCoins.length}
                        </Badge>
                      )}
                    </Flex>
                  </MenuButton>
                  <MenuList maxH="200px" overflowY="auto" minW="180px">
                    <Box px={3} py={1}>
                      <Text fontSize="xs" fontWeight="bold" mb={1}>ASSETS</Text>
                    </Box>
                    <Divider my={1} />
                    {availableCoins.map(coin => (
                      <MenuItem key={coin} closeOnSelect={false}>
                        <Flex justify="space-between" width="100%" alignItems="center">
                          <Text fontSize="sm">{coin}</Text>
                          <IconButton
                            aria-label={selectedCoins.includes(coin) ? "Remove filter" : "Add filter"}
                            icon={selectedCoins.includes(coin) ? <CloseIcon /> : <FaFilter />}
                            size="xs"
                            colorScheme={selectedCoins.includes(coin) ? "purple" : "gray"}
                            variant={selectedCoins.includes(coin) ? "solid" : "ghost"}
                            onClick={() => {
                              if (selectedCoins.includes(coin)) {
                                setSelectedCoins(coins => coins.filter(c => c !== coin));
                              } else {
                                setSelectedCoins([...selectedCoins, coin]);
                              }
                            }}
                          />
                        </Flex>
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>

                <Popover placement="bottom-end" isOpen={isOpen} onClose={() => {
                  if (selectedSize === null) setMinLiquidationSize(0);
                  onClose();
                }}>
                  <PopoverTrigger>
                    <Button 
                      size="sm" 
                      width={{ base: "full", md: "auto" }}
                      onClick={onOpen} 
                      colorScheme={minLiquidationSize > 0 ? "purple" : "gray"}
                      variant={minLiquidationSize > 0 ? "solid" : "outline"}
                      leftIcon={<FaDollarSign size="0.8em" />}
                    >
                      {minLiquidationSize > 0 ? formatCurrency(minLiquidationSize) : "Min"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent width="180px" p={2} borderRadius="md" boxShadow="lg">
                    <PopoverArrow />
                    <PopoverCloseButton size="sm" />
                    <PopoverHeader fontSize="sm" fontWeight="bold" borderBottomWidth="1px" py={2}>Min Size</PopoverHeader>
                    <PopoverBody px={1} py={2}>
                      <VStack spacing={1} align="stretch">
                        <Button 
                          width="100%" 
                          variant={selectedSize === null ? "solid" : "ghost"}
                          colorScheme={selectedSize === null ? "purple" : "gray"}
                          size="xs"
                          onClick={() => {
                            setSelectedSize(null);
                            setMinLiquidationSize(0);
                            onClose();
                          }}
                        >
                          No Minimum
                        </Button>
                        {[10000, 50000, 100000, 250000, 500000].map((amount) => (
                          <Button 
                            key={amount}
                            width="100%" 
                            variant={selectedSize === amount ? "solid" : "ghost"}
                            colorScheme={selectedSize === amount ? "purple" : "gray"}
                            size="xs"
                            onClick={() => {
                              setSelectedSize(amount);
                              setMinLiquidationSize(amount);
                              onClose();
                            }}
                          >
                            {formatCurrency(amount)}
                          </Button>
                        ))}
                      </VStack>
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </HStack>
            </Flex>
    
            {selectedCoins.length > 0 && (
              <Flex wrap="wrap" gap={1}>
                {selectedCoins.map(coin => (
                  <Tag
                    key={coin} 
                    size="sm"
                    borderRadius="full"
                    variant="subtle"
                    colorScheme="purple"
                  >
                    <TagLabel fontSize="xs">{coin}</TagLabel>
                    <TagCloseButton 
                      onClick={() => setSelectedCoins(coins => coins.filter(c => c !== coin))}
                    />
                  </Tag>
                ))}
                {selectedCoins.length > 1 && (
                  <Button
                    size="xs"
                    variant="link"
                    colorScheme="purple"
                    onClick={() => setSelectedCoins([])}
                  >
                    Clear all
                  </Button>
                )}
              </Flex>
            )}
          </VStack>
        </Box>
    
       {/* Optimize the AnimatePresence with presenceAffectsLayout={false} */}
<TableContainer 
  flex="1"
  overflowY="auto"
  css={{
    '&::-webkit-scrollbar': { width: '4px' },
    '&::-webkit-scrollbar-track': { background: useColorModeValue('rgba(0,0,0,0.03)', 'rgba(255,255,255,0.03)') },
    '&::-webkit-scrollbar-thumb': { background: useColorModeValue('rgba(0,0,0,0.15)', 'rgba(255,255,255,0.15)'), borderRadius: '2px' },
  }}
>
  <Table variant="simple" size="sm" width="100%" style={{ tableLayout: 'fixed' }}>
    <Thead position="sticky" top={0} zIndex={1} bg={cardBg}>
      <Tr>
        <Th width="28%" borderRight="1px" borderColor={borderColor} px={2} py={2} fontSize="xs">Asset</Th>
        <Th width="24%" isNumeric borderRight="1px" borderColor={borderColor} px={2} py={2} fontSize="xs">Price</Th>
        <Th width="24%" isNumeric borderRight="1px" borderColor={borderColor} px={2} py={2} fontSize="xs">Value</Th>
        <Th width="24%" isNumeric px={2} py={2} fontSize="xs">Time</Th>
      </Tr>
    </Thead>
    <Tbody>
      {/* Limit the maximum rendered items and optimize animations */}
      <AnimatePresence initial={false} presenceAffectsLayout={false}>
        {filteredLiquidations.slice(0, 100).map((liquidation, index) => (
          <LiquidationRow 
            key={`${liquidation.timestamp.toISO()}-${liquidation.symbol}-${liquidation.price}-${liquidation.value}`}
            liquidation={liquidation} 
            currentTime={currentTime} 
            index={index}
            compact={compact}
          />
        ))}
      </AnimatePresence>
      {filteredLiquidations.length === 0 && (
        <Tr>
          <Td colSpan={4} textAlign="center" py={4}>
            <Text color="gray.500" fontSize="sm">No liquidations match your filters</Text>
          </Td>
        </Tr>
      )}
    </Tbody>
  </Table>
</TableContainer>

        
<Box 
  p={2} 
  fontSize="xs" 
  color="gray.500" 
  textAlign="center"
  borderTopWidth="1px"
  borderColor={borderColor}
  bg={filterBg}
>
  {filteredLiquidations.length > 100 
    ? '100+ liquidations displayed' 
    : `${filteredLiquidations.length} liquidations displayed`}
  {selectedCoins.length > 0 || minLiquidationSize > 0 || filterInput 
    ? ` (filtered from ${sortedLiquidations.length} total)` 
    : ''}
</Box>
      </Box>
    
      <Box
        borderRadius="md"
        boxShadow="md"
        bg={cardBg}
        border="1px solid"
        borderColor={borderColor}
        height={{ base: "auto", lg: "560px" }}
        overflow="hidden"
      >
        <WhaleAlertTable 
          compact={true} 
          soundEnabled={soundEnabled} 
          height="100%" 
        />
      </Box>
    </Grid>
  );
};

// Memoize LiquidationRow to prevent unnecessary re-renders
const LiquidationRow: React.FC<{ liquidation: any, currentTime: number, index: number, compact: boolean }> = React.memo(({ liquidation, currentTime,  compact }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [lastDisplayedMilestone, setLastDisplayedMilestone] = useState<number | null>(null);
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const timeAgoInSeconds = Math.floor((currentTime - liquidation.timestamp.toMillis()) / 1000);
  const timeAgoInMinutes = Math.floor(timeAgoInSeconds / 60);
  const displayTime = timeAgoInSeconds < 60 ? `${timeAgoInSeconds}s` : `${timeAgoInMinutes}m`; 
  const isHighValue = liquidation.value > 3000;
  const isRecent = timeAgoInSeconds < 30;

  const shouldDisplayTime = timeAgoInSeconds < 60 || timeAgoInSeconds % 60 === 0;

  useEffect(() => {
    if (shouldDisplayTime) {
      setLastDisplayedMilestone(timeAgoInMinutes);
    }
  }, [shouldDisplayTime, timeAgoInMinutes]);

  const isMilestoneLeader = timeAgoInSeconds < 60 || (timeAgoInSeconds % 60 === 0 && timeAgoInMinutes !== lastDisplayedMilestone);

  const formatNumber = (num: number, isPrice: boolean = false) => {
    if (isPrice) {
      if (num === 0) return '0';
      if (num < 0.01) return num.toFixed(4);
      if (num < 1) return num.toFixed(2).replace('0.', '.');
      if (num < 100) return num.toFixed(2);
      if (num < 1000) return num.toFixed(1);
      return Math.round(num).toString();
    }
    if (num >= 1000) return Math.round(num).toString();
    if (num >= 100) return num.toFixed(1);
    if (num < 1) return num.toFixed(2).replace('0.', '.');
    return num.toFixed(2);
  };

  const formatSymbol = (symbol: string) => {
    return symbol.replace('USDT', '').replace(/--?SWAP/, '');
  };

  const highValueStyle = {
    fontWeight: "700",
    fontFamily: "Rajdhani",
    fontSize: "1.05em",
    color: "purple.500",
    _dark: { color: "purple.300" }
  };

  const regularStyle = {
    fontWeight: "400",
    fontSize: "0.85em",
    color: "gray.700",
    _dark: { color: "gray.300" }
  };

  const rowVariants = {
    initial: { 
      opacity: 0, 
      y: -5 
    },
    animate: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.15, 
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      transition: { 
        duration: 0.1 
      }
    }
  };

  // Lighter on entry (isRecent = true), darker after 30s (isRecent = false)
    // Lighter on entry (isRecent = true), darker after 30s (isRecent = false)
    const bgColor = isRecent
    ? liquidation.side === 'BUY' ? 'green.50' : 'red.50'  // Very light on entry
    : liquidation.side === 'BUY' ? 'green.200' : 'red.200'; // Darker after 30s

  const darkBgColor = isRecent
    ? liquidation.side === 'BUY' ? 'green.900' : 'red.900' // Lightest dark mode on entry
    : liquidation.side === 'BUY' ? 'green.700' : 'red.700'; // Darker after 30s
  return (
    <MotionTr
      variants={rowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      bg={bgColor}
      _dark={{ bg: darkBgColor }}
      _hover={{
        bg: liquidation.side === 'BUY' ? 'green.100' : 'red.100',
        _dark: { bg: liquidation.side === 'BUY' ? 'green.800' : 'red.800' }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      position="relative"
      width="100%"
      layout
      borderLeftWidth="2px"
      borderLeftColor={liquidation.side === 'BUY' ? 'green.400' : 'red.400'}
      borderLeftStyle={isRecent ? 'solid' : 'hidden'}
    >
      <Td 
        width="28%" 
        minWidth="28%" 
        maxWidth="28%" 
        borderRight="1px" 
        borderColor={borderColor}
        px={2}
        py={compact ? 1 : 2}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        <HStack spacing="2" overflow="hidden">
          {liquidation.exchange === 'BINANCE' ? (
            <Box flexShrink={0} width="14px" height="14px">
              <img src="/bnb.svg" alt="Binance" width="14" height="14" style={{ opacity: 1 }} />
            </Box>
          ) : liquidation.exchange === 'BYBIT' ? (
            <Box flexShrink={0} width="14px" height="14px">
              <img src="/bybit.svg" alt="Bybit" width="14" height="14" style={{ opacity: 0.8 }} />
            </Box>
          ) : liquidation.exchange === 'OKX' ? (
            <Box flexShrink={0} width="14px" height="14px">
              <img src="/okx.svg" alt="OKX" width="14" height="14" style={{ opacity: 0.8 }} />
            </Box>
          ) : null}
          <Text 
            {...(isHighValue ? highValueStyle : regularStyle)} 
            overflow="hidden" 
            textOverflow="ellipsis" 
            whiteSpace="nowrap"
          >
            {formatSymbol(liquidation.symbol)}
          </Text>
        </HStack>
      </Td>

      <Td 
        isNumeric 
        width="24%" 
        minWidth="24%" 
        maxWidth="24%" 
        borderRight="1px" 
        borderColor={borderColor}
        px={2}
        py={compact ? 1 : 2}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        <Text 
          {...(isHighValue ? highValueStyle : regularStyle)}
          textAlign="right"
          whiteSpace="nowrap"
        >
          {formatNumber(liquidation.price, true)}
        </Text>
      </Td>

      <Td 
        isNumeric 
        width="24%" 
        minWidth="24%" 
        maxWidth="24%" 
        borderRight="1px" 
        borderColor={borderColor}
        px={2}
        py={compact ? 1 : 2}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        <Tooltip 
          label={`${liquidation.quantity.toFixed(4)} units at $${liquidation.price.toFixed(2)}`} 
          hasArrow
          openDelay={500}
          placement="top"
        >
          <Box display="flex" alignItems="center" justifyContent="flex-end" width="100%">
            {isHovered 
              ? <>
                  <Box as={FaCoins} marginRight="4px" fontSize="10px" flexShrink={0} />
                  <Text fontSize="xs" whiteSpace="nowrap">
                    {(() => {
                      const quantity = parseFloat(liquidation.quantity.toString());
                      return quantity < 1 ? 
                        quantity.toFixed(4).replace('0.', '.') : 
                        Number.isInteger(quantity) ? 
                          quantity.toString() : 
                          quantity.toFixed(2);
                    })()}
                  </Text>
                </>
              : <>
                  <Box 
                    as={FaDollarSign} 
                    marginRight="2px" 
                    flexShrink={0}
                    fontSize="10px"
                    color={isHighValue ? 'purple.500' : 'gray.400'}
                    _dark={{ color: isHighValue ? 'purple.300' : 'gray.500' }}
                  /> 
                  <Text 
                    as="span" 
                    {...(isHighValue ? highValueStyle : regularStyle)}
                    whiteSpace="nowrap"
                  >
                    {formatNumber(liquidation.value)}
                  </Text>
                </>
            }
          </Box>
        </Tooltip>
      </Td>

      <Td 
        isNumeric 
        width="24%" 
        minWidth="24%" 
        maxWidth="24%"
        px={2}
        py={compact ? 1 : 2}
        textAlign="right"
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        <Box height="16px" display="flex" justifyContent="flex-end" alignItems="center">
          {isMilestoneLeader && timeAgoInSeconds >= 0 ? (
            <Badge
              colorScheme={isRecent ? "purple" : "gray"}
              variant="subtle"
              px={1.5}
              py={0.5}
              borderRadius="full"
              fontSize="2xs"
            >
              {displayTime}
            </Badge>
          ) : null}
        </Box>
      </Td>
    </MotionTr>
  );
}, (prevProps, nextProps) => {
  return prevProps.liquidation === nextProps.liquidation && 
         Math.floor(prevProps.currentTime / 1000) === Math.floor(nextProps.currentTime / 1000);
});