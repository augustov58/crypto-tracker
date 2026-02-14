// CSV Import API Route

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { csvImportSchema } from '@/lib/validations/cost-basis';
import { parseExchangeCSV, validateLots } from '@/lib/pnl/csv-parser';
import type { Lot } from '@/lib/pnl/types';

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServerClient() as any;
    const body = await request.json();
    
    // Validate input
    const validationResult = csvImportSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }
    
    const { csv_content, target_symbol, merge } = validationResult.data;
    
    // Parse CSV
    const parseResult = parseExchangeCSV(csv_content, target_symbol);
    
    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'CSV parsing errors', 
          details: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }
    
    if (parseResult.lots.length === 0) {
      return NextResponse.json(
        { 
          error: 'No valid lots found in CSV',
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }
    
    // Validate lots
    const lotValidation = validateLots(parseResult.lots);
    if (!lotValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid lot data', details: lotValidation.errors },
        { status: 400 }
      );
    }
    
    const tokenId = parseResult.token_id;
    const symbol = parseResult.symbol;
    
    // Check for existing entry
    const { data: existing } = await supabase
      .from('cost_basis')
      .select('*')
      .eq('token_id', tokenId)
      .single();
    
    let finalLots: Lot[];
    
    if (existing && merge) {
      // Merge with existing lots
      const existingLots: Lot[] = typeof existing.lots === 'string' 
        ? JSON.parse(existing.lots) 
        : existing.lots;
      
      // Combine and deduplicate by date+qty (simple dedup)
      const lotMap = new Map<string, Lot>();
      
      for (const lot of existingLots) {
        const key = `${lot.date}-${lot.qty}-${lot.price_per_unit}`;
        lotMap.set(key, lot);
      }
      
      for (const lot of parseResult.lots) {
        const key = `${lot.date}-${lot.qty}-${lot.price_per_unit}`;
        if (!lotMap.has(key)) {
          lotMap.set(key, lot);
        }
      }
      
      finalLots = Array.from(lotMap.values());
    } else {
      finalLots = parseResult.lots;
    }
    
    // Sort by date
    finalLots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Upsert the entry
    let data, error;
    
    if (existing) {
      const result = await supabase
        .from('cost_basis')
        .update({
          lots: finalLots,
          method: 'csv_import',
          updated_at: new Date().toISOString(),
        })
        .eq('token_id', tokenId)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('cost_basis')
        .insert({
          token_id: tokenId,
          symbol,
          method: 'csv_import',
          lots: finalLots,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save cost basis', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        lots: typeof data.lots === 'string' ? JSON.parse(data.lots) : data.lots,
      },
      stats: {
        lots_imported: parseResult.lots.length,
        total_lots: finalLots.length,
        merged: existing && merge,
      },
      warnings: parseResult.warnings,
    });
  } catch (error) {
    console.error('Error importing CSV:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
