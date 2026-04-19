import React, { useRef } from 'react';
import {
  Button,
  Divider,
  HStack,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text,
  VStack,
} from '@chakra-ui/react';
import { InlineHelp } from './InlineHelp';
import { useReplayStore } from '../store/replayStore';

const formatCount = (value: number) => {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${value}`;
};

export const ReplayDatasetMenu: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    captureEnabled,
    events,
    minuteVectors,
    toggleCapture,
    clearDataset,
    exportDataset,
    importDataset,
  } = useReplayStore();

  const handleExport = () => {
    const dataset = exportDataset();
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `liquidation-replay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const result = importDataset(JSON.parse(rawText));
      if (!result.ok) {
        window.alert(result.message);
      }
    } catch {
      window.alert('Failed to import dataset. Make sure the file is valid JSON.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <HStack spacing={1}>
      <Menu>
        <MenuButton
          as={Button}
          size="xs"
          variant="solid"
          bg={captureEnabled ? 'brand.mutedGreen' : 'brand.ink'}
          color="brand.paper"
          borderRadius="0"
          fontSize="10px"
          fontWeight="900"
          fontFamily="mono"
          px={3}
          _hover={{ bg: captureEnabled ? 'brand.mutedGreen' : 'brand.mutedInk' }}
        >
          REPLAY DATASET [{formatCount(events.length)}]
        </MenuButton>
        <MenuList borderRadius="0" bg="brand.paper" borderColor="brand.ink" borderWidth="2px" boxShadow="none" p={0} minW="280px">
          <VStack align="stretch" spacing={0} p={3}>
            <Text fontSize="9px" fontWeight="900" color="brand.ink" fontFamily="mono" letterSpacing="0.08em">
              REPLAY DATASET
            </Text>
            <Text fontSize="9px" color="brand.mutedInk" fontFamily="mono">
              Capture: {captureEnabled ? 'ON' : 'OFF'}
            </Text>
            <Text fontSize="9px" color="brand.mutedInk" fontFamily="mono">
              Events: {events.length}
            </Text>
            <Text fontSize="9px" color="brand.mutedInk" fontFamily="mono">
              Minutes: {minuteVectors.length}
            </Text>
          </VStack>
          <Divider />
          <MenuItem onClick={toggleCapture} fontSize="10px" fontFamily="mono" _hover={{ bg: 'brand.ink', color: 'brand.paper' }}>
            {captureEnabled ? 'STOP LIVE CAPTURE' : 'START LIVE CAPTURE'}
          </MenuItem>
          <MenuItem onClick={handleExport} isDisabled={events.length === 0} fontSize="10px" fontFamily="mono" _hover={{ bg: 'brand.ink', color: 'brand.paper' }}>
            EXPORT DATASET JSON
          </MenuItem>
          <MenuItem onClick={() => fileInputRef.current?.click()} fontSize="10px" fontFamily="mono" _hover={{ bg: 'brand.ink', color: 'brand.paper' }}>
            IMPORT DATASET JSON
          </MenuItem>
          <MenuItem onClick={clearDataset} isDisabled={events.length === 0} fontSize="10px" fontFamily="mono" _hover={{ bg: 'brand.ink', color: 'brand.paper' }}>
            CLEAR REPLAY DATA
          </MenuItem>
        </MenuList>
      </Menu>
      <InlineHelp
        title="REPLAY DATASET"
        body="Capture live liquidations into a portable dataset, export it, and load it back later for replay or training. For larger archives, the next step would be IndexedDB instead of in-memory buffers."
        placement="bottom"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleImport}
        style={{ display: 'none' }}
      />
    </HStack>
  );
};