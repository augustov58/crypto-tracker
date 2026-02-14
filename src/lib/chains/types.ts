// Shared types for chain integrations

export interface TokenBalance {
  tokenId: string;        // CoinGecko ID or contract address
  symbol: string;
  name: string;
  balance: number;        // Human-readable amount (not wei/lamports)
  decimals: number;
  contractAddress?: string;
  chain: Chain;
  logoUrl?: string;
}

export type Chain = 
  | 'ethereum' 
  | 'base' 
  | 'arbitrum' 
  | 'solana' 
  | 'bitcoin' 
  | 'bittensor' 
  | 'alephium';

export interface ChainConfig {
  name: Chain;
  rpcUrl: string;
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
    coingeckoId: string;
  };
}

export interface FetchError {
  chain: Chain;
  address: string;
  error: string;
  retryable: boolean;
}

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// Helper: exponential backoff with jitter
export async function withRetry<T>(
  fn: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on non-retryable errors
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }
      
      if (attempt < config.maxRetries - 1) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          config.maxDelayMs
        );
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('invalid address') ||
    message.includes('invalid public key') ||
    message.includes('not found') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Chain configurations
export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  ethereum: {
    name: 'ethereum',
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    nativeToken: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  },
  base: {
    name: 'base',
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    nativeToken: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  },
  arbitrum: {
    name: 'arbitrum',
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    nativeToken: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  },
  solana: {
    name: 'solana',
    rpcUrl: `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
    nativeToken: {
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      coingeckoId: 'solana',
    },
  },
  bitcoin: {
    name: 'bitcoin',
    rpcUrl: 'https://blockstream.info/api',
    nativeToken: {
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      coingeckoId: 'bitcoin',
    },
  },
  bittensor: {
    name: 'bittensor',
    rpcUrl: 'wss://entrypoint-finney.opentensor.ai:443',
    nativeToken: {
      symbol: 'TAO',
      name: 'Bittensor',
      decimals: 9,
      coingeckoId: 'bittensor',
    },
  },
  alephium: {
    name: 'alephium',
    rpcUrl: 'https://backend.mainnet.alephium.org',
    nativeToken: {
      symbol: 'ALPH',
      name: 'Alephium',
      decimals: 18,
      coingeckoId: 'alephium',
    },
  },
};
