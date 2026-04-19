export const EPOCH_MS = 60_000;
export const WHALE_THRESHOLD = 100_000;
export const MIN_PACE_ELAPSED_MS = 5_000;

export type MinuteFeatureKey =
  | 'volumePaceLog'
  | 'eventPaceLog'
  | 'averageSizeLog'
  | 'largestShare'
  | 'sideImbalance'
  | 'exchangeConcentration'
  | 'symbolConcentration'
  | 'sizeDispersion'
  | 'whaleShare';

export const MINUTE_FEATURE_KEYS: MinuteFeatureKey[] = [
  'volumePaceLog',
  'eventPaceLog',
  'averageSizeLog',
  'largestShare',
  'sideImbalance',
  'exchangeConcentration',
  'symbolConcentration',
  'sizeDispersion',
  'whaleShare',
];

const FEATURE_COMPARE_SCALES: Record<MinuteFeatureKey, number> = {
  volumePaceLog: 2,
  eventPaceLog: 2,
  averageSizeLog: 1.5,
  largestShare: 0.35,
  sideImbalance: 0.4,
  exchangeConcentration: 0.4,
  symbolConcentration: 0.4,
  sizeDispersion: 0.6,
  whaleShare: 0.4,
};

export interface MinuteVectorEvent {
  id: string;
  exchange: string;
  symbol: string;
  baseAsset: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  quantity: number;
  price: number;
  orderStatus: string;
  timestampMs: number;
  isoTimestamp: string;
  value: number;
}

export interface MinuteMetrics {
  eventCount: number;
  volumePace: number;
  eventPace: number;
  averageSize: number;
  largestEvent: number;
  sideImbalance: number;
  exchangeSpread: number;
  symbolSpread: number;
  sizeDispersion: number;
}

export type MinuteFeatureVector = Record<MinuteFeatureKey, number>;

export interface MinuteAccumulator {
  startedAt: number;
  eventCount: number;
  totalValue: number;
  largestEvent: number;
  buyValue: number;
  sellValue: number;
  whaleValue: number;
  exchangeValues: Map<string, number>;
  symbolValues: Map<string, number>;
  logValues: number[];
}

export interface MinuteSnapshot {
  totalValue: number;
  metrics: MinuteMetrics;
  features: MinuteFeatureVector;
}

export interface MinuteVectorRow {
  startedAt: number;
  endedAt: number;
  isoTimestamp: string;
  totalValue: number;
  metrics: MinuteMetrics;
  features: MinuteFeatureVector;
  vector: number[];
}

export interface MinuteFeatureDelta {
  key: MinuteFeatureKey;
  label: MinuteFeatureKey;
  live: number;
  replay: number;
  delta: number;
  normalizedDelta: number;
}

export interface MinuteFeatureComparison {
  similarityPercent: number;
  deltas: MinuteFeatureDelta[];
}

export const EMPTY_MINUTE_METRICS: MinuteMetrics = {
  eventCount: 0,
  volumePace: 0,
  eventPace: 0,
  averageSize: 0,
  largestEvent: 0,
  sideImbalance: 0,
  exchangeSpread: 0,
  symbolSpread: 0,
  sizeDispersion: 0,
};

export const EMPTY_MINUTE_FEATURES: MinuteFeatureVector = {
  volumePaceLog: 0,
  eventPaceLog: 0,
  averageSizeLog: 0,
  largestShare: 0,
  sideImbalance: 0,
  exchangeConcentration: 0,
  symbolConcentration: 0,
  sizeDispersion: 0,
  whaleShare: 0,
};

export const createMinuteAccumulator = (startedAt = Date.now()): MinuteAccumulator => ({
  startedAt,
  eventCount: 0,
  totalValue: 0,
  largestEvent: 0,
  buyValue: 0,
  sellValue: 0,
  whaleValue: 0,
  exchangeValues: new Map(),
  symbolValues: new Map(),
  logValues: [],
});

export const computeMeanStd = (values: number[]) => {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;

  return {
    mean,
    stdDev: Math.sqrt(variance),
  };
};

export const floorToMinute = (timestampMs: number) => Math.floor(timestampMs / EPOCH_MS) * EPOCH_MS;

export const roundMetric = (value: number, digits = 3) => {
  const precision = Math.pow(10, digits);
  return Math.round(value * precision) / precision;
};

export const vectorToArray = (features: MinuteFeatureVector) => {
  return MINUTE_FEATURE_KEYS.map((featureKey) => features[featureKey]);
};

export const compareMinuteFeatureVectors = (
  live: MinuteFeatureVector,
  replay: MinuteFeatureVector,
): MinuteFeatureComparison => {
  const deltas = MINUTE_FEATURE_KEYS.map((featureKey) => {
    const delta = Math.abs(live[featureKey] - replay[featureKey]);
    const normalizedDelta = Math.min(1, delta / FEATURE_COMPARE_SCALES[featureKey]);

    return {
      key: featureKey,
      label: featureKey,
      live: live[featureKey],
      replay: replay[featureKey],
      delta,
      normalizedDelta,
    };
  }).sort((left, right) => right.normalizedDelta - left.normalizedDelta);

  const similarityScore = deltas.reduce((sum, delta) => sum + (1 - delta.normalizedDelta), 0) / deltas.length;

  return {
    similarityPercent: Math.round(similarityScore * 100),
    deltas,
  };
};

export const accumulateMinuteEvent = (accumulator: MinuteAccumulator, event: MinuteVectorEvent) => {
  accumulator.eventCount += 1;
  accumulator.totalValue += event.value;
  accumulator.largestEvent = Math.max(accumulator.largestEvent, event.value);

  if (event.side === 'BUY') {
    accumulator.buyValue += event.value;
  } else {
    accumulator.sellValue += event.value;
  }

  if (event.value >= WHALE_THRESHOLD) {
    accumulator.whaleValue += event.value;
  }

  accumulator.exchangeValues.set(
    event.exchange,
    (accumulator.exchangeValues.get(event.exchange) || 0) + event.value,
  );
  accumulator.symbolValues.set(
    event.baseAsset,
    (accumulator.symbolValues.get(event.baseAsset) || 0) + event.value,
  );
  accumulator.logValues.push(Math.log1p(event.value));
};

export const accumulateMinuteEvents = (accumulator: MinuteAccumulator, events: MinuteVectorEvent[]) => {
  events.forEach((event) => accumulateMinuteEvent(accumulator, event));
};

export const buildMinuteSnapshot = (
  accumulator: MinuteAccumulator,
  options: { finalized?: boolean; nowMs?: number } = {},
): MinuteSnapshot => {
  const { finalized = false, nowMs = Date.now() } = options;

  if (accumulator.eventCount === 0 || accumulator.totalValue === 0) {
    return {
      totalValue: 0,
      metrics: EMPTY_MINUTE_METRICS,
      features: EMPTY_MINUTE_FEATURES,
    };
  }

  const elapsedMs = finalized
    ? EPOCH_MS
    : Math.min(EPOCH_MS, Math.max(MIN_PACE_ELAPSED_MS, nowMs - accumulator.startedAt));
  const paceMultiplier = finalized ? 1 : EPOCH_MS / elapsedMs;
  const volumePace = accumulator.totalValue * paceMultiplier;
  const eventPace = accumulator.eventCount * paceMultiplier;
  const averageSize = accumulator.totalValue / accumulator.eventCount;
  const largestShare = accumulator.largestEvent / accumulator.totalValue;
  const sideImbalance = Math.abs(accumulator.buyValue - accumulator.sellValue) / accumulator.totalValue;
  const exchangeConcentration = Math.max(0, ...Array.from(accumulator.exchangeValues.values())) / accumulator.totalValue;
  const symbolConcentration = Math.max(0, ...Array.from(accumulator.symbolValues.values())) / accumulator.totalValue;
  const { stdDev: sizeDispersion } = computeMeanStd(accumulator.logValues);
  const whaleShare = accumulator.whaleValue / accumulator.totalValue;

  return {
    totalValue: accumulator.totalValue,
    metrics: {
      eventCount: accumulator.eventCount,
      volumePace,
      eventPace,
      averageSize,
      largestEvent: accumulator.largestEvent,
      sideImbalance,
      exchangeSpread: 1 - exchangeConcentration,
      symbolSpread: 1 - symbolConcentration,
      sizeDispersion,
    },
    features: {
      volumePaceLog: Math.log1p(volumePace),
      eventPaceLog: Math.log1p(eventPace),
      averageSizeLog: Math.log1p(averageSize),
      largestShare,
      sideImbalance,
      exchangeConcentration,
      symbolConcentration,
      sizeDispersion,
      whaleShare,
    },
  };
};

export const buildMinuteVectorsFromEvents = (events: MinuteVectorEvent[]) => {
  if (events.length === 0) {
    return [] as MinuteVectorRow[];
  }

  const sortedEvents = [...events].sort((left, right) => left.timestampMs - right.timestampMs);
  const rows: MinuteVectorRow[] = [];

  let minuteStart = floorToMinute(sortedEvents[0].timestampMs);
  let accumulator = createMinuteAccumulator(minuteStart);

  for (const event of sortedEvents) {
    const eventMinute = floorToMinute(event.timestampMs);
    if (eventMinute !== minuteStart) {
      const snapshot = buildMinuteSnapshot(accumulator, { finalized: true, nowMs: minuteStart + EPOCH_MS });
      rows.push({
        startedAt: minuteStart,
        endedAt: minuteStart + EPOCH_MS - 1,
        isoTimestamp: new Date(minuteStart).toISOString(),
        totalValue: snapshot.totalValue,
        metrics: snapshot.metrics,
        features: snapshot.features,
        vector: vectorToArray(snapshot.features),
      });

      minuteStart = eventMinute;
      accumulator = createMinuteAccumulator(minuteStart);
    }

    accumulateMinuteEvent(accumulator, event);
  }

  const snapshot = buildMinuteSnapshot(accumulator, { finalized: true, nowMs: minuteStart + EPOCH_MS });
  rows.push({
    startedAt: minuteStart,
    endedAt: minuteStart + EPOCH_MS - 1,
    isoTimestamp: new Date(minuteStart).toISOString(),
    totalValue: snapshot.totalValue,
    metrics: snapshot.metrics,
    features: snapshot.features,
    vector: vectorToArray(snapshot.features),
  });

  return rows;
};