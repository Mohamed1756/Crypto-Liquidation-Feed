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

export const buildClustersFromLiquidations = (
  liquidations: Liquidation[],
  referenceTimeMillis = Date.now(),
) => {
  const thresholdMillis = referenceTimeMillis - CLUSTERING_WINDOW_MINUTES * 60_000;
  const currentClusters: LiqCluster[] = [];

  const sortedLiquidations = [...liquidations].sort(
    (left, right) => left.timestamp.toMillis() - right.timestamp.toMillis(),
  );

  for (const liq of sortedLiquidations) {
    if (liq.timestamp.toMillis() <= thresholdMillis) {
      continue;
    }

    const matchIndex = currentClusters.findIndex((cluster) => {
      if (cluster.lastUpdate.toMillis() <= thresholdMillis) {
        return false;
      }
      if (cluster.baseAsset !== liq.baseAsset || cluster.side !== liq.side) {
        return false;
      }

      const avgPrice = (cluster.minPrice + cluster.maxPrice) / 2;
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
        lastUpdate: liq.timestamp,
        events: [liq, ...existing.events].slice(0, 50),
      };
      continue;
    }

    currentClusters.push({
      id: `cluster-${liq.id}`,
      baseAsset: liq.baseAsset,
      side: liq.side,
      minPrice: liq.price,
      maxPrice: liq.price,
      totalValue: liq.value,
      count: 1,
      lastUpdate: liq.timestamp,
      events: [liq],
    });
  }

  return currentClusters
    .filter((cluster) => cluster.lastUpdate.toMillis() > thresholdMillis)
    .sort((left, right) => right.totalValue - left.totalValue)
    .slice(0, 500);
};

export const buildVolatilityZones = (clusters: LiqCluster[]) => {
  const massive = clusters.filter((cluster) => cluster.totalValue >= 1_000_000);
  const byAsset: Record<string, LiqCluster[]> = {};

  for (const cluster of massive) {
    if (!byAsset[cluster.baseAsset]) {
      byAsset[cluster.baseAsset] = [];
    }
    byAsset[cluster.baseAsset].push(cluster);
  }

  const voids: { asset: string; minLimit: number; maxLimit: number; diffPercent: number }[] = [];

  Object.entries(byAsset).forEach(([asset, assetClusters]) => {
    const sortedClusters = [...assetClusters].sort((left, right) => left.minPrice - right.minPrice);
    for (let index = 0; index < sortedClusters.length - 1; index += 1) {
      const lower = sortedClusters[index];
      const higher = sortedClusters[index + 1];

      if (higher.minPrice <= lower.maxPrice) {
        continue;
      }

      const diffPercent = ((higher.minPrice - lower.maxPrice) / lower.maxPrice) * 100;
      if (diffPercent > 0.05) {
        voids.push({
          asset,
          minLimit: lower.maxPrice,
          maxLimit: higher.minPrice,
          diffPercent,
        });
      }
    }
  });

  return voids.sort((left, right) => right.diffPercent - left.diffPercent);
};

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
