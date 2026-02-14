/**
 * Portfolio API
 * 
 * GET: Returns current portfolio state with latest balances, prices, and PnL
 * Aggregates tokens across all wallets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export interface PortfolioToken {
  tokenId: string;
  symbol: string;
  totalBalance: number;
  price: number | null;
  usdValue: number | null;
  change24h: number | null;
  walletBreakdown: Array<{
    walletId: number;
    walletLabel: string | null;
    chain: string;
    address: string;
    balance: number;
    usdValue: number | null;
  }>;
  // PnL fields (if cost basis exists)
  costBasis?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
}

export interface PortfolioResponse {
  totalUsd: number;
  change24hUsd: number | null;
  change24hPercent: number | null;
  tokens: PortfolioToken[];
  lastUpdated: string | null;
}

export async function GET(request: NextRequest) {
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
      return NextResponse.json({
        totalUsd: 0,
        change24hUsd: null,
        change24hPercent: null,
        tokens: [],
        lastUpdated: null,
      });
    }

    const snapshotAt = latestSnapshot.snapshot_at;

    // Get all balances at the latest snapshot time
    const { data: balances, error: balancesError } = await supabase
      .from('balances')
      .select(`
        *,
        wallets (
          id,
          chain,
          address,
          label
        )
      `)
      .eq('snapshot_at', snapshotAt);

    if (balancesError) {
      console.error('Failed to fetch balances:', balancesError);
      return NextResponse.json(
        { error: 'Failed to fetch balances' },
        { status: 500 }
      );
    }

    // Get latest prices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenIds = [...new Set(balances?.map((b: any) => b.token_id) || [])];
    const { data: pricesData } = await supabase
      .from('prices')
      .select('*')
      .in('token_id', tokenIds)
      .eq('recorded_at', snapshotAt);

    const priceMap = new Map<string, { price: number; change24h?: number }>();
    for (const p of pricesData || []) {
      priceMap.set(p.token_id, { price: parseFloat(p.price_usd) });
    }

    // Get cost basis for PnL calculation
    const { data: costBasisData } = await supabase
      .from('cost_basis')
      .select('*')
      .in('token_id', tokenIds);

    const costBasisMap = new Map<string, { totalCost: number; totalQty: number }>();
    for (const cb of costBasisData || []) {
      const lots = cb.lots as Array<{ qty: number; price_per_unit: number }>;
      let totalCost = 0;
      let totalQty = 0;
      for (const lot of lots) {
        if (lot.qty > 0) {
          totalCost += lot.qty * lot.price_per_unit;
          totalQty += lot.qty;
        }
      }
      costBasisMap.set(cb.token_id, { totalCost, totalQty });
    }

    // Aggregate balances by token
    const tokenMap = new Map<string, PortfolioToken>();

    for (const balance of balances || []) {
      const wallet = balance.wallets as {
        id: number;
        chain: string;
        address: string;
        label: string | null;
      };

      const existing = tokenMap.get(balance.token_id);
      const balanceNum = parseFloat(balance.balance);
      const usdValue = balance.usd_value ? parseFloat(balance.usd_value) : null;
      const priceInfo = priceMap.get(balance.token_id);

      if (existing) {
        existing.totalBalance += balanceNum;
        if (usdValue !== null) {
          existing.usdValue = (existing.usdValue || 0) + usdValue;
        }
        existing.walletBreakdown.push({
          walletId: wallet.id,
          walletLabel: wallet.label,
          chain: wallet.chain,
          address: wallet.address,
          balance: balanceNum,
          usdValue,
        });
      } else {
        const token: PortfolioToken = {
          tokenId: balance.token_id,
          symbol: balance.symbol,
          totalBalance: balanceNum,
          price: priceInfo?.price ?? null,
          usdValue,
          change24h: priceInfo?.change24h ?? null,
          walletBreakdown: [{
            walletId: wallet.id,
            walletLabel: wallet.label,
            chain: wallet.chain,
            address: wallet.address,
            balance: balanceNum,
            usdValue,
          }],
        };

        // Add PnL if cost basis exists
        const costBasis = costBasisMap.get(balance.token_id);
        if (costBasis && costBasis.totalQty > 0) {
          const avgCostPerUnit = costBasis.totalCost / costBasis.totalQty;
          token.costBasis = avgCostPerUnit;
          if (priceInfo?.price) {
            const currentValue = balanceNum * priceInfo.price;
            const costValue = balanceNum * avgCostPerUnit;
            token.unrealizedPnl = currentValue - costValue;
            token.unrealizedPnlPercent = ((currentValue - costValue) / costValue) * 100;
          }
        }

        tokenMap.set(balance.token_id, token);
      }
    }

    // Calculate totals
    let totalUsd = 0;
    const tokens = Array.from(tokenMap.values());
    
    for (const token of tokens) {
      // Recalculate PnL after aggregation
      const costBasis = costBasisMap.get(token.tokenId);
      if (costBasis && costBasis.totalQty > 0 && token.price) {
        const avgCostPerUnit = costBasis.totalCost / costBasis.totalQty;
        token.costBasis = avgCostPerUnit;
        const currentValue = token.totalBalance * token.price;
        const costValue = token.totalBalance * avgCostPerUnit;
        token.unrealizedPnl = currentValue - costValue;
        token.unrealizedPnlPercent = ((currentValue - costValue) / costValue) * 100;
      }
      
      if (token.usdValue !== null) {
        totalUsd += token.usdValue;
      }
    }

    // Sort by USD value descending
    tokens.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));

    // Get 24h ago snapshot for change calculation
    const yesterday = new Date(snapshotAt);
    yesterday.setHours(yesterday.getHours() - 24);

    const { data: previousSnapshot } = await supabase
      .from('snapshots')
      .select('total_usd')
      .lt('snapshot_at', snapshotAt)
      .gte('snapshot_at', yesterday.toISOString())
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .single();

    let change24hUsd: number | null = null;
    let change24hPercent: number | null = null;

    if (previousSnapshot) {
      const prevTotal = parseFloat(previousSnapshot.total_usd);
      change24hUsd = totalUsd - prevTotal;
      change24hPercent = prevTotal > 0 ? ((totalUsd - prevTotal) / prevTotal) * 100 : null;
    }

    return NextResponse.json<PortfolioResponse>({
      totalUsd,
      change24hUsd,
      change24hPercent,
      tokens,
      lastUpdated: snapshotAt,
    });

  } catch (error) {
    console.error('Portfolio API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
