import { useMemo } from 'react';
import { useReplayStore } from '../store/replayStore';

export const useActiveFeed = () => {
  const {
    mode,
    playbackTapeLiquidations,
    playbackClusterLiquidations,
    activeMinuteVector,
  } = useReplayStore();

  return useMemo(() => {
    const usingReplay = mode !== 'LIVE' && playbackTapeLiquidations.length > 0;

    return {
      mode,
      usingReplay,
      activeMinuteVector: usingReplay ? activeMinuteVector : null,
      tapeLiquidations: usingReplay ? playbackTapeLiquidations : undefined,
      clusterLiquidations: usingReplay ? playbackClusterLiquidations : undefined,
    };
  }, [mode, playbackTapeLiquidations, playbackClusterLiquidations, activeMinuteVector]);
};
