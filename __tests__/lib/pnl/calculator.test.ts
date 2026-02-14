import { describe, it, expect } from 'vitest';
import {
  calculateTotalQty,
  calculateAverageCost,
  calculateCostBasis,
  calculateRealizedPnL,
  calculateTokenPnL,
  processPartialSell,
  getBuyLots,
  getSellLots,
} from '@/lib/pnl/calculator';
import type { Lot } from '@/lib/pnl/types';

describe('PnL Calculator', () => {
  describe('calculateTotalQty', () => {
    it('calculates total quantity from buy lots', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 45000 },
      ];
      expect(calculateTotalQty(lots)).toBe(1.5);
    });

    it('accounts for sell lots (negative qty)', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: -0.3, price_per_unit: 50000 },
      ];
      expect(calculateTotalQty(lots)).toBe(0.7);
    });

    it('returns 0 for empty lots', () => {
      expect(calculateTotalQty([])).toBe(0);
    });
  });

  describe('getBuyLots and getSellLots', () => {
    const lots: Lot[] = [
      { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
      { date: '2024-02-01', qty: -0.3, price_per_unit: 50000 },
      { date: '2024-03-01', qty: 0.5, price_per_unit: 45000 },
    ];

    it('filters buy lots correctly', () => {
      const buys = getBuyLots(lots);
      expect(buys.length).toBe(2);
      expect(buys.every(lot => lot.qty > 0)).toBe(true);
    });

    it('filters sell lots correctly', () => {
      const sells = getSellLots(lots);
      expect(sells.length).toBe(1);
      expect(sells.every(lot => lot.qty < 0)).toBe(true);
    });
  });

  describe('calculateAverageCost', () => {
    it('calculates average cost from buy lots', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 1.0, price_per_unit: 50000 },
      ];
      expect(calculateAverageCost(lots)).toBe(45000);
    });

    it('weights average by quantity', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 3.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 1.0, price_per_unit: 60000 },
      ];
      // (3 * 40000 + 1 * 60000) / 4 = 180000 / 4 = 45000
      expect(calculateAverageCost(lots)).toBe(45000);
    });

    it('ignores sell lots in average calculation', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: -0.5, price_per_unit: 50000 },
        { date: '2024-03-01', qty: 1.0, price_per_unit: 60000 },
      ];
      expect(calculateAverageCost(lots)).toBe(50000);
    });

    it('returns 0 for no buy lots', () => {
      expect(calculateAverageCost([])).toBe(0);
    });
  });

  describe('calculateCostBasis', () => {
    const baseLots: Lot[] = [
      { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
      { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
    ];

    it('calculates cost basis for buy-only scenario', () => {
      const costBasis = calculateCostBasis(baseLots, 'fifo');
      // 1 * 40000 + 0.5 * 50000 = 65000
      expect(costBasis).toBe(65000);
    });

    it('calculates cost basis with FIFO after partial sell', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
        { date: '2024-03-01', qty: -0.5, price_per_unit: 60000 }, // Sell 0.5
      ];
      // FIFO: sell from first lot (40000)
      // Remaining: 0.5 @ 40000 + 0.5 @ 50000 = 20000 + 25000 = 45000
      const costBasis = calculateCostBasis(lots, 'fifo');
      expect(costBasis).toBe(45000);
    });

    it('calculates cost basis with LIFO after partial sell', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
        { date: '2024-03-01', qty: -0.5, price_per_unit: 60000 }, // Sell 0.5
      ];
      // LIFO: sell from last lot (50000)
      // Remaining: 1.0 @ 40000 = 40000
      const costBasis = calculateCostBasis(lots, 'lifo');
      expect(costBasis).toBe(40000);
    });

    it('calculates cost basis with average method', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
        { date: '2024-03-01', qty: -0.5, price_per_unit: 60000 },
      ];
      // Average cost = 65000 / 1.5 = 43333.33
      // Remaining qty = 1.0
      // Cost basis = 1.0 * 43333.33 = 43333.33
      const avgCost = 65000 / 1.5;
      const costBasis = calculateCostBasis(lots, 'average');
      expect(costBasis).toBeCloseTo(avgCost * 1.0, 2);
    });
  });

  describe('calculateRealizedPnL', () => {
    it('returns 0 when no sells', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
      ];
      expect(calculateRealizedPnL(lots, 'fifo')).toBe(0);
    });

    it('calculates realized PnL with FIFO', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
        { date: '2024-03-01', qty: -0.5, price_per_unit: 60000 },
      ];
      // FIFO: sell 0.5 from first lot @ 40000
      // Realized = 0.5 * 60000 - 0.5 * 40000 = 30000 - 20000 = 10000
      expect(calculateRealizedPnL(lots, 'fifo')).toBe(10000);
    });

    it('calculates realized PnL with LIFO', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
        { date: '2024-03-01', qty: -0.5, price_per_unit: 60000 },
      ];
      // LIFO: sell 0.5 from last lot @ 50000
      // Realized = 0.5 * 60000 - 0.5 * 50000 = 30000 - 25000 = 5000
      expect(calculateRealizedPnL(lots, 'lifo')).toBe(5000);
    });

    it('calculates realized PnL with average', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
        { date: '2024-03-01', qty: -0.5, price_per_unit: 60000 },
      ];
      // Average cost = 65000 / 1.5 = 43333.33
      // Realized = 0.5 * 60000 - 0.5 * 43333.33 = 30000 - 21666.67 = 8333.33
      const avgCost = 65000 / 1.5;
      const expectedPnL = 0.5 * 60000 - 0.5 * avgCost;
      expect(calculateRealizedPnL(lots, 'average')).toBeCloseTo(expectedPnL, 2);
    });
  });

  describe('calculateTokenPnL', () => {
    it('calculates complete PnL for a token', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000, notes: 'Initial buy' },
        { date: '2024-02-01', qty: 0.5, price_per_unit: 50000, notes: 'DCA' },
      ];
      const currentPrice = 60000;

      const result = calculateTokenPnL('bitcoin', 'BTC', lots, currentPrice, 'fifo');

      expect(result.token_id).toBe('bitcoin');
      expect(result.symbol).toBe('BTC');
      expect(result.total_qty).toBe(1.5);
      expect(result.current_price).toBe(60000);
      expect(result.current_value).toBe(90000); // 1.5 * 60000
      expect(result.total_cost_basis).toBe(65000); // 1 * 40000 + 0.5 * 50000
      expect(result.average_cost).toBeCloseTo(65000 / 1.5, 2);
      expect(result.unrealized_pnl).toBe(25000); // 90000 - 65000
      expect(result.unrealized_pnl_percent).toBeCloseTo(38.46, 1);
      expect(result.realized_pnl).toBe(0);
      expect(result.method).toBe('fifo');
    });

    it('includes realized PnL when there are sells', () => {
      const lots: Lot[] = [
        { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
        { date: '2024-02-01', qty: -0.5, price_per_unit: 60000 },
      ];
      const currentPrice = 70000;

      const result = calculateTokenPnL('bitcoin', 'BTC', lots, currentPrice, 'fifo');

      expect(result.total_qty).toBe(0.5);
      expect(result.current_value).toBe(35000);
      expect(result.realized_pnl).toBe(10000); // 0.5 * (60000 - 40000)
    });
  });

  describe('processPartialSell', () => {
    const lots: Lot[] = [
      { date: '2024-01-01', qty: 1.0, price_per_unit: 40000 },
      { date: '2024-02-01', qty: 0.5, price_per_unit: 50000 },
    ];

    it('processes partial sell with FIFO', () => {
      const result = processPartialSell(lots, 0.75, 60000, 'fifo');

      // FIFO: Sell 0.75 from first lot @ 40000
      // Realized = 0.75 * (60000 - 40000) = 0.75 * 20000 = 15000
      expect(result.total_realized_pnl).toBe(15000);
      expect(result.allocations.length).toBe(1); // Only uses first lot
      expect(result.remaining_lots.length).toBe(2);
      expect(result.remaining_lots[0].qty).toBeCloseTo(0.25, 6);
    });

    it('processes partial sell with LIFO', () => {
      const result = processPartialSell(lots, 0.75, 60000, 'lifo');

      // LIFO: First sells from 0.5 @ 50000, then 0.25 @ 40000
      expect(result.allocations.length).toBe(2);
      expect(result.remaining_lots.length).toBe(1);
      expect(result.remaining_lots[0].qty).toBeCloseTo(0.75, 6);
    });

    it('processes partial sell with average method', () => {
      const result = processPartialSell(lots, 0.5, 60000, 'average');

      const avgCost = 65000 / 1.5;
      const expectedPnL = 0.5 * (60000 - avgCost);
      expect(result.total_realized_pnl).toBeCloseTo(expectedPnL, 2);
      expect(result.allocations.length).toBe(1);
      expect(result.allocations[0].lot_index).toBe(-1); // Average doesn't allocate to specific lots
    });
  });
});
