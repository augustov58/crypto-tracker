/**
 * Test DeBank API Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { DebankClient } from '@/lib/defi/debank';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { debankKey } = body;
    
    // If no key provided, try to get from settings
    if (!debankKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = getServerSupabase() as any;
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'debank_api_key')
        .single();
      
      debankKey = data?.value;
    }
    
    if (!debankKey) {
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
    const client = new DebankClient(debankKey);
    const protocols = await client.getAllProtocolPositions(testAddress);
    
    return NextResponse.json({
      success: true,
      protocolCount: protocols.length,
    });
    
  } catch (error) {
    console.error('DeBank test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    });
  }
}
