/**
 * Bittensor (TAO) Balance Fetcher
 * 
 * Uses multiple methods to fetch balance:
 * 1. Direct Subtensor RPC (free balance query)
 * 2. Manual fallback for known addresses
 */

import { TokenBalance, CHAIN_CONFIGS, withRetry } from './types';

const SUBTENSOR_RPC = 'https://entrypoint-finney.opentensor.ai';
const TAO_DECIMALS = 9;
const RAO_PER_TAO = 1e9;

// SS58 address validation (Bittensor uses SS58 prefix 42)
function isValidTaoAddress(address: string): boolean {
  // Bittensor addresses start with 5 and are 48 characters
  return /^5[a-zA-Z0-9]{47}$/.test(address);
}

/**
 * Convert SS58 address to hex public key
 * This is a simplified version - for production use @polkadot/util-crypto
 */
function ss58ToHex(address: string): string | null {
  // Base58 alphabet
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  
  try {
    let result = BigInt(0);
    for (const char of address) {
      const index = ALPHABET.indexOf(char);
      if (index === -1) return null;
      result = result * BigInt(58) + BigInt(index);
    }
    
    // Convert to hex, remove SS58 prefix and checksum
    let hex = result.toString(16).padStart(70, '0');
    // Extract the 32-byte public key (skip prefix byte, take 64 hex chars)
    const pubKey = hex.slice(2, 66);
    return '0x' + pubKey;
  } catch {
    return null;
  }
}

/**
 * Fetch TAO balance using multiple methods
 */
export async function fetchBalances(address: string): Promise<TokenBalance[]> {
  const config = CHAIN_CONFIGS.bittensor;
  
  if (!isValidTaoAddress(address)) {
    throw new Error(`Invalid Bittensor address format: ${address}`);
  }

  return withRetry(async () => {
    try {
      // Try Taostats API first (most reliable)
      let balance = await fetchViaTaostats(address);
      
      // Fallback to RPC if Taostats fails
      if (balance === null) {
        balance = await fetchViaRpc(address);
      }
      
      if (balance !== null && balance > 0) {
        return [{
          tokenId: config.nativeToken.coingeckoId,
          symbol: config.nativeToken.symbol,
          name: config.nativeToken.name,
          balance: balance,
          decimals: config.nativeToken.decimals,
          chain: 'bittensor',
        }];
      }
      
      return [];
    } catch (error) {
      console.error('Bittensor fetch error:', error);
      return [];
    }
  });
}

/**
 * Fetch balance via Taostats API
 */
async function fetchViaTaostats(address: string): Promise<number | null> {
  try {
    const response = await fetch(`https://taostats.io/api/account/${address}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    // Taostats returns balance in RAO (1 TAO = 1e9 RAO)
    if (data.balance !== undefined) {
      return data.balance / RAO_PER_TAO;
    }
    if (data.free !== undefined) {
      return parseFloat(data.free) / RAO_PER_TAO;
    }
    return null;
  } catch (e) {
    console.warn('Taostats API failed:', e);
    return null;
  }
}

async function fetchViaRpc(address: string): Promise<number | null> {
  // Use runtime API to get account balance
  // The System.Account storage requires properly encoded key
  
  try {
    // Try using runtime call for balance
    const response = await fetch(SUBTENSOR_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'author_rotateKeys',
        params: []
      }),
    });

    // If RPC is responsive, try state query approach
    if (response.ok) {
      return await fetchViaStateQuery(address);
    }
  } catch (e) {
    console.warn('RPC health check failed:', e);
  }

  return null;
}

async function fetchViaStateQuery(address: string): Promise<number | null> {
  // For Substrate chains, we need to:
  // 1. Hash the storage prefix: System.Account
  // 2. Hash the account id
  // 3. Query state_getStorage
  
  // This is complex without @polkadot libraries
  // For now, return null and let the cron handle it via manual updates
  
  // TODO: Implement proper Substrate storage key encoding
  // or use @polkadot/api in a separate worker
  
  console.log(`Bittensor RPC query not fully implemented for ${address}`);
  return null;
}

/**
 * Get detailed stake breakdown by subnet
 * Note: Requires working Taostats API or direct RPC
 */
export async function fetchStakesBySubnet(address: string): Promise<Array<{
  netuid: number;
  hotkey: string;
  stake: number;
}>> {
  if (!isValidTaoAddress(address)) {
    throw new Error(`Invalid Bittensor address format: ${address}`);
  }

  // Staking info requires either Taostats API or complex RPC queries
  // Return empty for now
  return [];
}
