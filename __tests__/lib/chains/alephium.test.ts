import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBalances } from '@/lib/chains/alephium';
import { mockAlephiumAddressInfo } from '@/test/fixtures/mock-rpc-responses';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Alephium Balance Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches ALPH balance correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlephiumAddressInfo,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const balances = await fetchBalances('1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH');

    expect(balances).toBeDefined();
    expect(balances.length).toBe(1);
    expect(balances[0].symbol).toBe('ALPH');
    expect(balances[0].balance).toBe(1000); // 1000 ALPH
    expect(balances[0].chain).toBe('alephium');
    expect(balances[0].tokenId).toBe('alephium');
  });

  it('handles wallet with no activity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const balances = await fetchBalances('1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH');

    expect(balances).toBeDefined();
    expect(balances.length).toBe(0);
  });

  it('includes locked balance in total', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: '500000000000000000000', // 500 ALPH
          lockedBalance: '500000000000000000000', // 500 ALPH locked
          txNumber: 10,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const balances = await fetchBalances('1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH');

    expect(balances[0].balance).toBe(1000); // 500 + 500 = 1000 ALPH total
  });

  it('handles zero balance', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: '0',
          lockedBalance: '0',
          txNumber: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const balances = await fetchBalances('1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH');

    expect(balances.length).toBe(0);
  });

  it('validates Alephium address format', async () => {
    await expect(fetchBalances('invalid-alph-address')).rejects.toThrow(
      'Invalid Alephium address'
    );
  });

  it('rejects addresses that do not start with 1-4', async () => {
    await expect(
      fetchBalances('5DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH')
    ).rejects.toThrow('Invalid Alephium address');
  });

  it('handles API errors gracefully', async () => {
    // Return 500 error for all retry attempts
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      fetchBalances('1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH')
    ).rejects.toThrow('Alephium Explorer API error');
  }, 15000); // Increase timeout for retries

  it('returns correct decimals for ALPH', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlephiumAddressInfo,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const balances = await fetchBalances('1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH');

    expect(balances[0].decimals).toBe(18);
  });

  it('continues if token fetch fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAlephiumAddressInfo,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    const balances = await fetchBalances('1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH');

    // Should still have ALPH balance
    expect(balances.length).toBe(1);
    expect(balances[0].symbol).toBe('ALPH');
  });
});
