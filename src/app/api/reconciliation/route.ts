/**
 * Reconciliation API
 * 
 * Compares wallet balances with cost basis lots to identify discrepancies
 */

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { calculateTotalQty } from '@/lib/pnl/calculator';

export interface ReconciliationItem {
  tokenId: string;
  symbol: string;
  walletBalance: number;
  costBasisQty: number;
  difference: number;
  differencePercent: number;
  currentPrice: number | null;
  differenceUsd: number | null;
  status: 'balanced' | 'over' | 'under' | 'no_cost_basis';
}

export interface ReconciliationResponse {
  items: ReconciliationItem[];
  summary: {
    totalTokens: number;
    balanced: number;
    needsAttention: number;
    noCostBasis: number;
  };
}

// Threshold for considering balanced (0.1% difference)
const BALANCE_THRESHOLD = 0.001;

// Minimum USD value to show tokens without cost basis (filters dust/spam)
const MIN_USD_VALUE_FOR_NO_CB = 10;

// Patterns that indicate spam/scam tokens
const SPAM_PATTERNS = [
  /https?:\/\//i,           // URLs in symbol
  /\.com|\.org|\.net|\.io/i, // Domain names
  /claim|reward|airdrop/i,   // Scam keywords
  /visit\s+/i,               // "Visit website..."
  /^0x[a-f0-9]{20,}/i,       // Raw contract addresses as symbols
];

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;

    // Get the latest snapshot time
    const { data: latestSnapshot } = await supabase
      .from('snapshots')
      .select('snapshot_at')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestSnapshot) {
      return NextResponse.json<ReconciliationResponse>({
        items: [],
        summary: {
          totalTokens: 0,
          balanced: 0,
          needsAttention: 0,
          noCostBasis: 0,
        },
      });
    }

    const snapshotAt = latestSnapshot.snapshot_at;

    // Get all balances at the latest snapshot, aggregated by token
    const { data: balances, error: balancesError } = await supabase
      .from('balances')
      .select('token_id, symbol, balance, usd_value')
      .eq('snapshot_at', snapshotAt);

    if (balancesError) {
      console.error('Failed to fetch balances:', balancesError);
      return NextResponse.json(
        { error: 'Failed to fetch balances' },
        { status: 500 }
      );
    }

    // Aggregate balances by token
    const walletBalances = new Map<string, { symbol: string; balance: number; usdValue: number | null }>();
    
    for (const b of balances || []) {
      const existing = walletBalances.get(b.token_id);
      const balance = parseFloat(b.balance) || 0;
      const usdValue = b.usd_value ? parseFloat(b.usd_value) : null;
      
      if (existing) {
        existing.balance += balance;
        if (usdValue !== null) {
          existing.usdValue = (existing.usdValue || 0) + usdValue;
        }
      } else {
        walletBalances.set(b.token_id, {
          symbol: b.symbol,
          balance,
          usdValue,
        });
      }
    }

    // Get all cost basis entries
    const { data: costBasisEntries, error: cbError } = await supabase
      .from('cost_basis')
      .select('token_id, symbol, lots');

    if (cbError) {
      console.error('Failed to fetch cost basis:', cbError);
      return NextResponse.json(
        { error: 'Failed to fetch cost basis' },
        { status: 500 }
      );
    }

    // Build cost basis map
    const costBasisMap = new Map<string, { symbol: string; totalQty: number }>();
    
    for (const cb of costBasisEntries || []) {
      const lots = typeof cb.lots === 'string' ? JSON.parse(cb.lots) : cb.lots;
      const totalQty = calculateTotalQty(lots);
      costBasisMap.set(cb.token_id, {
        symbol: cb.symbol,
        totalQty,
      });
    }

    // Get latest prices
    const allTokenIds = new Set([...walletBalances.keys(), ...costBasisMap.keys()]);
    const { data: pricesData } = await supabase
      .from('prices')
      .select('token_id, price_usd')
      .in('token_id', Array.from(allTokenIds))
      .eq('recorded_at', snapshotAt);

    const priceMap = new Map<string, number>();
    for (const p of pricesData || []) {
      priceMap.set(p.token_id, parseFloat(p.price_usd));
    }

    // Build reconciliation items
    const items: ReconciliationItem[] = [];
    
    // Helper to check if symbol looks like spam
    const isSpamSymbol = (symbol: string): boolean => {
      return SPAM_PATTERNS.some(pattern => pattern.test(symbol));
    };
    
    // Check all tokens that have either wallet balance or cost basis
    for (const tokenId of allTokenIds) {
      const walletData = walletBalances.get(tokenId);
      const costBasisData = costBasisMap.get(tokenId);
      
      const walletBalance = walletData?.balance || 0;
      const costBasisQty = costBasisData?.totalQty || 0;
      const symbol = walletData?.symbol || costBasisData?.symbol || tokenId.toUpperCase();
      const price = priceMap.get(tokenId) || null;
      const usdValue = price ? walletBalance * price : null;
      
      // Skip tokens with no wallet balance (we only care about tokens we hold)
      if (walletBalance <= 0) continue;
      
      // Skip very small balances (dust)
      if (walletBalance < 0.00001 && (!price || walletBalance * price < 0.01)) continue;
      
      // Skip spam tokens: no price, no cost basis, and either:
      // - Symbol looks like spam, OR
      // - Value is below threshold (can't determine value without price)
      const hasCostBasis = costBasisQty > 0;
      if (!price && !hasCostBasis) {
        // No price and no cost basis - likely spam unless high potential value
        if (isSpamSymbol(symbol)) continue;
        // Skip if we can't determine value (no price) - user can add manually if needed
        continue;
      }
      
      // Skip tokens with price but very low value and no cost basis
      if (usdValue !== null && usdValue < MIN_USD_VALUE_FOR_NO_CB && !hasCostBasis) {
        continue;
      }
      
      const difference = walletBalance - costBasisQty;
      const differencePercent = costBasisQty > 0 
        ? (difference / costBasisQty) * 100 
        : (walletBalance > 0 ? 100 : 0);
      
      const differenceUsd = price ? difference * price : null;
      
      // Determine status
      let status: ReconciliationItem['status'];
      
      if (costBasisQty === 0) {
        status = 'no_cost_basis';
      } else if (Math.abs(difference / walletBalance) < BALANCE_THRESHOLD) {
        status = 'balanced';
      } else if (difference > 0) {
        status = 'under'; // More in wallet than cost basis accounts for
      } else {
        status = 'over'; // Cost basis claims more than wallet has
      }
      
      items.push({
        tokenId,
        symbol,
        walletBalance,
        costBasisQty,
        difference,
        differencePercent,
        currentPrice: price,
        differenceUsd,
        status,
      });
    }

    // Sort: no_cost_basis first, then by absolute USD difference
    items.sort((a, b) => {
      // Prioritize no_cost_basis items
      if (a.status === 'no_cost_basis' && b.status !== 'no_cost_basis') return -1;
      if (b.status === 'no_cost_basis' && a.status !== 'no_cost_basis') return 1;
      
      // Then by absolute USD value of difference
      const aUsd = Math.abs(a.differenceUsd || 0);
      const bUsd = Math.abs(b.differenceUsd || 0);
      return bUsd - aUsd;
    });

    // Calculate summary
    const summary = {
      totalTokens: items.length,
      balanced: items.filter(i => i.status === 'balanced').length,
      needsAttention: items.filter(i => i.status === 'over' || i.status === 'under').length,
      noCostBasis: items.filter(i => i.status === 'no_cost_basis').length,
    };

    return NextResponse.json<ReconciliationResponse>({
      items,
      summary,
    });

  } catch (error) {
    console.error('Reconciliation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
