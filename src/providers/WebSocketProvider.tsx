import React, { useEffect } from 'react';
import { DateTime } from 'luxon';
import { useLiquidationStore } from '../store/liquidationStore';

const WEBSOCKET_URI = 'wss://fstream.binance.com/ws/!forceOrder@arr';

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const addLiquidation = useLiquidationStore((state) => state.addLiquidation);

  useEffect(() => {
    const ws = new WebSocket(WEBSOCKET_URI);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data).o;
        const liquidation = {
          symbol: msg.s,
          side: msg.S,
          orderType: msg.o,
          quantity: parseFloat(msg.q),
          price: parseFloat(msg.ap),
          orderStatus: msg.X,
          timestamp: DateTime.fromMillis(parseInt(msg.T)),
          value: parseFloat(msg.q) * parseFloat(msg.ap),
        };

        addLiquidation(liquidation);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [addLiquidation]);

  return <>{children}</>;
};