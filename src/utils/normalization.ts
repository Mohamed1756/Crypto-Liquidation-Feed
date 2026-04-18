import { DateTime } from 'luxon';
import { Liquidation } from '../types/liquidation';

// OKX Contract Sizes (Amount of base asset per contract)
const OKX_CONTRACT_SIZES: Record<string, number> = {
  'BTC': 0.01,
  'ETH': 0.1,
  'LTC': 1,
  'DOGE': 1000,
  'SOL': 1,
  'XRP': 100,
  'DOT': 1,
  'ADA': 100,
  'MATIC': 10,
  'LINK': 1,
};

const getOkxMultiplier = (symbol: string): number => {
  const baseAsset = symbol.split('-')[0];
  return OKX_CONTRACT_SIZES[baseAsset] || 1;
};

const extractBaseAsset = (symbol: string, exchange: string): string => {
  if (exchange === 'BINANCE' || exchange === 'BYBIT') {
    // Usually ends with USDT, BUSD, BTC, etc.
    // Try to cut off common quote assets
    const quoteAssets = ['USDT', 'BUSD', 'BTC', 'ETH', 'USDC'];
    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        return symbol.slice(0, -quote.length);
      }
    }
    return symbol;
  }
  if (exchange === 'OKX') {
    // OKX uses BTC-USDT-SWAP
    return symbol.split('-')[0];
  }
  return symbol;
};

export const normalizeLiquidation = (exchange: 'BINANCE' | 'BYBIT' | 'OKX', data: any): Liquidation | null => {
  try {
    if (exchange === 'BINANCE') {
      const msg = data.o;
      if (!msg) return null;

      const quantity = parseFloat(msg.q);
      const price = parseFloat(msg.ap);
      const eventTime = msg.T;
      const baseAsset = extractBaseAsset(msg.s, 'BINANCE');
      
      return {
        id: `BINANCE-${msg.s}-${msg.S}-${price}-${quantity}-${eventTime}`,
        exchange: 'BINANCE',
        symbol: msg.s,
        baseAsset,
        side: msg.S as 'BUY' | 'SELL',
        orderType: msg.o,
        quantity,
        price,
        orderStatus: msg.X,
        timestamp: DateTime.fromMillis(eventTime),
        value: quantity * price,
      };
    }

    if (exchange === 'BYBIT') {
      if (!data.topic?.includes('allLiquidation') || !data.data?.[0]) return null;
      const msg = data.data[0];
      
      const quantity = parseFloat(msg.v);
      const price = parseFloat(msg.p);
      const eventTime = data.ts;
      const baseAsset = extractBaseAsset(msg.s, 'BYBIT');
      
      const side = msg.S.toUpperCase() as 'BUY' | 'SELL';

      return {
        id: `BYBIT-${msg.s}-${side}-${price}-${quantity}-${eventTime}`,
        exchange: 'BYBIT',
        symbol: msg.s,
        baseAsset,
        side,
        orderType: 'LIMIT',
        quantity,
        price,
        orderStatus: 'FILLED',
        timestamp: DateTime.fromMillis(eventTime),
        value: quantity * price,
      };
    }

    if (exchange === 'OKX') {
      if (data.arg?.channel !== 'liquidation-orders' || !data.data?.[0]?.details?.[0]) return null;
      
      const instrument = data.data[0];
      const detail = instrument.details[0];
      
      const multiplier = getOkxMultiplier(instrument.instId);
      const quantity = parseFloat(detail.sz) * multiplier;
      const price = parseFloat(detail.bkPx);
      const eventTime = parseInt(detail.ts);
      const baseAsset = extractBaseAsset(instrument.instId, 'OKX');

      const side = detail.posSide === 'short' ? 'BUY' : 'SELL';

      return {
        id: `OKX-${instrument.instId}-${side}-${price}-${quantity}-${eventTime}`,
        exchange: 'OKX',
        symbol: instrument.instId,
        baseAsset,
        side: side as 'BUY' | 'SELL',
        orderType: 'MARKET',
        quantity,
        price,
        orderStatus: 'FILLED',
        timestamp: DateTime.fromMillis(eventTime),
        value: quantity * price,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error normalizing ${exchange} data:`, error);
    return null;
  }
};
