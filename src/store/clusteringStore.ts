import create from 'zustand';
import { DateTime } from 'luxon';
import { Liquidation } from '../types/liquidation';

export interface LiqCluster {
  id: string;
  baseAsset: string;
  side: 'BUY' | 'SELL';
  minPrice: number;
  maxPrice: number;
  totalValue: number;
  count: number;
  lastUpdate: DateTime;
  events: Liquidation[];
}

interface ClusteringState {
  clusters: LiqCluster[];
  addLiquidation: (liq: Liquidation) => void;
  addLiquidations: (liqs: Liquidation[]) => void;
  pruneClusters: () => void;
}

const CLUSTERING_WINDOW_MINUTES = 10;
const PRICE_BUCKET_PERCENT = 0.002; // 0.2% bucket size

export const useClusteringStore = create<ClusteringState>((set) => ({
  clusters: [],
  
  addLiquidation: (liq) => set((state) => {
    const now = DateTime.now();
    const threshold = now.minus({ minutes: CLUSTERING_WINDOW_MINUTES });
    
    // 1. Find matching cluster (must be active, same side, same base asset, and price within threshold)
    const matchIndex = state.clusters.findIndex(c => {
      if (c.lastUpdate <= threshold) return false;
      if (c.baseAsset !== liq.baseAsset || c.side !== liq.side) return false;
      
      const avgPrice = (c.minPrice + c.maxPrice) / 2;
      const priceDiff = Math.abs(liq.price - avgPrice) / avgPrice;
      return priceDiff <= PRICE_BUCKET_PERCENT;
    });

    if (matchIndex >= 0) {
      const existing = state.clusters[matchIndex];
      const updated = {
        ...existing,
        minPrice: Math.min(existing.minPrice, liq.price),
        maxPrice: Math.max(existing.maxPrice, liq.price),
        totalValue: existing.totalValue + liq.value,
        count: existing.count + 1,
        lastUpdate: now,
        events: [liq, ...existing.events].slice(0, 50) // Keep history light
      };
      const newClusters = [...state.clusters];
      newClusters[matchIndex] = updated;
      return { clusters: newClusters };
    } else {
      const newCluster: LiqCluster = {
        id: `cluster-${liq.id}`,
        baseAsset: liq.baseAsset,
        side: liq.side,
        minPrice: liq.price,
        maxPrice: liq.price,
        totalValue: liq.value,
        count: 1,
        lastUpdate: now,
        events: [liq]
      };
      let nextClusters = [...state.clusters, newCluster];
      // STRICT MEMORY CAP: Prevent array from growing infinitely
      // and causing memory leaks / browser crashes on heavy load
      if (nextClusters.length > 500) {
        nextClusters.sort((a, b) => b.lastUpdate.toMillis() - a.lastUpdate.toMillis());
        nextClusters = nextClusters.slice(0, 500);
      }
      return { clusters: nextClusters };
    }
  }),

  pruneClusters: () => set((state) => {
    const threshold = DateTime.now().minus({ minutes: CLUSTERING_WINDOW_MINUTES });
    return { clusters: state.clusters.filter(c => c.lastUpdate > threshold) };
  }),

  addLiquidations: (liqs) => set((state) => {
    if (liqs.length === 0) return state;

    const now = DateTime.now();
    const threshold = now.minus({ minutes: CLUSTERING_WINDOW_MINUTES });
    let currentClusters = [...state.clusters];

    for (const liq of liqs) {
      const matchIndex = currentClusters.findIndex(c => {
        if (c.lastUpdate <= threshold) return false;
        if (c.baseAsset !== liq.baseAsset || c.side !== liq.side) return false;
        
        const avgPrice = (c.minPrice + c.maxPrice) / 2;
        const priceDiff = Math.abs(liq.price - avgPrice) / avgPrice;
        return priceDiff <= PRICE_BUCKET_PERCENT;
      });

      if (matchIndex >= 0) {
        const existing = currentClusters[matchIndex];
        currentClusters[matchIndex] = {
          ...existing,
          minPrice: Math.min(existing.minPrice, liq.price),
          maxPrice: Math.max(existing.maxPrice, liq.price),
          totalValue: existing.totalValue + liq.value,
          count: existing.count + 1,
          lastUpdate: now,
          events: [liq, ...existing.events].slice(0, 50)
        };
      } else {
        const newCluster: LiqCluster = {
          id: `cluster-${liq.id}`,
          baseAsset: liq.baseAsset,
          side: liq.side,
          minPrice: liq.price,
          maxPrice: liq.price,
          totalValue: liq.value,
          count: 1,
          lastUpdate: now,
          events: [liq]
        };
        currentClusters.push(newCluster);
      }
    }

    if (currentClusters.length > 500) {
      currentClusters.sort((a, b) => b.lastUpdate.toMillis() - a.lastUpdate.toMillis());
      currentClusters = currentClusters.slice(0, 500);
    }

    return { clusters: currentClusters };
  })
}));
