import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Heading, 
  Table, 
  Tbody, 
  Tr, 
  Td, 
  Text, 
  Flex, 
  Badge,
  VStack, 
  useColorModeValue,
  Tooltip,
  TableContainer,
  Thead,
  Th,
  HStack
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiquidationStore } from '../store/liquidationStore';
import { Fish } from "lucide-react";
import useSound from 'use-sound';

const MotionBox = motion(Box);
const MotionTr = motion(Tr);

interface Props {
  compact?: boolean;
  soundEnabled: boolean;
  threshold?: number;
  height?: string;
  retention?: number; // How long to keep entries in minutes
}

export const WhaleAlertTable: React.FC<Props> = React.memo(({ 
 
  soundEnabled,
  threshold = 250000,
  height = "500px",
  retention = 60 // Default: keep whale alerts for 60 minutes
}) => {
  const liquidations = useLiquidationStore((state) => state.liquidations);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [lastSoundPlayed, setLastSoundPlayed] = useState<number>(0);
  const [playWhaleSound] = useSound('/whale.mp3', { volume: 0.5 });
  
  // NEW: Local state to persist whale liquidations longer
  const [persistedWhaleLiquidations, setPersistedWhaleLiquidations] = useState<any[]>([]);

  // Theme colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBg = useColorModeValue('purple.50', 'purple.900');
  const headerColor = useColorModeValue('purple.700', 'purple.200');
  const placeholderColor = useColorModeValue('gray.500', 'gray.400');
  const scrollbarTrack = useColorModeValue('rgba(0,0,0,0.03)', 'rgba(255,255,255,0.03)');
  const scrollbarThumb = useColorModeValue('rgba(0,0,0,0.15)', 'rgba(255,255,255,0.15)');

  // NEW: Update our persisted whale liquidations when new ones arrive
  useEffect(() => {
    // Find high-value liquidations
    const newWhaleLiquidations = liquidations.filter(l => l.value >= threshold);
    
    if (newWhaleLiquidations.length === 0) return;
    
    // Update our persisted list with new whale liquidations
    setPersistedWhaleLiquidations(prevWhales => {
      // Get existing IDs to avoid duplicates
      const existingIds = new Set(prevWhales.map(whale => 
        `${whale.timestamp.toISO()}-${whale.symbol}-${whale.value}`));
      
      // Add only new whale liquidations
      const newWhales = newWhaleLiquidations.filter(whale => 
        !existingIds.has(`${whale.timestamp.toISO()}-${whale.symbol}-${whale.value}`));
      
      // Merge without duplicates
      return [...prevWhales, ...newWhales];
    });
  }, [liquidations, threshold]);
  
  // NEW: Clean up old whale liquidations based on retention period
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const retentionMs = retention * 60 * 1000; // Convert minutes to ms
      const cutoffTime = Date.now() - retentionMs;
      
      setPersistedWhaleLiquidations(prevWhales => 
        prevWhales.filter(whale => 
          whale.timestamp.toMillis() > cutoffTime
        )
      );
    }, 60000); // Check every minute
    
    return () => clearInterval(cleanupInterval);
  }, [retention]);

  // Use our persisted list instead of filtering the store directly
  const whaleLiquidations = useMemo(() => 
    [...persistedWhaleLiquidations]
      .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
      .slice(0, 100), // Limit to improve performance
    [persistedWhaleLiquidations]
  );

  // Sound effect with debounce
  useEffect(() => {
    if (!soundEnabled || whaleLiquidations.length === 0) return;

    const latestLiquidation = whaleLiquidations[0];
    const timeDiff = Date.now() - latestLiquidation.timestamp.toMillis();
    const soundCooldown = 5000; // 5 seconds cooldown

    if (timeDiff < 10000 && Date.now() - lastSoundPlayed > soundCooldown) {
      playWhaleSound();
      setLastSoundPlayed(Date.now());
    }
  }, [whaleLiquidations, playWhaleSound, soundEnabled, lastSoundPlayed]);

  // Time update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatLargeNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
  };

  const formatTimeAgo = (timestamp: any) => {
    const timeAgoInSeconds = Math.floor((currentTime - timestamp.toMillis()) / 1000);
    const timeAgoInMinutes = Math.floor(timeAgoInSeconds / 60);
    
    if (timeAgoInSeconds < 60) return `${timeAgoInSeconds}s`;
    if (timeAgoInMinutes < 60) return `${timeAgoInMinutes}m`;
    return `${Math.floor(timeAgoInMinutes / 60)}h${timeAgoInMinutes % 60}m`;
  };

  const formatSymbol = (symbol: string) => {
    return symbol.replace('USDT', '').replace(/--?SWAP/, '');
  };

  // Highlight new whales (less than 30s old)
  const isNewWhale = (timestamp: any) => {
    return (currentTime - timestamp.toMillis()) < 30000;
  };

  // Row animation variants
  const rowVariants = {
    initial: { 
      opacity: 0, 
      transform: 'translateY(-5px)'
    },
    animate: { 
      opacity: 1,
      transform: 'translateY(0px)',
      transition: { 
        duration: 0.12,
        ease: [0.16, 1, 0.3, 1], // Fast-out, slow-in curve
      }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.08 }
    }
  };

  return (
    <Box
      borderRadius="md"
      boxShadow="md"
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      height={height}
      width="100%"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Simplified Header */}
      <Box
        bg={headerBg}
        borderBottomWidth="1px"
        borderColor={borderColor}
        width="100%"
        py={2}
        px={3}
      >
        <Flex
          align="center"
          justify="space-between"
        >
          <HStack spacing={1.5}>
            <Fish size={16} />
            <Heading size="xs" color={headerColor} fontWeight="600">
              Whale Alerts
            </Heading>
          </HStack>
          <HStack>
            <Badge 
              colorScheme="purple" 
              fontSize="xs" 
              borderRadius="full" 
              px={2} 
              py={0.5}
            >
              {formatLargeNumber(threshold)}+
            </Badge>
            <Badge 
              colorScheme="gray" 
              fontSize="xs" 
              borderRadius="full" 
              px={2} 
              py={0.5}
              variant="outline"
            >
              {retention}m history
            </Badge>
          </HStack>
        </Flex>
      </Box>

      {/* Table Container with Fixed Height */}
      <TableContainer 
        flex="1"
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: scrollbarTrack,
          },
          '&::-webkit-scrollbar-thumb': {
            background: scrollbarThumb,
            borderRadius: '2px',
          },
        }}
      >
        {whaleLiquidations.length > 0 ? (
          <Table variant="simple" size="sm" layout="fixed" width="100%">
            <Thead position="sticky" top={0} zIndex={1} bg={bgColor}>
              <Tr>
                <Th width="40%" textAlign="left" fontSize="xs" px={2} py={2}>Asset</Th>
                <Th width="35%" isNumeric fontSize="xs" px={2} py={2}>Value</Th>
                <Th width="25%" isNumeric fontSize="xs" px={2} py={2}>Time</Th>
              </Tr>
            </Thead>
            <Tbody>
              <AnimatePresence initial={false} presenceAffectsLayout={false}>
                {whaleLiquidations.map((liquidation) => {
                  const isNew = isNewWhale(liquidation.timestamp);
                  // Calculate time for visual indication (newer entries are more vibrant)
                  const entryAge = (currentTime - liquidation.timestamp.toMillis()) / 1000;
                  const fadeLevel = Math.min(1, entryAge / (retention * 60));
                  const opacity = 1 - (fadeLevel * 0.4); // Max fade to 60% opacity
                  
                  return (
                    <MotionTr
                      key={`${liquidation.timestamp.toISO()}-${liquidation.symbol}-${liquidation.value}`}
                      variants={rowVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      bg={liquidation.side === 'BUY' 
                        ? useColorModeValue('green.50', 'green.900') 
                        : useColorModeValue('red.50', 'red.900')
                      }
                      _hover={{
                        bg: liquidation.side === 'BUY' 
                          ? useColorModeValue('green.100', 'green.800') 
                          : useColorModeValue('red.100', 'red.800')
                      }}
                      position="relative"
                      borderLeftWidth="2px"
                      borderLeftColor={liquidation.side === 'BUY' ? "green.400" : "red.400"}
                      borderLeftStyle={isNew ? 'solid' : 'hidden'}
                      style={{ 
                        willChange: 'transform, opacity',
                        opacity
                      }}
                    >
                      <Td py={1.5} px={2} width="40%">
                        <Flex align="center">
                          {liquidation.exchange === 'BINANCE' && (
                            <Box flexShrink={0} width="14px" height="14px" mr={1.5}>
                              <img src="/bnb.svg" alt="Binance" width="14" height="14" />
                            </Box>
                          )}
                          {liquidation.exchange === 'BYBIT' && (
                            <Box flexShrink={0} width="14px" height="14px" mr={1.5}>
                              <img src="/bybit.svg" alt="Bybit" width="14" height="14" />
                            </Box>
                          )}
                          {liquidation.exchange === 'OKX' && (
                            <Box flexShrink={0} width="14px" height="14px" mr={1.5}>
                              <img src="/okx.svg" alt="OKX" width="14" height="14" />
                            </Box>
                          )}
                          <Text 
                            fontWeight={600} 
                            fontSize="xs" 
                            noOfLines={1}
                            overflow="hidden"
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                          >
                            {formatSymbol(liquidation.symbol)}
                          </Text>
                        </Flex>
                      </Td>
                      <Td isNumeric py={1.5} px={2} width="35%">
                      <Tooltip 
  label={`${liquidation.side === 'SELL' ? 'Long' : 'Short'} liquidated at $${liquidation.price.toLocaleString()}`} 
  hasArrow
  placement="top"
  openDelay={500}
>
                          <Text 
                            fontWeight="600" 
                            fontSize="xs"
                            color={liquidation.side === 'BUY' 
                              ? useColorModeValue('green.600', 'green.300') 
                              : useColorModeValue('red.600', 'red.300')
                            }
                          >
                            {formatLargeNumber(liquidation.value)}
                          </Text>
                        </Tooltip>
                      </Td>
                      <Td isNumeric py={1.5} px={2} width="25%">
                        <Badge 
                          variant="subtle" 
                          colorScheme={isNew ? "purple" : "gray"}
                          px={1.5}
                          py={0.5}
                          borderRadius="full"
                          fontSize="2xs"
                          minWidth="24px"
                          textAlign="center"
                          display="inline-block"
                        >
                          {formatTimeAgo(liquidation.timestamp)}
                        </Badge>
                      </Td>
                    </MotionTr>
                  );
                })}
              </AnimatePresence>
            </Tbody>
          </Table>
        ) : (
          <Flex 
            align="center" 
            justify="center" 
            height="100%"
            p={4}
          >
            <VStack spacing={3}>
              <MotionBox
                animate={{ 
                  scale: [1, 1.05, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "loop"
                }}
              >
                <Fish size={24} strokeWidth={1.5} color={useColorModeValue('#805AD5', '#D6BCFA')} />
              </MotionBox>
              <Text 
                color={placeholderColor} 
                fontSize="xs" 
                textAlign="center"
              >
                Watching for whale liquidations <br/>over {formatLargeNumber(threshold)}
              </Text>
            </VStack>
          </Flex>
        )}
      </TableContainer>
      
      {/* Simplified Footer */}
      <Box 
        p={1.5}
        fontSize="2xs" 
        color={placeholderColor} 
        textAlign="center"
        borderTopWidth="1px"
        borderColor={borderColor}
        bg={useColorModeValue('gray.50', 'gray.900')}
        width="100%"
      >
        {whaleLiquidations.length > 0 ? (
          `${whaleLiquidations.length} whale liquidations displayed • Retained for ${retention} minutes`
        ) : (
          "Monitoring market for large liquidations"
        )}
      </Box>
    </Box>
  );
});
