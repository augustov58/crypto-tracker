// PnL Calculation Types

export interface Lot {
  date: string;
  qty: number;
  price_per_unit: number;
  notes?: string;
}

export interface CostBasisEntry {
  id?: number;
  token_id: string;
  symbol: string;
  method: 'manual' | 'csv_import';
  lots: Lot[];
  updated_at?: string;
}

export type PnLMethod = 'fifo' | 'lifo' | 'average';

export interface PnLResult {
  token_id: string;
  symbol: string;
  
  // Current holdings
  total_qty: number;
  current_price: number;
  current_value: number;
  
  // Cost basis
  total_cost_basis: number;
  average_cost: number;
  
  // P&L
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  realized_pnl: number;
  
  // Method used
  method: PnLMethod;
}

export interface PortfolioPnLSummary {
  total_value: number;
  total_cost_basis: number;
  total_unrealized_pnl: number;
  total_unrealized_pnl_percent: number;
  total_realized_pnl: number;
  by_token: PnLResult[];
}

export interface SellAllocation {
  lot_index: number;
  qty_from_lot: number;
  cost_basis: number;
  sale_proceeds: number;
  realized_pnl: number;
}

export interface PartialSellResult {
  allocations: SellAllocation[];
  total_realized_pnl: number;
  remaining_lots: Lot[];
}
