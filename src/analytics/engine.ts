import {
  EMPTY_MINUTE_FEATURES,
  EMPTY_MINUTE_METRICS,
  EPOCH_MS,
  accumulateMinuteEvents,
  buildMinuteSnapshot,
  computeMeanStd,
  createMinuteAccumulator,
  roundMetric,
  type MinuteAccumulator,
  type MinuteFeatureKey,
  type MinuteSnapshot,
  type MinuteVectorEvent,
} from '../ml/minuteVectors';
import type {
  AnalyticsRuntimeSnapshot,
  AnomalyRuntimeState,
  CascadeRuntimeState,
  EntropyRuntimeState,
  FeatureContribution,
  MarketChaosState,
  Severity,
} from './types';

const AVALANCHE_THRESHOLD = 2_000_000;
const CASCADE_WINDOW_MS = 500;
const MAX_EPOCHS = 60;
const MIN_BASELINE_EPOCHS = 8;

const ENTROPY_WINDOW_MS = 180_000;
const MIN_GAPS = 12;
const MAX_TIMESTAMPS = 512;
const LONG_GAP_MS = 300;
const DELTA_BINS = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
const MAX_ENTROPY = Math.log2(DELTA_BINS.length + 1);

const FEATURE_DEFS: Record<MinuteFeatureKey, { label: string; weight: number; minStdDev: number }> = {
  volumePaceLog: { label: 'Volume pace', weight: 1.4, minStdDev: 0.18 },
  eventPaceLog: { label: 'Tape density', weight: 1.1, minStdDev: 0.15 },
  averageSizeLog: { label: 'Average size', weight: 0.95, minStdDev: 0.14 },
  largestShare: { label: 'Top print', weight: 0.9, minStdDev: 0.025 },
  sideImbalance: { label: 'Side skew', weight: 0.8, minStdDev: 0.03 },
  exchangeConcentration: { label: 'Exchange focus', weight: 0.7, minStdDev: 0.03 },
  symbolConcentration: { label: 'Symbol focus', weight: 0.9, minStdDev: 0.03 },
  sizeDispersion: { label: 'Size spread', weight: 0.75, minStdDev: 0.05 },
  whaleShare: { label: 'Whale share', weight: 1.0, minStdDev: 0.03 },
};

interface CascadeEvent {
  value: number;
  timeMillis: number;
}

type AutoencoderModule = typeof import('../ml/autoencoder');

const EMPTY_CASCADE: CascadeRuntimeState = {
  riskPercent: 0,
  totalValue500ms: 0,
};

const EMPTY_ENTROPY: EntropyRuntimeState = {
  entropyPercent: 0,
  entropyBits: 0,
  sampleCount: 0,
  avgGapMs: 0,
  p95GapMs: 0,
  burstiness: 0,
  longGapShare: 0,
  marketState: 'ORDERLY',
};

const EMPTY_ANOMALY: AnomalyRuntimeState = {
  zScore: 0,
  anomalyPercent: 0,
  severity: 'BASELINING',
  currentVolume: 0,
  mean: 0,
  stdDev: 0,
  baselineReady: false,
  warmupEpochs: 0,
  epochsRequired: MIN_BASELINE_EPOCHS,
  leadingSignal: 'Collecting baseline',
  currentMetrics: EMPTY_MINUTE_METRICS,
  currentFeatures: EMPTY_MINUTE_FEATURES,
  featureContributions: [],
  mlModelReady: false,
  mlAnomalyPercent: 0,
  mlReconstructionError: null,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number, digits = 2) => {
  const precision = Math.pow(10, digits);
  return Math.round(value * precision) / precision;
};

const getPercentile = (sortedValues: number[], percentile: number) => {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((percentile / 100) * (sortedValues.length - 1))),
  );

  return sortedValues[index];
};

const getMarketState = (entropyPercent: number): MarketChaosState => {
  if (entropyPercent >= 80) {
    return 'VACUUM';
  }
  if (entropyPercent >= 60) {
    return 'FRACTURED';
  }
  if (entropyPercent >= 35) {
    return 'UNSTABLE';
  }
  return 'ORDERLY';
};

const roundMetrics = (metrics: AnomalyRuntimeState['currentMetrics']) => ({
  ...metrics,
  volumePace: roundMetric(metrics.volumePace),
  eventPace: roundMetric(metrics.eventPace),
  averageSize: roundMetric(metrics.averageSize),
  largestEvent: roundMetric(metrics.largestEvent),
  sideImbalance: roundMetric(metrics.sideImbalance),
  exchangeSpread: roundMetric(metrics.exchangeSpread),
  symbolSpread: roundMetric(metrics.symbolSpread),
  sizeDispersion: roundMetric(metrics.sizeDispersion),
});

const getAnomalyPercent = (zScore: number, baselineReady: boolean) => {
  if (!baselineReady) {
    return 0;
  }
  return Math.min(100, Math.round((Math.min(zScore, 4.5) / 4.5) * 100));
};

const getSeverity = (zScore: number, baselineReady: boolean, detectorPercent: number): Severity => {
  if (!baselineReady) {
    return 'BASELINING';
  }
  if (zScore >= 3.25 || detectorPercent >= 85) {
    return 'EXTREME';
  }
  if (zScore >= 1.75 || detectorPercent >= 50) {
    return 'ELEVATED';
  }
  return 'NORMAL';
};

const buildEntropyState = (timestamps: number[]): EntropyRuntimeState => {
  if (timestamps.length < 2) {
    return EMPTY_ENTROPY;
  }

  const gaps: number[] = [];

  for (let index = 1; index < timestamps.length; index += 1) {
    const delta = timestamps[index] - timestamps[index - 1];
    if (delta < 0) {
      continue;
    }
    gaps.push(Math.max(1, delta));
  }

  if (gaps.length < MIN_GAPS) {
    return {
      ...EMPTY_ENTROPY,
      sampleCount: gaps.length,
    };
  }

  const counts = new Array(DELTA_BINS.length + 1).fill(0);
  let totalGap = 0;

  for (const gap of gaps) {
    totalGap += gap;

    let bucketIndex = counts.length - 1;
    for (let binIndex = 0; binIndex < DELTA_BINS.length; binIndex += 1) {
      if (gap < DELTA_BINS[binIndex]) {
        bucketIndex = binIndex;
        break;
      }
    }
    counts[bucketIndex] += 1;
  }

  const meanGap = totalGap / gaps.length;
  const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - meanGap, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);
  const burstiness = stdDev + meanGap === 0 ? 0 : clamp((stdDev - meanGap) / (stdDev + meanGap), 0, 1);
  const longGapShare = gaps.filter((gap) => gap >= LONG_GAP_MS).length / gaps.length;
  const sortedGaps = [...gaps].sort((left, right) => left - right);
  const p95GapMs = getPercentile(sortedGaps, 95);

  let entropyBits = 0;
  for (const count of counts) {
    if (count === 0) {
      continue;
    }
    const probability = count / gaps.length;
    entropyBits -= probability * Math.log2(probability);
  }

  const normalizedEntropy = clamp(entropyBits / MAX_ENTROPY, 0, 1);
  const tailPressure = clamp((p95GapMs / 900) * 0.5 + longGapShare * 0.5, 0, 1);
  const entropyPercent = Math.round(
    clamp(
      normalizedEntropy * 0.55 + burstiness * 0.25 + tailPressure * 0.2,
      0,
      1,
    ) * 100,
  );

  return {
    entropyPercent,
    entropyBits: round(entropyBits),
    sampleCount: gaps.length,
    avgGapMs: round(meanGap),
    p95GapMs: round(p95GapMs),
    burstiness: round(burstiness),
    longGapShare: round(longGapShare),
    marketState: getMarketState(entropyPercent),
  };
};

export const createAnalyticsEngine = () => {
  let recentCascadeEvents: CascadeEvent[] = [];
  let entropyTimestamps: number[] = [];
  let currentEpoch: MinuteAccumulator = createMinuteAccumulator();
  let historicalEpochs: MinuteSnapshot[] = [];
  let autoencoderModule: AutoencoderModule | null = null;
  let snapshot: AnalyticsRuntimeSnapshot = {
    nowMs: Date.now(),
    cascade: EMPTY_CASCADE,
    entropy: EMPTY_ENTROPY,
    anomaly: EMPTY_ANOMALY,
  };

  const deriveCascade = (nowMs: number): CascadeRuntimeState => {
    const cutoff = nowMs - CASCADE_WINDOW_MS;
    recentCascadeEvents = recentCascadeEvents.filter((event) => event.timeMillis > cutoff);
    const totalValue500ms = recentCascadeEvents.reduce((sum, event) => sum + event.value, 0);
    const riskPercent = Math.min(100, Math.round((totalValue500ms / AVALANCHE_THRESHOLD) * 100));

    return {
      riskPercent,
      totalValue500ms,
    };
  };

  const deriveEntropy = (nowMs: number): EntropyRuntimeState => {
    const cutoff = nowMs - ENTROPY_WINDOW_MS;
    entropyTimestamps = entropyTimestamps.filter((timestamp) => timestamp >= cutoff);
    if (entropyTimestamps.length > MAX_TIMESTAMPS) {
      entropyTimestamps = entropyTimestamps.slice(entropyTimestamps.length - MAX_TIMESTAMPS);
    }
    return buildEntropyState(entropyTimestamps);
  };

  const deriveAnomaly = (nowMs: number): AnomalyRuntimeState => {
    const currentSnapshot = buildMinuteSnapshot(currentEpoch, { nowMs });
    const volumeStats = computeMeanStd(historicalEpochs.map((epoch) => epoch.totalValue));
    const baselineReady = historicalEpochs.length >= MIN_BASELINE_EPOCHS;
    const mlScore = autoencoderModule?.scoreMinuteFeatureVector(currentSnapshot.features) || null;
    const mlModelReady = mlScore !== null;

    if (!baselineReady) {
      return {
        zScore: 0,
        anomalyPercent: mlScore?.anomalyPercent || 0,
        severity: 'BASELINING',
        currentVolume: currentSnapshot.totalValue,
        mean: volumeStats.mean,
        stdDev: volumeStats.stdDev,
        baselineReady,
        warmupEpochs: historicalEpochs.length,
        epochsRequired: MIN_BASELINE_EPOCHS,
        leadingSignal: historicalEpochs.length === 0 ? 'Collecting baseline' : 'Calibrating flow baseline',
        currentMetrics: roundMetrics(currentSnapshot.metrics),
        currentFeatures: currentSnapshot.features,
        featureContributions: [],
        mlModelReady,
        mlAnomalyPercent: mlScore?.anomalyPercent || 0,
        mlReconstructionError: mlScore?.reconstructionError ?? null,
      };
    }

    const featureContributions: FeatureContribution[] = [];
    let weightedScore = 0;
    let totalWeight = 0;

    (Object.keys(FEATURE_DEFS) as MinuteFeatureKey[]).forEach((featureKey) => {
      const featureHistory = historicalEpochs.map((epoch) => epoch.features[featureKey]);
      const { mean, stdDev } = computeMeanStd(featureHistory);
      const effectiveStdDev = Math.max(stdDev, FEATURE_DEFS[featureKey].minStdDev);
      const rawZScore = (currentSnapshot.features[featureKey] - mean) / effectiveStdDev;
      const zScore = Math.max(0, rawZScore);

      featureContributions.push({
        key: featureKey,
        label: FEATURE_DEFS[featureKey].label,
        zScore: roundMetric(zScore),
        value: roundMetric(currentSnapshot.features[featureKey]),
        baseline: roundMetric(mean),
      });

      weightedScore += FEATURE_DEFS[featureKey].weight * zScore * zScore;
      totalWeight += FEATURE_DEFS[featureKey].weight;
    });

    featureContributions.sort((left, right) => right.zScore - left.zScore);

    const zScore = totalWeight === 0 ? 0 : Math.sqrt(weightedScore / totalWeight);
    const roundedZScore = roundMetric(zScore, 2);
    const statAnomalyPercent = getAnomalyPercent(roundedZScore, baselineReady);
    const anomalyPercent = Math.max(statAnomalyPercent, mlScore?.anomalyPercent || 0);
    const leadingSignal = featureContributions[0]?.zScore > 0.5
      ? featureContributions[0].label
      : 'Inside baseline';

    return {
      zScore: roundedZScore,
      anomalyPercent,
      severity: getSeverity(roundedZScore, baselineReady, anomalyPercent),
      currentVolume: currentSnapshot.totalValue,
      mean: volumeStats.mean,
      stdDev: volumeStats.stdDev,
      baselineReady,
      warmupEpochs: historicalEpochs.length,
      epochsRequired: MIN_BASELINE_EPOCHS,
      leadingSignal,
      currentMetrics: roundMetrics(currentSnapshot.metrics),
      currentFeatures: currentSnapshot.features,
      featureContributions: featureContributions.slice(0, 3),
      mlModelReady,
      mlAnomalyPercent: mlScore?.anomalyPercent || 0,
      mlReconstructionError: mlScore?.reconstructionError ?? null,
    };
  };

  const buildSnapshot = (nowMs: number): AnalyticsRuntimeSnapshot => ({
    nowMs,
    cascade: deriveCascade(nowMs),
    entropy: deriveEntropy(nowMs),
    anomaly: deriveAnomaly(nowMs),
  });

  return {
    getSnapshot: () => snapshot,

    reset: (nowMs = Date.now()) => {
      recentCascadeEvents = [];
      entropyTimestamps = [];
      currentEpoch = createMinuteAccumulator(nowMs);
      historicalEpochs = [];
      snapshot = buildSnapshot(nowMs);
      return snapshot;
    },

    ingest: (events: MinuteVectorEvent[], nowMs = Date.now()) => {
      if (events.length > 0) {
        recentCascadeEvents.push(...events.map((event) => ({ value: event.value, timeMillis: nowMs })));
        entropyTimestamps = [...entropyTimestamps, ...events.map((event) => event.timestampMs)].sort((left, right) => left - right);
        accumulateMinuteEvents(currentEpoch, events);
      }

      snapshot = buildSnapshot(nowMs);
      return snapshot;
    },

    sync: (nowMs = Date.now()) => {
      snapshot = buildSnapshot(nowMs);
      return snapshot;
    },

    tickEpoch: (nowMs = Date.now()) => {
      historicalEpochs.push(buildMinuteSnapshot(currentEpoch, { finalized: true, nowMs: currentEpoch.startedAt + EPOCH_MS }));
      if (historicalEpochs.length > MAX_EPOCHS) {
        historicalEpochs.shift();
      }

      currentEpoch = createMinuteAccumulator(nowMs);
      snapshot = buildSnapshot(nowMs);
      return snapshot;
    },

    loadModel: async (path?: string) => {
      const loadedModule = autoencoderModule ?? await import('../ml/autoencoder');
      autoencoderModule = loadedModule;

      await loadedModule.loadLiquidationAutoencoder(path);
      snapshot = buildSnapshot(Date.now());
      return snapshot;
    },
  };
};
