/**
 * CoinGecko Price Fetcher
 * Batch fetches prices for multiple tokens
 * 
 * Free tier limits: 10-30 req/min (demo), 500 req/min (API key)
 * Max 250 IDs per /simple/price call
 */

import { withRetry, sleep } from '../chains/types';

export interface TokenPrice {
  id: string;
  usd: number;
  usd_24h_change?: number;
  usd_24h_vol?: number;
  usd_market_cap?: number;
  last_updated_at?: number;
}

export interface PriceMap {
  [tokenId: string]: TokenPrice;
}

interface CoinGeckoSimplePriceResponse {
  [id: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_24h_vol?: number;
    usd_market_cap?: number;
    last_updated_at?: number;
  };
}

interface CoinGeckoCoinResponse {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
}

const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const MAX_IDS_PER_REQUEST = 250;
const RATE_LIMIT_DELAY_MS = 1500; // Safe delay between requests

// Cache for contract-to-coingecko-id mappings
const contractIdCache = new Map<string, string>();

/**
 * Fetch prices for multiple tokens by CoinGecko ID
 * Automatically batches requests to respect API limits
 */
export async function fetchPrices(
  tokenIds: string[],
  options: {
    includeMarketCap?: boolean;
    include24hVol?: boolean;
    include24hChange?: boolean;
  } = {}
): Promise<PriceMap> {
  const {
    includeMarketCap = false,
    include24hVol = false,
    include24hChange = true,
  } = options;

  // Deduplicate and filter empty IDs
  const uniqueIds = [...new Set(tokenIds.filter(id => id && !id.startsWith('0x')))];
  
  if (uniqueIds.length === 0) {
    return {};
  }

  // Split into batches of MAX_IDS_PER_REQUEST
  const batches: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += MAX_IDS_PER_REQUEST) {
    batches.push(uniqueIds.slice(i, i + MAX_IDS_PER_REQUEST));
  }

  const allPrices: PriceMap = {};

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Rate limit between batches
    if (i > 0) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    const batchPrices = await fetchPriceBatch(batch, {
      includeMarketCap,
      include24hVol,
      include24hChange,
    });

    Object.assign(allPrices, batchPrices);
  }

  return allPrices;
}

async function fetchPriceBatch(
  ids: string[],
  options: {
    includeMarketCap: boolean;
    include24hVol: boolean;
    include24hChange: boolean;
  }
): Promise<PriceMap> {
  const params = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: 'usd',
    include_24hr_change: String(options.include24hChange),
    include_24hr_vol: String(options.include24hVol),
    include_market_cap: String(options.includeMarketCap),
    include_last_updated_at: 'true',
  });

  return withRetry(async () => {
    const response = await fetch(`${COINGECKO_API}/simple/price?${params}`, {
      headers: {
        'Accept': 'application/json',
        // Add API key if available (higher rate limits)
        ...(process.env.COINGECKO_API_KEY && {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
        }),
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('CoinGecko rate limit exceeded');
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: CoinGeckoSimplePriceResponse = await response.json();
    
    const prices: PriceMap = {};
    for (const [id, priceData] of Object.entries(data)) {
      if (priceData && typeof priceData.usd === 'number') {
        prices[id] = {
          id,
          usd: priceData.usd,
          usd_24h_change: priceData.usd_24h_change,
          usd_24h_vol: priceData.usd_24h_vol,
          usd_market_cap: priceData.usd_market_cap,
          last_updated_at: priceData.last_updated_at,
        };
      }
    }

    return prices;
  });
}

/**
 * Fetch price for a single token by contract address
 * Useful for unknown ERC-20 tokens
 */
export async function fetchPriceByContract(
  contractAddress: string,
  platform: 'ethereum' | 'base' | 'arbitrum-one' | 'solana' = 'ethereum'
): Promise<TokenPrice | null> {
  const address = contractAddress.toLowerCase();

  return withRetry(async () => {
    const response = await fetch(
      `${COINGECKO_API}/simple/token_price/${platform}?` +
      `contract_addresses=${address}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'Accept': 'application/json',
          ...(process.env.COINGECKO_API_KEY && {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
          }),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const priceData = data[address];
    
    if (!priceData) return null;

    return {
      id: address,
      usd: priceData.usd,
      usd_24h_change: priceData.usd_24h_change,
    };
  });
}

/**
 * Look up CoinGecko ID by contract address
 * Caches results to avoid repeated lookups
 */
export async function getCoingeckoIdByContract(
  contractAddress: string,
  platform: 'ethereum' | 'base' | 'arbitrum-one' | 'solana' = 'ethereum'
): Promise<string | null> {
  const cacheKey = `${platform}:${contractAddress.toLowerCase()}`;
  
  if (contractIdCache.has(cacheKey)) {
    return contractIdCache.get(cacheKey) || null;
  }

  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${platform}/contract/${contractAddress.toLowerCase()}`,
      {
        headers: {
          'Accept': 'application/json',
          ...(process.env.COINGECKO_API_KEY && {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
          }),
        },
      }
    );

    if (!response.ok) {
      contractIdCache.set(cacheKey, '');
      return null;
    }

    const data: CoinGeckoCoinResponse = await response.json();
    contractIdCache.set(cacheKey, data.id);
    return data.id;
  } catch {
    return null;
  }
}

/**
 * Fetch historical prices for a token
 * Useful for calculating volatility and PnL
 */
export async function fetchHistoricalPrices(
  tokenId: string,
  days: number = 90,
  interval: 'daily' | 'hourly' = 'daily'
): Promise<Array<{ timestamp: number; price: number }>> {
  return withRetry(async () => {
    const params = new URLSearchParams({
      vs_currency: 'usd',
      days: String(days),
      interval: interval,
    });

    const response = await fetch(
      `${COINGECKO_API}/coins/${tokenId}/market_chart?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          ...(process.env.COINGECKO_API_KEY && {
            'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
          }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: { prices: [number, number][] } = await response.json();
    
    return data.prices.map(([timestamp, price]) => ({
      timestamp,
      price,
    }));
  });
}

/**
 * Calculate daily volatility from historical prices
 * Returns annualized volatility percentage
 */
export function calculateVolatility(prices: Array<{ price: number }>): number {
  if (prices.length < 2) return 0;

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const dailyReturn = Math.log(prices[i].price / prices[i - 1].price);
    returns.push(dailyReturn);
  }

  // Calculate standard deviation of returns
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
  const dailyVolatility = Math.sqrt(variance);

  // Annualize (assuming 365 trading days for crypto)
  const annualizedVolatility = dailyVolatility * Math.sqrt(365);
  
  return annualizedVolatility * 100; // Return as percentage
}

/**
 * Get trending tokens (useful for discovery)
 */
export async function getTrendingTokens(): Promise<Array<{
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number;
}>> {
  return withRetry(async () => {
    const response = await fetch(`${COINGECKO_API}/search/trending`, {
      headers: {
        'Accept': 'application/json',
        ...(process.env.COINGECKO_API_KEY && {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY,
        }),
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.coins.map((coin: { item: { id: string; name: string; symbol: string; market_cap_rank: number } }) => ({
      id: coin.item.id,
      name: coin.item.name,
      symbol: coin.item.symbol,
      marketCapRank: coin.item.market_cap_rank,
    }));
  });
}
