import { create } from 'zustand';
import {
  EMPTY_MINUTE_FEATURES,
  EMPTY_MINUTE_METRICS,
  type MinuteMetrics,
  type MinuteFeatureVector,
} from '../ml/minuteVectors';
import type { AnomalyRuntimeState } from '../analytics/types';

interface AnomalyState extends AnomalyRuntimeState {
  currentMetrics: MinuteMetrics;
  currentFeatures: MinuteFeatureVector;
  applySnapshot: (snapshot: AnomalyRuntimeState) => void;
}

export const useAnomalyStore = create<AnomalyState>((set) => ({
  zScore: 0,
  anomalyPercent: 0,
  severity: 'BASELINING',
  currentVolume: 0,
  mean: 0,
  stdDev: 0,
  baselineReady: false,
  warmupEpochs: 0,
  epochsRequired: 8,
  leadingSignal: 'Collecting baseline',
  currentMetrics: EMPTY_MINUTE_METRICS,
  currentFeatures: EMPTY_MINUTE_FEATURES,
  featureContributions: [],
  mlModelReady: false,
  mlAnomalyPercent: 0,
  mlReconstructionError: null,

  applySnapshot: (snapshot) => set(snapshot),
}));
