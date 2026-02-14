/**
 * Solana Balance Fetcher
 * Uses Helius API for enhanced token data (DAS API)
 */

import { TokenBalance, CHAIN_CONFIGS, withRetry } from './types';

// Helius DAS API response types
interface HeliusAsset {
  id: string;
  interface: string;
  content: {
    $schema?: string;
    json_uri?: string;
    files?: Array<{ uri: string; mime: string }>;
    metadata?: {
      name?: string;
      symbol?: string;
    };
    links?: {
      image?: string;
    };
  };
  authorities?: Array<{ address: string; scopes: string[] }>;
  compression?: {
    eligible: boolean;
    compressed: boolean;
  };
  grouping?: Array<{ group_key: string; group_value: string }>;
  royalty?: {
    royalty_model: string;
    target?: string;
    percent: number;
    locked: boolean;
  };
  ownership: {
    frozen: boolean;
    delegated: boolean;
    delegate?: string;
    ownership_model: string;
    owner: string;
  };
  token_info?: {
    symbol: string;
    balance: number;
    supply: number;
    decimals: number;
    token_program: string;
    associated_token_address: string;
    price_info?: {
      price_per_token: number;
      total_price: number;
      currency: string;
    };
  };
}

interface HeliusAssetsByOwnerResponse {
  total: number;
  limit: number;
  page: number;
  items: HeliusAsset[];
}

// Known SPL token mappings to CoinGecko IDs
const SPL_TOKEN_REGISTRY: Record<string, string> = {
  // Major tokens
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'usd-coin',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'tether',
  'So11111111111111111111111111111111111111112': 'wrapped-solana',
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ethereum-wormhole',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'jupiter-exchange-solana',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'bonk',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'dogwifhat',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'pyth-network',
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': 'popcat',
  'RaydiumPoolv4111111111111111111111111111112': 'raydium',
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'orca',
  'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey': 'marinade',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'msol',
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'blazestake-staked-sol',
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': 'jito-governance-token',
};

function getHeliusApiKey(): string {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Fetch all token balances for a Solana address
 */
export async function fetchBalances(address: string): Promise<TokenBalance[]> {
  const apiKey = getHeliusApiKey();
  const config = CHAIN_CONFIGS.solana;
  const balances: TokenBalance[] = [];

  return withRetry(async () => {
    // 1. Fetch native SOL balance
    const solBalance = await fetchNativeSolBalance(apiKey, address);
    
    if (solBalance > 0) {
      balances.push({
        tokenId: config.nativeToken.coingeckoId,
        symbol: config.nativeToken.symbol,
        name: config.nativeToken.name,
        balance: solBalance,
        decimals: config.nativeToken.decimals,
        chain: 'solana',
      });
    }

    // 2. Fetch all SPL token balances using Helius DAS API
    const assets = await fetchAssetsByOwner(apiKey, address);
    
    for (const asset of assets) {
      // Only process fungible tokens with token_info
      if (!asset.token_info || asset.interface !== 'FungibleToken') {
        continue;
      }

      const tokenInfo = asset.token_info;
      const rawBalance = tokenInfo.balance;
      const decimals = tokenInfo.decimals;
      const formattedBalance = rawBalance / Math.pow(10, decimals);

      if (formattedBalance > 0) {
        // Get symbol and name from metadata or token_info
        const symbol = tokenInfo.symbol || 
                      asset.content?.metadata?.symbol || 
                      'UNKNOWN';
        const name = asset.content?.metadata?.name || symbol;
        
        // Try to find CoinGecko ID from registry
        const coingeckoId = SPL_TOKEN_REGISTRY[asset.id] || asset.id;

        balances.push({
          tokenId: coingeckoId,
          symbol,
          name,
          balance: formattedBalance,
          decimals,
          contractAddress: asset.id,
          chain: 'solana',
          logoUrl: asset.content?.links?.image,
        });
      }
    }

    return balances;
  });
}

async function fetchNativeSolBalance(apiKey: string, address: string): Promise<number> {
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  });

  if (!response.ok) {
    throw new Error(`Helius RPC error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Solana RPC error: ${data.error.message}`);
  }

  // Convert lamports to SOL (9 decimals)
  return data.result.value / 1e9;
}

async function fetchAssetsByOwner(
  apiKey: string,
  ownerAddress: string
): Promise<HeliusAsset[]> {
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const allAssets: HeliusAsset[] = [];
  let page = 1;
  const limit = 1000;

  // Paginate through all assets
  while (true) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress,
          page,
          limit,
          displayOptions: {
            showFungible: true,
            showNativeBalance: false, // We fetch this separately
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius DAS API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Helius DAS error: ${data.error.message}`);
    }

    const result: HeliusAssetsByOwnerResponse = data.result;
    allAssets.push(...result.items);

    // Check if there are more pages
    if (result.items.length < limit) {
      break;
    }
    page++;
    
    // Safety limit
    if (page > 10) {
      console.warn('Hit pagination limit for Solana assets');
      break;
    }
  }

  return allAssets;
}
