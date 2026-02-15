/**
 * Bittensor (TAO) Balance Fetcher
 * 
 * Uses @polkadot/api to connect to Subtensor and fetch balance
 */

import { TokenBalance, CHAIN_CONFIGS, withRetry } from './types';
import { ApiPromise, WsProvider } from '@polkadot/api';

const SUBTENSOR_WS = 'wss://entrypoint-finney.opentensor.ai:443';
const TAO_DECIMALS = 9;

// Connection cache to avoid reconnecting on every request
let apiCache: ApiPromise | null = null;
let connectionPromise: Promise<ApiPromise> | null = null;

/**
 * SS58 address validation (Bittensor uses SS58 prefix 42)
 */
function isValidTaoAddress(address: string): boolean {
  return /^5[a-zA-Z0-9]{47}$/.test(address);
}

/**
 * Get or create a cached API connection
 */
async function getApi(): Promise<ApiPromise> {
  if (apiCache?.isConnected) {
    return apiCache;
  }
  
  if (connectionPromise) {
    return connectionPromise;
  }
  
  connectionPromise = (async () => {
    const provider = new WsProvider(SUBTENSOR_WS);
    const api = await ApiPromise.create({ provider });
    apiCache = api;
    connectionPromise = null;
    return api;
  })();
  
  return connectionPromise;
}

interface AccountData {
  free: { toString(): string };
  reserved: { toString(): string };
}

interface AccountInfo {
  data: AccountData;
}

/**
 * Fetch TAO balance for an address using polkadot API
 */
async function fetchViaApi(address: string): Promise<number | null> {
  try {
    const api = await getApi();
    
    // Query the account info
    const accountInfo = await api.query.system.account(address) as unknown as AccountInfo;
    
    // Extract free and reserved balance
    const data = accountInfo.data;
    const free = BigInt(data.free.toString());
    const reserved = BigInt(data.reserved.toString());
    
    const totalRao = free + reserved;
    const totalTao = Number(totalRao) / Math.pow(10, TAO_DECIMALS);
    
    return totalTao;
  } catch (error) {
    console.error('Polkadot API query error:', error);
    return null;
  }
}

/**
 * Fetch TAO balance for an address
 */
export async function fetchBalances(address: string): Promise<TokenBalance[]> {
  const config = CHAIN_CONFIGS.bittensor;
  
  if (!isValidTaoAddress(address)) {
    throw new Error(`Invalid Bittensor address format: ${address}`);
  }

  return withRetry(async () => {
    const balance = await fetchViaApi(address);
    
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
  });
}

/**
 * Disconnect from API (call on shutdown)
 */
export async function disconnect(): Promise<void> {
  if (apiCache) {
    await apiCache.disconnect();
    apiCache = null;
  }
}

/**
 * Get detailed stake breakdown by subnet
 * Note: Would require additional RPC queries to SubtensorModule storage
 */
export async function fetchStakesBySubnet(address: string): Promise<Array<{
  netuid: number;
  hotkey: string;
  stake: number;
}>> {
  if (!isValidTaoAddress(address)) {
    throw new Error(`Invalid Bittensor address format: ${address}`);
  }

  // TODO: Implement stake queries via SubtensorModule.Stake storage
  return [];
}
