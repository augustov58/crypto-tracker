"use client";

import { useState, useEffect, useCallback } from 'react';
import { usePortfolioStore } from '@/lib/store';
import type { PnLResult, PortfolioPnLSummary } from '@/lib/pnl/types';

interface UsePnLReturn {
  summary: PortfolioPnLSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getTokenPnL: (tokenId: string) => PnLResult | undefined;
}

export function usePnL(): UsePnLReturn {
  const { pnlMethod } = usePortfolioStore();
  const [summary, setSummary] = useState<PortfolioPnLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/pnl?method=${pnlMethod}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch PnL');
      }
      
      setSummary(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [pnlMethod]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const getTokenPnL = useCallback((tokenId: string): PnLResult | undefined => {
    return summary?.by_token.find(t => t.token_id === tokenId);
  }, [summary]);

  return {
    summary,
    loading,
    error,
    refetch,
    getTokenPnL,
  };
}
