import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  HStack,
  VStack,
  IconButton,
  Button,
  useColorMode,
  useColorModeValue,
  Switch,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tooltip,
  Badge,
  Tag,
  TagLabel,
  TagLeftIcon,
  Skeleton,
  useToast,
  useDisclosure,
  Collapse,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  Fade,
  Divider,
  Spacer,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  TabIndicator,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useBreakpointValue,
  FormControl,
  FormLabel,
  UnorderedList,
  ListItem,
  Circle,
  Link,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';
import {
  SunIcon,
  MoonIcon,
  InfoOutlineIcon,
  ChevronDownIcon,
  BellIcon,
  CheckCircleIcon,
  TimeIcon,
  SettingsIcon,
  RepeatIcon,
  HamburgerIcon,
  CloseIcon,
  WarningIcon,
  SearchIcon,
  InfoIcon,
} from '@chakra-ui/icons';
import { FaDiscord } from 'react-icons/fa';
import { keyframes } from '@emotion/react';
import { Achievements } from './components/Achievements';
import { LiquidationTable } from './components/LiquidationTable';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { useLiquidationStore } from './store/liquidationStore';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fetchFundingRates } from './components/FundingRates'; // Adjust the import path as needed

// Define motion variants for animations
const MotionBox = motion(Box);

// Animation for notification pulse
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(49, 151, 149, 0.6); }
  70% { box-shadow: 0 0 0 10px rgba(49, 151, 149, 0); }
  100% { box-shadow: 0 0 0 0 rgba(49, 151, 149, 0); }
`;

// Define FundingRate type (copied from FundingRates.tsx for context)
interface FundingRate {
  symbol: string;
  coin: string;
  lastFundingRate: number;
  nextFundingTime: number;
  exchange: string;
}

function App() {
  // Core states
  const { colorMode, toggleColorMode } = useColorMode();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alertVolume] = useState(70);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [activeView, setActiveView] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  const [minLiquidationAlert] = useState(500000);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [animateNotification, setAnimateNotification] = useState(false);

  // Funding rates states
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [fundingLoading, setFundingLoading] = useState(true);
  const [fundingError, setFundingError] = useState<string | null>(null);

  // Remove the unused state variable
  const [themeAccent] = useState<'teal' | 'purple' | 'blue' | 'cyan'>('teal');

  // Exchange states
  type Exchange = 'BINANCE' | 'BYBIT' | 'OKX';
  const [selectedExchanges, setSelectedExchanges] = useState<Exchange[]>(['BINANCE', 'BYBIT', 'OKX']);
  const availableExchanges: Exchange[] = ['BINANCE', 'BYBIT', 'OKX'];

  // UI Hooks
  const toast = useToast();
  const { isOpen: isAlertOpen, onClose: onAlertClose } = useDisclosure({ defaultIsOpen: hasError });
  const { onOpen: onSettingsDrawerOpen } = useDisclosure();

  // Dynamic color values based on color mode and theme
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const accentColorMap = {
    teal: useColorModeValue('teal.500', 'teal.300'),
    purple: useColorModeValue('purple.500', 'purple.300'),
    blue: useColorModeValue('blue.500', 'blue.300'),
    cyan: useColorModeValue('cyan.500', 'cyan.300'),
  };
  const accentColor = accentColorMap[themeAccent];

  const cardBg = useColorModeValue('white', 'gray.800');
  const mutedText = useColorModeValue('gray.600', 'gray.400');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const statsCardBg = useColorModeValue('white', 'gray.800');
  const pulseAnimation = `${pulse} 2s infinite`;

  // Responsive values
  const headingSize = useBreakpointValue({ base: 'md', md: 'lg' });
  const headerPadding = useBreakpointValue({ base: 3, md: 5 });
  const containerPadding = useBreakpointValue({ base: 2, md: 4 });

  // References
  const lastLiquidationRef = useRef<{ amount: number; symbol: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch funding rates
  useEffect(() => {
    async function loadFundingRates() {
      try {
        setFundingLoading(true);
        setFundingError(null);
        const rates = await fetchFundingRates(['BTC', 'ETH', 'SOL']);
        setFundingRates(rates);
      } catch (error) {
        console.error('Error loading funding rates:', error);
        setFundingError('Failed to load funding rates. Please try again later.');
        toast({
          title: 'Error',
          description: 'Failed to load funding rates.',
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'bottom-right',
        });
      } finally {
        setFundingLoading(false);
      }
    }
    loadFundingRates();
    // Refresh every 5 minutes
    const interval = setInterval(loadFundingRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Toggle exchange selection
  const toggleExchange = (exchange: Exchange) => {
    if (selectedExchanges.includes(exchange)) {
      // Don't allow deselecting all exchanges
      if (selectedExchanges.length > 1) {
        setSelectedExchanges(selectedExchanges.filter(ex => ex !== exchange));

        toast({
          title: `${exchange} removed`,
          description: `No longer monitoring ${exchange}`,
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'bottom-right',
          variant: 'subtle',
          icon: <InfoIcon />,
        });
      }
    } else {
      setSelectedExchanges([...selectedExchanges, exchange] as Exchange[]);

      toast({
        title: `${exchange} added`,
        description: `Now monitoring ${exchange}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'bottom-right',
        variant: 'subtle',
        icon: <CheckCircleIcon />,
      });
    }
  };

  // Handle connection status changes
  useEffect(() => {
    // Simulate connection process
    setConnectionStatus('connecting');

    const timer = setTimeout(() => {
      setIsLoading(false);
      setConnectionStatus('connected');

      toast({
        title: 'Connected',
        description: `Monitoring ${selectedExchanges.length} exchanges`,
        status: 'success',
        duration: 4000,
        isClosable: true,
        position: 'top',
        variant: 'subtle',
        icon: <CheckCircleIcon />,
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Initialize audio element
  useEffect(() => {
    // This would normally be a sound file
    audioRef.current = new Audio('alert-sound.mp3');
    if (audioRef.current) {
      audioRef.current.volume = alertVolume / 100;
    }
  }, []);

  // Update audio volume when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = alertVolume / 100;
    }
  }, [alertVolume]);

  // Simulated periodic data updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new liquidation events coming in
      const randomAmount = Math.floor(Math.random() * 1000000) + 10000;
      const randomSymbol = ['BTC', 'ETH', 'SOL', 'XRP'][Math.floor(Math.random() * 4)];

      if (Math.random() > 0.5) {
        handleNewLiquidation({
          amount: randomAmount,
          symbol: randomSymbol,
        });
      }
    }, 10000); // Simulate events every 10 seconds

    return () => clearInterval(interval);
  }, [soundEnabled, minLiquidationAlert]);

  // Simulate handling a new liquidation
  const handleNewLiquidation = (data: { amount: number; symbol: string }) => {
    // Update the last liquidation ref and increment the counter

    // Track largest liquidation
    if (!lastLiquidationRef.current || data.amount > lastLiquidationRef.current.amount) {
      lastLiquidationRef.current = data;
    }

    // Animate notification badge
    setAnimateNotification(true);
    setTimeout(() => setAnimateNotification(false), 2000);

    if (soundEnabled && data.amount > minLiquidationAlert) {
      // Play sound logic
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error('Audio play failed:', e));
      }

      // Show a notification for large liquidations
      toast({
        title: 'Large Liquidation!',
        description: `$${data.amount.toLocaleString()} ${data.symbol} liquidated`,
        status: 'warning',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
        icon: <WarningIcon />,
        variant: 'solid',
      });
    }
  };

  // Connection status indicator properties
  const getConnectionStatusProps = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          colorScheme: 'green',
          text: 'LIVE',
          icon: CheckCircleIcon,
          tooltip: 'Real-time data connection active',
        };
      case 'connecting':
        return {
          colorScheme: 'yellow',
          text: 'CONNECTING',
          icon: TimeIcon,
          tooltip: 'Establishing connection...',
        };
      case 'disconnected':
        return {
          colorScheme: 'red',
          text: 'OFFLINE',
          icon: InfoOutlineIcon,
          tooltip: 'Connection lost. Trying to reconnect...',
        };
    }
  };
// Helper function for arbitrage calculation
const calculateArbitrage = (rates: FundingRate[], coin: string) => {
  const coinRates = rates.filter(r => r.coin === coin);
  if (coinRates.length < 2) return null;
  const highest = coinRates.reduce((max, r) => (r.lastFundingRate > max.lastFundingRate ? r : max), coinRates[0]);
  const lowest = coinRates.reduce((min, r) => (r.lastFundingRate < min.lastFundingRate ? r : min), coinRates[0]);
  const diff = highest.lastFundingRate - lowest.lastFundingRate;
  if (Math.abs(diff) < 0.01) return null;
  return (
    <Text color={diff > 0 ? 'blue.400' : 'gray.400'} fontSize="sm">
      <Text as="span" fontWeight="medium">{diff.toFixed(4)}%</Text>
      <Text as="span" color={mutedText} ml={1}>
        ({lowest.exchange} → {highest.exchange})
      </Text>
    </Text>
  );
};
  // Apply status properties
  const statusProps = getConnectionStatusProps();

  const { stats, totalValue } = useLiquidationStore();
  const { buyCount, sellCount, largestLiquidation } = stats;

  const quickStats = useMemo(() => {
    const totalLiquidations = buyCount + sellCount;
    const buyRatio = totalLiquidations > 0 ? buyCount / totalLiquidations : 0.5;
    const sellRatio = totalLiquidations > 0 ? sellCount / totalLiquidations : 0.5;

    // Calculate position of the indicator based on the ratio
    const indicatorPosition = `${buyRatio * 100}%`;

    // Pulse animation for the active side
    const pulseKeyframes = keyframes`
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    `;

    const pulseAnimation = `${pulseKeyframes} 1.5s ease-in-out infinite`;

    return [
      {
        label: 'Liquidation Battle',
        value: totalLiquidations,
        customContent: true,
        render: (
          <Stat>
            <StatLabel color={mutedText}>Liquidation Tug of War</StatLabel>
            <StatNumber fontSize="xl" color={accentColor}>
              {totalLiquidations.toLocaleString()}
            </StatNumber>
            <Tooltip label={`Buy: ${buyCount} vs Sell: ${sellCount}`} placement="top" hasArrow>
              <Box
                position="relative"
                w="full"
                h="12px"
                mt={2}
                mb={1}
                borderRadius="md"
                overflow="hidden"
                bg={borderColor}
                cursor="help"
              >
                {/* Buy side (green) */}
                <Box
                  position="absolute"
                  h="full"
                  w={indicatorPosition}
                  bg="green.500"
                  left="0"
                  animation={buyRatio > 0.5 ? pulseAnimation : undefined}
                  borderRightRadius="md"
                />

                {/* Sell side (red) */}
                <Box
                  position="absolute"
                  h="full"
                  w={`${sellRatio * 100}%`}
                  bg="red.500"
                  right="0"
                  animation={sellRatio > 0.5 ? pulseAnimation : undefined}
                  borderLeftRadius="md"
                />

                {/* Center battle line/indicator */}
                <Box
                  position="absolute"
                  w="4px"
                  h="full"
                  bg="white"
                  top="0"
                  left={indicatorPosition}
                  transform="translateX(-50%)"
                  boxShadow="0 0 10px rgba(255,255,255,0.8)"
                  zIndex="2"
                />
              </Box>
            </Tooltip>
          </Stat>
        ),
        direction: 'increase',
      },
      {
        label: 'Largest Seen',
        customContent: true,
        render: (
          <Stat>
            <StatLabel color={mutedText}>Largest Seen</StatLabel>
            <StatNumber fontSize="xl" color={accentColor}>
              {largestLiquidation
                ? largestLiquidation.value >= 1000000
                  ? `$${(largestLiquidation.value / 1000000).toFixed(2)}M`
                  : largestLiquidation.value >= 1000
                  ? `$${(largestLiquidation.value / 1000).toFixed(2)}K`
                  : `$${largestLiquidation.value.toFixed(2)}`
                : '-'}
            </StatNumber>
            {largestLiquidation?.symbol && (
              <Text fontSize="sm" color={mutedText} mt={-1} textAlign="right" pr={2}>
                {largestLiquidation.symbol}
              </Text>
            )}
          </Stat>
        ),
        direction: 'increase',
      },
      {
        label: 'Total Value',
        value: `$${(totalValue / 1000000).toFixed(1)}M`,
        customContent: true,
        render: (
          <Stat>
            <StatLabel color={mutedText}>
              <Flex align="center">
                Total Liquidation Value
                <Tooltip
                  label={`Current total liquidation value: $${totalValue.toLocaleString()}`}
                  placement="top"
                  hasArrow
                >
                  <InfoIcon ml={1} boxSize="12px" color={mutedText} cursor="help" />
                </Tooltip>
              </Flex>
            </StatLabel>
            <StatNumber fontSize="xl" color={accentColor}>
              {totalValue >= 1000000
                ? `$${(totalValue / 1000000).toFixed(1)}M`
                : `$${(totalValue / 1000).toFixed(1)}K`}
            </StatNumber>
          </Stat>
        ),
      },
      {
        label: 'Active Exchanges',
        value: selectedExchanges.length,
        max: availableExchanges.length,
        direction: 'none',
      },
    ];
  }, [buyCount, sellCount, largestLiquidation, totalValue, selectedExchanges.length, borderColor, accentColor, mutedText]);

  return (
    <WebSocketProvider exchanges={selectedExchanges}>
      <Box bg={bgColor} minH="100vh" py={containerPadding}>
        <Container maxW="container.xl" px={containerPadding}>
          {/* Header Bar */}
          <MotionBox
            py={headerPadding}
            px={headerPadding}
            mb={6}
            bg={headerBg}
            borderRadius="lg"
            boxShadow="sm"
            borderWidth="1px"
            borderColor={borderColor}
            position="sticky"
            top={2}
            zIndex="sticky"
            _hover={{ boxShadow: 'md' }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ transition: 'all 0.3s ease' }}
            transition={{ duration: 0.5 }}
          >
            <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
              <Flex align="center">
                {/* Mobile menu button */}
                <IconButton
                  display={{ base: 'flex', md: 'none' }}
                  aria-label="Open menu"
                  fontSize="20px"
                  variant="ghost"
                  icon={showMobileMenu ? <CloseIcon /> : <HamburgerIcon />}
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  mr={2}
                />
                <Heading size={headingSize} color={accentColor}>
                  <HStack>
                    <Text>Crypto Liquidation Feed</Text>
                    <Tooltip label={statusProps.tooltip} placement="top">
                      <Tag
                        size="md"
                        colorScheme={statusProps.colorScheme}
                        borderRadius="full"
                        variant="subtle"
                        animation={animateNotification ? pulseAnimation : undefined}
                      >
                        <TagLeftIcon as={statusProps.icon} />
                        <TagLabel fontWeight="medium">{statusProps.text}</TagLabel>
                      </Tag>
                    </Tooltip>
                  </HStack>
                </Heading>
              </Flex>

              {/* Desktop Navigation */}
              <HStack spacing={4} display={{ base: 'none', md: 'flex' }}>
                <Button
                  variant={activeView === 'dashboard' ? 'solid' : 'ghost'}
                  colorScheme={themeAccent}
                  onClick={() => setActiveView('dashboard')}
                  leftIcon={<InfoIcon />}
                  size="sm"
                >
                  Dashboard
                </Button>
                <Button
                  variant={activeView === 'analytics' ? 'solid' : 'ghost'}
                  colorScheme={themeAccent}
                  onClick={() => setActiveView('analytics')}
                  leftIcon={<SearchIcon />}
                  size="sm"
                >
                  Analytics
                </Button>
              </HStack>

              <Flex align="center" gap={4} flexWrap="wrap">
                {/* Exchange selection dropdown */}
                <Menu closeOnSelect={false}>
                  <MenuButton
                    as={Button}
                    size="sm"
                    rightIcon={<ChevronDownIcon />}
                    colorScheme={themeAccent}
                    variant="outline"
                    _hover={{ bg: hoverBg }}
                    transition="all 0.2s"
                  >
                    Exchanges ({selectedExchanges.length})
                  </MenuButton>
                  <MenuList>
                    {availableExchanges.map(exchange => (
                      <MenuItem
                        key={exchange}
                        onClick={() => toggleExchange(exchange)}
                        closeOnSelect={false}
                        _hover={{ bg: hoverBg }}
                        transition="all 0.2s"
                      >
                        <Flex align="center" width="100%">
                          <Text fontWeight={selectedExchanges.includes(exchange) ? 'medium' : 'normal'}>
                            {exchange}
                          </Text>
                          <Spacer />
                          <Circle
                            size="3"
                            bg={selectedExchanges.includes(exchange) ? `${themeAccent}.500` : 'gray.300'}
                            transition="background 0.2s"
                          />
                        </Flex>
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>

                {/* Sound Toggle */}
                <FormControl display="flex" alignItems="center" width="auto">
                  <HStack spacing={2}>
                    <FormLabel htmlFor="sound-toggle" mb="0" fontSize="sm" fontWeight="medium">
                      <Tooltip label="Enable sound alerts for large liquidations" placement="top">
                        <HStack spacing={1} cursor="help">
                          <BellIcon />
                          <Text display={{ base: 'none', sm: 'block' }}>Sound</Text>
                        </HStack>
                      </Tooltip>
                    </FormLabel>
                    <Switch
                      id="sound-toggle"
                      isChecked={soundEnabled}
                      onChange={() => {
                        setSoundEnabled(!soundEnabled);
                        toast({
                          title: `Sound alerts ${!soundEnabled ? 'enabled' : 'disabled'}`,
                          status: !soundEnabled ? 'success' : 'info',
                          duration: 2000,
                          isClosable: true,
                          position: 'bottom-right',
                        });
                      }}
                      colorScheme={themeAccent}
                      size="md"
                    />
                  </HStack>
                </FormControl>

                <Divider orientation="vertical" height={6} display={{ base: 'none', md: 'block' }} />

                {/* Theme toggle */}
                <IconButton
                  aria-label="Toggle color mode"
                  icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                  onClick={toggleColorMode}
                  variant="outline"
                  colorScheme={themeAccent}
                  size="md"
                  _hover={{ bg: hoverBg }}
                  transition="all 0.2s"
                />

                {/* Settings button */}
                <IconButton
                  aria-label="Settings"
                  icon={<SettingsIcon />}
                  onClick={onSettingsDrawerOpen}
                  variant="outline"
                  colorScheme={themeAccent}
                  size="md"
                  _hover={{ bg: hoverBg }}
                  transition="all 0.2s"
                />
              </Flex>
            </Flex>

            {/* Mobile Navigation Menu */}
            <Collapse in={showMobileMenu} animateOpacity>
              <VStack spacing={2} mt={4} align="stretch">
                <Button
                  variant={activeView === 'dashboard' ? 'solid' : 'ghost'}
                  colorScheme={themeAccent}
                  onClick={() => {
                    setActiveView('dashboard');
                    setShowMobileMenu(false);
                  }}
                  justifyContent="flex-start"
                  leftIcon={<InfoIcon />}
                >
                  Dashboard
                </Button>
                <Button
                  variant={activeView === 'analytics' ? 'solid' : 'ghost'}
                  colorScheme={themeAccent}
                  onClick={() => {
                    setActiveView('analytics');
                    setShowMobileMenu(false);
                  }}
                  justifyContent="flex-start"
                  leftIcon={<SearchIcon />}
                >
                  Analytics
                </Button>
              </VStack>
            </Collapse>
          </MotionBox>

          {/* Error state with animation */}
          <Collapse in={hasError && isAlertOpen} animateOpacity>
            <Alert status="error" mb={6} borderRadius="lg" variant="left-accent">
              <AlertIcon />
              <Box flex="1">
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription>
                  We're having trouble connecting to the live feed. Data may be delayed.
                </AlertDescription>
              </Box>
              <CloseButton onClick={onAlertClose} position="absolute" right="8px" top="8px" />
  </Alert>
            </Collapse>

          {/* Dashboard View */}
          {activeView === 'dashboard' && (
            <VStack spacing={6} align="stretch">
              {/* Quick Stats Section */}
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                  {quickStats.map((stat, index) => (
                    <Box
                      key={index}
                      bg={statsCardBg}
                      p={4}
                      borderRadius="lg"
                      boxShadow="sm"
                      borderWidth="1px"
                      borderColor={borderColor}
                      transition="all 0.2s"
                      _hover={{ boxShadow: 'md', borderColor: `${themeAccent}.200` }}
                    >
                      {stat.customContent ? (
                        stat.render
                      ) : (
                        <Stat>
                          <StatLabel color={mutedText}>{stat.label}</StatLabel>
                          <StatNumber fontSize="xl" color={accentColor}>
                            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                            {'symbol' in stat && <Text as="span" fontSize="md" ml={1}>{stat.symbol as string}</Text>}
                          </StatNumber>
                          {'change' in stat && (
                            <StatHelpText>
                              <StatArrow type={stat.direction as 'increase' | 'decrease'} />
                              {stat.change as React.ReactNode}
                            </StatHelpText>
                          )}
                          {'detail' in stat && <StatHelpText>{stat.detail as React.ReactNode}</StatHelpText>}
                          {stat.max && <StatHelpText>of {stat.max} available</StatHelpText>}
                        </Stat>
                      )}
                    </Box>
                  ))}
                </SimpleGrid>
              </MotionBox>

              {/* Main Content Tabs */}
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Box
                  bg={cardBg}
                  p={5}
                  borderRadius="lg"
                  boxShadow="sm"
                  borderWidth="1px"
                  borderColor={borderColor}
                  transition="all 0.2s"
                  _hover={{ boxShadow: 'md' }}
                >
                  <Tabs position="relative" variant="unstyled" colorScheme={themeAccent}>
  <TabList>
    <Tab _selected={{ color: accentColor, fontWeight: "medium" }}>Liquidation Feed</Tab>
    <Tab _selected={{ color: accentColor, fontWeight: "medium" }}>Achievements</Tab>
    <Tab _selected={{ color: accentColor, fontWeight: "medium" }}>Funding Rates</Tab>
  </TabList>
  <TabIndicator mt="-1.5px" height="2px" bg={accentColor} borderRadius="1px" />
  <TabPanels>
    {/* Liquidation Feed Panel */}
    <TabPanel px={0} pt={4}>
      <Flex
        mb={4}
        flexDirection={{ base: 'column', md: 'row' }}
        gap={{ base: 2, md: 0 }}
        alignItems={{ base: 'flex-start', md: 'center' }}
      >
        <Text fontSize="lg" fontWeight="bold" color={accentColor}>Liquidation Events</Text>
        <Spacer />
        <HStack spacing={2} wrap="wrap">
          <Tooltip label="Data updates in real-time">
            <Badge colorScheme="green" fontSize="xs" p={1} borderRadius="md">Real-time</Badge>
          </Tooltip>
          <Tooltip label={`Monitoring: ${selectedExchanges.join(', ')}`}>
            <Badge
              colorScheme="blue"
              fontSize="xs"
              p={1}
              borderRadius="md"
              cursor="pointer"
              onClick={() => document.querySelector('.chakra-menu__menu-button')?.dispatchEvent(
                new MouseEvent('click', { bubbles: true })
              )}
            >
              {selectedExchanges.length} Exchanges
            </Badge>
          </Tooltip>
          <Tooltip label="Sound alerts for large liquidations">
            <Badge
              colorScheme={soundEnabled ? themeAccent : "gray"}
              fontSize="xs"
              p={1}
              borderRadius="md"
              cursor="pointer"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              Sound {soundEnabled ? 'ON' : 'OFF'}
            </Badge>
          </Tooltip>
        </HStack>
      </Flex>
      <Fade in={!isLoading} transition={{ enter: { duration: 0.5 } }}>
        {isLoading ? (
          <Skeleton
            height="300px"
            borderRadius="md"
            startColor={`${themeAccent}.100`}
            endColor={`${themeAccent}.500`}
          />
        ) : (
          <LiquidationTable
            soundEnabled={soundEnabled}
            onNewLiquidation={handleNewLiquidation}
          />
        )}
      </Fade>
    </TabPanel>

    {/* Achievements Panel */}
    <TabPanel px={0} pt={4}>
      <Flex align="center" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color={accentColor}>Achievements</Text>
        <Spacer />
        <Tooltip label="This feature is in beta testing">
          <Badge colorScheme="yellow" fontSize="xs" p={1} borderRadius="md">Beta</Badge>
        </Tooltip>
      </Flex>
      <Fade in={!isLoading} transition={{ enter: { duration: 0.5 } }}>
        {isLoading ? (
          <Skeleton height="150px" borderRadius="md" startColor="yellow.100" endColor="yellow.500" />
        ) : (
          <Achievements />
        )}
      </Fade>
    </TabPanel>

    {/* Funding Rates Panel */}
    <TabPanel px={0} pt={4}>
      <Flex align="center" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color={accentColor}>Funding Rates</Text>
        <Spacer />
        <HStack spacing={2} wrap="wrap">
          <Tooltip label="Funding rates from major exchanges">
            <Badge colorScheme="purple" fontSize="xs" p={1} borderRadius="md">Multi-Exchange</Badge>
          </Tooltip>
          <Tooltip label="Data refreshes every 5 minutes">
            <Badge colorScheme="teal" fontSize="xs" p={1} borderRadius="md">Auto-Refresh</Badge>
          </Tooltip>
          <Tooltip label="This feature is under active development">
            <Badge colorScheme="orange" fontSize="xs" p={1} borderRadius="md">In Development</Badge>
          </Tooltip>
        </HStack>
      </Flex>
      <Fade in={!fundingLoading} transition={{ enter: { duration: 0.5 } }}>
        {fundingError ? (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{fundingError}</AlertDescription>
            </Box>
          </Alert>
        ) : fundingLoading ? (
          <Skeleton
            height="300px"
            borderRadius="md"
            startColor={`${themeAccent}.100`}
            endColor={`${themeAccent}.500`}
          />
        ) : fundingRates.length > 0 ? (
          <Box overflowX="auto">
            <Table variant="simple" colorScheme={themeAccent}>
              <Thead>
                <Tr>
                  <Th color={accentColor}>Coin</Th>
                  <Th color={accentColor}>Exchange</Th>
                  <Th color={accentColor}>Funding Rate</Th>
                  <Th color={accentColor}>Next Funding</Th>
                  <Th color={accentColor}>Arbitrage</Th>
                </Tr>
              </Thead>
              <Tbody>
                {fundingRates.map((rate, index) => (
                  <Tr key={`${rate.symbol}-${rate.exchange}-${index}`}>
                    <Td>{rate.coin}</Td>
                    <Td>{rate.exchange}</Td>
                    <Td color={rate.lastFundingRate >= 0 ? 'green.400' : 'red.400'}>
                      {(rate.lastFundingRate >= 0 ? '+' : '') +
                        rate.lastFundingRate.toFixed(4) +
                        '%'}
                    </Td>
                    <Td>{new Date(rate.nextFundingTime).toLocaleTimeString()}</Td>
                    <Td>
                      {calculateArbitrage(fundingRates, rate.coin) || (
                        <Text color={mutedText}>-</Text>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        ) : (
          <Text color={mutedText} textAlign="center" py={8}>
            No funding rate data available
          </Text>
        )}
      </Fade>
    </TabPanel>
  </TabPanels>
</Tabs>
                </Box>
              </MotionBox>
            </VStack>
          )}

          {/* Analytics View */}
          {activeView === 'analytics' && (
            <MotionBox
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Box
                bg={cardBg}
                p={5}
                borderRadius="lg"
                boxShadow="sm"
                borderWidth="1px"
                borderColor={borderColor}
                transition="all 0.2s"
                _hover={{ boxShadow: 'md' }}
              >
                <VStack spacing={6} align="stretch">
                  <Flex align="center" justify="space-between">
                    <Heading size="md" color={accentColor}>
                      Advanced Analytics
                    </Heading>
                    <Tag colorScheme="yellow" size="sm">
                      Coming Soon
                    </Tag>
                  </Flex>

                  <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    <Box>
                      <AlertTitle mb={1}>Analytics Dashboard Under Development</AlertTitle>
                      <AlertDescription>
                        This section will include:
                        <UnorderedList mt={2}>
                          <ListItem>Historical liquidation trends</ListItem>
                          <ListItem>Exchange-wise distribution analysis</ListItem>
                          <ListItem>Price correlation insights</ListItem>
                          <ListItem>Market sentiment indicators</ListItem>
                        </UnorderedList>
                      </AlertDescription>
                    </Box>
                  </Alert>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Box
                      p={6}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      borderRadius="lg"
                      borderWidth="1px"
                      borderStyle="dashed"
                    >
                      <VStack spacing={3} align="center">
                        <Circle size="40px" bg={`${themeAccent}.100`}>
                          <TimeIcon color={accentColor} />
                        </Circle>
                        <Text fontWeight="medium">Historical Analysis</Text>
                        <Text fontSize="sm" color={mutedText} textAlign="center">
                          Temporal patterns and trend analysis of liquidation events
                        </Text>
                      </VStack>
                    </Box>

                    <Box
                      p={6}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      borderRadius="lg"
                      borderWidth="1px"
                      borderStyle="dashed"
                    >
                      <VStack spacing={3} align="center">
                        <Circle size="40px" bg={`${themeAccent}.100`}>
                          <RepeatIcon color={accentColor} />
                        </Circle>
                        <Text fontWeight="medium">Market Correlation</Text>
                        <Text fontSize="sm" color={mutedText} textAlign="center">
                          Cross-market liquidation impact analysis
                        </Text>
                      </VStack>
                    </Box>
                  </SimpleGrid>

                  <Divider />

                  <Text fontSize="sm" color={mutedText} textAlign="center">
                    Analytics features are currently in development. Check back soon for updates.
                  </Text>
                </VStack>
              </Box>
            </MotionBox>
          )}

          {/* Footer */}
          <Box
            mt={8}
            mb={4}
            textAlign="center"
            color={mutedText}
            fontSize="sm"
            p={4}
            borderTop="1px"
            borderColor={borderColor}
          >
            <HStack spacing={2} justifyContent="center" mb={2}>
              <Tooltip label="Connection status">
                <Tag size="sm" colorScheme={statusProps.colorScheme} variant="subtle">
                  <TagLeftIcon boxSize="10px" as={statusProps.icon} />
                  <TagLabel>{connectionStatus}</TagLabel>
                </Tag>
              </Tooltip>
              <Tooltip label="Active exchanges">
                <Tag size="sm" colorScheme="blue" variant="subtle">
                  <TagLabel>{selectedExchanges.join(', ')}</TagLabel>
                </Tag>
              </Tooltip>
              <Tooltip label="Sound alerts">
                <Tag size="sm" colorScheme={soundEnabled ? 'teal' : 'gray'} variant="subtle">
                  <TagLeftIcon boxSize="10px" as={BellIcon} />
                  <TagLabel>{soundEnabled ? 'On' : 'Off'}</TagLabel>
                </Tag>
              </Tooltip>
              {/* Discord Link */}
              <Tooltip label="Join our Discord community">
                <Link href="https://discord.gg/eJNykujH" isExternal>
                  <Tag size="sm" colorScheme="purple" variant="subtle" cursor="pointer">
                    <TagLeftIcon boxSize="10px" as={FaDiscord} />
                    <TagLabel>Discord</TagLabel>
                  </Tag>
                </Link>
              </Tooltip>
            </HStack>
            <Text>© {new Date().getFullYear()} Crypto Liquidation Feed</Text>
          </Box>
        </Container>
      </Box>
    </WebSocketProvider>
  );
}

export default App;