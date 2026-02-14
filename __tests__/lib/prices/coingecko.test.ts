import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPrices,
  fetchHistoricalPrices,
  calculateVolatility,
  fetchPriceByContract,
} from '@/lib/prices/coingecko';
import {
  mockCoinGeckoPrices,
  mockCoinGeckoHistoricalPrices,
} from '@/test/fixtures/mock-rpc-responses';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CoinGecko Price Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchPrices', () => {
    it('fetches prices for multiple tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCoinGeckoPrices,
      });

      const prices = await fetchPrices(['bitcoin', 'ethereum', 'solana']);

      expect(prices).toBeDefined();
      expect(prices.bitcoin).toBeDefined();
      expect(prices.bitcoin.usd).toBe(97500);
      expect(prices.ethereum.usd).toBe(3250);
      expect(prices.solana.usd).toBe(185);
    });

    it('handles empty token list', async () => {
      const prices = await fetchPrices([]);

      expect(prices).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('filters out contract addresses (0x...)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: mockCoinGeckoPrices.bitcoin }),
      });

      const prices = await fetchPrices([
        'bitcoin',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      ]);

      // Only bitcoin should be in the request
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain('0xa0b86991');
    });

    it('deduplicates token IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: mockCoinGeckoPrices.bitcoin }),
      });

      await fetchPrices(['bitcoin', 'bitcoin', 'bitcoin']);

      const url = mockFetch.mock.calls[0][0] as string;
      const idsParam = new URL(url).searchParams.get('ids');
      expect(idsParam).toBe('bitcoin');
    });

    it('includes 24h change when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCoinGeckoPrices,
      });

      const prices = await fetchPrices(['bitcoin'], { include24hChange: true });

      expect(prices.bitcoin.usd_24h_change).toBe(2.5);
    });

    it('batches requests for >250 tokens', async () => {
      const manyTokens = Array.from({ length: 300 }, (_, i) => `token${i}`);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      await fetchPrices(manyTokens);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('handles rate limit errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(fetchPrices(['bitcoin'])).rejects.toThrow('rate limit');
    });
  });

  describe('fetchPriceByContract', () => {
    it('fetches price by contract address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
            usd: 1.0,
            usd_24h_change: 0.01,
          },
        }),
      });

      const price = await fetchPriceByContract(
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'ethereum'
      );

      expect(price).toBeDefined();
      expect(price?.usd).toBe(1.0);
    });

    it('returns null for unknown contracts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const price = await fetchPriceByContract(
        '0x0000000000000000000000000000000000000001',
        'ethereum'
      );

      expect(price).toBeNull();
    });
  });

  describe('fetchHistoricalPrices', () => {
    it('fetches historical prices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCoinGeckoHistoricalPrices,
      });

      const prices = await fetchHistoricalPrices('bitcoin', 7, 'daily');

      expect(prices).toBeDefined();
      expect(prices.length).toBe(7);
      expect(prices[0].timestamp).toBe(1707800000000);
      expect(prices[0].price).toBe(95000);
    });

    it('handles API errors', async () => {
      // Return error for all retry attempts
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchHistoricalPrices('bitcoin', 7)).rejects.toThrow(
        'CoinGecko API error'
      );
    }, 15000); // Increase timeout for retries
  });

  describe('calculateVolatility', () => {
    it('calculates volatility from price data', () => {
      const prices = [
        { price: 100 },
        { price: 102 },
        { price: 101 },
        { price: 103 },
        { price: 99 },
        { price: 100 },
      ];

      const volatility = calculateVolatility(prices);

      expect(volatility).toBeGreaterThan(0);
      expect(volatility).toBeLessThan(100); // Reasonable volatility
    });

    it('returns 0 for insufficient data', () => {
      const volatility = calculateVolatility([{ price: 100 }]);

      expect(volatility).toBe(0);
    });

    it('returns 0 for empty array', () => {
      const volatility = calculateVolatility([]);

      expect(volatility).toBe(0);
    });

    it('handles high volatility correctly', () => {
      const prices = [
        { price: 100 },
        { price: 200 },
        { price: 100 },
        { price: 200 },
        { price: 100 },
      ];

      const volatility = calculateVolatility(prices);

      // High volatility expected
      expect(volatility).toBeGreaterThan(100);
    });

    it('handles low volatility correctly', () => {
      const prices = [
        { price: 100 },
        { price: 100.01 },
        { price: 100.02 },
        { price: 100.01 },
        { price: 100 },
      ];

      const volatility = calculateVolatility(prices);

      // Very low volatility expected
      expect(volatility).toBeLessThan(5);
    });
  });
});
