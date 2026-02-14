/**
 * Alephium (ALPH) Balance Fetcher
 * Uses Alephium Explorer API (backend.mainnet.alephium.org)
 */

import { TokenBalance, CHAIN_CONFIGS, withRetry } from './types';

// Alephium Explorer API types
interface AlephiumAddressInfo {
  balance: string;         // attoALPH (1 ALPH = 1e18 attoALPH)
  lockedBalance: string;
  txNumber: number;
}

interface AlephiumTokenBalance {
  tokenId: string;
  balance: string;
  lockedBalance: string;
}

interface AlephiumTokenInfo {
  token: {
    id: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  };
  logoUri?: string;
  description?: string;
}

const ALEPHIUM_EXPLORER_API = 'https://backend.mainnet.alephium.org';
const ALEPHIUM_TOKENS_API = 'https://indexer.mainnet.alephium.org';

// Known token mappings to CoinGecko IDs
const ALEPHIUM_TOKEN_REGISTRY: Record<string, string> = {
  // Native ALPH
  '0000000000000000000000000000000000000000000000000000000000000000': 'alephium',
  // AYIN tokens and others can be added here
};

/**
 * Validate Alephium address format
 * Alephium addresses are 45-46 characters, alphanumeric
 */
function isValidAlephiumAddress(address: string): boolean {
  // Alephium addresses start with a number 1-4 and are base58 encoded
  return /^[1-4][0-9A-HJ-NP-Za-km-z]{44,45}$/.test(address);
}

/**
 * Fetch ALPH balance and tokens for an address
 */
export async function fetchBalances(address: string): Promise<TokenBalance[]> {
  const config = CHAIN_CONFIGS.alephium;
  
  if (!isValidAlephiumAddress(address)) {
    throw new Error(`Invalid Alephium address format: ${address}`);
  }

  return withRetry(async () => {
    const balances: TokenBalance[] = [];

    // 1. Fetch native ALPH balance
    const addressInfo = await fetchAddressInfo(address);
    
    // Convert attoALPH to ALPH (18 decimals)
    const totalAlph = (
      BigInt(addressInfo.balance) + BigInt(addressInfo.lockedBalance)
    );
    const alphBalance = Number(totalAlph) / 1e18;
    
    if (alphBalance > 0) {
      balances.push({
        tokenId: config.nativeToken.coingeckoId,
        symbol: config.nativeToken.symbol,
        name: config.nativeToken.name,
        balance: alphBalance,
        decimals: config.nativeToken.decimals,
        chain: 'alephium',
      });
    }

    // 2. Fetch token balances
    try {
      const tokenBalances = await fetchTokenBalances(address);
      
      for (const token of tokenBalances) {
        const totalTokenBalance = (
          BigInt(token.balance) + BigInt(token.lockedBalance)
        );
        
        if (totalTokenBalance <= BigInt(0)) continue;

        // Try to get token metadata
        try {
          const tokenInfo = await fetchTokenInfo(token.tokenId);
          const decimals = tokenInfo.token.decimals;
          const formattedBalance = Number(totalTokenBalance) / Math.pow(10, decimals);
          
          if (formattedBalance > 0) {
            const coingeckoId = ALEPHIUM_TOKEN_REGISTRY[token.tokenId] || token.tokenId;
            
            balances.push({
              tokenId: coingeckoId,
              symbol: tokenInfo.token.symbol,
              name: tokenInfo.token.name,
              balance: formattedBalance,
              decimals,
              contractAddress: token.tokenId,
              chain: 'alephium',
              logoUrl: tokenInfo.logoUri,
            });
          }
        } catch (metadataError) {
          console.warn(`Failed to fetch metadata for token ${token.tokenId}:`, metadataError);
          // Skip tokens without metadata
        }
      }
    } catch (tokenError) {
      console.warn('Failed to fetch Alephium tokens:', tokenError);
      // Continue with just ALPH balance
    }

    return balances;
  });
}

async function fetchAddressInfo(address: string): Promise<AlephiumAddressInfo> {
  const response = await fetch(
    `${ALEPHIUM_EXPLORER_API}/addresses/${address}`,
    {
      headers: { 'Accept': 'application/json' },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      // Address doesn't exist or has no transactions
      return { balance: '0', lockedBalance: '0', txNumber: 0 };
    }
    throw new Error(`Alephium Explorer API error: ${response.status}`);
  }

  return response.json();
}

async function fetchTokenBalances(address: string): Promise<AlephiumTokenBalance[]> {
  const response = await fetch(
    `${ALEPHIUM_EXPLORER_API}/addresses/${address}/tokens`,
    {
      headers: { 'Accept': 'application/json' },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Alephium Explorer API error: ${response.status}`);
  }

  const data = await response.json();
  return data || [];
}

async function fetchTokenInfo(tokenId: string): Promise<AlephiumTokenInfo> {
  const response = await fetch(
    `${ALEPHIUM_TOKENS_API}/tokens/${tokenId}`,
    {
      headers: { 'Accept': 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Token info fetch failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get transaction history for an address
 */
export async function fetchTransactions(
  address: string,
  page: number = 1,
  limit: number = 20
): Promise<Array<{
  hash: string;
  timestamp: number;
  inputs: Array<{ address: string; attoAlphAmount: string }>;
  outputs: Array<{ address: string; attoAlphAmount: string }>;
}>> {
  if (!isValidAlephiumAddress(address)) {
    throw new Error(`Invalid Alephium address format: ${address}`);
  }

  return withRetry(async () => {
    const response = await fetch(
      `${ALEPHIUM_EXPLORER_API}/addresses/${address}/transactions?page=${page}&limit=${limit}`,
      {
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Alephium Explorer API error: ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Get address balance at a specific block
 */
export async function fetchBalanceAtBlock(
  address: string,
  blockHash: string
): Promise<{ balance: string; lockedBalance: string }> {
  if (!isValidAlephiumAddress(address)) {
    throw new Error(`Invalid Alephium address format: ${address}`);
  }

  return withRetry(async () => {
    const response = await fetch(
      `${ALEPHIUM_EXPLORER_API}/addresses/${address}/balance?blockHash=${blockHash}`,
      {
        headers: { 'Accept': 'application/json' },
      }
    );

    if (!response.ok) {
      throw new Error(`Alephium Explorer API error: ${response.status}`);
    }

    return response.json();
  });
}
