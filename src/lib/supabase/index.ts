/**
 * Supabase client exports
 */
export { getServerSupabase } from './server';
export { getClientSupabase } from './client';
export type {
  DbWallet,
  DbBalance,
  DbSnapshot,
  DbPrice,
  DbCostBasis,
  CostBasisLot,
} from './server';

// Backwards compatibility alias
export { getServerSupabase as createServerClient } from './server';
export { getClientSupabase as supabase } from './client';
