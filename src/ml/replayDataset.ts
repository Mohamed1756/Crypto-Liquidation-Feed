import { DateTime } from 'luxon';
import type { Liquidation } from '../types/liquidation.ts';
import {
  MINUTE_FEATURE_KEYS,
  buildMinuteVectorsFromEvents,
  type MinuteVectorEvent,
  type MinuteVectorRow,
} from './minuteVectors.ts';

export const REPLAY_DATASET_SCHEMA_VERSION = 1;
export const MAX_REPLAY_EVENTS = 10_000;

export interface ReplayDataset {
  schemaVersion: number;
  source: string;
  createdAt: string;
  generatedBy: string;
  featureKeys: typeof MINUTE_FEATURE_KEYS;
  eventCount: number;
  minuteCount: number;
  events: MinuteVectorEvent[];
  minuteVectors: MinuteVectorRow[];
  metadata?: Record<string, string | number | boolean | null>;
}

export const liquidationToReplayEvent = (liquidation: Liquidation): MinuteVectorEvent => ({
  id: liquidation.id,
  exchange: liquidation.exchange,
  symbol: liquidation.symbol,
  baseAsset: liquidation.baseAsset,
  side: liquidation.side,
  orderType: liquidation.orderType,
  quantity: liquidation.quantity,
  price: liquidation.price,
  orderStatus: liquidation.orderStatus,
  timestampMs: liquidation.timestamp.toMillis(),
  isoTimestamp: liquidation.timestamp.toUTC().toISO() || new Date(liquidation.timestamp.toMillis()).toISOString(),
  value: liquidation.value,
});

export const replayEventToLiquidation = (event: MinuteVectorEvent): Liquidation => ({
  id: event.id,
  exchange: event.exchange as Liquidation['exchange'],
  symbol: event.symbol,
  baseAsset: event.baseAsset,
  side: event.side,
  orderType: event.orderType,
  quantity: event.quantity,
  price: event.price,
  orderStatus: event.orderStatus,
  timestamp: DateTime.fromMillis(event.timestampMs),
  value: event.value,
});

export const buildReplayDataset = (
  inputEvents: MinuteVectorEvent[],
  source: string,
  metadata?: Record<string, string | number | boolean | null>,
): ReplayDataset => {
  const events = [...inputEvents]
    .sort((left, right) => left.timestampMs - right.timestampMs)
    .slice(-MAX_REPLAY_EVENTS);
  const minuteVectors = buildMinuteVectorsFromEvents(events);

  return {
    schemaVersion: REPLAY_DATASET_SCHEMA_VERSION,
    source,
    createdAt: new Date().toISOString(),
    generatedBy: 'Crypto Liquidation Feed',
    featureKeys: MINUTE_FEATURE_KEYS,
    eventCount: events.length,
    minuteCount: minuteVectors.length,
    events,
    minuteVectors,
    metadata,
  };
};

export const isReplayDataset = (value: unknown): value is ReplayDataset => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeDataset = value as Partial<ReplayDataset>;

  return (
    maybeDataset.schemaVersion === REPLAY_DATASET_SCHEMA_VERSION
    && Array.isArray(maybeDataset.events)
    && Array.isArray(maybeDataset.minuteVectors)
    && typeof maybeDataset.source === 'string'
  );
};