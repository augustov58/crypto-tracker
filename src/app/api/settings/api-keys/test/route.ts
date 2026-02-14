/**
 * Test Zerion API Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { ZerionClient, transformZerionPositions } from '@/lib/defi/zerion';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { zerionKey } = body;
    
    // If no key provided, try to get from settings
    if (!zerionKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = getServerSupabase() as any;
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'zerion_api_key')
        .single();
      
      zerionKey = data?.value;
    }
    
    if (!zerionKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'No API key provided' 
      });
    }
    
    // Get a wallet address to test with
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const { data: wallets } = await supabase
      .from('wallets')
      .select('address')
      .like('address', '0x%')
      .limit(1);
    
    if (!wallets?.length) {
      return NextResponse.json({ 
        success: false, 
        error: 'No EVM wallet found to test with' 
      });
    }
    
    const testAddress = wallets[0].address;
    
    // Test the API
    const client = new ZerionClient(zerionKey);
    const positions = await client.getDefiPositions(testAddress);
    const transformed = transformZerionPositions(positions);
    const totalValue = transformed.reduce((sum, p) => sum + p.netUsdValue, 0);
    
    return NextResponse.json({
      success: true,
      positionCount: transformed.length,
      totalValue: Math.round(totalValue * 100) / 100,
    });
    
  } catch (error) {
    console.error('Zerion test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    });
  }
}
