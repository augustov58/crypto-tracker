import { create } from 'zustand';

export type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
export type PnlMethod = 'fifo' | 'lifo' | 'average';
export type ProjectionModel = 'cagr' | 'scenarios' | 'montecarlo';

interface PortfolioState {
  // Time range for charts
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  
  // PnL calculation method
  pnlMethod: PnlMethod;
  setPnlMethod: (method: PnlMethod) => void;
  
  // Projection model
  projectionModel: ProjectionModel;
  setProjectionModel: (model: ProjectionModel) => void;
  
  // UI state
  isRefreshing: boolean;
  setIsRefreshing: (refreshing: boolean) => void;
  
  // Selected token for detail view
  selectedTokenId: string | null;
  setSelectedTokenId: (tokenId: string | null) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  timeRange: '7d',
  setTimeRange: (range) => set({ timeRange: range }),
  
  pnlMethod: 'fifo',
  setPnlMethod: (method) => set({ pnlMethod: method }),
  
  projectionModel: 'cagr',
  setProjectionModel: (model) => set({ projectionModel: model }),
  
  isRefreshing: false,
  setIsRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
  
  selectedTokenId: null,
  setSelectedTokenId: (tokenId) => set({ selectedTokenId: tokenId }),
}));
