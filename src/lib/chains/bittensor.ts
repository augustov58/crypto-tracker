/**
 * Bittensor (TAO) Balance Fetcher
 * Uses Taostats API (primary) with fallback to Subtensor RPC
 * 
 * Note: Bittensor is Substrate-based. Full @polkadot/api integration
 * is available but heavy. We prefer REST APIs for serverless.
 */

import { TokenBalance, CHAIN_CONFIGS, withRetry } from './types';

// Taostats API types
interface TaostatsAccountResponse {
  address: string;
  balance: string; // in RAO (1 TAO = 1e9 RAO)
  stake?: string;
  rank?: number;
}

interface TaostatsStakeResponse {
  hotkey: string;
  coldkey: string;
  stake: string; // in RAO
  netuid?: number;
}

// Subtensor RPC types (for fallback)
interface SubtensorBalanceResponse {
  free: string;
  reserved: string;
  frozen: string;
}

const TAOSTATS_API = 'https://api.taostats.io/api/v1';
const SUBTENSOR_RPC = 'https://lite.sub.taostats.io';

// SS58 address validation (Bittensor uses SS58 prefix 42)
function isValidTaoAddress(address: string): boolean {
  // Bittensor addresses start with 5 and are 48 characters
  return /^5[a-zA-Z0-9]{47}$/.test(address);
}

/**
 * Fetch TAO balance and staking positions for an address
 * Returns both free balance and staked TAO
 */
export async function fetchBalances(address: string): Promise<TokenBalance[]> {
  const config = CHAIN_CONFIGS.bittensor;
  
  if (!isValidTaoAddress(address)) {
    throw new Error(`Invalid Bittensor address format: ${address}`);
  }

  return withRetry(async () => {
    try {
      // Try Taostats API first (more reliable, includes stake info)
      return await fetchViaTaostats(address, config);
    } catch (error) {
      console.warn('Taostats API failed, falling back to Subtensor RPC:', error);
      // Fallback to direct Subtensor RPC
      return await fetchViaSubtensorRpc(address, config);
    }
  });
}

async function fetchViaTaostats(
  address: string,
  config: typeof CHAIN_CONFIGS.bittensor
): Promise<TokenBalance[]> {
  const balances: TokenBalance[] = [];

  // Fetch account balance
  const accountResponse = await fetch(`${TAOSTATS_API}/account/${address}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!accountResponse.ok) {
    if (accountResponse.status === 404) {
      // Address exists but has no activity
      return [];
    }
    throw new Error(`Taostats API error: ${accountResponse.status}`);
  }

  const accountData: TaostatsAccountResponse = await accountResponse.json();
  
  // Convert RAO to TAO (9 decimals)
  const freeBalance = parseFloat(accountData.balance) / 1e9;
  
  if (freeBalance > 0) {
    balances.push({
      tokenId: config.nativeToken.coingeckoId,
      symbol: config.nativeToken.symbol,
      name: `${config.nativeToken.name} (Free)`,
      balance: freeBalance,
      decimals: config.nativeToken.decimals,
      chain: 'bittensor',
    });
  }

  // Fetch stake info (this address as coldkey)
  try {
    const stakeResponse = await fetch(
      `${TAOSTATS_API}/stake/coldkey/${address}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (stakeResponse.ok) {
      const stakeData: TaostatsStakeResponse[] = await stakeResponse.json();
      
      // Sum all stakes for this coldkey
      const totalStake = stakeData.reduce(
        (sum, s) => sum + parseFloat(s.stake),
        0
      ) / 1e9;

      if (totalStake > 0) {
        balances.push({
          tokenId: config.nativeToken.coingeckoId,
          symbol: `s${config.nativeToken.symbol}`,
          name: `${config.nativeToken.name} (Staked)`,
          balance: totalStake,
          decimals: config.nativeToken.decimals,
          chain: 'bittensor',
        });
      }
    }
  } catch (stakeError) {
    console.warn('Failed to fetch stake info:', stakeError);
    // Continue without stake info
  }

  return balances;
}

async function fetchViaSubtensorRpc(
  address: string,
  config: typeof CHAIN_CONFIGS.bittensor
): Promise<TokenBalance[]> {
  // Use JSON-RPC to query balance
  const response = await fetch(SUBTENSOR_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'system_account',
      params: [address],
    }),
  });

  if (!response.ok) {
    throw new Error(`Subtensor RPC error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    // Try alternative method for balance query
    return await fetchViaSubtensorState(address, config);
  }

  const accountInfo = data.result?.data;
  if (!accountInfo) {
    return [];
  }

  // Parse balance from Substrate account info
  const freeBalance = parseFloat(accountInfo.free || '0') / 1e9;
  
  if (freeBalance <= 0) {
    return [];
  }

  return [{
    tokenId: config.nativeToken.coingeckoId,
    symbol: config.nativeToken.symbol,
    name: config.nativeToken.name,
    balance: freeBalance,
    decimals: config.nativeToken.decimals,
    chain: 'bittensor',
  }];
}

async function fetchViaSubtensorState(
  address: string,
  config: typeof CHAIN_CONFIGS.bittensor
): Promise<TokenBalance[]> {
  // Alternative: query state storage directly
  const response = await fetch(SUBTENSOR_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'state_call',
      params: ['AccountNonceApi_account_nonce', address],
    }),
  });

  if (!response.ok) {
    throw new Error(`Subtensor state query failed: ${response.status}`);
  }

  // If we can't get balance via RPC, return empty
  // User should check Taostats directly
  console.warn('Could not fetch Bittensor balance via RPC, returning empty');
  return [];
}

/**
 * Get detailed stake breakdown by subnet
 */
export async function fetchStakesBySubnet(address: string): Promise<Array<{
  netuid: number;
  hotkey: string;
  stake: number;
}>> {
  if (!isValidTaoAddress(address)) {
    throw new Error(`Invalid Bittensor address format: ${address}`);
  }

  return withRetry(async () => {
    const response = await fetch(
      `${TAOSTATS_API}/stake/coldkey/${address}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`Taostats API error: ${response.status}`);
    }

    const data: TaostatsStakeResponse[] = await response.json();
    
    return data.map(s => ({
      netuid: s.netuid || 0,
      hotkey: s.hotkey,
      stake: parseFloat(s.stake) / 1e9,
    }));
  });
}
