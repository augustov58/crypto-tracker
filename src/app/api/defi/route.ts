/**
 * DeFi Positions API
 * 
 * Detects DeFi tokens from balances and categorizes them
 * Returns positions with USD values
 */

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// Known DeFi tokens and their protocols
const DEFI_TOKENS: Record<string, {
  protocol: string;
  type: 'staking' | 'lending' | 'lp' | 'yield';
  coingeckoId: string;
  underlying?: string;
}> = {
  // Lido
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': {
    protocol: 'Lido',
    type: 'staking',
    coingeckoId: 'staked-ether',
    underlying: 'ETH',
  },
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': {
    protocol: 'Lido',
    type: 'staking',
    coingeckoId: 'wrapped-steth',
    underlying: 'ETH',
  },
  'steth': {
    protocol: 'Lido',
    type: 'staking',
    coingeckoId: 'staked-ether',
    underlying: 'ETH',
  },
  'wsteth': {
    protocol: 'Lido',
    type: 'staking',
    coingeckoId: 'wrapped-steth',
    underlying: 'ETH',
  },
  // Aave tokens (common ones)
  'aethweth': {
    protocol: 'Aave V3',
    type: 'lending',
    coingeckoId: 'weth',
    underlying: 'WETH',
  },
  'ausdc': {
    protocol: 'Aave V3',
    type: 'lending',
    coingeckoId: 'usd-coin',
    underlying: 'USDC',
  },
  'ausdt': {
    protocol: 'Aave V3',
    type: 'lending',
    coingeckoId: 'tether',
    underlying: 'USDT',
  },
  // Rocket Pool
  'reth': {
    protocol: 'Rocket Pool',
    type: 'staking',
    coingeckoId: 'rocket-pool-eth',
    underlying: 'ETH',
  },
  // Coinbase ETH
  'cbeth': {
    protocol: 'Coinbase',
    type: 'staking',
    coingeckoId: 'coinbase-wrapped-staked-eth',
    underlying: 'ETH',
  },
};

export interface DefiPosition {
  id: string;
  protocol: string;
  type: 'staking' | 'lending' | 'lp' | 'yield';
  tokens: Array<{
    symbol: string;
    amount: number;
    usdValue: number;
  }>;
  totalUsd: number;
  apy?: number;
  chain: string;
}

export interface DefiResponse {
  positions: DefiPosition[];
  totalUsd: number;
}

// Fetch prices from CoinGecko
async function fetchDefiPrices(coingeckoIds: string[]): Promise<Record<string, number>> {
  if (coingeckoIds.length === 0) return {};
  
  const ids = [...new Set(coingeckoIds)].join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    
    const data = await response.json();
    const prices: Record<string, number> = {};
    
    for (const [id, priceData] of Object.entries(data)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prices[id] = (priceData as any).usd || 0;
    }
    
    return prices;
  } catch {
    return {};
  }
}

// Known APYs (could fetch from DeFiLlama in the future)
const KNOWN_APYS: Record<string, number> = {
  'Lido': 3.5,
  'Rocket Pool': 3.2,
  'Coinbase': 2.9,
  'Aave V3': 2.5,
};

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;

    // Get latest balances
    const { data: balances, error } = await supabase
      .from('balances')
      .select('*, wallets(chain)')
      .order('snapshot_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch balances:', error);
      return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
    }

    // Group by token to dedupe across snapshots
    const latestBalances = new Map<string, typeof balances[0]>();
    for (const balance of balances || []) {
      const key = `${balance.wallet_id}-${balance.token_id}`;
      if (!latestBalances.has(key)) {
        latestBalances.set(key, balance);
      }
    }

    // Find DeFi positions
    const defiBalances: Array<{
      balance: typeof balances[0];
      defiInfo: typeof DEFI_TOKENS[string];
    }> = [];

    for (const balance of latestBalances.values()) {
      const tokenId = balance.token_id.toLowerCase();
      const symbol = balance.symbol.toLowerCase();
      
      // Check by contract address or symbol
      const defiInfo = DEFI_TOKENS[tokenId] || DEFI_TOKENS[symbol];
      
      if (defiInfo && parseFloat(balance.balance) > 0.0000001) {
        defiBalances.push({ balance, defiInfo });
      }
    }

    // Fetch prices for DeFi tokens
    const coingeckoIds = [...new Set(defiBalances.map(d => d.defiInfo.coingeckoId))];
    const prices = await fetchDefiPrices(coingeckoIds);

    // Build positions grouped by protocol
    const positionsByProtocol = new Map<string, DefiPosition>();

    for (const { balance, defiInfo } of defiBalances) {
      const amount = parseFloat(balance.balance);
      const price = prices[defiInfo.coingeckoId] || 0;
      const usdValue = amount * price;
      const chain = balance.wallets?.chain || 'ethereum';

      const key = `${defiInfo.protocol}-${defiInfo.type}-${chain}`;
      
      if (!positionsByProtocol.has(key)) {
        positionsByProtocol.set(key, {
          id: key,
          protocol: defiInfo.protocol,
          type: defiInfo.type,
          tokens: [],
          totalUsd: 0,
          apy: KNOWN_APYS[defiInfo.protocol],
          chain,
        });
      }

      const position = positionsByProtocol.get(key)!;
      
      // Check if token already exists in position
      const existingToken = position.tokens.find(t => t.symbol === balance.symbol);
      if (existingToken) {
        existingToken.amount += amount;
        existingToken.usdValue += usdValue;
      } else {
        position.tokens.push({
          symbol: balance.symbol,
          amount,
          usdValue,
        });
      }
      
      position.totalUsd += usdValue;
    }

    const positions = Array.from(positionsByProtocol.values())
      .filter(p => p.totalUsd > 0.01)
      .sort((a, b) => b.totalUsd - a.totalUsd);

    const totalUsd = positions.reduce((sum, p) => sum + p.totalUsd, 0);

    return NextResponse.json<DefiResponse>({
      positions,
      totalUsd,
    });

  } catch (error) {
    console.error('DeFi API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
// Force rebuild 1771098929
