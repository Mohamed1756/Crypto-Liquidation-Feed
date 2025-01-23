import { DateTime } from 'luxon';

export interface Liquidation {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  quantity: number;
  price: number;
  orderStatus: string;
  timestamp: DateTime;
  value: number;
}