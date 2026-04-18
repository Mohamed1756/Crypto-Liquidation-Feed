import React, { useEffect } from 'react';
import { useLiquidationStore } from '../store/liquidationStore';
import { useClusteringStore } from '../store/clusteringStore';
import { useBybitSymbols } from './BybitSymbols';
import { normalizeLiquidation } from '../utils/normalization';

const ENDPOINTS = {
  BINANCE: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  BYBIT: 'wss://stream.bybit.com/v5/public/linear',
  OKX: 'wss://ws.okx.com:8443/ws/v5/public',
};

export const WebSocketProvider: React.FC<{ 
  children: React.ReactNode,
  exchanges?: ('BINANCE' | 'BYBIT' | 'OKX')[]
}> = ({ 
  children, 
  exchanges = ['BINANCE', 'BYBIT', 'OKX']
}) => {
  const addLiquidations = useLiquidationStore((state) => state.addLiquidations);
  const addClusterLiquidations = useClusteringStore((state) => state.addLiquidations);
  const bybitSymbols = useBybitSymbols();

  useEffect(() => {
    console.log('WebSocketProvider useEffect running with exchanges:', exchanges);

    const connections = new Map<string, WebSocket>();
    const pingIntervals = new Map<string, NodeJS.Timeout>();
    const buffer: any[] = []; // Micro-batch buffer

    const flushInterval = setInterval(() => {
      if (buffer.length > 0) {
        addLiquidations(buffer);
        addClusterLiquidations(buffer);
        buffer.length = 0; // clear buffer
      }
    }, 100);

    exchanges.forEach(exchange => {
      console.log(`Attempting to create WebSocket for ${exchange} at ${ENDPOINTS[exchange]}`);
      
      let ws: WebSocket;
      try {
        ws = new WebSocket(ENDPOINTS[exchange]);
      } catch (error) {
        console.error(`Failed to instantiate WebSocket for ${exchange}:`, error);
        return;
      }

      ws.onopen = () => {
        console.log(`${exchange} WebSocket connected`);
        if (exchange === 'BYBIT') {
          const subscriptionArgs = bybitSymbols.map(symbol => `allLiquidation.${symbol}`);
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: subscriptionArgs
          }));
        } else if (exchange === 'OKX') {
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: [{
              channel: 'liquidation-orders',
              instType: 'SWAP'
            }]
          }));

          const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 25000);
          pingIntervals.set(exchange, pingInterval);
        }
      };

      ws.onclose = () => {
        console.log(`${exchange} WebSocket closed`);
        const interval = pingIntervals.get(exchange);
        if (interval) clearInterval(interval);
      };

      ws.onerror = (error) => {
        console.error(`${exchange} WebSocket error:`, error);
      };

      ws.onmessage = (event) => {
        try {
          const message = event.data.toString();
          
          if (exchange === 'OKX' && message === 'pong') return;

          const data = JSON.parse(message);
          
          // Handle subscription confirmations
          if (data.event === 'subscribe' || data.op === 'subscribe') return;

          const liquidation = normalizeLiquidation(exchange, data);

          if (liquidation) {
            buffer.push(liquidation);
          }
        } catch (error) {
          console.error(`${exchange} message parsing error:`, error);
        }
      };

      connections.set(exchange, ws);
    });

    return () => {
      connections.forEach(ws => ws.close());
      pingIntervals.forEach(interval => clearInterval(interval));
      clearInterval(flushInterval);
    };
  }, [addLiquidations, addClusterLiquidations, exchanges, bybitSymbols]);

  return <>{children}</>;
};