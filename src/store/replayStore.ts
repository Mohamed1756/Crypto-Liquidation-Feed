import { create } from 'zustand';
import type { Liquidation } from '../types/liquidation';
import {
  buildReplayDataset,
  isReplayDataset,
  liquidationToReplayEvent,
  replayEventToLiquidation,
  type ReplayDataset,
} from '../ml/replayDataset';
import type { MinuteVectorEvent, MinuteVectorRow } from '../ml/minuteVectors';

const MAX_CAPTURED_EVENTS = 10_000;
const PLAYBACK_TAPE_WINDOW_MS = 120_000;
const PLAYBACK_CLUSTER_WINDOW_MS = 600_000;

type ReplayMode = 'LIVE' | 'REPLAY' | 'COMPARE';

const clampIndex = (index: number, minuteVectors: MinuteVectorRow[]) => {
  if (minuteVectors.length === 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), minuteVectors.length - 1);
};

const buildPlaybackSlices = (
  events: MinuteVectorEvent[],
  minuteVectors: MinuteVectorRow[],
  playbackIndex: number,
) => {
  if (minuteVectors.length === 0) {
    return {
      playbackIndex: 0,
      activeMinuteVector: null,
      playbackTapeLiquidations: [] as Liquidation[],
      playbackClusterLiquidations: [] as Liquidation[],
    };
  }

  const nextIndex = clampIndex(playbackIndex, minuteVectors);
  const activeMinuteVector = minuteVectors[nextIndex];
  const tapeStart = activeMinuteVector.endedAt - PLAYBACK_TAPE_WINDOW_MS + 1;
  const clusterStart = activeMinuteVector.endedAt - PLAYBACK_CLUSTER_WINDOW_MS + 1;

  const toLiquidations = (startAt: number) => events
    .filter((event) => event.timestampMs >= startAt && event.timestampMs <= activeMinuteVector.endedAt)
    .map(replayEventToLiquidation)
    .sort((left, right) => right.timestamp.toMillis() - left.timestamp.toMillis());

  return {
    playbackIndex: nextIndex,
    activeMinuteVector,
    playbackTapeLiquidations: toLiquidations(tapeStart),
    playbackClusterLiquidations: toLiquidations(clusterStart),
  };
};

interface ReplayState {
  captureEnabled: boolean;
  events: MinuteVectorEvent[];
  minuteVectors: MinuteVectorRow[];
  mode: ReplayMode;
  isPlaying: boolean;
  speed: number;
  playbackIndex: number;
  activeMinuteVector: MinuteVectorRow | null;
  playbackTapeLiquidations: Liquidation[];
  playbackClusterLiquidations: Liquidation[];
  toggleCapture: () => void;
  ingestLiquidations: (liqs: Liquidation[]) => void;
  clearDataset: () => void;
  exportDataset: () => ReplayDataset;
  importDataset: (dataset: unknown) => { ok: boolean; message: string };
  setMode: (mode: ReplayMode) => void;
  play: () => void;
  pause: () => void;
  resetPlayback: () => void;
  stepPlayback: (delta: number) => void;
  seekToMinute: (index: number) => void;
  setSpeed: (speed: number) => void;
}

export const useReplayStore = create<ReplayState>((set, get) => ({
  captureEnabled: false,
  events: [],
  minuteVectors: [],
  mode: 'LIVE',
  isPlaying: false,
  speed: 1,
  playbackIndex: 0,
  activeMinuteVector: null,
  playbackTapeLiquidations: [],
  playbackClusterLiquidations: [],

  toggleCapture: () => set((state) => ({ captureEnabled: !state.captureEnabled })),

  ingestLiquidations: (liqs) => set((state) => {
    if (!state.captureEnabled || liqs.length === 0) {
      return state;
    }

    const nextEvents = [
      ...state.events,
      ...liqs.map(liquidationToReplayEvent),
    ].slice(-MAX_CAPTURED_EVENTS);
    const dataset = buildReplayDataset(nextEvents, 'live-browser-capture', {
      captureEnabled: true,
    });

    const nextPlayback = buildPlaybackSlices(
      dataset.events,
      dataset.minuteVectors,
      state.mode === 'LIVE' ? dataset.minuteVectors.length - 1 : state.playbackIndex,
    );

    return {
      events: dataset.events,
      minuteVectors: dataset.minuteVectors,
      ...nextPlayback,
    };
  }),

  clearDataset: () => set({
    events: [],
    minuteVectors: [],
    mode: 'LIVE',
    isPlaying: false,
    playbackIndex: 0,
    activeMinuteVector: null,
    playbackTapeLiquidations: [],
    playbackClusterLiquidations: [],
  }),

  exportDataset: () => {
    const state = get();
    return buildReplayDataset(state.events, 'live-browser-capture', {
      captureEnabled: state.captureEnabled,
    });
  },

  importDataset: (dataset) => {
    if (!isReplayDataset(dataset)) {
      return {
        ok: false,
        message: 'Invalid replay dataset schema.',
      };
    }

    const normalizedDataset = buildReplayDataset(
      dataset.events.slice(-MAX_CAPTURED_EVENTS),
      dataset.source,
      dataset.metadata,
    );
    const playback = buildPlaybackSlices(normalizedDataset.events, normalizedDataset.minuteVectors, 0);

    set({
      captureEnabled: false,
      events: normalizedDataset.events,
      minuteVectors: normalizedDataset.minuteVectors,
      mode: 'REPLAY',
      isPlaying: false,
      ...playback,
    });

    return {
      ok: true,
      message: `Imported ${normalizedDataset.eventCount} events across ${normalizedDataset.minuteCount} minutes.`,
    };
  },

  setMode: (mode) => set((state) => {
    if (mode === 'LIVE') {
      return {
        mode,
        isPlaying: false,
      };
    }

    if (state.minuteVectors.length === 0) {
      return state;
    }

    return {
      mode,
      isPlaying: false,
      ...buildPlaybackSlices(state.events, state.minuteVectors, state.playbackIndex),
    };
  }),

  play: () => set((state) => {
    if (state.minuteVectors.length === 0) {
      return state;
    }

    return {
      mode: state.mode === 'LIVE' ? 'REPLAY' : state.mode,
      isPlaying: true,
    };
  }),

  pause: () => set({ isPlaying: false }),

  resetPlayback: () => set((state) => ({
    isPlaying: false,
    ...buildPlaybackSlices(state.events, state.minuteVectors, 0),
  })),

  stepPlayback: (delta) => set((state) => {
    if (state.minuteVectors.length === 0) {
      return state;
    }

    const nextIndex = clampIndex(state.playbackIndex + delta, state.minuteVectors);
    const atEnd = nextIndex === state.minuteVectors.length - 1;

    return {
      isPlaying: atEnd && delta > 0 ? false : state.isPlaying,
      ...buildPlaybackSlices(state.events, state.minuteVectors, nextIndex),
    };
  }),

  seekToMinute: (index) => set((state) => ({
    ...buildPlaybackSlices(state.events, state.minuteVectors, index),
  })),

  setSpeed: (speed) => set({ speed }),
}));