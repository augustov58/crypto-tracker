/**
 * Wallets API
 * 
 * CRUD for wallet addresses
 * GET: List all wallets
 * POST: Add a new wallet
 * PUT: Update a wallet (label)
 * DELETE: Remove a wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, DbWallet } from '@/lib/supabase';
import { isValidAddress, Chain } from '@/lib/chains';

const SUPPORTED_CHAINS: Chain[] = [
  'ethereum',
  'base',
  'arbitrum',
  'solana',
  'bitcoin',
  'bittensor',
  'alephium',
];

// GET: List all wallets
export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;

    const { data: wallets, error } = await supabase
      .from('wallets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch wallets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch wallets' },
        { status: 500 }
      );
    }

    return NextResponse.json({ wallets: wallets || [] });

  } catch (error) {
    console.error('Wallets API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Add a new wallet
export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const body = await request.json();
    const { chain, address, label } = body as {
      chain: string;
      address: string;
      label?: string;
    };

    // Validate chain
    if (!chain || !SUPPORTED_CHAINS.includes(chain as Chain)) {
      return NextResponse.json(
        { error: `Invalid chain. Supported: ${SUPPORTED_CHAINS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate address
    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    if (!isValidAddress(address, chain as Chain)) {
      return NextResponse.json(
        { error: `Invalid address format for ${chain}` },
        { status: 400 }
      );
    }

    // Check for existing wallet
    const { data: existing } = await supabase
      .from('wallets')
      .select('id')
      .eq('chain', chain)
      .eq('address', address.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Wallet already exists' },
        { status: 409 }
      );
    }

    // Insert new wallet
    const { data: wallet, error } = await supabase
      .from('wallets')
      .insert({
        chain,
        address: address.toLowerCase(),
        label: label || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create wallet:', error);
      return NextResponse.json(
        { error: 'Failed to create wallet' },
        { status: 500 }
      );
    }

    return NextResponse.json({ wallet }, { status: 201 });

  } catch (error) {
    console.error('Wallets API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update a wallet
export async function PUT(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const body = await request.json();
    const { id, label } = body as {
      id: number;
      label?: string;
    };

    if (!id) {
      return NextResponse.json(
        { error: 'Wallet ID is required' },
        { status: 400 }
      );
    }

    const { data: wallet, error } = await supabase
      .from('wallets')
      .update({ label: label || null })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update wallet:', error);
      return NextResponse.json(
        { error: 'Failed to update wallet' },
        { status: 500 }
      );
    }

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ wallet });

  } catch (error) {
    console.error('Wallets API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a wallet
export async function DELETE(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = getServerSupabase() as any;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Wallet ID is required' },
        { status: 400 }
      );
    }

    // First delete related balances
    await supabase
      .from('balances')
      .delete()
      .eq('wallet_id', parseInt(id));

    // Then delete the wallet
    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('Failed to delete wallet:', error);
      return NextResponse.json(
        { error: 'Failed to delete wallet' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Wallets API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
