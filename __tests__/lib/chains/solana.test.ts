import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBalances } from '@/lib/chains/solana';
import {
  mockHeliusSolBalance,
  mockHeliusAssetsByOwner,
} from '@/test/fixtures/mock-rpc-responses';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Solana Balance Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches native SOL balance correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHeliusSolBalance,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHeliusAssetsByOwner,
      });

    const balances = await fetchBalances('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH');

    expect(balances).toBeDefined();
    expect(Array.isArray(balances)).toBe(true);
    
    // Find SOL balance
    const solBalance = balances.find(b => b.symbol === 'SOL');
    expect(solBalance).toBeDefined();
    expect(solBalance?.balance).toBe(5); // 5 SOL
    expect(solBalance?.chain).toBe('solana');
  });

  it('fetches SPL token balances correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHeliusSolBalance,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHeliusAssetsByOwner,
      });

    const balances = await fetchBalances('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH');

    // Find USDC balance
    const usdcBalance = balances.find(b => b.symbol === 'USDC');
    expect(usdcBalance).toBeDefined();
    expect(usdcBalance?.balance).toBe(1000); // 1000 USDC

    // Find JUP balance
    const jupBalance = balances.find(b => b.symbol === 'JUP');
    expect(jupBalance).toBeDefined();
    expect(jupBalance?.balance).toBe(50); // 50 JUP
  });

  it('handles empty wallet', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { context: { slot: 200000000 }, value: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { total: 0, limit: 1000, page: 1, items: [] },
        }),
      });

    const balances = await fetchBalances('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH');

    expect(balances).toBeDefined();
    expect(balances.length).toBe(0);
  });

  it('retries on API errors', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return { ok: false, status: 500, statusText: 'Internal Server Error' };
      }
      return {
        ok: true,
        json: async () => mockHeliusSolBalance,
      };
    });

    try {
      await fetchBalances('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH');
    } catch {
      // Expected
    }

    expect(callCount).toBeGreaterThan(1);
  });

  it('maps known tokens to CoinGecko IDs', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHeliusSolBalance,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockHeliusAssetsByOwner,
      });

    const balances = await fetchBalances('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH');

    const usdcBalance = balances.find(b => b.symbol === 'USDC');
    expect(usdcBalance?.tokenId).toBe('usd-coin');

    const jupBalance = balances.find(b => b.symbol === 'JUP');
    expect(jupBalance?.tokenId).toBe('jupiter-exchange-solana');
  });

  it('throws on missing API key', async () => {
    const originalKey = process.env.HELIUS_API_KEY;
    delete process.env.HELIUS_API_KEY;

    await expect(
      fetchBalances('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH')
    ).rejects.toThrow('HELIUS_API_KEY');

    process.env.HELIUS_API_KEY = originalKey;
  });
});
