import type {
  MinuteFeatureKey,
  MinuteFeatureVector,
  MinuteMetrics,
} from '../ml/minuteVectors';

export type Severity = 'BASELINING' | 'NORMAL' | 'ELEVATED' | 'EXTREME';
export type MarketChaosState = 'ORDERLY' | 'UNSTABLE' | 'FRACTURED' | 'VACUUM';

export interface FeatureContribution {
  key: MinuteFeatureKey;
  label: string;
  zScore: number;
  value: number;
  baseline: number;
}

export interface CascadeRuntimeState {
  riskPercent: number;
  totalValue500ms: number;
}

export interface EntropyRuntimeState {
  entropyPercent: number;
  entropyBits: number;
  sampleCount: number;
  avgGapMs: number;
  p95GapMs: number;
  burstiness: number;
  longGapShare: number;
  marketState: MarketChaosState;
}

export interface AnomalyRuntimeState {
  zScore: number;
  anomalyPercent: number;
  severity: Severity;
  currentVolume: number;
  mean: number;
  stdDev: number;
  baselineReady: boolean;
  warmupEpochs: number;
  epochsRequired: number;
  leadingSignal: string;
  currentMetrics: MinuteMetrics;
  currentFeatures: MinuteFeatureVector;
  featureContributions: FeatureContribution[];
  mlModelReady: boolean;
  mlAnomalyPercent: number;
  mlReconstructionError: number | null;
}

export interface AnalyticsRuntimeSnapshot {
  nowMs: number;
  cascade: CascadeRuntimeState;
  entropy: EntropyRuntimeState;
  anomaly: AnomalyRuntimeState;
}
