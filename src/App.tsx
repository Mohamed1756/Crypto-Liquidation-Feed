import {
  Container,
  VStack,
  Heading,
  useColorMode,
  IconButton,
  FormControl,
  FormLabel,
  Switch,
  Box,
  Flex,
  Text,
  useColorModeValue,
  Badge,
  Tooltip,
  useBreakpointValue,
  Divider,
  HStack,
  Spacer,
  Skeleton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useDisclosure,
  Collapse,
  CloseButton,
  Fade,
  Tag,
  TagLabel,
  TagLeftIcon,
  useToast
} from '@chakra-ui/react';
import { 
  SunIcon, 
  MoonIcon, 
  InfoOutlineIcon, 
  ChevronDownIcon, 
  SettingsIcon,
  BellIcon,
  CheckCircleIcon,
  TimeIcon
} from '@chakra-ui/icons';
import { Stats } from './components/Stats';
import { Achievements } from './components/Achievements';
import { LiquidationTable } from './components/LiquidationTable';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { useState, useEffect, useRef } from 'react';

function App() {
  const { colorMode, toggleColorMode } = useColorMode();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const toast = useToast();
  const { isOpen: isAlertOpen, onClose: onAlertClose, onToggle: onAlertToggle } = useDisclosure({ defaultIsOpen: hasError });
  
  type Exchange = 'BINANCE' | 'BYBIT' | 'OKX';
  const [selectedExchanges, setSelectedExchanges] = useState<Exchange[]>(['BINANCE', 'BYBIT', 'OKX']);
  const availableExchanges: Exchange[] = ['BINANCE', 'BYBIT', 'OKX'];
  
  // Dynamic color values based on color mode
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const accentColor = useColorModeValue('teal.500', 'teal.300');
  const cardBg = useColorModeValue('white', 'gray.800');
  const mutedText = useColorModeValue('gray.600', 'gray.400');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  
  // Responsive values
  const headingSize = useBreakpointValue({ base: 'md', md: 'lg' });
  const headerPadding = useBreakpointValue({ base: 3, md: 5 });
  const containerPadding = useBreakpointValue({ base: 2, md: 4 });
  const isMobile = useBreakpointValue({ base: true, md: false });

  // References
  const lastLiquidationRef = useRef<{ amount: number; symbol: string } | null>(null);

  // Toggle exchange selection
  const toggleExchange = (exchange: Exchange) => {
    if (selectedExchanges.includes(exchange)) {
      // Don't allow deselecting all exchanges
      if (selectedExchanges.length > 1) {
        setSelectedExchanges(selectedExchanges.filter(ex => ex !== exchange));
        
        // Show toast notification when exchange is removed
        toast({
          title: `${exchange} removed`,
          description: `No longer monitoring ${exchange}`,
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'bottom-right',
        });
      }
    } else {
      setSelectedExchanges([...selectedExchanges, exchange] as Exchange[]);
      
      // Show toast notification when exchange is added
      toast({
        title: `${exchange} added`,
        description: `Now monitoring ${exchange}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'bottom-right',
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
      
      // Simulate a successful connection toast
      toast({
        title: 'Connected',
        description: `Monitoring ${selectedExchanges.length} exchanges`,
        status: 'success',
        duration: 4000,
        isClosable: true,
        position: 'bottom-right',
      });
      
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  // Simulate handling a new large liquidation
  const handleNewLiquidation = (data: { amount: number; symbol: string }) => {
    lastLiquidationRef.current = data;
    
    if (soundEnabled && data.amount > 500000) {
      // Play sound logic would go here
      
      // Show a notification for large liquidations
      toast({
        title: 'Large Liquidation!',
        description: `$${data.amount.toLocaleString()} ${data.symbol} liquidated`,
        status: 'warning',
        duration: 5000,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  // Connection status indicator
  const getConnectionStatusProps = () => {
    switch (connectionStatus) {
      case 'connected':
        return { 
          colorScheme: 'green', 
          text: 'LIVE', 
          icon: CheckCircleIcon,
          tooltip: 'Real-time data connection active'
        };
      case 'connecting':
        return { 
          colorScheme: 'yellow', 
          text: 'CONNECTING', 
          icon: TimeIcon,
          tooltip: 'Establishing connection...'
        };
      case 'disconnected':
        return { 
          colorScheme: 'red', 
          text: 'OFFLINE', 
          icon: InfoOutlineIcon,
          tooltip: 'Connection lost. Trying to reconnect...'
        };
    }
  };

  const statusProps = getConnectionStatusProps();

  return (
    <WebSocketProvider 
      exchanges={selectedExchanges}
    >
      <Box bg={bgColor} minH="100vh" py={containerPadding}>
        <Container maxW="container.xl" px={containerPadding}>
          {/* Header with improved styling */}
          <Box 
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
            transition="all 0.2s ease"
            _hover={{ boxShadow: 'md' }}
          >
            <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
              <Flex align="center">
                <Heading size={headingSize} color={accentColor}>
                  <HStack>
                    <Text>Crypto Liquidation Feed</Text>
                    <Tooltip label="Real-time cryptocurrency liquidation data" fontSize="md">
                      <InfoOutlineIcon color={mutedText} boxSize={4} />
                    </Tooltip>
                  </HStack>
                </Heading>
                <Tooltip label={statusProps.tooltip} placement="top">
                  <Tag size="md" ml={3} colorScheme={statusProps.colorScheme} borderRadius="full" variant="subtle">
                    <TagLeftIcon as={statusProps.icon} />
                    <TagLabel fontWeight="medium">{statusProps.text}</TagLabel>
                  </Tag>
                </Tooltip>
              </Flex>
              
              <Flex align="center" gap={4} flexWrap="wrap">
                {/* Exchange selection dropdown */}
                <Menu closeOnSelect={false}>
                  <MenuButton 
                    as={Button} 
                    size="sm" 
                    rightIcon={<ChevronDownIcon />} 
                    colorScheme="teal" 
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
                          <Text fontWeight={selectedExchanges.includes(exchange) ? "medium" : "normal"}>
                            {exchange}
                          </Text>
                          <Spacer />
                          <Box 
                            w="3" 
                            h="3" 
                            bg={selectedExchanges.includes(exchange) ? "teal.500" : "gray.300"} 
                            borderRadius="full" 
                            transition="background 0.2s"
                          />
                        </Flex>
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>
                
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
                      colorScheme="teal"
                      size="md"
                    />
                  </HStack>
                </FormControl>
                
                <Divider orientation="vertical" height={6} display={{ base: 'none', md: 'block' }} />
                
                <IconButton
                  aria-label="Toggle color mode"
                  icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                  onClick={toggleColorMode}
                  variant="outline"
                  colorScheme="teal"
                  size="md"
                  _hover={{ bg: hoverBg }}
                  transition="all 0.2s"
                />
              </Flex>
            </Flex>
          </Box>
          
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
              <CloseButton 
                onClick={onAlertClose}
                position="absolute"
                right="8px"
                top="8px"
              />
            </Alert>
          </Collapse>

          {/* Main content with improved spacing and styling */}
          <VStack spacing={6} align="stretch">
            {/* Stats Card */}
            <Box 
              bg={cardBg}
              p={5}
              borderRadius="lg"
              boxShadow="sm"
              borderWidth="1px"
              borderColor={borderColor}
              position="relative"
              transition="all 0.2s"
              _hover={{ boxShadow: 'md', borderColor: 'teal.200' }}
            >
              <Flex align="center" mb={4}>
                <Text fontSize="lg" fontWeight="bold" color={accentColor}>Market Overview</Text>
                <Spacer />
                <Tooltip label="Data refreshes every 5 seconds">
                  <Badge colorScheme="purple" fontSize="xs" p={1} borderRadius="md">Updated every 5s</Badge>
                </Tooltip>
              </Flex>
              <Fade in={!isLoading} transition={{ enter: { duration: 0.5 } }}>
                {isLoading ? (
                  <Skeleton height="100px" borderRadius="md" startColor="teal.100" endColor="teal.500" />
                ) : (
                  <Stats />
                )}
              </Fade>
            </Box>
            
            {/* Achievements Card */}
            <Box 
              bg={cardBg}
              p={5}
              borderRadius="lg"
              boxShadow="sm"
              borderWidth="1px"
              borderColor={borderColor}
              transition="all 0.2s"
              _hover={{ boxShadow: 'md', borderColor: 'yellow.200' }}
            >
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
            </Box>
            
            {/* Liquidation Table Card */}
            <Box 
              bg={cardBg}
              p={5}
              borderRadius="lg"
              boxShadow="sm"
              borderWidth="1px"
              borderColor={borderColor}
              transition="all 0.2s"
              _hover={{ boxShadow: 'md', borderColor: 'green.200' }}
            >
              <Flex 
                align="center" 
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
                      colorScheme={soundEnabled ? "teal" : "gray"} 
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
                  <Skeleton height="300px" borderRadius="md" startColor="green.100" endColor="green.500" />
                ) : (
                  <LiquidationTable 
                    soundEnabled={soundEnabled} 
                    onNewLiquidation={handleNewLiquidation}
                  />
                )}
              </Fade>
            </Box>
          </VStack>

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
                <Tag size="sm" colorScheme={soundEnabled ? "teal" : "gray"} variant="subtle">
                  <TagLeftIcon boxSize="10px" as={BellIcon} />
                  <TagLabel>{soundEnabled ? 'On' : 'Off'}</TagLabel>
                </Tag>
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