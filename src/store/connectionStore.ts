import { create } from 'zustand';

export type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export interface ExchangeConnectionInfo {
  status: ConnectionStatus;
  lastMessageAt: number;
  rtt: number | null;
}

interface ConnectionState {
  exchanges: Record<string, ExchangeConnectionInfo>;
  updateExchange: (exchange: string, data: Partial<ExchangeConnectionInfo>) => void;
  getOverallHealth: (activeExchanges: string[]) => { status: ConnectionStatus, isStale: boolean, aggregatedRtt: number | null };
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  exchanges: {},
  updateExchange: (exchange, data) => set((state) => {
    const currentState = state.exchanges[exchange] || { status: 'DISCONNECTED', lastMessageAt: Date.now(), rtt: null };
    return {
      exchanges: {
        ...state.exchanges,
        [exchange]: { ...currentState, ...data }
      }
    };
  }),
  getOverallHealth: (activeExchanges) => {
    const state = get();
    if (activeExchanges.length === 0) return { status: 'DISCONNECTED', isStale: false, aggregatedRtt: null };
    
    let connectedCount = 0;
    let reconnectingCount = 0;
    let maxRtt: number | null = null;
    let isStale = false;
    const now = Date.now();

    activeExchanges.forEach(ex => {
      const info = state.exchanges[ex];
      if (!info) return;

      if (info.status === 'CONNECTED') connectedCount++;
      if (info.status === 'RECONNECTING') reconnectingCount++;
      
      if (info.rtt !== null) {
        maxRtt = maxRtt === null ? info.rtt : Math.max(maxRtt, info.rtt);
      }
      
      // If ANY connected exchange hasn't received a message in 5 seconds, it's stale
      if (info.status === 'CONNECTED' && now - info.lastMessageAt > 5000) {
        isStale = true;
      }
    });

    const status: ConnectionStatus =
      connectedCount === activeExchanges.length ? 'CONNECTED' :
      (connectedCount > 0 || reconnectingCount > 0 ? 'RECONNECTING' : 'DISCONNECTED');

    return { status, isStale, aggregatedRtt: maxRtt };
  }
}));
