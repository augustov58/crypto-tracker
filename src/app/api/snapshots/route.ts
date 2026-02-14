/**
 * Snapshots API
 * 
 * GET: Returns historical snapshots for charts
 * Supports query params:
 *   - from: ISO date string (default: 7 days ago)
 *   - to: ISO date string (default: now)
 *   - interval: 'hourly' | 'daily' (default: depends on range)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export interface SnapshotPoint {
  timestamp: string;
  totalUsd: number;
  defiUsd: number;
  tokenCount: number;
}

export interface SnapshotsResponse {
  snapshots: SnapshotPoint[];
  interval: 'hourly' | 'daily';
  from: string;
  to: string;
}

export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const searchParams = request.nextUrl.searchParams;

    // Parse query params
    const toParam = searchParams.get('to');
    const fromParam = searchParams.get('from');
    const intervalParam = searchParams.get('interval') as 'hourly' | 'daily' | null;

    const to = toParam ? new Date(toParam) : new Date();
    const defaultFrom = new Date(to);
    defaultFrom.setDate(defaultFrom.getDate() - 7);
    const from = fromParam ? new Date(fromParam) : defaultFrom;

    // Determine interval based on range if not specified
    const rangeMs = to.getTime() - from.getTime();
    const rangeDays = rangeMs / (1000 * 60 * 60 * 24);
    const interval: 'hourly' | 'daily' = intervalParam || (rangeDays > 14 ? 'daily' : 'hourly');

    // Fetch snapshots within range
    const { data: rawSnapshots, error } = await supabase
      .from('snapshots')
      .select('*')
      .gte('snapshot_at', from.toISOString())
      .lte('snapshot_at', to.toISOString())
      .order('snapshot_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch snapshots:', error);
      return NextResponse.json(
        { error: 'Failed to fetch snapshots' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let snapshots: SnapshotPoint[] = (rawSnapshots || []).map((s: any) => ({
      timestamp: s.snapshot_at,
      totalUsd: parseFloat(s.total_usd),
      defiUsd: parseFloat(s.defi_usd || '0'),
      tokenCount: s.token_count,
    }));

    // Aggregate to daily if needed
    if (interval === 'daily' && snapshots.length > 0) {
      const dailyMap = new Map<string, SnapshotPoint[]>();
      
      for (const snapshot of snapshots) {
        const date = snapshot.timestamp.split('T')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, []);
        }
        dailyMap.get(date)!.push(snapshot);
      }

      // Take the last snapshot of each day
      snapshots = Array.from(dailyMap.entries())
        .map(([date, daySnapshots]) => {
          const lastSnapshot = daySnapshots[daySnapshots.length - 1];
          return {
            ...lastSnapshot,
            timestamp: `${date}T23:59:59Z`,
          };
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    return NextResponse.json<SnapshotsResponse>({
      snapshots,
      interval,
      from: from.toISOString(),
      to: to.toISOString(),
    });

  } catch (error) {
    console.error('Snapshots API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
