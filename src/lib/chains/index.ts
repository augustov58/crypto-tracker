/**
 * Chain Integration Index
 * Re-exports all chain fetchers and types
 */

export * from './types';

// Individual chain exports
export { fetchBalances as fetchEthereumBalances, fetchBaseBalances, fetchArbitrumBalances } from './ethereum';
export { fetchBalances as fetchSolanaBalances } from './solana';
export { fetchBalances as fetchBitcoinBalances } from './bitcoin';
export { fetchBalances as fetchBittensorBalances } from './bittensor';
export { fetchBalances as fetchAlephiumBalances } from './alephium';

import { fetchBalances as fetchEthBalances } from './ethereum';
import { fetchBalances as fetchSolBalances } from './solana';
import { fetchBalances as fetchBtcBalances } from './bitcoin';
import { fetchBalances as fetchTaoBalances } from './bittensor';
import { fetchBalances as fetchAlphBalances } from './alephium';
import { Chain, TokenBalance } from './types';

/**
 * Unified balance fetcher - routes to appropriate chain module
 */
export async function fetchBalancesByChain(
  address: string,
  chain: Chain
): Promise<TokenBalance[]> {
  switch (chain) {
    case 'ethereum':
      return fetchEthBalances(address, 'ethereum');
    case 'base':
      return fetchEthBalances(address, 'base');
    case 'arbitrum':
      return fetchEthBalances(address, 'arbitrum');
    case 'solana':
      return fetchSolBalances(address);
    case 'bitcoin':
      return fetchBtcBalances(address);
    case 'bittensor':
      return fetchTaoBalances(address);
    case 'alephium':
      return fetchAlphBalances(address);
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

/**
 * Fetch balances for multiple addresses across multiple chains
 * Returns results grouped by address
 */
export async function fetchAllBalances(
  wallets: Array<{ address: string; chain: Chain }>
): Promise<Map<string, TokenBalance[]>> {
  const results = new Map<string, TokenBalance[]>();
  
  // Group wallets by chain for potential batching optimization
  const byChain = wallets.reduce((acc, w) => {
    if (!acc.has(w.chain)) acc.set(w.chain, []);
    acc.get(w.chain)!.push(w.address);
    return acc;
  }, new Map<Chain, string[]>());

  // Fetch in parallel per chain
  const fetchPromises: Promise<void>[] = [];

  for (const [chain, addresses] of byChain) {
    for (const address of addresses) {
      const key = `${chain}:${address}`;
      fetchPromises.push(
        fetchBalancesByChain(address, chain)
          .then(balances => {
            results.set(key, balances);
          })
          .catch(error => {
            console.error(`Failed to fetch ${chain} balances for ${address}:`, error);
            results.set(key, []);
          })
      );
    }
  }

  await Promise.allSettled(fetchPromises);
  
  return results;
}

/**
 * Chain validation helpers
 */
export function isValidAddress(address: string, chain: Chain): boolean {
  switch (chain) {
    case 'ethereum':
    case 'base':
    case 'arbitrum':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'solana':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    case 'bitcoin':
      return (
        /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
        /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
        /^bc1[a-z0-9]{38,62}$/.test(address)
      );
    case 'bittensor':
      return /^5[a-zA-Z0-9]{47}$/.test(address);
    case 'alephium':
      return /^[1-4][0-9A-HJ-NP-Za-km-z]{44,45}$/.test(address);
    default:
      return false;
  }
}
