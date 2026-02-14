// CSV Parser for Exchange Exports
// Supports Coinbase, Binance, and generic CSV formats

import type { Lot } from './types';

export interface ParsedCSVResult {
  lots: Lot[];
  token_id: string;
  symbol: string;
  errors: string[];
  warnings: string[];
}

export interface CSVRow {
  [key: string]: string;
}

export type ExchangeFormat = 'coinbase' | 'binance' | 'generic';

/**
 * Detect the exchange format from CSV headers
 */
export function detectExchangeFormat(headers: string[]): ExchangeFormat {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Coinbase: "Timestamp,Transaction Type,Asset,Quantity Transacted,Spot Price Currency,..."
  if (lowerHeaders.includes('transaction type') && lowerHeaders.includes('quantity transacted')) {
    return 'coinbase';
  }
  
  // Binance: "Date(UTC),Pair,Side,Price,Executed,Amount,Fee"
  if (lowerHeaders.includes('pair') && lowerHeaders.includes('side') && lowerHeaders.includes('executed')) {
    return 'binance';
  }
  
  return 'generic';
}

/**
 * Parse CSV string to rows
 */
export function parseCSVString(csvContent: string): { headers: string[]; rows: CSVRow[] } {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }
  
  // Handle potential BOM
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = parseCSVLine(headerLine);
  
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: CSVRow = {};
      headers.forEach((header, idx) => {
        row[header.trim()] = values[idx].trim();
      });
      rows.push(row);
    }
  }
  
  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

/**
 * Parse Coinbase CSV format
 */
export function parseCoinbaseCSV(rows: CSVRow[], targetSymbol?: string): ParsedCSVResult {
  const lots: Lot[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let detectedSymbol = '';
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // +2 for header row and 0-indexing
    
    try {
      const txType = row['Transaction Type']?.toLowerCase();
      const asset = row['Asset'];
      const qty = parseFloat(row['Quantity Transacted']);
      const spotPrice = parseFloat(row['Spot Price at Transaction']);
      const timestamp = row['Timestamp'];
      
      if (!asset || isNaN(qty) || isNaN(spotPrice)) {
        warnings.push(`Line ${lineNum}: Missing required fields, skipped`);
        continue;
      }
      
      // Filter by symbol if specified
      if (targetSymbol && asset.toUpperCase() !== targetSymbol.toUpperCase()) {
        continue;
      }
      
      if (!detectedSymbol) {
        detectedSymbol = asset.toUpperCase();
      }
      
      // Only process buy/sell transactions
      if (!['buy', 'sell', 'advanced trade buy', 'advanced trade sell'].includes(txType)) {
        continue;
      }
      
      const isSell = txType.includes('sell');
      const date = parseDate(timestamp);
      
      lots.push({
        date,
        qty: isSell ? -Math.abs(qty) : Math.abs(qty),
        price_per_unit: spotPrice,
        notes: `Coinbase ${txType}`,
      });
    } catch (e) {
      errors.push(`Line ${lineNum}: ${e instanceof Error ? e.message : 'Parse error'}`);
    }
  }
  
  return {
    lots,
    token_id: detectedSymbol.toLowerCase(),
    symbol: detectedSymbol,
    errors,
    warnings,
  };
}

/**
 * Parse Binance CSV format
 */
export function parseBinanceCSV(rows: CSVRow[], targetSymbol?: string): ParsedCSVResult {
  const lots: Lot[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let detectedSymbol = '';
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;
    
    try {
      const pair = row['Pair'];
      const side = row['Side']?.toLowerCase();
      const price = parseFloat(row['Price']);
      const executed = parseFloat(row['Executed']);
      const timestamp = row['Date(UTC)'];
      
      if (!pair || isNaN(price) || isNaN(executed)) {
        warnings.push(`Line ${lineNum}: Missing required fields, skipped`);
        continue;
      }
      
      // Extract base asset from pair (e.g., "BTCUSDT" -> "BTC")
      const baseAsset = extractBaseAsset(pair);
      
      if (targetSymbol && baseAsset.toUpperCase() !== targetSymbol.toUpperCase()) {
        continue;
      }
      
      if (!detectedSymbol) {
        detectedSymbol = baseAsset.toUpperCase();
      }
      
      const isSell = side === 'sell';
      const date = parseDate(timestamp);
      
      lots.push({
        date,
        qty: isSell ? -Math.abs(executed) : Math.abs(executed),
        price_per_unit: price,
        notes: `Binance ${side}`,
      });
    } catch (e) {
      errors.push(`Line ${lineNum}: ${e instanceof Error ? e.message : 'Parse error'}`);
    }
  }
  
  return {
    lots,
    token_id: detectedSymbol.toLowerCase(),
    symbol: detectedSymbol,
    errors,
    warnings,
  };
}

/**
 * Parse generic CSV format
 * Expected columns: date, quantity (or qty), price (or price_per_unit), type (optional), notes (optional)
 */
export function parseGenericCSV(rows: CSVRow[], targetSymbol?: string): ParsedCSVResult {
  const lots: Lot[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let detectedSymbol = '';
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;
    
    try {
      // Flexible column name matching
      const date = row['date'] || row['Date'] || row['timestamp'] || row['Timestamp'];
      const qtyStr = row['quantity'] || row['qty'] || row['Quantity'] || row['Qty'] || row['amount'] || row['Amount'];
      const priceStr = row['price'] || row['Price'] || row['price_per_unit'] || row['unit_price'] || row['UnitPrice'];
      const typeStr = row['type'] || row['Type'] || row['side'] || row['Side'] || '';
      const symbol = row['symbol'] || row['Symbol'] || row['asset'] || row['Asset'] || '';
      const notes = row['notes'] || row['Notes'] || row['memo'] || row['Memo'] || '';
      
      if (!date || !qtyStr || !priceStr) {
        warnings.push(`Line ${lineNum}: Missing date, quantity, or price, skipped`);
        continue;
      }
      
      if (targetSymbol && symbol && symbol.toUpperCase() !== targetSymbol.toUpperCase()) {
        continue;
      }
      
      if (symbol && !detectedSymbol) {
        detectedSymbol = symbol.toUpperCase();
      }
      
      let qty = parseFloat(qtyStr);
      const price = parseFloat(priceStr);
      
      if (isNaN(qty) || isNaN(price)) {
        errors.push(`Line ${lineNum}: Invalid number format`);
        continue;
      }
      
      // Handle type indicator
      const isSell = typeStr.toLowerCase().includes('sell') || qty < 0;
      if (isSell && qty > 0) {
        qty = -qty;
      }
      
      lots.push({
        date: parseDate(date),
        qty,
        price_per_unit: price,
        notes: notes || undefined,
      });
    } catch (e) {
      errors.push(`Line ${lineNum}: ${e instanceof Error ? e.message : 'Parse error'}`);
    }
  }
  
  return {
    lots,
    token_id: detectedSymbol.toLowerCase() || 'unknown',
    symbol: detectedSymbol || 'UNKNOWN',
    errors,
    warnings,
  };
}

/**
 * Main CSV parsing function - auto-detects format
 */
export function parseExchangeCSV(csvContent: string, targetSymbol?: string): ParsedCSVResult {
  const { headers, rows } = parseCSVString(csvContent);
  
  if (rows.length === 0) {
    return {
      lots: [],
      token_id: '',
      symbol: '',
      errors: ['No data rows found in CSV'],
      warnings: [],
    };
  }
  
  const format = detectExchangeFormat(headers);
  
  switch (format) {
    case 'coinbase':
      return parseCoinbaseCSV(rows, targetSymbol);
    case 'binance':
      return parseBinanceCSV(rows, targetSymbol);
    default:
      return parseGenericCSV(rows, targetSymbol);
  }
}

/**
 * Extract base asset from trading pair
 */
function extractBaseAsset(pair: string): string {
  // Common quote currencies
  const quotes = ['USDT', 'USDC', 'BUSD', 'USD', 'BTC', 'ETH', 'BNB'];
  
  for (const quote of quotes) {
    if (pair.endsWith(quote)) {
      return pair.slice(0, -quote.length);
    }
  }
  
  // Fallback: take first 3-4 characters
  return pair.slice(0, Math.min(4, pair.length));
}

/**
 * Parse various date formats to YYYY-MM-DD
 */
function parseDate(dateStr: string): string {
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    // Try common formats
    // MM/DD/YYYY
    const mdyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdyMatch) {
      return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
    }
    
    // YYYY/MM/DD
    const ymdSlashMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (ymdSlashMatch) {
      return `${ymdSlashMatch[1]}-${ymdSlashMatch[2].padStart(2, '0')}-${ymdSlashMatch[3].padStart(2, '0')}`;
    }
    
    // Return as-is if we can't parse
    return dateStr.split(' ')[0].split('T')[0];
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Validate lots before import
 */
export function validateLots(lots: Lot[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i];
    
    if (!lot.date || !/^\d{4}-\d{2}-\d{2}$/.test(lot.date)) {
      errors.push(`Lot ${i + 1}: Invalid date format (expected YYYY-MM-DD)`);
    }
    
    if (typeof lot.qty !== 'number' || lot.qty === 0) {
      errors.push(`Lot ${i + 1}: Quantity must be a non-zero number`);
    }
    
    if (typeof lot.price_per_unit !== 'number' || lot.price_per_unit <= 0) {
      errors.push(`Lot ${i + 1}: Price must be a positive number`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
