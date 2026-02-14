/**
 * Test API Route - Fetch Balances
 * For manual verification of chain integrations
 * 
 * GET /api/test/fetch-balances?chain=ethereum&address=0x...
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchBalancesByChain, isValidAddress, Chain } from '@/lib/chains';
import { fetchPrices } from '@/lib/prices';

const SUPPORTED_CHAINS: Chain[] = [
  'ethereum',
  'base',
  'arbitrum',
  'solana',
  'bitcoin',
  'bittensor',
  'alephium',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') as Chain | null;
    const address = searchParams.get('address');

    // Validate inputs
    if (!chain) {
      return NextResponse.json(
        { 
          error: 'Missing chain parameter',
          supported: SUPPORTED_CHAINS,
        },
        { status: 400 }
      );
    }

    if (!SUPPORTED_CHAINS.includes(chain)) {
      return NextResponse.json(
        { 
          error: `Unsupported chain: ${chain}`,
          supported: SUPPORTED_CHAINS,
        },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    if (!isValidAddress(address, chain)) {
      return NextResponse.json(
        { error: `Invalid address format for ${chain}: ${address}` },
        { status: 400 }
      );
    }

    // Fetch balances
    const startTime = Date.now();
    const balances = await fetchBalancesByChain(address, chain);
    const fetchTime = Date.now() - startTime;

    // Fetch prices for tokens found
    const tokenIds = balances
      .map(b => b.tokenId)
      .filter(id => !id.startsWith('0x'));
    
    let prices = {};
    if (tokenIds.length > 0) {
      prices = await fetchPrices(tokenIds);
    }

    // Calculate USD values
    const balancesWithUsd = balances.map(b => {
      const price = (prices as Record<string, { usd: number }>)[b.tokenId]?.usd;
      return {
        ...b,
        priceUsd: price ?? null,
        valueUsd: price ? b.balance * price : null,
      };
    });

    const totalValueUsd = balancesWithUsd.reduce(
      (sum, b) => sum + (b.valueUsd ?? 0),
      0
    );

    return NextResponse.json({
      success: true,
      chain,
      address,
      fetchTimeMs: fetchTime,
      tokenCount: balances.length,
      totalValueUsd,
      balances: balancesWithUsd,
    });
  } catch (error) {
    console.error('Fetch balances error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.stack : undefined)
          : undefined,
      },
      { status: 500 }
    );
  }
}
