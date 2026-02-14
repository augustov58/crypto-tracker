/**
 * DeFi Positions API
 * 
 * Uses DeBank API when configured, otherwise falls back to token detection
 */

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { DebankClient, transformDebankPositions, DefiPosition, DEBANK_CHAIN_IDS } from '@/lib/defi/debank';

export interface DefiResponse {
  positions: DefiPosition[];
  totalUsd: number;
  source: 'debank' | 'token-detection';
}

async function getDebankApiKey(supabase: ReturnType<typeof getServerSupabase>): Promise<string | null> {
  // First check environment variable
  if (process.env.DEBANK_API_KEY) {
    return process.env.DEBANK_API_KEY;
  }
  
  // Then check settings table
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('settings')
      .select('value')
      .eq('key', 'debank_api_key')
      .single();
    
    return data?.value || null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;

    // Get wallet addresses
    const { data: wallets, error: walletsError } = await supabase
      .from('wallets')
      .select('id, address, chain, label');

    if (walletsError) {
      console.error('Failed to fetch wallets:', walletsError);
      return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 });
    }

    // Check for DeBank API key
    const debankApiKey = await getDebankApiKey(supabase);
    
    // If DeBank API key is configured, use it
    if (debankApiKey) {
      try {
        const client = new DebankClient(debankApiKey);
        const allPositions: DefiPosition[] = [];
        
        // Get unique addresses (some wallets may share addresses across chains)
        const uniqueAddresses = [...new Set(wallets.map((w: { address: string }) => w.address.toLowerCase()))];
        
        // Fetch positions for each address
        for (const address of uniqueAddresses) {
          // Only fetch for EVM addresses (skip Bitcoin, Solana, etc.)
          if (!address.startsWith('0x')) continue;
          
          try {
            const protocols = await client.getAllProtocolPositions(address);
            const positions = transformDebankPositions(protocols);
            allPositions.push(...positions);
          } catch (err) {
            console.error(`DeBank error for ${address}:`, err);
            // Continue with other addresses
          }
        }
        
        // Deduplicate positions by ID
        const uniquePositions = Array.from(
          new Map(allPositions.map(p => [p.id, p])).values()
        ).sort((a, b) => b.netUsdValue - a.netUsdValue);
        
        const totalUsd = uniquePositions.reduce((sum, p) => sum + p.netUsdValue, 0);
        
        return NextResponse.json<DefiResponse>({
          positions: uniquePositions,
          totalUsd,
          source: 'debank',
        });
      } catch (err) {
        console.error('DeBank API failed, falling back to token detection:', err);
        // Fall through to token detection
      }
    }

    // Fallback: Token-based detection (original implementation)
    return await getTokenBasedDefi(supabase);

  } catch (error) {
    console.error('DeFi API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Original token-based DeFi detection
async function getTokenBasedDefi(supabase: ReturnType<typeof getServerSupabase>) {
  // Known DeFi tokens and their protocols
  const DEFI_TOKENS: Record<string, {
    protocol: string;
    type: 'staking' | 'lending' | 'lp' | 'yield';
    coingeckoId: string;
    underlying?: string;
  }> = {
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
    'steth': { protocol: 'Lido', type: 'staking', coingeckoId: 'staked-ether', underlying: 'ETH' },
    'wsteth': { protocol: 'Lido', type: 'staking', coingeckoId: 'wrapped-steth', underlying: 'ETH' },
    'reth': { protocol: 'Rocket Pool', type: 'staking', coingeckoId: 'rocket-pool-eth', underlying: 'ETH' },
    'cbeth': { protocol: 'Coinbase', type: 'staking', coingeckoId: 'coinbase-wrapped-staked-eth', underlying: 'ETH' },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: balances, error } = await (supabase as any)
    .from('balances')
    .select('*, wallets(chain)')
    .order('snapshot_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch balances:', error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }

  const latestBalances = new Map<string, typeof balances[0]>();
  for (const balance of balances || []) {
    const key = `${balance.wallet_id}-${balance.token_id}`;
    if (!latestBalances.has(key)) {
      latestBalances.set(key, balance);
    }
  }

  const defiBalances: Array<{
    balance: typeof balances[0];
    defiInfo: typeof DEFI_TOKENS[string];
  }> = [];

  for (const balance of latestBalances.values()) {
    const tokenId = balance.token_id.toLowerCase();
    const symbol = balance.symbol?.toLowerCase() || '';
    const defiInfo = DEFI_TOKENS[tokenId] || DEFI_TOKENS[symbol];
    
    if (defiInfo && parseFloat(balance.balance) > 0.0000001) {
      defiBalances.push({ balance, defiInfo });
    }
  }

  // Fetch prices
  const coingeckoIds = [...new Set(defiBalances.map(d => d.defiInfo.coingeckoId))];
  const prices = await fetchDefiPrices(coingeckoIds);

  const KNOWN_APYS: Record<string, number> = {
    'Lido': 3.5,
    'Rocket Pool': 3.2,
    'Coinbase': 2.9,
  };

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
        protocolLogo: null,
        protocolUrl: null,
        chain,
        type: defiInfo.type,
        tokens: [],
        netUsdValue: 0,
        assetUsdValue: 0,
        debtUsdValue: 0,
      });
    }

    const position = positionsByProtocol.get(key)!;
    const existingToken = position.tokens.find(t => t.symbol === balance.symbol);
    
    if (existingToken) {
      existingToken.amount += amount;
      existingToken.usdValue += usdValue;
    } else {
      position.tokens.push({
        symbol: balance.symbol,
        name: balance.symbol,
        amount,
        usdValue,
        logo: null,
      });
    }
    
    position.netUsdValue += usdValue;
    position.assetUsdValue += usdValue;
  }

  const positions = Array.from(positionsByProtocol.values())
    .filter(p => p.netUsdValue > 0.01)
    .sort((a, b) => b.netUsdValue - a.netUsdValue);

  const totalUsd = positions.reduce((sum, p) => sum + p.netUsdValue, 0);

  return NextResponse.json<DefiResponse>({
    positions,
    totalUsd,
    source: 'token-detection',
  });
}

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
