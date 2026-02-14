/**
 * Bitcoin Balance Fetcher
 * Uses Blockstream.info REST API (no rate limit, free)
 */

import { TokenBalance, CHAIN_CONFIGS, withRetry } from './types';

// Blockstream API response types
interface BlockstreamAddressStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

interface BlockstreamAddressResponse {
  address: string;
  chain_stats: BlockstreamAddressStats;
  mempool_stats: BlockstreamAddressStats;
}

const BLOCKSTREAM_API = 'https://blockstream.info/api';

/**
 * Validate Bitcoin address format
 * Supports: P2PKH (1...), P2SH (3...), Bech32 (bc1q...), Bech32m (bc1p...)
 */
function isValidBitcoinAddress(address: string): boolean {
  // P2PKH (Legacy)
  if (/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
  // P2SH
  if (/^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true;
  // Bech32 (SegWit)
  if (/^bc1q[a-z0-9]{38,59}$/.test(address)) return true;
  // Bech32m (Taproot)
  if (/^bc1p[a-z0-9]{58}$/.test(address)) return true;
  
  return false;
}

/**
 * Fetch Bitcoin balance for an address
 */
export async function fetchBalances(address: string): Promise<TokenBalance[]> {
  const config = CHAIN_CONFIGS.bitcoin;
  
  // Validate address format
  if (!isValidBitcoinAddress(address)) {
    throw new Error(`Invalid Bitcoin address format: ${address}`);
  }

  return withRetry(async () => {
    const response = await fetch(`${BLOCKSTREAM_API}/address/${address}`);
    
    if (!response.ok) {
      if (response.status === 400) {
        throw new Error(`Invalid Bitcoin address: ${address}`);
      }
      throw new Error(`Blockstream API error: ${response.status} ${response.statusText}`);
    }

    const data: BlockstreamAddressResponse = await response.json();
    
    // Calculate confirmed balance (funded - spent in chain_stats)
    const confirmedSatoshis = 
      data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    
    // Include unconfirmed (mempool) balance
    const unconfirmedSatoshis = 
      data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
    
    const totalSatoshis = confirmedSatoshis + unconfirmedSatoshis;
    
    // Convert satoshis to BTC (8 decimals)
    const btcBalance = totalSatoshis / 1e8;
    
    if (btcBalance <= 0) {
      return [];
    }

    return [{
      tokenId: config.nativeToken.coingeckoId,
      symbol: config.nativeToken.symbol,
      name: config.nativeToken.name,
      balance: btcBalance,
      decimals: config.nativeToken.decimals,
      chain: 'bitcoin',
    }];
  });
}

/**
 * Fetch UTXOs for an address (useful for showing transaction details)
 */
export async function fetchUtxos(address: string): Promise<Array<{
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number };
}>> {
  if (!isValidBitcoinAddress(address)) {
    throw new Error(`Invalid Bitcoin address format: ${address}`);
  }

  return withRetry(async () => {
    const response = await fetch(`${BLOCKSTREAM_API}/address/${address}/utxo`);
    
    if (!response.ok) {
      throw new Error(`Blockstream API error: ${response.status}`);
    }

    return response.json();
  });
}

/**
 * Get recent transactions for an address
 */
export async function fetchTransactions(
  address: string,
  limit: number = 25
): Promise<Array<{
  txid: string;
  fee: number;
  status: { confirmed: boolean; block_time?: number };
}>> {
  if (!isValidBitcoinAddress(address)) {
    throw new Error(`Invalid Bitcoin address format: ${address}`);
  }

  return withRetry(async () => {
    const response = await fetch(`${BLOCKSTREAM_API}/address/${address}/txs`);
    
    if (!response.ok) {
      throw new Error(`Blockstream API error: ${response.status}`);
    }

    const txs = await response.json();
    return txs.slice(0, limit);
  });
}
