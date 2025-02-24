import React, { useEffect } from 'react';
import { DateTime } from 'luxon';
import { useLiquidationStore } from '../store/liquidationStore';


const ENDPOINTS = {
  BINANCE: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  BYBIT: 'wss://stream.bybit.com/v5/public/linear'
};

// Update the interface to match actual Bybit message structure
interface BybitLiquidation {
  topic: string;
  type: string;
  ts: number;
  data: [{
    T: number;      // Timestamp
    s: string;      // Symbol
    S: string;      // Side
    v: string;      // Volume/Size
    p: string;      // Price
  }];
}

export const WebSocketProvider: React.FC<{ 
  children: React.ReactNode,
  exchanges?: ('BINANCE' | 'BYBIT')[]
}> = ({ 
  children, 
  exchanges = ['BINANCE', 'BYBIT']
}) => {
  const addLiquidation = useLiquidationStore((state) => state.addLiquidation);
  

  useEffect(() => {
    // Define connections map inside useEffect
    const connections = new Map();

    // Connect to each exchange
    exchanges.forEach(exchange => {
      const ws = new WebSocket(ENDPOINTS[exchange]);

      // Setup connection handlers
      ws.onopen = () => {
        console.log(`${exchange} connected`);
        if (exchange === 'BYBIT') {
          // Subscribe using correct topic prefix
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: [
              'allLiquidation.BTCUSDT',
              'allLiquidation.ETHUSDT',
              'allLiquidation.SOLUSDT',
              'allLiquidation.KAITOUSDT',
            ]
          }));
        }
      };

      ws.onclose = () => {
        console.log(`${exchange} connection closed`);
      };

      ws.onerror = (error) => {
        console.error(`${exchange} error:`, error);
      };

      // Add message handler
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`${exchange} received:`, data); // Debug log

          let liquidation;
          if (exchange === 'BINANCE') {
            const msg = data.o;
            liquidation = {
              exchange: 'BINANCE' as 'BINANCE',
              symbol: msg.s,
              side: msg.S,
              orderType: msg.o,
              quantity: parseFloat(msg.q),
              price: parseFloat(msg.ap),
              orderStatus: msg.X,
              timestamp: DateTime.fromMillis(parseInt(msg.T)),
              value: parseFloat(msg.q) * parseFloat(msg.ap),
            };
          } else if (exchange === 'BYBIT') {
            // Type check the message
            const bybitMsg = data as BybitLiquidation;
            
            if (bybitMsg.topic?.includes('allLiquidation') && bybitMsg.data?.[0]) {
              const msg = bybitMsg.data[0];
              
              // Validate required fields using new structure
              if (!msg.s || !msg.S || !msg.v || !msg.p) {
                console.warn('Invalid Bybit message structure:', msg);
                return;
              }

              liquidation = {
                exchange: 'BYBIT' as 'BYBIT',
                symbol: msg.s,
                side: msg.S.toUpperCase() as 'BUY' | 'SELL',
                orderType: 'LIMIT',
                quantity: parseFloat(msg.v),
                price: parseFloat(msg.p),
                orderStatus: 'FILLED',
                timestamp: DateTime.fromMillis(msg.T),
                value: parseFloat(msg.v) * parseFloat(msg.p),
              };
            }
          }

          if (liquidation) {
            addLiquidation(liquidation);
          }
        } catch (error) {
          console.error(`${exchange} message error:`, error);
        }
      };

      // Store connection
      connections.set(exchange, ws);
    });

    // Cleanup
    return () => {
      connections.forEach(ws => ws.close());
    };
  }, [addLiquidation, exchanges]); // Remove bybitSymbols dependency

  return <>{children}</>;
};