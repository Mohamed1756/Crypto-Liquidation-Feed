import React, { useEffect, useMemo } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { InlineHelp } from './InlineHelp';
import { useReplayStore } from '../store/replayStore';
import { useAnomalyStore } from '../store/anomalyStore';
import { compareMinuteFeatureVectors } from '../ml/minuteVectors';

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8] as const;

const formatValue = (value: number) => {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${Math.round(value)}`;
};

const labelizeFeature = (label: string) => label.replace(/([A-Z])/g, ' $1').trim();

export const ReplayModePanel: React.FC = () => {
  const {
    mode,
    minuteVectors,
    events,
    playbackIndex,
    activeMinuteVector,
    isPlaying,
    speed,
    setMode,
    play,
    pause,
    resetPlayback,
    stepPlayback,
    seekToMinute,
    setSpeed,
  } = useReplayStore();
  const liveFeatures = useAnomalyStore((state) => state.currentFeatures);
  const liveAnomalyPercent = useAnomalyStore((state) => state.anomalyPercent);
  const liveLeadingSignal = useAnomalyStore((state) => state.leadingSignal);

  useEffect(() => {
    if ((mode === 'LIVE' || !isPlaying) || minuteVectors.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      stepPlayback(1);
    }, Math.max(180, Math.round(700 / speed)));

    return () => window.clearInterval(timer);
  }, [mode, isPlaying, minuteVectors.length, speed, stepPlayback]);

  const comparison = useMemo(() => {
    if (!activeMinuteVector) {
      return null;
    }

    return compareMinuteFeatureVectors(liveFeatures, activeMinuteVector.features);
  }, [activeMinuteVector, liveFeatures]);

  const datasetReady = minuteVectors.length > 0;
  const canReplay = datasetReady;

  return (
    <Box border="1px solid" borderColor="brand.border" py={2} px={3} bg="brand.paper">
      <Flex justify="space-between" align={{ base: 'start', lg: 'center' }} gap={4} direction={{ base: 'column', lg: 'row' }}>
        <VStack align="start" spacing={1} minW={{ lg: '220px' }}>
          <HStack spacing={1}>
            <Text fontSize="10px" fontWeight="900" color="brand.ink" letterSpacing="0.08em">
              REPLAY
            </Text>
            <InlineHelp
              title="REPLAY"
              body="Use a saved dataset to step through past liquidations, change speed, and compare the current replay minute with the live market."
              placement="right"
            />
          </HStack>
          <Text fontSize="9px" color="brand.mutedInk" fontFamily="mono">
            Loaded: {events.length} events / {minuteVectors.length} minutes
          </Text>
          <HStack spacing={2} pt={1}>
            {(['LIVE', 'REPLAY', 'COMPARE'] as const).map((nextMode) => (
              <Button
                key={nextMode}
                size="xs"
                onClick={() => setMode(nextMode)}
                isDisabled={nextMode !== 'LIVE' && !canReplay}
                bg={mode === nextMode ? 'brand.ink' : 'transparent'}
                color={mode === nextMode ? 'brand.paper' : 'brand.ink'}
                borderWidth="2px"
                borderColor="brand.ink"
                _hover={{ bg: 'brand.ink', color: 'brand.paper' }}
              >
                {nextMode}
              </Button>
            ))}
          </HStack>
        </VStack>

        <Box flex="1" w="100%">
          {!datasetReady ? (
            <Flex justify="space-between" align="center" gap={4}>
              <Text fontSize="10px" fontFamily="mono" color="brand.mutedInk">
                Import a replay dataset to use playback and comparison.
              </Text>
              <Badge variant="premium">NO DATASET</Badge>
            </Flex>
          ) : (
            <VStack align="stretch" spacing={3}>
              <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
                <HStack spacing={2}>
                  <Button size="xs" onClick={isPlaying ? pause : play} bg="brand.ink" color="brand.paper" _hover={{ bg: 'brand.mutedInk' }}>
                    <HStack spacing={1}>
                      {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                      <Text>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
                    </HStack>
                  </Button>
                  <Button size="xs" variant="outline" borderWidth="2px" borderColor="brand.ink" onClick={resetPlayback}>
                    <HStack spacing={1}>
                      <SkipBack size={12} />
                      <Text>RESET</Text>
                    </HStack>
                  </Button>
                  <Button size="xs" variant="outline" borderWidth="2px" borderColor="brand.ink" onClick={() => stepPlayback(-1)}>
                    BACK
                  </Button>
                  <Button size="xs" variant="outline" borderWidth="2px" borderColor="brand.ink" onClick={() => stepPlayback(1)}>
                    <HStack spacing={1}>
                      <Text>NEXT</Text>
                      <SkipForward size={12} />
                    </HStack>
                  </Button>
                </HStack>

                <HStack spacing={2} flexWrap="wrap">
                  {SPEED_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      size="xs"
                      onClick={() => setSpeed(option)}
                      variant="outline"
                      borderWidth="2px"
                      borderColor={speed === option ? 'brand.ink' : 'brand.border'}
                      bg={speed === option ? 'brand.ink' : 'transparent'}
                      color={speed === option ? 'brand.paper' : 'brand.ink'}
                      _hover={{ bg: 'brand.ink', color: 'brand.paper' }}
                    >
                      {option}X
                    </Button>
                  ))}
                </HStack>
              </Flex>

              <VStack align="stretch" spacing={1}>
                <Slider
                  value={playbackIndex}
                  min={0}
                  max={Math.max(0, minuteVectors.length - 1)}
                  step={1}
                  onChange={seekToMinute}
                  focusThumbOnChange={false}
                >
                  <SliderTrack bg="brand.border">
                    <SliderFilledTrack bg="brand.ink" />
                  </SliderTrack>
                  <SliderThumb boxSize={3} bg="brand.ink" />
                </Slider>
                <Flex justify="space-between" fontSize="9px" fontFamily="mono" color="brand.mutedInk">
                  <Text>Minute {Math.min(playbackIndex + 1, minuteVectors.length)} / {minuteVectors.length}</Text>
                  <Text>{activeMinuteVector?.isoTimestamp || 'No active replay minute'}</Text>
                </Flex>
              </VStack>

              <Divider />

              <Flex gap={4} direction={{ base: 'column', xl: 'row' }}>
                <Box flex="1" minW={0}>
                  <Text fontSize="9px" fontWeight="900" fontFamily="mono" color="brand.ink" mb={2}>
                    CURRENT MINUTE
                  </Text>
                  {activeMinuteVector ? (
                    <HStack spacing={4} align="start" flexWrap="wrap">
                      <VStack align="start" spacing={0} minW="110px">
                        <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">TOTAL VALUE</Text>
                        <Text fontSize="14px" fontWeight="900">{formatValue(activeMinuteVector.totalValue)}</Text>
                      </VStack>
                      <VStack align="start" spacing={0} minW="100px">
                        <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">EVENTS</Text>
                        <Text fontSize="14px" fontWeight="900">{activeMinuteVector.metrics.eventCount}</Text>
                      </VStack>
                      <VStack align="start" spacing={0} minW="100px">
                        <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">AVG SIZE</Text>
                        <Text fontSize="14px" fontWeight="900">{formatValue(activeMinuteVector.metrics.averageSize)}</Text>
                      </VStack>
                      <VStack align="start" spacing={0} minW="100px">
                        <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">WHALE SHARE</Text>
                        <Text fontSize="14px" fontWeight="900">{Math.round(activeMinuteVector.features.whaleShare * 100)}%</Text>
                      </VStack>
                    </HStack>
                  ) : (
                    <Text fontSize="10px" color="brand.mutedInk" fontFamily="mono">Move through the dataset to inspect a replay minute.</Text>
                  )}
                </Box>

                <Box flex="1" minW={0} borderLeft={{ xl: '1px solid' }} borderColor="brand.border" pl={{ xl: 4 }}>
                  <Text fontSize="9px" fontWeight="900" fontFamily="mono" color="brand.ink" mb={2}>
                    LIVE COMPARISON
                  </Text>
                  {comparison && activeMinuteVector ? (
                    <VStack align="stretch" spacing={2}>
                      <HStack spacing={4} flexWrap="wrap">
                        <VStack align="start" spacing={0} minW="90px">
                          <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">ALIGNMENT</Text>
                          <Text fontSize="16px" fontWeight="900">{comparison.similarityPercent}%</Text>
                        </VStack>
                        <VStack align="start" spacing={0} minW="110px">
                          <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">LIVE ANOMALY</Text>
                          <Text fontSize="16px" fontWeight="900">{liveAnomalyPercent}%</Text>
                        </VStack>
                        <VStack align="start" spacing={0} minW="130px">
                          <Text fontSize="8px" color="brand.mutedInk" fontFamily="mono">LIVE LEADING</Text>
                          <Text fontSize="12px" fontWeight="900">{liveLeadingSignal.toUpperCase()}</Text>
                        </VStack>
                      </HStack>
                      <VStack align="stretch" spacing={1} pt={1}>
                        {comparison.deltas.slice(0, 3).map((delta) => (
                          <Flex key={delta.key} justify="space-between" fontSize="9px" fontFamily="mono">
                            <Text color="brand.ink">{labelizeFeature(delta.label)}</Text>
                            <Text color="brand.mutedInk">{delta.replay.toFixed(3)} vs {delta.live.toFixed(3)}</Text>
                          </Flex>
                        ))}
                      </VStack>
                    </VStack>
                  ) : (
                    <Text fontSize="10px" color="brand.mutedInk" fontFamily="mono">
                      Compare mode shows how close the current replay minute is to the live market.
                    </Text>
                  )}
                </Box>
              </Flex>
            </VStack>
          )}
        </Box>
      </Flex>
    </Box>
  );
};