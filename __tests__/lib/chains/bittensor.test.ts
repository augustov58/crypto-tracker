import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBalances } from '@/lib/chains/bittensor';
import {
  mockTaostatsAccount,
  mockTaostatsStake,
} from '@/test/fixtures/mock-rpc-responses';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Bittensor Balance Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches TAO balance correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaostatsAccount,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaostatsStake,
      });

    const balances = await fetchBalances('5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM');

    expect(balances).toBeDefined();
    expect(Array.isArray(balances)).toBe(true);
    
    // Find free TAO balance
    const freeBalance = balances.find(b => b.name.includes('Free'));
    expect(freeBalance).toBeDefined();
    expect(freeBalance?.balance).toBe(10); // 10 TAO
    expect(freeBalance?.symbol).toBe('TAO');
    expect(freeBalance?.chain).toBe('bittensor');
  });

  it('fetches staked TAO correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaostatsAccount,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaostatsStake,
      });

    const balances = await fetchBalances('5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM');

    // Find staked TAO balance
    const stakedBalance = balances.find(b => b.name.includes('Staked'));
    expect(stakedBalance).toBeDefined();
    expect(stakedBalance?.balance).toBe(5); // 5 TAO staked
    expect(stakedBalance?.symbol).toBe('sTAO');
  });

  it('handles address with no activity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const balances = await fetchBalances('5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM');

    expect(balances).toBeDefined();
    expect(balances.length).toBe(0);
  });

  it('continues without stake info on stake API failure', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaostatsAccount,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    const balances = await fetchBalances('5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM');

    // Should still have free balance
    expect(balances.length).toBeGreaterThanOrEqual(1);
    const freeBalance = balances.find(b => b.name.includes('Free'));
    expect(freeBalance).toBeDefined();
  });

  it('validates SS58 address format', async () => {
    await expect(
      fetchBalances('invalid-tao-address')
    ).rejects.toThrow('Invalid Bittensor address');
  });

  it('rejects addresses that do not start with 5', async () => {
    await expect(
      fetchBalances('1C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM')
    ).rejects.toThrow('Invalid Bittensor address');
  });

  it('returns correct CoinGecko ID', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTaostatsAccount,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const balances = await fetchBalances('5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM');

    expect(balances[0].tokenId).toBe('bittensor');
  });

  it('handles zero balance correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTaostatsAccount,
          balance: '0',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    const balances = await fetchBalances('5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM');

    // No free balance when balance is 0
    const freeBalance = balances.find(b => b.name.includes('Free'));
    expect(freeBalance).toBeUndefined();
  });
});
