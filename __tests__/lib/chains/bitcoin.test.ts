import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBalances } from '@/lib/chains/bitcoin';
import { mockBlockstreamAddress } from '@/test/fixtures/mock-rpc-responses';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Bitcoin Balance Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches BTC balance correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBlockstreamAddress,
    });

    const balances = await fetchBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');

    expect(balances).toBeDefined();
    expect(balances.length).toBe(1);
    expect(balances[0].symbol).toBe('BTC');
    expect(balances[0].balance).toBe(1); // 1.5 BTC funded - 0.5 BTC spent = 1 BTC
    expect(balances[0].chain).toBe('bitcoin');
    expect(balances[0].tokenId).toBe('bitcoin');
  });

  it('handles empty wallet', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        chain_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
          tx_count: 0,
        },
        mempool_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
          tx_count: 0,
        },
      }),
    });

    const balances = await fetchBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');

    expect(balances.length).toBe(0);
  });

  it('includes unconfirmed (mempool) balance', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        chain_stats: {
          funded_txo_count: 1,
          funded_txo_sum: 100000000, // 1 BTC confirmed
          spent_txo_count: 0,
          spent_txo_sum: 0,
          tx_count: 1,
        },
        mempool_stats: {
          funded_txo_count: 1,
          funded_txo_sum: 50000000, // 0.5 BTC pending
          spent_txo_count: 0,
          spent_txo_sum: 0,
          tx_count: 1,
        },
      }),
    });

    const balances = await fetchBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');

    expect(balances[0].balance).toBe(1.5); // 1 BTC + 0.5 BTC pending
  });

  it('validates Legacy P2PKH addresses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockBlockstreamAddress,
        address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      }),
    });

    const balances = await fetchBalances('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
    expect(balances).toBeDefined();
  });

  it('validates P2SH addresses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockBlockstreamAddress,
        address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
      }),
    });

    const balances = await fetchBalances('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
    expect(balances).toBeDefined();
  });

  it('validates Bech32 SegWit addresses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBlockstreamAddress,
    });

    const balances = await fetchBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
    expect(balances).toBeDefined();
  });

  it('rejects invalid addresses', async () => {
    await expect(fetchBalances('invalid-btc-address')).rejects.toThrow(
      'Invalid Bitcoin address'
    );
  });

  it('handles API errors gracefully', async () => {
    // Return 500 error for all retry attempts
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      fetchBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')
    ).rejects.toThrow('Blockstream API error');
  }, 15000); // Increase timeout for retries

  it('returns correct decimals for BTC', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockBlockstreamAddress,
    });

    const balances = await fetchBalances('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');

    expect(balances[0].decimals).toBe(8);
  });
});
