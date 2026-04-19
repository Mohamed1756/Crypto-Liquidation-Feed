import React, { useEffect, useRef } from 'react';
import { useLiquidationStore } from '../store/liquidationStore';
import { useClusteringStore } from '../store/clusteringStore';
import { useConnectionStore } from '../store/connectionStore';
import { useReplayStore } from '../store/replayStore';
import { useBybitSymbols } from './BybitSymbols';
import { normalizeLiquidation } from '../utils/normalization';
import type { Liquidation } from '../types/liquidation';
import { liquidationToReplayEvent } from '../ml/replayDataset';
import {
  ingestAnalyticsEvents,
  startAnalyticsRuntime,
  syncAnalyticsRuntime,
  tickAnalyticsEpoch,
} from '../analytics/client';

const ENDPOINTS = {
  BINANCE: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  BYBIT: 'wss://stream.bybit.com/v5/public/linear',
  OKX: 'wss://ws.okx.com:8443/ws/v5/public',
};

const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 16000;
const HEARTBEAT_TIMEOUT = 5000; // 5 seconds
const ANOMALY_EPOCH_MS = 60000;

export const WebSocketProvider: React.FC<{ 
  children: React.ReactNode,
  exchanges?: ('BINANCE' | 'BYBIT' | 'OKX')[]
}> = ({ 
  children, 
  exchanges = ['BINANCE', 'BYBIT', 'OKX']
}) => {
  const addLiquidations = useLiquidationStore((state) => state.addLiquidations);
  const addClusterLiquidations = useClusteringStore((state) => state.addLiquidations);
  const updateExchange = useConnectionStore((state) => state.updateExchange);
  const bybitSymbols = useBybitSymbols();

  const bufferRef = useRef<Liquidation[]>([]);

  useEffect(() => {
    startAnalyticsRuntime();

    // Shared buffer for micro-batching
    const flushInterval = setInterval(() => {
      if (bufferRef.current.length > 0) {
        addLiquidations(bufferRef.current);
        addClusterLiquidations(bufferRef.current);
        useReplayStore.getState().ingestLiquidations(bufferRef.current);
        ingestAnalyticsEvents(bufferRef.current.map(liquidationToReplayEvent));
        bufferRef.current = [];
      } else {
        syncAnalyticsRuntime();
      }
    }, 100);

    let anomalyInterval: ReturnType<typeof setInterval> | null = null;
    const anomalyTimeout = setTimeout(() => {
      tickAnalyticsEpoch();
      anomalyInterval = setInterval(() => {
        tickAnalyticsEpoch();
      }, ANOMALY_EPOCH_MS);
    }, ANOMALY_EPOCH_MS - (Date.now() % ANOMALY_EPOCH_MS));

    return () => {
      clearInterval(flushInterval);
      clearTimeout(anomalyTimeout);
      if (anomalyInterval) {
        clearInterval(anomalyInterval);
      }
    };
  }, [addLiquidations, addClusterLiquidations]);

  useEffect(() => {
    const activeConnections = new Map<string, WebSocket>();
    const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const backoffDelays = new Map<string, number>();
    let isDisposed = false;
    
    // Track timestamps locally to prevent heavy Zustand re-renders
    const lastMessageTimes = new Map<string, number>();

    const connect = (exchange: 'BINANCE' | 'BYBIT' | 'OKX') => {
      if (isDisposed) {
        return;
      }

      if (reconnectTimers.has(exchange)) {
        clearTimeout(reconnectTimers.get(exchange)!);
        reconnectTimers.delete(exchange);
      }
      
      updateExchange(exchange, { status: 'RECONNECTING' });

      let ws: WebSocket;
      try {
        ws = new WebSocket(ENDPOINTS[exchange]);
      } catch (error) {
        console.error(`Failed to instantiate WebSocket for ${exchange}:`, error);
        scheduleReconnect(exchange);
        return;
      }

      activeConnections.set(exchange, ws);

      ws.onopen = () => {
        if (isDisposed) {
          ws.close();
          return;
        }

        backoffDelays.set(exchange, INITIAL_BACKOFF);
        lastMessageTimes.set(exchange, Date.now());
        updateExchange(exchange, { status: 'CONNECTED', lastMessageAt: Date.now() });

        if (exchange === 'BYBIT') {
          const subscriptionArgs = bybitSymbols.map(symbol => `allLiquidation.${symbol}`);
          ws.send(JSON.stringify({ op: 'subscribe', args: subscriptionArgs }));
        } else if (exchange === 'OKX') {
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: [{ channel: 'liquidation-orders', instType: 'SWAP' }]
          }));
        }
      };

      ws.onclose = () => {
        activeConnections.delete(exchange);

        if (!isDisposed) {
          scheduleReconnect(exchange);
        }
      };

      ws.onerror = (error) => {
        console.error(`${exchange} WebSocket error:`, error);
      };

      ws.onmessage = (event) => {
        if (isDisposed) {
          return;
        }

        try {
          // Fast local update
          lastMessageTimes.set(exchange, Date.now());

          const message = event.data.toString();
          
          if (exchange === 'OKX' && message === 'pong') return;
          // Bybit responds to ping with {"success":true,"ret_msg":"pong","conn_id":"...","req_id":"100001","op":"ping"}
          if (exchange === 'BYBIT' && message.includes('"op":"ping"')) return;

          const data = JSON.parse(message);
          
          if (data.event === 'subscribe' || data.op === 'subscribe') return;

          const liquidation = normalizeLiquidation(exchange, data);
          if (liquidation) {
            bufferRef.current.push(liquidation);
          }
        } catch (error) {
          console.error(`${exchange} message parsing error:`, error);
        }
      };
    };

    const scheduleReconnect = (exchange: 'BINANCE' | 'BYBIT' | 'OKX') => {
      if (isDisposed) {
        return;
      }

      activeConnections.delete(exchange);
      updateExchange(exchange, { status: 'DISCONNECTED' });

      const currentBackoff = backoffDelays.get(exchange) || INITIAL_BACKOFF;
      const nextBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF);
      backoffDelays.set(exchange, nextBackoff);

      const timer = setTimeout(() => {
        connect(exchange);
      }, currentBackoff);
      
      reconnectTimers.set(exchange, timer);
    };

    exchanges.forEach(ex => {
      backoffDelays.set(ex, INITIAL_BACKOFF);
      connect(ex);
    });

    // Watchdog Sync & Heartbeat
    const watchdog = setInterval(() => {
      const now = Date.now();
      
      exchanges.forEach(ex => {
        const ws = activeConnections.get(ex);
        if (ws && ws.readyState === WebSocket.OPEN) {
          // Send Heartbeats
          if (ex === 'OKX') {
            ws.send('ping');
          } else if (ex === 'BYBIT') {
            ws.send(JSON.stringify({ req_id: "100001", op: "ping" }));
          }

          const lastMsg = lastMessageTimes.get(ex) || 0;
          
          // Bulk update Zustand once per second with current lastMessageTs to prevent high-frequency renders
          updateExchange(ex, { lastMessageAt: lastMsg });

          // Staleness check
          if (now - lastMsg > HEARTBEAT_TIMEOUT) {
            console.warn(`${ex} WebSocket stale (no message for >5s). Forcing reconnect...`);
            ws.close();
          }
        }
      });
    }, 1000); // 1-second cadence is very light and maintains precision

    return () => {
      isDisposed = true;
      clearInterval(watchdog);
      reconnectTimers.forEach(timer => clearTimeout(timer));
      activeConnections.forEach((ws) => {
        ws.onclose = null;
        ws.close();
      });
    };
  }, [exchanges, bybitSymbols, updateExchange]);

  return <>{children}</>;
};