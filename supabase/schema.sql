-- Crypto Portfolio Tracker Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Wallet addresses grouped by chain
CREATE TABLE wallets (
  id          SERIAL PRIMARY KEY,
  chain       TEXT NOT NULL,  -- 'ethereum','base','arbitrum','solana','bitcoin','bittensor','alephium'
  address     TEXT NOT NULL,
  label       TEXT,           -- optional friendly name
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chain, address)
);

-- Raw token balances per wallet per snapshot
CREATE TABLE balances (
  id          SERIAL PRIMARY KEY,
  wallet_id   INT REFERENCES wallets(id) ON DELETE CASCADE,
  token_id    TEXT NOT NULL,        -- coingecko ID or contract address
  symbol      TEXT NOT NULL,
  balance     NUMERIC NOT NULL,     -- raw amount (human-readable, not wei)
  usd_value   NUMERIC,              -- balance * price at snapshot time
  snapshot_at TIMESTAMPTZ NOT NULL,
  UNIQUE(wallet_id, token_id, snapshot_at)
);

-- DeFi positions (staking, LPs, yield)
CREATE TABLE defi_positions (
  id            SERIAL PRIMARY KEY,
  wallet_id     INT REFERENCES wallets(id) ON DELETE CASCADE,
  protocol      TEXT NOT NULL,       -- 'aave', 'uniswap-v3', 'lido', etc.
  position_type TEXT NOT NULL,       -- 'staking', 'lp', 'lending', 'yield'
  tokens        JSONB NOT NULL,      -- [{symbol, amount, usd_value}]
  total_usd     NUMERIC,
  apy           NUMERIC,             -- current APY if available
  snapshot_at   TIMESTAMPTZ NOT NULL
);

-- Hourly portfolio snapshots (aggregated)
CREATE TABLE snapshots (
  id              SERIAL PRIMARY KEY,
  total_usd       NUMERIC NOT NULL,
  defi_usd        NUMERIC DEFAULT 0,
  token_count     INT,
  snapshot_at     TIMESTAMPTZ NOT NULL UNIQUE
);

-- Historical prices (for PnL calc and charts)
CREATE TABLE prices (
  id          SERIAL PRIMARY KEY,
  token_id    TEXT NOT NULL,
  price_usd   NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  UNIQUE(token_id, recorded_at)
);

-- Manual cost basis entries
CREATE TABLE cost_basis (
  id          SERIAL PRIMARY KEY,
  token_id    TEXT NOT NULL UNIQUE,
  symbol      TEXT NOT NULL,
  method      TEXT DEFAULT 'manual',  -- 'manual', 'csv_import'
  lots        JSONB NOT NULL,         -- [{date, qty, price_per_unit, notes}]
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Alert rules
CREATE TABLE alerts (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  condition   JSONB NOT NULL,  -- {type: 'price'|'portfolio'|'pnl', token_id?, operator, value}
  channel     TEXT DEFAULT 'telegram',  -- 'telegram' | 'ntfy'
  enabled     BOOLEAN DEFAULT true,
  last_fired  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX idx_balances_snapshot ON balances(snapshot_at);
CREATE INDEX idx_balances_token ON balances(token_id, snapshot_at);
CREATE INDEX idx_snapshots_time ON snapshots(snapshot_at);
CREATE INDEX idx_prices_token_time ON prices(token_id, recorded_at);
CREATE INDEX idx_defi_positions_wallet ON defi_positions(wallet_id);
CREATE INDEX idx_defi_positions_snapshot ON defi_positions(snapshot_at);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE defi_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_basis ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (single-user app, service role has full access)
CREATE POLICY "Service role full access" ON wallets FOR ALL USING (true);
CREATE POLICY "Service role full access" ON balances FOR ALL USING (true);
CREATE POLICY "Service role full access" ON defi_positions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON snapshots FOR ALL USING (true);
CREATE POLICY "Service role full access" ON prices FOR ALL USING (true);
CREATE POLICY "Service role full access" ON cost_basis FOR ALL USING (true);
CREATE POLICY "Service role full access" ON alerts FOR ALL USING (true);
