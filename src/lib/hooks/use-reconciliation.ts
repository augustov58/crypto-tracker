"use client";

import { useState, useEffect, useCallback } from 'react';

export interface ReconciliationItem {
  tokenId: string;
  symbol: string;
  walletBalance: number;
  costBasisQty: number;
  difference: number;
  differencePercent: number;
  currentPrice: number | null;
  differenceUsd: number | null;
  status: 'balanced' | 'over' | 'under' | 'no_cost_basis';
}

export interface ReconciliationSummary {
  totalTokens: number;
  balanced: number;
  needsAttention: number;
  noCostBasis: number;
}

interface UseReconciliationReturn {
  items: ReconciliationItem[];
  summary: ReconciliationSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useReconciliation(): UseReconciliationReturn {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/reconciliation');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch reconciliation data');
      }
      
      setItems(data.items || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    items,
    summary,
    loading,
    error,
    refetch,
  };
}
