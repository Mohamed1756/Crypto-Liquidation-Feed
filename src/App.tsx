import { Container, VStack, Heading, useColorMode, IconButton, FormControl, FormLabel, Switch } from '@chakra-ui/react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';
import { Stats } from './components/Stats';
import { Achievements } from './components/Achievements';
import { LiquidationTable } from './components/LiquidationTable';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { HStack, } from '@chakra-ui/react';
import { useState } from 'react';

function App() {
  const { colorMode, toggleColorMode } = useColorMode();
  const [soundEnabled, setSoundEnabled] = useState(true); // Manage sound state here

  return (
    <WebSocketProvider>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8}>
          <HStack justify="space-between" width="100%" align="center">
            <IconButton
              aria-label="Toggle color mode"
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              onClick={toggleColorMode}
            />
            
            <FormControl display="flex" alignItems="center" height="100%">
              <FormLabel htmlFor="sound-toggle" mb="0">
                Sound
              </FormLabel>
              <Switch
                id="sound-toggle"
                isChecked={soundEnabled}
                onChange={() => setSoundEnabled(!soundEnabled)} // Toggle sound here
              />
            </FormControl>
          </HStack>

          <Heading size="xl">Binance Liquidation Feed</Heading>
          <Stats />
          <Achievements />
          <LiquidationTable soundEnabled={soundEnabled} /> {/* Pass soundEnabled as prop */}
        </VStack>
      </Container>
    </WebSocketProvider>
  );
}

export default App;