/**
 * Alerts API
 * 
 * CRUD for price/portfolio alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export interface AlertCondition {
  type: 'price' | 'portfolio_value' | 'pnl_percent';
  token_id?: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  value: number;
}

export interface Alert {
  id: number;
  name: string;
  condition: AlertCondition;
  enabled: boolean;
  last_fired: string | null;
  created_at: string;
}

export interface AlertsResponse {
  alerts: Alert[];
}

// GET: List all alerts
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;

    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }

    return NextResponse.json<AlertsResponse>({ alerts: alerts || [] });

  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new alert
export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const body = await request.json();
    
    const { name, condition, enabled = true } = body as {
      name: string;
      condition: AlertCondition;
      enabled?: boolean;
    };

    if (!name || !condition) {
      return NextResponse.json({ error: 'Name and condition are required' }, { status: 400 });
    }

    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        name,
        condition,
        enabled,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create alert:', error);
      return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }

    return NextResponse.json({ alert }, { status: 201 });

  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update an alert
export async function PUT(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const body = await request.json();
    
    const { id, name, condition, enabled } = body as {
      id: number;
      name?: string;
      condition?: AlertCondition;
      enabled?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (condition !== undefined) updates.condition = condition;
    if (enabled !== undefined) updates.enabled = enabled;

    const { data: alert, error } = await supabase
      .from('alerts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update alert:', error);
      return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
    }

    return NextResponse.json({ alert });

  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove an alert
export async function DELETE(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('Failed to delete alert:', error);
      return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
