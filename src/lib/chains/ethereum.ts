/**
 * EVM Chain Balance Fetcher
 * Works for Ethereum, Base, and Arbitrum via different RPC URLs (Alchemy)
 */

import { JsonRpcProvider, formatUnits } from 'ethers';
import { TokenBalance, Chain, CHAIN_CONFIGS, withRetry } from './types';

// Alchemy token balance response types
interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string | null;
  error?: string;
}

interface AlchemyTokenBalancesResponse {
  address: string;
  tokenBalances: AlchemyTokenBalance[];
}

interface AlchemyTokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

// Common ERC-20 tokens with CoinGecko IDs for quick lookup
const TOKEN_REGISTRY: Record<string, { coingeckoId: string; chain: Chain[] }> = {
  // Stablecoins
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { coingeckoId: 'usd-coin', chain: ['ethereum'] },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { coingeckoId: 'tether', chain: ['ethereum'] },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { coingeckoId: 'dai', chain: ['ethereum'] },
  // Major tokens
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { coingeckoId: 'wrapped-bitcoin', chain: ['ethereum'] },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { coingeckoId: 'weth', chain: ['ethereum'] },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { coingeckoId: 'chainlink', chain: ['ethereum'] },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { coingeckoId: 'uniswap', chain: ['ethereum'] },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { coingeckoId: 'aave', chain: ['ethereum'] },
  // wQUIL (Quilibrium)
  '0x8143182a775c54578c8b7b3ef77982498866945d': { coingeckoId: 'wrapped-quil', chain: ['ethereum'] },
  // wstETH (Lido Wrapped Staked ETH)
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': { coingeckoId: 'wrapped-steth', chain: ['ethereum'] },
  '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': { coingeckoId: 'superbridge-bridged-wsteth-base', chain: ['base'] },
  // BEAM (Gaming)
  '0x62d0a8458ed7719fdaf978fe5929c6d342b0bfce': { coingeckoId: 'beam-2', chain: ['ethereum'] },
  // SPX6900
  '0xe0f63a424a4439cbe457d80e4f4b51ad25b2c56c': { coingeckoId: 'spx6900', chain: ['ethereum'] },
  // Base tokens
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { coingeckoId: 'usd-coin', chain: ['base'] },
  '0x50da645f148798f68ef2d7db7c1cb22a6819bb2c': { coingeckoId: 'spx6900', chain: ['base'] },
  '0x2a66d51407b84b82b5aff3dec4d49f72cbcd322a': { coingeckoId: 'beam-2', chain: ['base'] },
  // Arbitrum tokens  
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { coingeckoId: 'usd-coin', chain: ['arbitrum'] },
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { coingeckoId: 'tether', chain: ['arbitrum'] },
  '0x912ce59144191c1204e64559fe8253a0e49e6548': { coingeckoId: 'arbitrum', chain: ['arbitrum'] },
};

function getChainRpcUrl(chain: Chain): string {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error('ALCHEMY_API_KEY environment variable is not set');
  }
  
  switch (chain) {
    case 'ethereum':
      return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
    case 'base':
      return `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;
    case 'arbitrum':
      return `https://arb-mainnet.g.alchemy.com/v2/${apiKey}`;
    default:
      throw new Error(`Unsupported EVM chain: ${chain}`);
  }
}

/**
 * Fetch all token balances for an address on an EVM chain
 */
export async function fetchBalances(
  address: string,
  chain: Chain = 'ethereum'
): Promise<TokenBalance[]> {
  const rpcUrl = getChainRpcUrl(chain);
  const config = CHAIN_CONFIGS[chain];
  const balances: TokenBalance[] = [];

  return withRetry(async () => {
    // 1. Fetch native ETH balance
    const provider = new JsonRpcProvider(rpcUrl);
    const ethBalance = await provider.getBalance(address);
    const ethBalanceFormatted = parseFloat(formatUnits(ethBalance, 18));
    
    if (ethBalanceFormatted > 0) {
      balances.push({
        tokenId: config.nativeToken.coingeckoId,
        symbol: config.nativeToken.symbol,
        name: config.nativeToken.name,
        balance: ethBalanceFormatted,
        decimals: config.nativeToken.decimals,
        chain,
      });
    }

    // 2. Fetch all ERC-20 balances via Alchemy
    const tokenBalancesResponse = await fetchAlchemyTokenBalances(rpcUrl, address);
    
    // 3. Get metadata for tokens with non-zero balances
    const nonZeroTokens = tokenBalancesResponse.tokenBalances.filter(
      t => t.tokenBalance && t.tokenBalance !== '0x0' && !t.error
    );

    // Batch fetch metadata (Alchemy supports this)
    const metadataPromises = nonZeroTokens.map(token =>
      fetchTokenMetadata(rpcUrl, token.contractAddress)
    );
    
    const metadataResults = await Promise.allSettled(metadataPromises);

    for (let i = 0; i < nonZeroTokens.length; i++) {
      const token = nonZeroTokens[i];
      const metadataResult = metadataResults[i];
      
      if (metadataResult.status === 'rejected') {
        console.warn(`Failed to fetch metadata for ${token.contractAddress}:`, metadataResult.reason);
        continue;
      }

      const metadata = metadataResult.value;
      if (!metadata || metadata.decimals === 0) continue;

      const rawBalance = BigInt(token.tokenBalance || '0');
      const formattedBalance = parseFloat(formatUnits(rawBalance, metadata.decimals));
      
      if (formattedBalance > 0) {
        // Try to find CoinGecko ID from registry
        const contractLower = token.contractAddress.toLowerCase();
        const registryEntry = TOKEN_REGISTRY[contractLower];
        const coingeckoId = registryEntry?.coingeckoId || contractLower;

        balances.push({
          tokenId: coingeckoId,
          symbol: metadata.symbol,
          name: metadata.name,
          balance: formattedBalance,
          decimals: metadata.decimals,
          contractAddress: token.contractAddress,
          chain,
          logoUrl: metadata.logo,
        });
      }
    }

    return balances;
  });
}

async function fetchAlchemyTokenBalances(
  rpcUrl: string,
  address: string
): Promise<AlchemyTokenBalancesResponse> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenBalances',
      params: [address, 'erc20'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Alchemy RPC error: ${data.error.message}`);
  }

  return data.result;
}

async function fetchTokenMetadata(
  rpcUrl: string,
  contractAddress: string
): Promise<AlchemyTokenMetadata | null> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenMetadata',
      params: [contractAddress],
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    console.warn(`Token metadata error for ${contractAddress}:`, data.error);
    return null;
  }

  return data.result;
}

// Re-export for Base and Arbitrum with proper typing
export function fetchEthereumBalances(address: string): Promise<TokenBalance[]> {
  return fetchBalances(address, 'ethereum');
}

export function fetchBaseBalances(address: string): Promise<TokenBalance[]> {
  return fetchBalances(address, 'base');
}

export function fetchArbitrumBalances(address: string): Promise<TokenBalance[]> {
  return fetchBalances(address, 'arbitrum');
}
