// PnL Calculation Engine
// Supports FIFO, LIFO, and Average cost methods

import type { Lot, PnLMethod, PnLResult, PartialSellResult, SellAllocation } from './types';

/**
 * Calculate total holdings from lots (buys have positive qty, sells have negative)
 */
export function calculateTotalQty(lots: Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.qty, 0);
}

/**
 * Get only buy lots (positive qty)
 */
export function getBuyLots(lots: Lot[]): Lot[] {
  return lots.filter(lot => lot.qty > 0);
}

/**
 * Get only sell lots (negative qty)
 */
export function getSellLots(lots: Lot[]): Lot[] {
  return lots.filter(lot => lot.qty < 0);
}

/**
 * Sort lots by date for FIFO (oldest first) or LIFO (newest first)
 */
export function sortLotsByDate(lots: Lot[], method: 'fifo' | 'lifo'): Lot[] {
  const sorted = [...lots].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return method === 'fifo' ? dateA - dateB : dateB - dateA;
  });
  return sorted;
}

/**
 * Calculate average cost basis per unit
 */
export function calculateAverageCost(lots: Lot[]): number {
  const buyLots = getBuyLots(lots);
  if (buyLots.length === 0) return 0;
  
  const totalCost = buyLots.reduce((sum, lot) => sum + (lot.qty * lot.price_per_unit), 0);
  const totalQty = buyLots.reduce((sum, lot) => sum + lot.qty, 0);
  
  return totalQty > 0 ? totalCost / totalQty : 0;
}

/**
 * Calculate total cost basis for remaining holdings using specified method
 */
export function calculateCostBasis(lots: Lot[], method: PnLMethod): number {
  const buyLots = getBuyLots(lots);
  const sellLots = getSellLots(lots);
  
  // Total sold quantity (as positive number)
  const totalSold = Math.abs(sellLots.reduce((sum, lot) => sum + lot.qty, 0));
  
  if (totalSold === 0) {
    // No sells, cost basis is simply sum of all buys
    return buyLots.reduce((sum, lot) => sum + (lot.qty * lot.price_per_unit), 0);
  }
  
  if (method === 'average') {
    const avgCost = calculateAverageCost(lots);
    const remainingQty = calculateTotalQty(lots);
    return remainingQty * avgCost;
  }
  
  // FIFO or LIFO: simulate sells to determine remaining cost basis
  const sortedBuys = sortLotsByDate(buyLots, method);
  const remainingLots = simulateSells(sortedBuys, totalSold);
  
  return remainingLots.reduce((sum, lot) => sum + (lot.qty * lot.price_per_unit), 0);
}

/**
 * Simulate sells against buy lots and return remaining lots
 */
function simulateSells(sortedBuyLots: Lot[], sellQty: number): Lot[] {
  const remaining: Lot[] = [];
  let qtyToSell = sellQty;
  
  for (const lot of sortedBuyLots) {
    if (qtyToSell <= 0) {
      remaining.push({ ...lot });
    } else if (qtyToSell >= lot.qty) {
      // Entire lot is sold
      qtyToSell -= lot.qty;
    } else {
      // Partial lot remains
      remaining.push({
        ...lot,
        qty: lot.qty - qtyToSell,
      });
      qtyToSell = 0;
    }
  }
  
  return remaining;
}

/**
 * Calculate realized PnL from sell transactions
 */
export function calculateRealizedPnL(lots: Lot[], method: PnLMethod): number {
  const buyLots = getBuyLots(lots);
  const sellLots = getSellLots(lots);
  
  if (sellLots.length === 0) return 0;
  
  if (method === 'average') {
    const avgCost = calculateAverageCost(lots);
    return sellLots.reduce((sum, sell) => {
      const saleProceeds = Math.abs(sell.qty) * sell.price_per_unit;
      const costBasis = Math.abs(sell.qty) * avgCost;
      return sum + (saleProceeds - costBasis);
    }, 0);
  }
  
  // FIFO or LIFO
  const sortedBuys = sortLotsByDate(buyLots, method);
  let realizedPnL = 0;
  const buyLotsRemaining = sortedBuys.map(lot => ({ ...lot }));
  
  for (const sell of sellLots) {
    let qtyToSell = Math.abs(sell.qty);
    const salePrice = sell.price_per_unit;
    
    for (const buyLot of buyLotsRemaining) {
      if (qtyToSell <= 0 || buyLot.qty <= 0) continue;
      
      const qtyFromThisLot = Math.min(qtyToSell, buyLot.qty);
      const costBasis = qtyFromThisLot * buyLot.price_per_unit;
      const saleProceeds = qtyFromThisLot * salePrice;
      
      realizedPnL += saleProceeds - costBasis;
      buyLot.qty -= qtyFromThisLot;
      qtyToSell -= qtyFromThisLot;
    }
  }
  
  return realizedPnL;
}

/**
 * Process a partial sell and return allocations and remaining lots
 */
export function processPartialSell(
  lots: Lot[],
  sellQty: number,
  sellPrice: number,
  method: PnLMethod
): PartialSellResult {
  const buyLots = getBuyLots(lots);
  const allocations: SellAllocation[] = [];
  let totalRealizedPnL = 0;
  
  if (method === 'average') {
    const avgCost = calculateAverageCost(lots);
    const costBasis = sellQty * avgCost;
    const saleProceeds = sellQty * sellPrice;
    const realizedPnL = saleProceeds - costBasis;
    
    allocations.push({
      lot_index: -1, // Average doesn't allocate to specific lots
      qty_from_lot: sellQty,
      cost_basis: costBasis,
      sale_proceeds: saleProceeds,
      realized_pnl: realizedPnL,
    });
    
    // For average method, we proportionally reduce all lots
    const totalBuyQty = buyLots.reduce((sum, lot) => sum + lot.qty, 0);
    const remainingLots = buyLots.map(lot => ({
      ...lot,
      qty: lot.qty * (1 - sellQty / totalBuyQty),
    })).filter(lot => lot.qty > 0.00000001); // Filter out tiny remainders
    
    return {
      allocations,
      total_realized_pnl: realizedPnL,
      remaining_lots: remainingLots,
    };
  }
  
  // FIFO or LIFO
  const sortedBuys = sortLotsByDate(buyLots, method);
  const buyLotsRemaining = sortedBuys.map((lot, index) => ({ ...lot, originalIndex: index }));
  let qtyToSell = sellQty;
  
  for (let i = 0; i < buyLotsRemaining.length && qtyToSell > 0; i++) {
    const buyLot = buyLotsRemaining[i];
    if (buyLot.qty <= 0) continue;
    
    const qtyFromThisLot = Math.min(qtyToSell, buyLot.qty);
    const costBasis = qtyFromThisLot * buyLot.price_per_unit;
    const saleProceeds = qtyFromThisLot * sellPrice;
    const realizedPnL = saleProceeds - costBasis;
    
    allocations.push({
      lot_index: buyLot.originalIndex,
      qty_from_lot: qtyFromThisLot,
      cost_basis: costBasis,
      sale_proceeds: saleProceeds,
      realized_pnl: realizedPnL,
    });
    
    totalRealizedPnL += realizedPnL;
    buyLot.qty -= qtyFromThisLot;
    qtyToSell -= qtyFromThisLot;
  }
  
  const remainingLots = buyLotsRemaining
    .filter(lot => lot.qty > 0.00000001)
    .map(({ originalIndex: _, ...lot }) => lot);
  
  return {
    allocations,
    total_realized_pnl: totalRealizedPnL,
    remaining_lots: remainingLots,
  };
}

/**
 * Calculate complete PnL for a token
 */
export function calculateTokenPnL(
  tokenId: string,
  symbol: string,
  lots: Lot[],
  currentPrice: number,
  method: PnLMethod
): PnLResult {
  const totalQty = calculateTotalQty(lots);
  const currentValue = totalQty * currentPrice;
  const totalCostBasis = calculateCostBasis(lots, method);
  const averageCost = totalQty > 0 ? totalCostBasis / totalQty : 0;
  const unrealizedPnL = currentValue - totalCostBasis;
  const unrealizedPnLPercent = totalCostBasis > 0 
    ? (unrealizedPnL / totalCostBasis) * 100 
    : 0;
  const realizedPnL = calculateRealizedPnL(lots, method);
  
  return {
    token_id: tokenId,
    symbol,
    total_qty: totalQty,
    current_price: currentPrice,
    current_value: currentValue,
    total_cost_basis: totalCostBasis,
    average_cost: averageCost,
    unrealized_pnl: unrealizedPnL,
    unrealized_pnl_percent: unrealizedPnLPercent,
    realized_pnl: realizedPnL,
    method,
  };
}
