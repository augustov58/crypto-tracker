// Mock data for development and static UI shell

export const mockTokens = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', balance: 0.85, price: 67432.12, value: 57317.30, change24h: 2.34, pnl: 12450.00, pnlPercent: 27.8 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', balance: 12.5, price: 3521.45, value: 44018.13, change24h: 1.89, pnl: 8200.00, pnlPercent: 22.9 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', balance: 150, price: 172.33, value: 25849.50, change24h: -1.23, pnl: 5600.00, pnlPercent: 27.7 },
  { id: 'bittensor', symbol: 'TAO', name: 'Bittensor', balance: 45, price: 412.50, value: 18562.50, change24h: 5.67, pnl: 7800.00, pnlPercent: 72.4 },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', balance: 5000, price: 1.12, value: 5600.00, change24h: -0.45, pnl: -200.00, pnlPercent: -3.4 },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', balance: 300, price: 14.85, value: 4455.00, change24h: 0.82, pnl: 455.00, pnlPercent: 11.4 },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', balance: 200, price: 9.72, value: 1944.00, change24h: -2.11, pnl: -156.00, pnlPercent: -7.4 },
  { id: 'alephium', symbol: 'ALPH', name: 'Alephium', balance: 10000, price: 0.45, value: 4500.00, change24h: 3.21, pnl: 1200.00, pnlPercent: 36.4 },
];

export const mockWallets = [
  { id: 1, chain: 'ethereum', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f1E3A2', label: 'Main ETH' },
  { id: 2, chain: 'ethereum', address: '0x8Ba1f109551bD432803012645Ac136ddd64DBA72', label: 'DeFi Wallet' },
  { id: 3, chain: 'base', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f1E3A2', label: 'Base Wallet' },
  { id: 4, chain: 'arbitrum', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f1E3A2', label: 'Arbitrum' },
  { id: 5, chain: 'solana', address: '7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7', label: 'Main SOL' },
  { id: 6, chain: 'bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', label: 'BTC Cold' },
  { id: 7, chain: 'bittensor', address: '5HBVrFGy8Wf9qt2g8u9X4VTq2bJJYjCUMnCKMPZWR8RUEqvH', label: 'TAO Staking' },
  { id: 8, chain: 'alephium', address: '1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH', label: 'ALPH Wallet' },
];

export const mockDefiPositions = [
  { id: 1, protocol: 'Lido', type: 'staking', tokens: [{ symbol: 'stETH', amount: 5.2, usdValue: 18312.00 }], apy: 3.8 },
  { id: 2, protocol: 'Aave V3', type: 'lending', tokens: [{ symbol: 'USDC', amount: 10000, usdValue: 10000.00 }], apy: 5.2 },
  { id: 3, protocol: 'Uniswap V3', type: 'lp', tokens: [{ symbol: 'ETH', amount: 2, usdValue: 7042.90 }, { symbol: 'USDC', amount: 7000, usdValue: 7000.00 }], apy: 12.5 },
  { id: 4, protocol: 'Bittensor', type: 'staking', tokens: [{ symbol: 'TAO', amount: 30, usdValue: 12375.00 }], apy: 18.0 },
];

export const mockCostBasis = [
  { 
    tokenId: 'bitcoin', 
    symbol: 'BTC', 
    lots: [
      { date: '2024-01-15', qty: 0.5, price_per_unit: 42000, notes: 'DCA buy' },
      { date: '2024-03-01', qty: 0.35, price_per_unit: 62000, notes: 'Limit order' },
    ],
    totalCost: 42700,
    avgPrice: 50235.29,
  },
  { 
    tokenId: 'ethereum', 
    symbol: 'ETH', 
    lots: [
      { date: '2023-11-10', qty: 5, price_per_unit: 1850, notes: 'Bear market buy' },
      { date: '2024-02-20', qty: 7.5, price_per_unit: 2900, notes: 'DCA' },
    ],
    totalCost: 31000,
    avgPrice: 2480.00,
  },
  { 
    tokenId: 'solana', 
    symbol: 'SOL', 
    lots: [
      { date: '2023-12-01', qty: 100, price_per_unit: 65, notes: 'Initial buy' },
      { date: '2024-01-15', qty: 50, price_per_unit: 95, notes: 'Added more' },
    ],
    totalCost: 11250,
    avgPrice: 75.00,
  },
];

export const mockAlerts = [
  { id: 1, name: 'BTC above 70k', condition: { type: 'price', token_id: 'bitcoin', operator: 'gt', value: 70000 }, enabled: true, lastFired: null },
  { id: 2, name: 'Portfolio drops 10%', condition: { type: 'portfolio_value', operator: 'lt', value: 150000 }, enabled: true, lastFired: null },
  { id: 3, name: 'ETH PnL 50%+', condition: { type: 'pnl_percent', token_id: 'ethereum', operator: 'gt', value: 50 }, enabled: false, lastFired: '2024-06-15' },
];

// Generate mock snapshot data for charts
export function generateMockSnapshots(days: number = 90) {
  const snapshots = [];
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  let value = 120000; // Starting value
  
  for (let i = days * 24; i >= 0; i--) {
    const change = (Math.random() - 0.48) * 0.02; // Slight upward bias
    value = value * (1 + change);
    snapshots.push({
      time: new Date(now - i * hourMs).toISOString(),
      value: Math.round(value * 100) / 100,
    });
  }
  
  return snapshots;
}

export const mockPortfolioStats = {
  totalValue: 162246.43,
  change24h: 2847.32,
  change24hPercent: 1.79,
  defiValue: 54729.90,
  tokenCount: 8,
  walletCount: 8,
  totalPnl: 35349.00,
  totalPnlPercent: 27.9,
};
