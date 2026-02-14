import { describe, it, expect } from 'vitest';
import {
  detectExchangeFormat,
  parseCSVString,
  parseCoinbaseCSV,
  parseBinanceCSV,
  parseGenericCSV,
  parseExchangeCSV,
  validateLots,
} from '@/lib/pnl/csv-parser';

describe('CSV Parser', () => {
  describe('detectExchangeFormat', () => {
    it('detects Coinbase format', () => {
      const headers = ['Timestamp', 'Transaction Type', 'Asset', 'Quantity Transacted', 'Spot Price at Transaction'];
      expect(detectExchangeFormat(headers)).toBe('coinbase');
    });

    it('detects Binance format', () => {
      const headers = ['Date(UTC)', 'Pair', 'Side', 'Price', 'Executed', 'Amount', 'Fee'];
      expect(detectExchangeFormat(headers)).toBe('binance');
    });

    it('defaults to generic format', () => {
      const headers = ['date', 'quantity', 'price', 'notes'];
      expect(detectExchangeFormat(headers)).toBe('generic');
    });
  });

  describe('parseCSVString', () => {
    it('parses simple CSV', () => {
      const csv = `date,quantity,price\n2024-01-01,1.0,40000\n2024-02-01,0.5,50000`;
      const { headers, rows } = parseCSVString(csv);
      
      expect(headers).toEqual(['date', 'quantity', 'price']);
      expect(rows.length).toBe(2);
      expect(rows[0]['date']).toBe('2024-01-01');
      expect(rows[0]['quantity']).toBe('1.0');
    });

    it('handles quoted values with commas', () => {
      const csv = `date,notes,qty\n2024-01-01,"Buy, DCA",1.0`;
      const { rows } = parseCSVString(csv);
      
      expect(rows[0]['notes']).toBe('Buy, DCA');
    });

    it('handles BOM character', () => {
      const csv = `\uFEFFdate,qty\n2024-01-01,1.0`;
      const { headers } = parseCSVString(csv);
      
      expect(headers[0]).toBe('date');
    });
  });

  describe('parseGenericCSV', () => {
    it('parses generic CSV with standard columns', () => {
      const rows = [
        { date: '2024-01-01', quantity: '1.0', price: '40000', type: 'buy', notes: 'DCA' },
        { date: '2024-02-01', quantity: '0.5', price: '50000', type: 'sell', notes: '' },
      ];
      
      const result = parseGenericCSV(rows);
      
      expect(result.lots.length).toBe(2);
      expect(result.lots[0].qty).toBe(1.0);
      expect(result.lots[0].price_per_unit).toBe(40000);
      expect(result.lots[0].notes).toBe('DCA');
      expect(result.lots[1].qty).toBe(-0.5); // Sell is negative
    });

    it('handles flexible column names', () => {
      const rows = [
        { Date: '2024-01-01', Qty: '1.0', Price: '40000' },
      ];
      
      const result = parseGenericCSV(rows);
      
      expect(result.lots.length).toBe(1);
      expect(result.lots[0].qty).toBe(1.0);
    });

    it('filters by target symbol', () => {
      const rows = [
        { date: '2024-01-01', qty: '1.0', price: '40000', symbol: 'BTC' },
        { date: '2024-02-01', qty: '10.0', price: '3500', symbol: 'ETH' },
      ];
      
      const result = parseGenericCSV(rows, 'BTC');
      
      expect(result.lots.length).toBe(1);
      expect(result.symbol).toBe('BTC');
    });
  });

  describe('parseCoinbaseCSV', () => {
    it('parses Coinbase export format', () => {
      const rows = [
        {
          'Timestamp': '2024-01-15T10:30:00Z',
          'Transaction Type': 'Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.5',
          'Spot Price at Transaction': '42000',
        },
        {
          'Timestamp': '2024-02-01T14:00:00Z',
          'Transaction Type': 'Sell',
          'Asset': 'BTC',
          'Quantity Transacted': '0.2',
          'Spot Price at Transaction': '48000',
        },
      ];
      
      const result = parseCoinbaseCSV(rows);
      
      expect(result.lots.length).toBe(2);
      expect(result.symbol).toBe('BTC');
      expect(result.lots[0].qty).toBe(0.5);
      expect(result.lots[1].qty).toBe(-0.2); // Sell is negative
    });

    it('ignores non-buy/sell transactions', () => {
      const rows = [
        {
          'Timestamp': '2024-01-15T10:30:00Z',
          'Transaction Type': 'Buy',
          'Asset': 'BTC',
          'Quantity Transacted': '0.5',
          'Spot Price at Transaction': '42000',
        },
        {
          'Timestamp': '2024-01-16T10:30:00Z',
          'Transaction Type': 'Send',
          'Asset': 'BTC',
          'Quantity Transacted': '0.1',
          'Spot Price at Transaction': '43000',
        },
      ];
      
      const result = parseCoinbaseCSV(rows);
      
      expect(result.lots.length).toBe(1);
    });
  });

  describe('parseBinanceCSV', () => {
    it('parses Binance export format', () => {
      const rows = [
        {
          'Date(UTC)': '2024-01-15 10:30:00',
          'Pair': 'BTCUSDT',
          'Side': 'BUY',
          'Price': '42000',
          'Executed': '0.5',
        },
        {
          'Date(UTC)': '2024-02-01 14:00:00',
          'Pair': 'BTCUSDT',
          'Side': 'SELL',
          'Price': '48000',
          'Executed': '0.2',
        },
      ];
      
      const result = parseBinanceCSV(rows);
      
      expect(result.lots.length).toBe(2);
      expect(result.symbol).toBe('BTC');
      expect(result.lots[0].qty).toBe(0.5);
      expect(result.lots[1].qty).toBe(-0.2);
    });
  });

  describe('parseExchangeCSV', () => {
    it('auto-detects and parses Coinbase format', () => {
      const csv = `Timestamp,Transaction Type,Asset,Quantity Transacted,Spot Price at Transaction
2024-01-15T10:30:00Z,Buy,BTC,0.5,42000`;
      
      const result = parseExchangeCSV(csv);
      
      expect(result.lots.length).toBe(1);
      expect(result.symbol).toBe('BTC');
    });

    it('returns error for empty CSV', () => {
      const csv = `date,qty,price`;
      
      const result = parseExchangeCSV(csv);
      
      expect(result.lots.length).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateLots', () => {
    it('validates correct lots', () => {
      const lots = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: -0.5, price_per_unit: 50000 },
      ];
      
      const result = validateLots(lots);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('catches invalid date format', () => {
      const lots = [
        { date: '01-01-2024', qty: 1.0, price_per_unit: 40000 },
      ];
      
      const result = validateLots(lots);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('date'))).toBe(true);
    });

    it('catches zero quantity', () => {
      const lots = [
        { date: '2024-01-01', qty: 0, price_per_unit: 40000 },
      ];
      
      const result = validateLots(lots);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Quantity'))).toBe(true);
    });

    it('catches negative price', () => {
      const lots = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: -40000 },
      ];
      
      const result = validateLots(lots);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Price'))).toBe(true);
    });
  });
});
