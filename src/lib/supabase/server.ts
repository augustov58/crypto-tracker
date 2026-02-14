/**
 * Server-side Supabase client
 * Uses service role key for full database access
 * Only use in API routes and server components
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create a singleton server client
let serverClient: ReturnType<typeof createClient> | null = null;

export function getServerSupabase() {
  if (!serverClient) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase server credentials');
    }
    serverClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return serverClient;
}

// Type-safe database types
export interface DbWallet {
  id: number;
  chain: string;
  address: string;
  label: string | null;
  created_at: string;
}

export interface DbBalance {
  id: number;
  wallet_id: number;
  token_id: string;
  symbol: string;
  balance: string;
  usd_value: string | null;
  snapshot_at: string;
}

export interface DbSnapshot {
  id: number;
  total_usd: string;
  defi_usd: string;
  token_count: number;
  snapshot_at: string;
}

export interface DbPrice {
  id: number;
  token_id: string;
  price_usd: string;
  recorded_at: string;
}

export interface DbCostBasis {
  id: number;
  token_id: string;
  symbol: string;
  method: string;
  lots: CostBasisLot[];
  updated_at: string;
}

export interface CostBasisLot {
  date: string;
  qty: number;
  price_per_unit: number;
  notes?: string;
}
