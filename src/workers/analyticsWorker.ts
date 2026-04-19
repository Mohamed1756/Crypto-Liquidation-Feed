/// <reference lib="webworker" />

import { createAnalyticsEngine } from '../analytics/engine';
import type { AnalyticsRuntimeSnapshot } from '../analytics/types';
import type { MinuteVectorEvent } from '../ml/minuteVectors';

type AnalyticsWorkerRequest =
  | { type: 'reset'; nowMs?: number }
  | { type: 'ingest'; nowMs?: number; events: MinuteVectorEvent[] }
  | { type: 'sync'; nowMs?: number }
  | { type: 'tick-epoch'; nowMs?: number }
  | { type: 'load-model'; path?: string };

type AnalyticsWorkerResponse =
  | { type: 'snapshot'; snapshot: AnalyticsRuntimeSnapshot }
  | { type: 'error'; message: string };

const workerScope = self as DedicatedWorkerGlobalScope;
const engine = createAnalyticsEngine();

const postSnapshot = (snapshot: AnalyticsRuntimeSnapshot) => {
  workerScope.postMessage({ type: 'snapshot', snapshot } satisfies AnalyticsWorkerResponse);
};

workerScope.onmessage = async (event: MessageEvent<AnalyticsWorkerRequest>) => {
  try {
    switch (event.data.type) {
      case 'reset':
        postSnapshot(engine.reset(event.data.nowMs));
        break;
      case 'ingest':
        postSnapshot(engine.ingest(event.data.events, event.data.nowMs));
        break;
      case 'sync':
        postSnapshot(engine.sync(event.data.nowMs));
        break;
      case 'tick-epoch':
        postSnapshot(engine.tickEpoch(event.data.nowMs));
        break;
      case 'load-model':
        postSnapshot(await engine.loadModel(event.data.path));
        break;
      default:
        break;
    }
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown analytics worker error',
    } satisfies AnalyticsWorkerResponse);
  }
};

export {};
