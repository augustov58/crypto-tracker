"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Lot } from '@/lib/pnl/types';

export interface CostBasisEntry {
  id: number;
  token_id: string;
  symbol: string;
  method: string;
  lots: Lot[];
  updated_at: string;
}

interface UseCostBasisReturn {
  entries: CostBasisEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addLot: (tokenId: string, symbol: string, lot: Lot) => Promise<boolean>;
  updateLots: (tokenId: string, lots: Lot[]) => Promise<boolean>;
  deleteLot: (tokenId: string, lotIndex: number) => Promise<boolean>;
  deleteEntry: (tokenId: string) => Promise<boolean>;
}

export function useCostBasis(): UseCostBasisReturn {
  const [entries, setEntries] = useState<CostBasisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/cost-basis');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch cost basis');
      }
      
      setEntries(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addLot = useCallback(async (tokenId: string, symbol: string, lot: Lot): Promise<boolean> => {
    try {
      const res = await fetch('/api/cost-basis?action=add_lot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: tokenId, symbol, lot }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add lot');
      }
      
      await refetch();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add lot');
      return false;
    }
  }, [refetch]);

  const updateLots = useCallback(async (tokenId: string, lots: Lot[]): Promise<boolean> => {
    try {
      const res = await fetch('/api/cost-basis', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: tokenId, lots }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update lots');
      }
      
      await refetch();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lots');
      return false;
    }
  }, [refetch]);

  const deleteLot = useCallback(async (tokenId: string, lotIndex: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cost-basis?token_id=${tokenId}&lot_index=${lotIndex}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete lot');
      }
      
      await refetch();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete lot');
      return false;
    }
  }, [refetch]);

  const deleteEntry = useCallback(async (tokenId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cost-basis?token_id=${tokenId}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete entry');
      }
      
      await refetch();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
      return false;
    }
  }, [refetch]);

  return {
    entries,
    loading,
    error,
    refetch,
    addLot,
    updateLots,
    deleteLot,
    deleteEntry,
  };
}
