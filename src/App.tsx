import { Container, VStack, Heading, useColorMode, IconButton } from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';
import { Stats } from './components/Stats';
import { Achievements } from './components/Achievements';
import { LiquidationTable } from './components/LiquidationTable';
import { WebSocketProvider } from './providers/WebSocketProvider';

function App() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <WebSocketProvider>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8}>
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            alignSelf="flex-end"
          />
          
          <Heading size="xl">Binance Liquidation Feed</Heading>
          <Stats />
          <Achievements />
          <LiquidationTable />
        </VStack>
      </Container>
    </WebSocketProvider>
  );
}

export default App;