import { create } from 'zustand';
import type { EntropyRuntimeState } from '../analytics/types';

interface EntropyState extends EntropyRuntimeState {
  applySnapshot: (snapshot: EntropyRuntimeState) => void;
}

const EMPTY_STATE: EntropyRuntimeState = {
  entropyPercent: 0,
  entropyBits: 0,
  sampleCount: 0,
  avgGapMs: 0,
  p95GapMs: 0,
  burstiness: 0,
  longGapShare: 0,
  marketState: 'ORDERLY',
};

export const useEntropyStore = create<EntropyState>((set) => ({
  ...EMPTY_STATE,
  applySnapshot: (snapshot) => set(snapshot),
}));
