import React, { useEffect } from 'react';
import { DateTime } from 'luxon';
import { useLiquidationStore } from '../store/liquidationStore';
import { useBybitSymbols } from './BybitSymbols';
import { Liquidation } from '../types/liquidation';

const ENDPOINTS = {
  BINANCE: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  BYBIT: 'wss://stream.bybit.com/v5/public/linear',
  OKX: 'wss://ws.okx.com:8443/ws/v5/public',
};

interface BybitLiquidation {
  topic: string;
  type: string;
  ts: number;
  data: [{
    T: number;
    s: string;
    S: string;
    v: string;
    p: string;
  }];
}

interface OkxLiquidation {
  arg: {
    channel: string;
    instType: string;
  };
  data: Array<{
    details: Array<{
      bkLoss: string;
      bkPx: string;
      ccy: string;
      posSide: 'long' | 'short';
      side: 'buy' | 'sell';
      sz: string;
      ts: string;
    }>;
    instFamily: string;
    instId: string;
    instType: string;
    uly: string;
  }>;
}

export const WebSocketProvider: React.FC<{ 
  children: React.ReactNode,
  exchanges?: ('BINANCE' | 'BYBIT' | 'OKX')[]
}> = ({ 
  children, 
  exchanges = ['BINANCE', 'BYBIT', 'OKX']
}) => {
  const addLiquidation = useLiquidationStore((state) => state.addLiquidation);
  const bybitSymbols = useBybitSymbols();

  useEffect(() => {
    console.log('WebSocketProvider useEffect running with exchanges:', exchanges);

    const connections = new Map<string, WebSocket>();
    const pingIntervals = new Map<string, NodeJS.Timeout>();

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
          console.log('BYBIT sending subscription:', subscriptionArgs);
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: subscriptionArgs
          }));
        } else if (exchange === 'OKX') {
          const subscription = {
            op: 'subscribe',
            args: [{
              channel: 'liquidation-orders',
              instType: 'SWAP'
            }]
          };
          console.log('OKX sending subscription:', JSON.stringify(subscription));
          ws.send(JSON.stringify(subscription));

          // Set up ping (using simple string 'ping' as per your friend's working code)
          const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              console.log('OKX sending ping...');
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
          console.log(`${exchange} received raw message:`, message);

          // Handle OKX pong response (as plain string)
          if (exchange === 'OKX' && message === 'pong') {
            console.log('OKX pong received');
            return;
          }

          const data = JSON.parse(message);
          let liquidation: Liquidation | undefined;

          if (exchange === 'BINANCE') {
            const msg = data.o;
            if (msg) {
              liquidation = {
                exchange: 'BINANCE',
                symbol: msg.s,
                side: msg.S as 'BUY' | 'SELL',
                orderType: msg.o,
                quantity: parseFloat(msg.q),
                price: parseFloat(msg.ap),
                orderStatus: msg.X,
                timestamp: DateTime.fromMillis(parseInt(msg.T)),
                value: parseFloat(msg.q) * parseFloat(msg.ap),
              };
            }
          } else if (exchange === 'BYBIT') {
            const bybitMsg = data as BybitLiquidation;
            if (bybitMsg.topic?.includes('allLiquidation') && bybitMsg.data?.[0]) {
              const msg = bybitMsg.data[0];
              if (!msg.s || !msg.S || !msg.v || !msg.p) {
                console.warn('Invalid Bybit message structure:', msg);
                return;
              }
              const side = msg.S.toUpperCase() === 'BUY' ? 'SELL' : 'BUY';
              liquidation = {
                exchange: 'BYBIT',
                symbol: msg.s,
                side: side as 'BUY' | 'SELL',
                orderType: 'LIMIT',
                quantity: parseFloat(msg.v),
                price: parseFloat(msg.p),
                orderStatus: 'FILLED',
                timestamp: DateTime.fromMillis(msg.T),
                value: parseFloat(msg.v) * parseFloat(msg.p),
              };
            }
          } else if (exchange === 'OKX') {
            console.log('OKX processing data:', data);
            
            // Handle subscription confirmation
            if ('event' in data && data.event === 'subscribe') {
              console.log('OKX subscription confirmed:', data.arg);
              return;
            }
            
            // Process liquidation data with the correct structure
            const okxMsg = data as OkxLiquidation;
            if (okxMsg.arg?.channel === 'liquidation-orders' && okxMsg.data?.[0]?.details?.[0]) {
              const detail = okxMsg.data[0].details[0];
              const instrument = okxMsg.data[0];
              
              // Convert position side to order side
              // When a long position is liquidated, the exchange performs a sell
              // When a short position is liquidated, the exchange performs a buy
              const side = detail.posSide === 'short' ? 'BUY' : 'SELL';
              
              liquidation = {
                exchange: 'OKX',
                symbol: instrument.instId,
                side: side as 'BUY' | 'SELL',
                orderType: 'MARKET',
                quantity: parseFloat(detail.sz),
                price: parseFloat(detail.bkPx),
                orderStatus: 'FILLED',
                timestamp: DateTime.fromMillis(parseInt(detail.ts)),
                value: parseFloat(detail.sz) * parseFloat(detail.bkPx),
              };
              console.log('OKX parsed liquidation:', liquidation);
            } else {
              console.log('OKX no liquidation data found in structure:', okxMsg);
            }
          }

          if (liquidation) {
            console.log(`${exchange} adding liquidation to store:`, liquidation);
            addLiquidation(liquidation);
          }
        } catch (error) {
          console.error(`${exchange} message parsing error:`, error);
        }
      };

      connections.set(exchange, ws);
    });

    return () => {
      console.log('Cleaning up WebSocket connections');
      connections.forEach(ws => ws.close());
      pingIntervals.forEach(interval => clearInterval(interval));
    };
  }, [addLiquidation, exchanges, bybitSymbols]);

  return <>{children}</>;
};