/**
 * Hourly Snapshot Cron Endpoint
 * 
 * This endpoint:
 * 1. Verifies CRON_SECRET
 * 2. Fetches balances from all chains in parallel
 * 3. Fetches prices from CoinGecko
 * 4. Stores balances in the balances table
 * 5. Stores prices in the prices table
 * 6. Creates aggregated snapshot in snapshots table
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, DbWallet } from '@/lib/supabase';
import { fetchBalancesByChain, Chain, TokenBalance } from '@/lib/chains';
import { fetchPrices, PriceMap } from '@/lib/prices/coingecko';

const CRON_SECRET = process.env.CRON_SECRET;

interface ChainFetchResult {
  wallet: DbWallet;
  balances: TokenBalance[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const urlSecret = request.nextUrl.searchParams.get('key');
    const providedSecret = authHeader?.replace('Bearer ', '') || urlSecret;

    if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const snapshotAt = new Date().toISOString();

    // 2. Fetch all wallets from DB
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('*');

    if (walletsError) {
      console.error('Failed to fetch wallets:', walletsError);
      return NextResponse.json(
        { error: 'Failed to fetch wallets', details: walletsError.message },
        { status: 500 }
      );
    }

    if (!wallets || wallets.length === 0) {
      return NextResponse.json({
        message: 'No wallets configured',
        snapshot: null,
      });
    }

    console.log(`[Cron] Starting snapshot for ${wallets.length} wallets`);

    // 3. Fetch balances from all chains in parallel
    const balancePromises = (wallets as DbWallet[]).map(async (wallet): Promise<ChainFetchResult> => {
      try {
        const balances = await fetchBalancesByChain(
          wallet.address,
          wallet.chain as Chain
        );
        return { wallet, balances };
      } catch (error) {
        console.error(`[Cron] Failed to fetch ${wallet.chain}:${wallet.address}:`, error);
        return {
          wallet,
          balances: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const results = await Promise.allSettled(balancePromises);
    
    // Collect all balances and extract unique token IDs for price fetch
    const allBalances: Array<{ wallet: DbWallet; balance: TokenBalance }> = [];
    const tokenIds = new Set<string>();
    const errors: Array<{ wallet: string; chain: string; error: string }> = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { wallet, balances, error } = result.value;
        
        if (error) {
          errors.push({ wallet: wallet.address, chain: wallet.chain, error });
        }
        
        for (const balance of balances) {
          allBalances.push({ wallet, balance });
          if (balance.tokenId && !balance.tokenId.startsWith('0x')) {
            tokenIds.add(balance.tokenId);
          }
        }
      } else {
        console.error('[Cron] Promise rejected:', result.reason);
      }
    }

    console.log(`[Cron] Fetched ${allBalances.length} token balances across ${wallets.length} wallets`);

    // 4. Fetch prices from CoinGecko
    let prices: PriceMap = {};
    if (tokenIds.size > 0) {
      try {
        prices = await fetchPrices(Array.from(tokenIds), {
          include24hChange: true,
        });
        console.log(`[Cron] Fetched prices for ${Object.keys(prices).length} tokens`);
      } catch (error) {
        console.error('[Cron] Failed to fetch prices:', error);
        // Continue without prices - we'll store null USD values
      }
    }

    // 5. Store prices in the prices table
    if (Object.keys(prices).length > 0) {
      const priceRecords = Object.entries(prices).map(([tokenId, priceData]) => ({
        token_id: tokenId,
        price_usd: priceData.usd.toString(),
        recorded_at: snapshotAt,
      }));

      const { error: priceError } = await supabase
        .from('prices')
        .upsert(priceRecords, {
          onConflict: 'token_id,recorded_at',
          ignoreDuplicates: true,
        });

      if (priceError) {
        console.error('[Cron] Failed to store prices:', priceError);
      }
    }

    // 6. Store balances in the balances table
    let totalUsd = 0;
    let tokenCount = 0;
    const balanceRecords: Array<{
      wallet_id: number;
      token_id: string;
      symbol: string;
      balance: string;
      usd_value: string | null;
      snapshot_at: string;
    }> = [];

    for (const { wallet, balance } of allBalances) {
      const price = prices[balance.tokenId];
      const usdValue = price ? balance.balance * price.usd : null;

      if (usdValue !== null) {
        totalUsd += usdValue;
      }
      tokenCount++;

      balanceRecords.push({
        wallet_id: wallet.id,
        token_id: balance.tokenId,
        symbol: balance.symbol,
        balance: balance.balance.toString(),
        usd_value: usdValue?.toString() ?? null,
        snapshot_at: snapshotAt,
      });
    }

    if (balanceRecords.length > 0) {
      const { error: balanceError } = await supabase
        .from('balances')
        .upsert(balanceRecords, {
          onConflict: 'wallet_id,token_id,snapshot_at',
          ignoreDuplicates: true,
        });

      if (balanceError) {
        console.error('[Cron] Failed to store balances:', balanceError);
      }
    }

    // 7. Create aggregated snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('snapshots')
      .upsert({
        total_usd: totalUsd.toString(),
        defi_usd: '0', // DeFi positions would be added later
        token_count: tokenCount,
        snapshot_at: snapshotAt,
      }, {
        onConflict: 'snapshot_at',
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('[Cron] Failed to create snapshot:', snapshotError);
      return NextResponse.json(
        { error: 'Failed to create snapshot', details: snapshotError.message },
        { status: 500 }
      );
    }

    console.log(`[Cron] Snapshot complete: $${totalUsd.toFixed(2)} across ${tokenCount} tokens`);

    return NextResponse.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        totalUsd,
        tokenCount,
        snapshotAt,
      },
      walletCount: wallets.length,
      balanceCount: balanceRecords.length,
      priceCount: Object.keys(prices).length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Also support POST for Vercel Cron
export async function POST(request: NextRequest) {
  return GET(request);
}
