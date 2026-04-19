import { create } from 'zustand';

interface FundingState {
  rawRates: Record<string, number>; // symbol -> average 8h rate (decimals, e.g. 0.0001 = 0.01%)
  setRawRates: (rates: { symbol: string, averageRate: number }[]) => void;
}

export const useFundingStore = create<FundingState>((set) => ({
  rawRates: {},
  setRawRates: (ratesArr) => {
    const rawRates: Record<string, number> = {};
    ratesArr.forEach(r => {
      rawRates[r.symbol] = r.averageRate;
    });
    set({ rawRates });
  }
}));
