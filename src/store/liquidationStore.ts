import { create } from 'zustand';
import type { Liquidation } from '../types/liquidation';

const MAX_LIQUIDATIONS = 1000;
const MAX_SEEN_IDS = 1500;

interface LiquidationState {
  liquidations: Liquidation[];
  totalValue: number;
  seenIds: Set<string>;
  addLiquidations: (liquidations: Liquidation[]) => void;
  stats: {
    buyCount: number;
    sellCount: number;
    largestLiquidation: Liquidation | null;
  };
}

export const useLiquidationStore = create<LiquidationState>((set) => ({
  liquidations: [],
  totalValue: 0,
  seenIds: new Set<string>(),
  stats: {
    buyCount: 0,
    sellCount: 0,
    largestLiquidation: null,
  },

  addLiquidations: (incoming) =>
    set((state) => {
      if (incoming.length === 0) {
        return state;
      }

      const nextSeenIds = new Set(state.seenIds);
      const accepted: Liquidation[] = [];
      let totalValue = state.totalValue;
      let { buyCount, sellCount, largestLiquidation } = state.stats;

      for (const liquidation of incoming) {
        if (nextSeenIds.has(liquidation.id)) {
          continue;
        }

        nextSeenIds.add(liquidation.id);
        accepted.push(liquidation);
        totalValue += liquidation.value;
        buyCount += liquidation.side === 'BUY' ? 1 : 0;
        sellCount += liquidation.side === 'SELL' ? 1 : 0;

        if (!largestLiquidation || liquidation.value > largestLiquidation.value) {
          largestLiquidation = liquidation;
        }
      }

      if (accepted.length === 0) {
        return state;
      }

      while (nextSeenIds.size > MAX_SEEN_IDS) {
        const oldestId = nextSeenIds.keys().next().value;
        nextSeenIds.delete(oldestId as string);
      }

      return {
        liquidations: [...accepted.reverse(), ...state.liquidations].slice(0, MAX_LIQUIDATIONS),
        totalValue,
        seenIds: nextSeenIds,
        stats: {
          buyCount,
          sellCount,
          largestLiquidation,
        },
      };
    }),
}));