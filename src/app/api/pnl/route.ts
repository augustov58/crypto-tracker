// PnL Calculation API Route

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { calculateTokenPnL } from '@/lib/pnl/calculator';
import type { PnLMethod, PnLResult, PortfolioPnLSummary, Lot } from '@/lib/pnl/types';

interface CostBasisRow {
  id: number;
  token_id: string;
  symbol: string;
  method: string;
  lots: Lot[];
  updated_at: string;
}

interface PriceRow {
  token_id: string;
  price_usd: string;
}

// GET - Calculate PnL for all tokens or specific token
export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServerClient() as any;
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('token_id');
    const method = (searchParams.get('method') || 'fifo') as PnLMethod;
    
    // Validate method
    if (!['fifo', 'lifo', 'average'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid PnL method. Use fifo, lifo, or average.' },
        { status: 400 }
      );
    }
    
    // Fetch cost basis entries
    let costBasisQuery = supabase.from('cost_basis').select('*');
    if (tokenId) {
      costBasisQuery = costBasisQuery.eq('token_id', tokenId);
    }
    
    const { data: costBasisData, error: costBasisError } = await costBasisQuery;
    
    if (costBasisError) {
      console.error('Error fetching cost basis:', costBasisError);
      return NextResponse.json(
        { error: 'Failed to fetch cost basis data' },
        { status: 500 }
      );
    }
    
    if (!costBasisData || costBasisData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total_value: 0,
          total_cost_basis: 0,
          total_unrealized_pnl: 0,
          total_unrealized_pnl_percent: 0,
          total_realized_pnl: 0,
          by_token: [],
        } as PortfolioPnLSummary,
      });
    }
    
    // Parse cost basis entries
    const costBasisEntries = (costBasisData as CostBasisRow[]).map(entry => ({
      ...entry,
      lots: typeof entry.lots === 'string' ? JSON.parse(entry.lots) : entry.lots,
    }));
    
    // Get token IDs for price lookup
    const tokenIds = costBasisEntries.map(e => e.token_id);
    
    // Fetch latest prices from the prices table
    // We get the most recent price for each token
    const { data: pricesData } = await supabase
      .from('prices')
      .select('token_id, price_usd')
      .in('token_id', tokenIds)
      .order('recorded_at', { ascending: false });
    
    // Build price map (get latest price per token)
    const priceMap = new Map<string, number>();
    if (pricesData) {
      for (const price of pricesData as PriceRow[]) {
        if (!priceMap.has(price.token_id)) {
          priceMap.set(price.token_id, parseFloat(price.price_usd));
        }
      }
    }
    
    // If we don't have prices in our DB, try to get from latest balances
    const missingPrices = tokenIds.filter(id => !priceMap.has(id));
    if (missingPrices.length > 0) {
      // Try to get prices from CoinGecko directly or use fallback
      // For now, we'll use a fallback approach
      const { data: balanceData } = await supabase
        .from('balances')
        .select('token_id, balance, usd_value')
        .in('token_id', missingPrices)
        .order('snapshot_at', { ascending: false });
      
      if (balanceData) {
        for (const balance of balanceData as { token_id: string; balance: string; usd_value: string }[]) {
          if (!priceMap.has(balance.token_id)) {
            const bal = parseFloat(balance.balance);
            const usd = parseFloat(balance.usd_value);
            if (bal > 0 && usd > 0) {
              priceMap.set(balance.token_id, usd / bal);
            }
          }
        }
      }
    }
    
    // Calculate PnL for each token
    const results: PnLResult[] = [];
    
    for (const entry of costBasisEntries) {
      const currentPrice = priceMap.get(entry.token_id) || 0;
      
      const pnl = calculateTokenPnL(
        entry.token_id,
        entry.symbol,
        entry.lots,
        currentPrice,
        method
      );
      
      results.push(pnl);
    }
    
    // Calculate portfolio totals
    const summary: PortfolioPnLSummary = {
      total_value: results.reduce((sum, r) => sum + r.current_value, 0),
      total_cost_basis: results.reduce((sum, r) => sum + r.total_cost_basis, 0),
      total_unrealized_pnl: results.reduce((sum, r) => sum + r.unrealized_pnl, 0),
      total_unrealized_pnl_percent: 0,
      total_realized_pnl: results.reduce((sum, r) => sum + r.realized_pnl, 0),
      by_token: results,
    };
    
    // Calculate overall percentage
    if (summary.total_cost_basis > 0) {
      summary.total_unrealized_pnl_percent = 
        (summary.total_unrealized_pnl / summary.total_cost_basis) * 100;
    }
    
    return NextResponse.json({
      success: true,
      data: summary,
      method,
    });
  } catch (error) {
    console.error('Error calculating PnL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
