/**
 * Client-side Supabase client
 * Uses anon key for restricted access
 * Safe to use in browser components
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a singleton client-side instance
let browserClient: ReturnType<typeof createClient> | null = null;

export function getClientSupabase() {
  if (!browserClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase client credentials');
    }
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

// Re-export types from server module
export type {
  DbWallet,
  DbBalance,
  DbSnapshot,
  DbPrice,
  DbCostBasis,
  CostBasisLot,
} from './server';
