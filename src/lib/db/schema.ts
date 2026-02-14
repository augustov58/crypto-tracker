import { pgTable, serial, text, numeric, boolean, timestamp, integer, jsonb, unique, index } from 'drizzle-orm/pg-core';

// Wallet addresses grouped by chain
export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  chain: text('chain').notNull(), // 'ethereum','base','arbitrum','solana','bitcoin','bittensor','alephium'
  address: text('address').notNull(),
  label: text('label'), // optional friendly name
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('wallets_chain_address_unique').on(table.chain, table.address),
]);

// Raw token balances per wallet per snapshot
export const balances = pgTable('balances', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').references(() => wallets.id),
  tokenId: text('token_id').notNull(), // coingecko ID or contract address
  symbol: text('symbol').notNull(),
  balance: numeric('balance').notNull(), // raw amount (human-readable, not wei)
  usdValue: numeric('usd_value'), // balance * price at snapshot time
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
}, (table) => [
  unique('balances_wallet_token_snapshot_unique').on(table.walletId, table.tokenId, table.snapshotAt),
  index('idx_balances_snapshot').on(table.snapshotAt),
  index('idx_balances_token').on(table.tokenId, table.snapshotAt),
]);

// DeFi positions (staking, LPs, yield)
export const defiPositions = pgTable('defi_positions', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').references(() => wallets.id),
  protocol: text('protocol').notNull(), // 'aave', 'uniswap-v3', 'lido', etc.
  positionType: text('position_type').notNull(), // 'staking', 'lp', 'lending', 'yield'
  tokens: jsonb('tokens').notNull(), // [{symbol, amount, usd_value}]
  totalUsd: numeric('total_usd'),
  apy: numeric('apy'), // current APY if available
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
});

// Hourly portfolio snapshots (aggregated)
export const snapshots = pgTable('snapshots', {
  id: serial('id').primaryKey(),
  totalUsd: numeric('total_usd').notNull(),
  defiUsd: numeric('defi_usd').default('0'),
  tokenCount: integer('token_count'),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull().unique(),
}, (table) => [
  index('idx_snapshots_time').on(table.snapshotAt),
]);

// Historical prices (for PnL calc and charts)
export const prices = pgTable('prices', {
  id: serial('id').primaryKey(),
  tokenId: text('token_id').notNull(),
  priceUsd: numeric('price_usd').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
}, (table) => [
  unique('prices_token_recorded_unique').on(table.tokenId, table.recordedAt),
  index('idx_prices_token_time').on(table.tokenId, table.recordedAt),
]);

// Manual cost basis entries
export const costBasis = pgTable('cost_basis', {
  id: serial('id').primaryKey(),
  tokenId: text('token_id').notNull().unique(),
  symbol: text('symbol').notNull(),
  method: text('method').default('manual'), // 'manual', 'csv_import'
  lots: jsonb('lots').notNull(), // [{date, qty, price_per_unit, notes}]
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Alert rules
export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  condition: jsonb('condition').notNull(), // {type: 'price'|'portfolio'|'pnl', token_id?, operator, value}
  channel: text('channel').default('telegram'), // 'telegram' | 'ntfy'
  enabled: boolean('enabled').default(true),
  lastFired: timestamp('last_fired', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Types for JSONB fields
export interface CostBasisLot {
  date: string;
  qty: number;
  price_per_unit: number;
  notes?: string;
}

export interface DefiToken {
  symbol: string;
  amount: number;
  usd_value: number;
}

export interface AlertCondition {
  type: 'price' | 'portfolio_value' | 'pnl_percent' | 'allocation';
  token_id?: string;
  operator: 'gt' | 'lt' | 'crosses_above' | 'crosses_below';
  value: number;
  cooldown_hours?: number;
}
