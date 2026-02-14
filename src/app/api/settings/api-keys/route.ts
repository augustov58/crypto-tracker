/**
 * API Keys Settings Endpoint
 * 
 * Stores API keys in Supabase for server-side use
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

const SETTINGS_TABLE = 'settings';

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    
    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .select('key, value')
      .in('key', ['zerion_api_key', 'debank_api_key']);
    
    if (error) {
      // Table might not exist yet
      console.error('Settings fetch error:', error);
      return NextResponse.json({ zerionKey: '', debankKey: '' });
    }
    
    const settings: Record<string, string> = {};
    for (const row of data || []) {
      settings[row.key] = row.value;
    }
    
    return NextResponse.json({
      zerionKey: settings.zerion_api_key ? '••••••••' + settings.zerion_api_key.slice(-4) : '',
      debankKey: settings.debank_api_key ? '••••••••' + settings.debank_api_key.slice(-4) : '',
    });
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zerionKey, debankKey } = body;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    
    // Upsert the API keys
    if (zerionKey) {
      const { error } = await supabase
        .from(SETTINGS_TABLE)
        .upsert(
          { key: 'zerion_api_key', value: zerionKey },
          { onConflict: 'key' }
        );
      
      if (error) {
        console.error('Failed to save Zerion API key:', error);
        return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
      }
    }
    
    if (debankKey) {
      const { error } = await supabase
        .from(SETTINGS_TABLE)
        .upsert(
          { key: 'debank_api_key', value: debankKey },
          { onConflict: 'key' }
        );
      
      if (error) {
        console.error('Failed to save DeBank API key:', error);
        return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
