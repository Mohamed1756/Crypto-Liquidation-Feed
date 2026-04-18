import { DateTime } from 'luxon';

export interface Liquidation {
  id: string;
  exchange: 'BINANCE' | 'BYBIT' | 'OKX';
  symbol: string;
  baseAsset: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  quantity: number;
  price: number;
  orderStatus: string;
  timestamp: DateTime;
  value: number;
}