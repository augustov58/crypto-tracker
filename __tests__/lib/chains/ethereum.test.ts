import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidAddress } from '@/lib/chains/index';
import { Chain } from '@/lib/chains/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Ethereum Balance Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Address Validation', () => {
    it('validates correct Ethereum addresses', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f9e4B4', 'ethereum')).toBe(true);
      expect(isValidAddress('0x0000000000000000000000000000000000000001', 'ethereum')).toBe(true);
      expect(isValidAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'ethereum')).toBe(true);
    });

    it('rejects invalid Ethereum addresses', () => {
      expect(isValidAddress('not-an-address', 'ethereum')).toBe(false);
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f9e4', 'ethereum')).toBe(false); // too short
      expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f9e4B4', 'ethereum')).toBe(false); // no 0x
    });

    it('validates addresses for Base and Arbitrum the same way', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f9e4B4';
      expect(isValidAddress(address, 'base')).toBe(true);
      expect(isValidAddress(address, 'arbitrum')).toBe(true);
    });
  });

  describe('Module exports', () => {
    it('exports fetchBalances function', async () => {
      const { fetchBalances } = await import('@/lib/chains/ethereum');
      expect(typeof fetchBalances).toBe('function');
    });

    it('exports chain-specific helpers', async () => {
      const { fetchEthereumBalances, fetchBaseBalances, fetchArbitrumBalances } = await import('@/lib/chains/ethereum');
      expect(typeof fetchEthereumBalances).toBe('function');
      expect(typeof fetchBaseBalances).toBe('function');
      expect(typeof fetchArbitrumBalances).toBe('function');
    });
  });

  describe('Environment validation', () => {
    it('throws on missing API key', async () => {
      const originalKey = process.env.ALCHEMY_API_KEY;
      delete process.env.ALCHEMY_API_KEY;

      const { fetchBalances } = await import('@/lib/chains/ethereum');
      
      await expect(
        fetchBalances('0x742d35Cc6634C0532925a3b844Bc9e7595f9e4B4', 'ethereum')
      ).rejects.toThrow('ALCHEMY_API_KEY');

      process.env.ALCHEMY_API_KEY = originalKey;
    });
  });
});

describe('EVM Chain Helpers', () => {
  it('all EVM chains use same address validation', () => {
    const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f9e4B4';
    const evmChains: Chain[] = ['ethereum', 'base', 'arbitrum'];
    
    for (const chain of evmChains) {
      expect(isValidAddress(validAddress, chain)).toBe(true);
    }
  });
});
