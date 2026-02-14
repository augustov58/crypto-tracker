// Cost Basis CRUD API Routes

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { 
  createCostBasisSchema, 
  updateCostBasisSchema, 
  addLotSchema,
  type Lot 
} from '@/lib/validations/cost-basis';

interface CostBasisRow {
  id: number;
  token_id: string;
  symbol: string;
  method: string;
  lots: Lot[];
  updated_at: string;
}

// GET - Fetch all cost basis entries or by token_id
export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServerClient() as any;
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('token_id');
    
    let query = supabase.from('cost_basis').select('*');
    
    if (tokenId) {
      query = query.eq('token_id', tokenId);
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cost basis entries', details: error.message },
        { status: 500 }
      );
    }
    
    // Parse the JSONB lots field
    const entries = (data as CostBasisRow[]).map(entry => ({
      ...entry,
      lots: typeof entry.lots === 'string' ? JSON.parse(entry.lots) : entry.lots,
    }));
    
    return NextResponse.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error('Error fetching cost basis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new cost basis entry with lots
export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServerClient() as any;
    const body = await request.json();
    
    // Validate input
    const validationResult = createCostBasisSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }
    
    const { token_id, symbol, method, lots } = validationResult.data;
    
    // Check if entry already exists
    const { data: existing } = await supabase
      .from('cost_basis')
      .select('id')
      .eq('token_id', token_id)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { error: 'Cost basis entry already exists for this token. Use PUT to update.' },
        { status: 409 }
      );
    }
    
    // Sort lots by date
    const sortedLots = [...lots].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const { data, error } = await supabase
      .from('cost_basis')
      .insert({
        token_id,
        symbol: symbol.toUpperCase(),
        method,
        lots: sortedLots,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create cost basis entry', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        lots: typeof data.lots === 'string' ? JSON.parse(data.lots) : data.lots,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating cost basis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update lots for a token (replace all lots or add new lot)
export async function PUT(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServerClient() as any;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'add_lot' for adding single lot
    
    // Handle add single lot action
    if (action === 'add_lot') {
      const validationResult = addLotSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validationResult.error.issues },
          { status: 400 }
        );
      }
      
      const { token_id, symbol, lot } = validationResult.data;
      
      // Get existing entry or create new one
      const { data: existing } = await supabase
        .from('cost_basis')
        .select('*')
        .eq('token_id', token_id)
        .single();
      
      let lots: Lot[];
      if (existing) {
        const existingLots = typeof existing.lots === 'string' 
          ? JSON.parse(existing.lots) 
          : existing.lots;
        lots = [...existingLots, lot];
      } else {
        lots = [lot];
      }
      
      // Sort by date
      lots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const { data, error } = existing
        ? await supabase
            .from('cost_basis')
            .update({ 
              lots, 
              updated_at: new Date().toISOString() 
            })
            .eq('token_id', token_id)
            .select()
            .single()
        : await supabase
            .from('cost_basis')
            .insert({
              token_id,
              symbol: symbol.toUpperCase(),
              method: 'manual',
              lots,
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();
      
      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to add lot', details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: {
          ...data,
          lots: typeof data.lots === 'string' ? JSON.parse(data.lots) : data.lots,
        },
      });
    }
    
    // Regular update - replace all lots
    const validationResult = updateCostBasisSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }
    
    const { token_id, lots, method } = validationResult.data;
    
    // Sort lots by date
    const sortedLots = [...lots].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const updateData: { lots: Lot[]; updated_at: string; method?: string } = {
      lots: sortedLots,
      updated_at: new Date().toISOString(),
    };
    
    if (method) {
      updateData.method = method;
    }
    
    const { data, error } = await supabase
      .from('cost_basis')
      .update(updateData)
      .eq('token_id', token_id)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update cost basis', details: error.message },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Cost basis entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        lots: typeof data.lots === 'string' ? JSON.parse(data.lots) : data.lots,
      },
    });
  } catch (error) {
    console.error('Error updating cost basis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove cost basis entry
export async function DELETE(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServerClient() as any;
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('token_id');
    const lotIndex = searchParams.get('lot_index'); // For deleting specific lot
    
    if (!tokenId) {
      return NextResponse.json(
        { error: 'token_id is required' },
        { status: 400 }
      );
    }
    
    // If lot_index is provided, delete specific lot
    if (lotIndex !== null) {
      const index = parseInt(lotIndex, 10);
      if (isNaN(index) || index < 0) {
        return NextResponse.json(
          { error: 'Invalid lot_index' },
          { status: 400 }
        );
      }
      
      // Get existing entry
      const { data: existing, error: fetchError } = await supabase
        .from('cost_basis')
        .select('*')
        .eq('token_id', tokenId)
        .single();
      
      if (fetchError || !existing) {
        return NextResponse.json(
          { error: 'Cost basis entry not found' },
          { status: 404 }
        );
      }
      
      const lots = typeof existing.lots === 'string' 
        ? JSON.parse(existing.lots) 
        : existing.lots;
      
      if (index >= lots.length) {
        return NextResponse.json(
          { error: 'Lot index out of range' },
          { status: 400 }
        );
      }
      
      // Remove the lot
      lots.splice(index, 1);
      
      // If no lots remain, delete the entire entry
      if (lots.length === 0) {
        const { error: deleteError } = await supabase
          .from('cost_basis')
          .delete()
          .eq('token_id', tokenId);
        
        if (deleteError) {
          console.error('Supabase error:', deleteError);
          return NextResponse.json(
            { error: 'Failed to delete cost basis entry', details: deleteError.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          success: true,
          message: 'Cost basis entry deleted (no remaining lots)',
        });
      }
      
      // Update with remaining lots
      const { data, error: updateError } = await supabase
        .from('cost_basis')
        .update({ 
          lots, 
          updated_at: new Date().toISOString() 
        })
        .eq('token_id', tokenId)
        .select()
        .single();
      
      if (updateError) {
        console.error('Supabase error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update cost basis', details: updateError.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: {
          ...data,
          lots: typeof data.lots === 'string' ? JSON.parse(data.lots) : data.lots,
        },
      });
    }
    
    // Delete entire entry
    const { error } = await supabase
      .from('cost_basis')
      .delete()
      .eq('token_id', tokenId);
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to delete cost basis entry', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Cost basis entry deleted',
    });
  } catch (error) {
    console.error('Error deleting cost basis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
