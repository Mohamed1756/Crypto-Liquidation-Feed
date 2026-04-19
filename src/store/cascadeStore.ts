import { create } from 'zustand';
import type { CascadeRuntimeState } from '../analytics/types';

interface CascadeState {
  riskPercent: number;
  totalValue500ms: number;
  applySnapshot: (snapshot: CascadeRuntimeState) => void;
}

export const useCascadeStore = create<CascadeState>((set) => ({
  riskPercent: 0,
  totalValue500ms: 0,
  applySnapshot: (snapshot) => set(snapshot),
}));
