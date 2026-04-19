import type { AnalyticsRuntimeSnapshot } from './types';
import type { MinuteVectorEvent } from '../ml/minuteVectors';
import { useCascadeStore } from '../store/cascadeStore';
import { useEntropyStore } from '../store/entropyStore';
import { useAnomalyStore } from '../store/anomalyStore';

type AnalyticsWorkerRequest =
  | { type: 'reset'; nowMs?: number }
  | { type: 'ingest'; nowMs?: number; events: MinuteVectorEvent[] }
  | { type: 'sync'; nowMs?: number }
  | { type: 'tick-epoch'; nowMs?: number }
  | { type: 'load-model'; path?: string };

type AnalyticsWorkerResponse =
  | { type: 'snapshot'; snapshot: AnalyticsRuntimeSnapshot }
  | { type: 'error'; message: string };

let analyticsWorker: Worker | null = null;

const applySnapshot = (snapshot: AnalyticsRuntimeSnapshot) => {
  useCascadeStore.getState().applySnapshot(snapshot.cascade);
  useEntropyStore.getState().applySnapshot(snapshot.entropy);
  useAnomalyStore.getState().applySnapshot(snapshot.anomaly);
};

const getWorker = () => {
  if (analyticsWorker) {
    return analyticsWorker;
  }

  analyticsWorker = new Worker(new URL('../workers/analyticsWorker.ts', import.meta.url), {
    type: 'module',
  });

  analyticsWorker.onmessage = (event: MessageEvent<AnalyticsWorkerResponse>) => {
    if (event.data.type === 'snapshot') {
      applySnapshot(event.data.snapshot);
      return;
    }

    console.error(event.data.message);
  };

  analyticsWorker.postMessage({ type: 'sync', nowMs: Date.now() } satisfies AnalyticsWorkerRequest);
  return analyticsWorker;
};

const postMessage = (message: AnalyticsWorkerRequest) => {
  getWorker().postMessage(message);
};

export const startAnalyticsRuntime = () => {
  getWorker();
};

export const ingestAnalyticsEvents = (events: MinuteVectorEvent[], nowMs = Date.now()) => {
  postMessage({ type: 'ingest', events, nowMs });
};

export const syncAnalyticsRuntime = (nowMs = Date.now()) => {
  postMessage({ type: 'sync', nowMs });
};

export const tickAnalyticsEpoch = (nowMs = Date.now()) => {
  postMessage({ type: 'tick-epoch', nowMs });
};

export const loadAnalyticsModel = (path?: string) => {
  postMessage({ type: 'load-model', path });
};

export const resetAnalyticsRuntime = (nowMs = Date.now()) => {
  postMessage({ type: 'reset', nowMs });
};
