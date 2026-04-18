import create from 'zustand';
import { DateTime } from 'luxon';
import { Liquidation } from '../types/liquidation';

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  timestamp?: DateTime;
}

interface LiquidationState {
  liquidations: Liquidation[];
  totalValue: number;
  highScore: number;
  achievements: Achievement[];
  seenIds: Set<string>;
  addLiquidation: (liquidation: Liquidation) => void;
  addLiquidations: (liquidations: Liquidation[]) => void;
  stats: {
    buyCount: number;
    sellCount: number;
    largestLiquidation: Liquidation | null;
    dailyStreak: number;
    lastActive: DateTime | null;
  };
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_million',
    title: 'FIRST MILLION',
    description: 'Witness 1M USDT in total liquidations',
    unlocked: false
  },
  {
    id: 'whale_hunter',
    title: 'WHALE HUNTER',
    description: 'Spot a single liquidation worth over 100k USDT',
    unlocked: false
  },
  {
    id: 'balanced_view',
    title: 'BALANCED VIEW',
    description: 'See equal number buy/sell liquidations (min 10 each)',
    unlocked: false
  }
];

export const useLiquidationStore = create<LiquidationState>((set) => ({
  liquidations: [],
  totalValue: 0,
  highScore: 0,
  achievements: ACHIEVEMENTS,
  seenIds: new Set<string>(),
  stats: {
    buyCount: 0,
    sellCount: 0,
    largestLiquidation: null,
    dailyStreak: 0,
    lastActive: null
  },
  addLiquidation: (liquidation) =>
    set((state) => {
      // Deduplication check
      if (state.seenIds.has(liquidation.id)) {
        return state;
      }

      // Add to seenIds with a cap to prevent memory leak
      const newSeenIds = new Set(state.seenIds);
      newSeenIds.add(liquidation.id);
      if (newSeenIds.size > 1500) {
        const firstId = newSeenIds.keys().next().value;
        newSeenIds.delete(firstId as string);
      }

      // STRICT MEMORY CAP: Definitively slice liquidations array to hold maximum of 1,000 items
      const newLiquidations = [liquidation, ...state.liquidations].slice(0, 1000);
      const newTotalValue = state.totalValue + liquidation.value;
      const newHighScore = Math.max(state.highScore, newTotalValue);
      
      // Update achievements
      const newAchievements = state.achievements.map(achievement => {
        if (achievement.unlocked) return achievement;
        
        let shouldUnlock = false;
        
        switch (achievement.id) {
          case 'first_million':
            shouldUnlock = newTotalValue >= 1000000;
            break;
          case 'whale_hunter':
            shouldUnlock = liquidation.value >= 100000;
            break;
          case 'balanced_view':
            const { buyCount, sellCount } = state.stats;
            shouldUnlock = buyCount >= 10 && sellCount >= 10 && buyCount === sellCount;
            break;
        }
        
        if (shouldUnlock) {
          return { ...achievement, unlocked: true, timestamp: DateTime.now() };
        }
        return achievement;
      });

      // Update streak
      const now = DateTime.now();
      const lastActive = state.stats.lastActive;
      let dailyStreak = state.stats.dailyStreak;

      if (!lastActive) {
        dailyStreak = 1;
      } else {
        const daysDiff = now.diff(lastActive, 'days').days;
        if (daysDiff >= 1 && daysDiff < 2) {
          dailyStreak += 1;
        } else if (daysDiff >= 2) {
          dailyStreak = 1;
        }
      }

      const newStats = {
        buyCount: state.stats.buyCount + (liquidation.side === 'BUY' ? 1 : 0),
        sellCount: state.stats.sellCount + (liquidation.side === 'SELL' ? 1 : 0),
        largestLiquidation:
          !state.stats.largestLiquidation || liquidation.value > state.stats.largestLiquidation.value
            ? liquidation
            : state.stats.largestLiquidation,
        dailyStreak,
        lastActive: now
      };

      return {
        liquidations: newLiquidations,
        totalValue: newTotalValue,
        highScore: newHighScore,
        achievements: newAchievements,
        seenIds: newSeenIds,
        stats: newStats
      };
    }),

  addLiquidations: (incoming) => 
    set((state) => {
      if (incoming.length === 0) return state;

      const newSeenIds = new Set(state.seenIds);
      const addedLiquidations: Liquidation[] = [];
      let newTotalValue = state.totalValue;
      let { buyCount, sellCount, largestLiquidation, lastActive } = state.stats;

      for (const liq of incoming) {
        if (newSeenIds.has(liq.id)) continue;
        newSeenIds.add(liq.id);
        addedLiquidations.push(liq);
        newTotalValue += liq.value;
        
        buyCount += (liq.side === 'BUY' ? 1 : 0);
        sellCount += (liq.side === 'SELL' ? 1 : 0);
        if (!largestLiquidation || liq.value > largestLiquidation.value) {
          largestLiquidation = liq;
        }
      }

      if (addedLiquidations.length === 0) return state;

      while (newSeenIds.size > 1500) {
        const firstId = newSeenIds.keys().next().value;
        newSeenIds.delete(firstId as string);
      }

      // Since 'addedLiquidations' are newest to oldest theoretically, or whatever order they came in
      // Let's prepend them. Incoming is usually oldest to newest per chunk, so reverse it to put newest first.
      const newLiquidations = [...addedLiquidations.reverse(), ...state.liquidations].slice(0, 1000);
      const newHighScore = Math.max(state.highScore, newTotalValue);

      const now = DateTime.now();
      let dailyStreak = state.stats.dailyStreak;
      if (!lastActive) {
        dailyStreak = 1;
      } else {
        const daysDiff = now.diff(lastActive, 'days').days;
        if (daysDiff >= 1 && daysDiff < 2) dailyStreak += 1;
        else if (daysDiff >= 2) dailyStreak = 1;
      }

      const newAchievements = state.achievements.map(achievement => {
        if (achievement.unlocked) return achievement;
        let shouldUnlock = false;
        switch (achievement.id) {
          case 'first_million': shouldUnlock = newTotalValue >= 1000000; break;
          case 'whale_hunter': shouldUnlock = largestLiquidation?.value !== undefined && largestLiquidation.value >= 100000; break;
          case 'balanced_view': shouldUnlock = buyCount >= 10 && sellCount >= 10 && buyCount === sellCount; break;
        }
        if (shouldUnlock) return { ...achievement, unlocked: true, timestamp: now };
        return achievement;
      });

      return {
        liquidations: newLiquidations,
        totalValue: newTotalValue,
        highScore: newHighScore,
        achievements: newAchievements,
        seenIds: newSeenIds,
        stats: { buyCount, sellCount, largestLiquidation, dailyStreak, lastActive: now }
      };
    }),
}));