# Crypto Portfolio Tracker — Architecture Spec

---

## Filled Prompt Template

```xml
<task>
Build a personal, web-based on-chain crypto portfolio tracker that:
1. Reads token balances from multiple wallet addresses across 7 chains:
   Ethereum, Base, Arbitrum, Solana, Bitcoin, Bittensor (TAO), Alephium (ALPH)
2. Tracks portfolio value over time with hourly snapshots
3. Graphs historical portfolio performance with interactive charts
4. Supports manual cost basis entry/adjustment per token (aggregate across wallets)
5. Calculates PnL per token and portfolio-wide
6. Tracks DeFi positions: staking, LP positions, yield farming
7. Estimates future returns via three selectable models:
   - CAGR / linear extrapolation
   - Scenario-based (bull / base / bear)
   - Monte Carlo simulation
8. Sends alerts/notifications when thresholds are hit
Single-user, no authentication required.
</task>

<context>
- User holds crypto across several wallet addresses on 7 chains
- Pain points with DeBank/Zerion: can't adjust cost basis on aggregated coins,
  some ERC-20s don't show, charting tools are limited
- Hosting: Vercel (free tier)
- API budget: Free tier only
- Data refresh: Hourly
- Tech stack: To be recommended (see architecture below)
</context>

<constraints>
- All APIs must have usable free tiers (CoinGecko, public RPCs, chain-specific APIs)
- Vercel serverless functions (10s timeout on free, 60s on hobby)
- Vercel Cron Jobs (limited to once/day on free, once/hour on hobby $20/mo)
- No authentication — single user, but wallet addresses stored server-side
- Must handle chains with no standard indexer support (Bittensor, Alephium)
- Historical price data backfill limited by free API rate limits
</constraints>

<examples>
Reference UX: DeBank, Zerion
Improvements over references:
  - Editable cost basis per token (aggregate or per-lot)
  - Full ERC-20 coverage via direct RPC + token list fallback
  - Richer charting: area charts, allocation pie, correlation matrix,
    projection overlays
</examples>

<output_format>
Architecture specification document covering:
  - System diagram
  - Tech stack with justification
  - Data model
  - API integration map per chain
  - Cron / data pipeline design
  - Frontend component tree
  - Projection engine design
  - Alert system
  - Deployment plan
</output_format>
```

---

## 1. Tech Stack Recommendation

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Framework** | Next.js 14 (App Router) | SSR + API routes + Vercel-native; single deploy target |
| **Language** | TypeScript | Type safety across shared models (chain configs, portfolio types) |
| **Database** | Supabase (PostgreSQL) | Free tier: 500MB, sufficient for years of hourly snapshots; built-in REST API, realtime subscriptions for alerts |
| **ORM** | Drizzle ORM | Lightweight, type-safe, edge-compatible |
| **Charts** | Lightweight Charts (TradingView) + Recharts | TradingView for candlestick/area (portfolio value); Recharts for pie/bar (allocation, PnL) |
| **Styling** | Tailwind CSS + shadcn/ui | Fast iteration, dark mode native |
| **State** | Zustand | Minimal boilerplate, works with SSR |
| **Cron** | Vercel Cron (hobby) or external (cron-job.org) | Hourly triggers for snapshot pipeline |
| **Notifications** | Telegram Bot API or Ntfy.sh | Both free, push-capable, no email infra needed |

### Why Not Python Backend?

Vercel serverless runs Node natively. Adding Python means either a separate backend (Railway, Fly.io) or Vercel's Python runtime with cold-start penalties. Keeping it all TypeScript simplifies deployment and shares types end-to-end.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Next.js)                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Frontend     │  │  API Routes  │  │  Cron Functions       │  │
│  │  (React/TW)   │  │  /api/*      │  │  /api/cron/snapshot   │  │
│  │              │  │              │  │  /api/cron/alerts     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
│         │                 │                     │               │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (PostgreSQL)                        │
│  snapshots · balances · prices · cost_basis · alerts · wallets  │
└─────────────────────────────────────────────────────────────────┘
          ▲                                       ▲
          │                                       │
    ┌─────┴──────────────────────────────────┐    │
    │         DATA SOURCES (hourly)          │    │
    │                                         │    │
    │  EVM Chains ──► Alchemy/public RPCs     │    │
    │  Solana ──────► Helius / public RPC     │    │
    │  Bitcoin ─────► Blockstream.info API    │    │
    │  Bittensor ───► TAO RPC / Taostats     │    │
    │  Alephium ────► Alephium Explorer API   │    │
    │  Prices ──────► CoinGecko free API      │    │
    │  DeFi ────────► DefiLlama yields API    │    │
    └─────────────────────────────────────────┘    │
                                                   │
    ┌──────────────────────────────────────────────┘
    │  NOTIFICATIONS
    │  Telegram Bot / Ntfy.sh
    └──────────────────────────────────────────────
```

---

## 3. Data Model (PostgreSQL / Supabase)

```sql
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
  wallet_id   INT REFERENCES wallets(id),
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
  wallet_id     INT REFERENCES wallets(id),
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
  token_id    TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  method      TEXT DEFAULT 'manual',  -- 'manual', 'csv_import'
  lots        JSONB NOT NULL,         -- [{date, qty, price_per_unit, notes}]
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(token_id)
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
```

### Cost Basis Design — Key Differentiator

The `cost_basis.lots` JSONB field stores an array of acquisition lots:

```json
[
  {"date": "2024-01-15", "qty": 0.5, "price_per_unit": 42000, "notes": "DCA buy"},
  {"date": "2024-03-01", "qty": 0.3, "price_per_unit": 62000, "notes": "Limit order"},
  {"date": "2024-06-10", "qty": -0.2, "price_per_unit": 67000, "notes": "Partial sell"}
]
```

This lets you:
- Manually add/edit/delete lots (what DeBank/Zerion can't do)
- Calculate PnL using FIFO, LIFO, or average cost (selectable in UI)
- Aggregate across wallets (the lots are per-token, not per-wallet)

---

## 4. Chain Integration Map

| Chain | Balance API | DeFi Tracking | Notes |
|-------|------------|---------------|-------|
| **Ethereum** | Alchemy `getTokenBalances` (free: 300M CU/mo) | DefiLlama positions API | Most complete ecosystem |
| **Base** | Alchemy (same key, Base endpoint) | DefiLlama | Same as ETH, different RPC URL |
| **Arbitrum** | Alchemy (same key, Arb endpoint) | DefiLlama | Same as ETH |
| **Solana** | Helius `getAssetsByOwner` (free: 1K req/day) or public RPC `getTokenAccountsByOwner` | Manual via on-chain program parsing | Helius DAS API handles SPL + compressed NFTs |
| **Bitcoin** | Blockstream.info API (`/api/address/{addr}`) | N/A | Simple UTXO balance, no rate limit |
| **Bittensor** | TAO Subtensor RPC (`get_balance`, `get_stake`) or Taostats API | Staking = delegated TAO | Substrate-based; use `@polkadot/api` or REST wrappers |
| **Alephium** | Alephium Explorer API (`/addresses/{addr}/balance`) | Limited; check AYIN DEX | Smaller ecosystem, REST API is straightforward |

### Token Discovery Problem (Solving the "Missing ERC-20" Issue)

DeBank/Zerion miss tokens because they rely on curated token lists. Strategy:

1. **Primary**: Alchemy `getTokenBalances` — returns ALL ERC-20 balances including unlisted tokens
2. **Metadata enrichment**: For unknown contracts, call `name()`, `symbol()`, `decimals()` directly via RPC
3. **Price resolution waterfall**:
   - CoinGecko by contract address → CoinGecko by ID → DEX price via on-chain pool (DeFiLlama) → mark as "unpriced"
4. **User override**: Let user manually tag unpriced tokens with a CoinGecko ID or manual price

---

## 5. Cron Pipeline Design

### Hourly Snapshot Flow (`/api/cron/snapshot`)

```
Trigger: Vercel Cron (every hour) or cron-job.org → GET /api/cron/snapshot?key=SECRET

Step 1: Fetch balances (parallel per chain)
  ├── EVM chains: Alchemy getTokenBalances × 3 chains × N wallets
  ├── Solana: Helius getAssetsByOwner × N wallets
  ├── Bitcoin: Blockstream balance × N wallets
  ├── Bittensor: Subtensor RPC × N wallets
  └── Alephium: Explorer API × N wallets

Step 2: Fetch prices (batch)
  └── CoinGecko /simple/price?ids=...&vs_currencies=usd (max 250 IDs per call)

Step 3: Fetch DeFi positions
  └── DefiLlama /positions/{chain}/{address} per relevant wallet

Step 4: Calculate + store
  ├── INSERT INTO balances (per token per wallet)
  ├── INSERT INTO defi_positions (per protocol per wallet)
  ├── INSERT INTO prices (deduplicated)
  └── INSERT INTO snapshots (aggregated total)

Step 5: Evaluate alerts
  └── Check each enabled alert rule against new data → fire notifications
```

### Rate Limit Budget (Free Tiers)

| API | Limit | Hourly Usage | Headroom |
|-----|-------|-------------|----------|
| CoinGecko | 10-30 req/min | ~5-10 requests | Comfortable |
| Alchemy | 300M CU/month | ~500 CU/snapshot | Massive headroom |
| Helius | 1000 req/day | ~24 req (1/hr × wallets) | Tight if >5 Solana wallets |
| Blockstream | Unlisted (generous) | ~1-3 req/hr | Fine |
| Alephium Explorer | Unlisted | ~1-3 req/hr | Fine |

### Vercel Free Tier Constraint

Vercel free tier cron jobs are **daily only**. Options:
1. **Upgrade to Hobby ($20/mo)** — gets hourly crons + 60s function timeout
2. **External cron** — Use cron-job.org (free) to hit your `/api/cron/snapshot` endpoint hourly
3. **Hybrid** — Use Supabase Edge Functions (free tier: 500K invocations/mo) as the cron runner

**Recommendation**: Option 2 (external cron) — zero cost, works immediately.

---

## 6. Frontend Component Tree

```
app/
├── layout.tsx                    -- Dark theme shell, sidebar nav
├── page.tsx                      -- Dashboard (redirect to /dashboard)
│
├── dashboard/
│   └── page.tsx
│       ├── <PortfolioValueChart>    -- TradingView Lightweight area chart
│       │                             -- Time range: 24h / 7d / 30d / 90d / 1y / All
│       ├── <AllocationPie>          -- Recharts pie: token allocation %
│       ├── <TopMovers>              -- Biggest gainers/losers (24h)
│       └── <QuickStats>             -- Total value, 24h change, DeFi value
│
├── portfolio/
│   └── page.tsx
│       ├── <TokenTable>             -- Sortable table: token, balance, value, PnL, %
│       │   └── <TokenRow>           -- Expandable: per-wallet breakdown
│       ├── <DeFiPositions>          -- Grouped by protocol
│       └── <UnpricedTokens>         -- Tokens needing manual price/ID
│
├── cost-basis/
│   └── page.tsx
│       ├── <CostBasisTable>         -- Per-token lots editor
│       │   └── <LotEditor>          -- Add/edit/delete lots modal
│       ├── <PnLSummary>             -- Realized + unrealized PnL
│       ├── <PnLMethodSelector>      -- FIFO / LIFO / Average toggle
│       └── <CSVImport>              -- Bulk import cost basis from CSV
│
├── projections/
│   └── page.tsx
│       ├── <ModelSelector>          -- Tabs: CAGR | Scenarios | Monte Carlo
│       ├── <CAGRProjection>         -- Slider: growth rate, time horizon
│       │                             -- Chart: current → projected value
│       ├── <ScenarioProjection>     -- Bull/Base/Bear inputs per token
│       │                             -- Stacked area chart with confidence bands
│       ├── <MonteCarloProjection>   -- Simulations: 1000 paths
│       │                             -- Fan chart with percentile bands (10/25/50/75/90)
│       └── <ProjectionParams>       -- Shared: time horizon, DCA input, rebalance toggle
│
├── alerts/
│   └── page.tsx
│       ├── <AlertList>              -- Active alerts with status
│       └── <AlertEditor>            -- Create/edit: condition builder
│
├── settings/
│   └── page.tsx
│       ├── <WalletManager>          -- Add/remove/label wallet addresses
│       ├── <TokenOverrides>         -- Manual CoinGecko ID mapping
│       └── <NotificationConfig>     -- Telegram bot token / Ntfy topic
│
└── api/
    ├── cron/
    │   ├── snapshot/route.ts        -- Hourly data pipeline
    │   └── alerts/route.ts          -- Alert evaluation (can merge with snapshot)
    ├── portfolio/route.ts           -- GET current portfolio state
    ├── snapshots/route.ts           -- GET historical snapshots (chart data)
    ├── cost-basis/route.ts          -- CRUD cost basis lots
    ├── projections/route.ts         -- Compute projections server-side
    └── wallets/route.ts             -- CRUD wallet addresses
```

---

## 7. Projection Engine Design

All three models run server-side via `/api/projections` to avoid shipping heavy math to the browser.

### Model 1: CAGR Extrapolation

```typescript
// Simple compound growth
function projectCAGR(currentValue: number, annualRate: number, years: number): number[] {
  return Array.from({ length: years * 12 }, (_, i) =>
    currentValue * Math.pow(1 + annualRate, (i + 1) / 12)
  );
}
// User inputs: annual growth rate (slider: -50% to +200%), time horizon (1-10 years)
// Optional: monthly DCA amount added to base
```

### Model 2: Scenario-Based (Bull / Base / Bear)

```typescript
interface Scenario {
  label: string;           // 'bull' | 'base' | 'bear'
  tokenMultipliers: {      // per-token price multiplier at horizon
    [tokenId: string]: number;  // e.g., BTC: 3.0 (bull), 1.5 (base), 0.4 (bear)
  };
  probability: number;     // user-assigned weight
}
// Output: three value curves + probability-weighted expected value
// Chart: stacked area with distinct colors per scenario
```

### Model 3: Monte Carlo Simulation

```typescript
// Uses historical volatility per token from stored price data
function monteCarloPortfolio(
  holdings: { tokenId: string; value: number; dailyVolatility: number }[],
  correlationMatrix: number[][],   // estimated from historical prices
  days: number,
  simulations: number = 1000
): number[][] {
  // Cholesky decomposition of correlation matrix
  // For each simulation:
  //   For each day:
  //     Generate correlated random returns
  //     Apply to each token position
  //     Sum portfolio value
  // Return array of simulation paths
}
// Output: fan chart with P10, P25, P50, P75, P90 bands
// Requires: ≥90 days of historical price data per token
```

**Historical volatility source**: Calculated from the `prices` table. CoinGecko free tier provides `/coins/{id}/market_chart?days=365` — backfill on first setup.

---

## 8. Alert System

### Alert Condition Schema

```typescript
interface AlertCondition {
  type: 'price' | 'portfolio_value' | 'pnl_percent' | 'allocation';
  token_id?: string;         // required for price/pnl alerts
  operator: 'gt' | 'lt' | 'crosses_above' | 'crosses_below';
  value: number;             // threshold
  cooldown_hours: number;    // min hours between repeat fires (default: 24)
}
```

### Notification Delivery

**Telegram Bot** (recommended):
1. Create bot via @BotFather → get token
2. User sends `/start` to bot → store chat_id in settings
3. On alert fire: `POST https://api.telegram.org/bot{token}/sendMessage`

**Ntfy.sh** (simpler alternative):
1. Pick a topic name (e.g., `crypto-portfolio-augusto`)
2. On alert fire: `POST https://ntfy.sh/{topic}` with message body
3. User subscribes via Ntfy app on phone

Both are free and require zero infrastructure.

---

## 9. Deployment Plan

### Phase 1 — Foundation (Week 1-2)
- Next.js project scaffold with Tailwind + shadcn/ui
- Supabase project + schema migration
- Wallet manager UI (add/remove addresses)
- Balance fetching for EVM chains (Alchemy) + Bitcoin (Blockstream)
- CoinGecko price integration
- Basic dashboard with portfolio value chart

### Phase 2 — Full Chain Coverage (Week 3)
- Solana balance fetching (Helius)
- Bittensor integration (Subtensor RPC / Taostats)
- Alephium integration (Explorer API)
- Token discovery + metadata enrichment for unknown ERC-20s
- Hourly cron pipeline via external cron

### Phase 3 — Cost Basis & PnL (Week 4)
- Cost basis CRUD UI with lot editor
- CSV import for bulk cost basis
- PnL calculation engine (FIFO/LIFO/Average)
- PnL display in portfolio table

### Phase 4 — DeFi & Projections (Week 5-6)
- DeFi position tracking (DefiLlama)
- Staking detection for Bittensor
- CAGR projection model + UI
- Scenario-based projection model + UI
- Monte Carlo engine + fan chart visualization

### Phase 5 — Alerts & Polish (Week 7)
- Alert rule builder UI
- Telegram/Ntfy notification delivery
- Historical price backfill
- Performance optimization (ISR for dashboard, edge caching)
- Mobile responsive refinements

---

## 10. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CoinGecko rate limits on free tier | Missing price data | Batch requests, cache aggressively (prices table), fallback to CMC free |
| Bittensor RPC instability | Failed balance fetches | Dual source: Subtensor RPC + Taostats REST API; retry with backoff |
| Alephium limited ecosystem | Can't track DeFi | Accept limitation; track ALPH balance only; add AYIN DEX if available |
| Vercel 10s timeout (free) | Cron function times out | Use Hobby tier ($20/mo) for 60s, or split pipeline into chain-specific functions |
| Helius 1K req/day limit | Can't handle many Solana wallets | Batch via `getAssetsByOwner` (1 call per wallet), or fallback to public RPC |
| Missing ERC-20 prices | Tokens show $0 value | Price waterfall (CoinGecko → DEX → manual), flag unpriced tokens in UI |
| Monte Carlo accuracy with thin data | Unreliable projections | Require min 90 days of price history; show confidence warning for newer tokens |

---

## 11. Claude Code Execution Guide (OpenClaw / Minimal Oversight)

> **This section is written FOR Claude Code.** When the user pastes this spec into a Claude Code session,
> Claude Code should read this section as its execution playbook.

### Required Tools & Setup

Before writing any code, install and configure these tools in order:

```bash
# 1. Node.js + package manager
node --version  # confirm >= 18.x
npm install -g pnpm  # faster, stricter than npm

# 2. Project scaffold
pnpm create next-app@latest crypto-tracker --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd crypto-tracker

# 3. Core dependencies
pnpm add drizzle-orm @supabase/supabase-js zustand lightweight-charts recharts
pnpm add @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select  # shadcn primitives
pnpm add -D drizzle-kit @types/node

# 4. Chain-specific SDKs
pnpm add ethers@6           # EVM chains (Alchemy RPC)
pnpm add @solana/web3.js    # Solana
pnpm add @polkadot/api      # Bittensor (Substrate)
# Alephium + Bitcoin use REST APIs — no SDK needed

# 5. shadcn/ui init
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input table tabs dialog select badge separator chart toast

# 6. Testing tools
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @playwright/test jsdom
pnpm add -D @vitejs/plugin-react
npx playwright install chromium  # headless browser for E2E

# 7. Utilities
pnpm add mathjs           # Monte Carlo / matrix operations
pnpm add croner           # local cron for dev testing
pnpm add zod              # runtime validation for API routes + alert conditions
```

### Environment Variables (Claude Code: create `.env.local`)

```bash
# Claude Code: Create this file, leave values as placeholders.
# User will fill in after setup.
cat > .env.local << 'EOF'
# === USER MUST FILL THESE IN ===
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Alchemy (free tier — sign up at alchemy.com)
ALCHEMY_API_KEY=your-alchemy-key-here

# Helius (free tier — sign up at helius.dev)
HELIUS_API_KEY=your-helius-key-here

# CoinGecko (free, no key needed for demo tier)
# COINGECKO_API_KEY=optional-for-pro-tier

# Notifications (choose one)
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here
# NTFY_TOPIC=crypto-portfolio-alerts

# Cron security
CRON_SECRET=generate-a-random-string-here

EOF
```

### Execution Order for Claude Code

Follow this phase order. **Each phase must pass its checks before moving on.**

```
PHASE 1: Scaffold + DB + Static UI Shell
  ├── Create project structure matching Section 6 component tree
  ├── Set up Drizzle schema matching Section 3 data model
  ├── Generate Supabase migration SQL
  ├── Build all page layouts with mock/placeholder data
  ├── Dashboard: mock chart with hardcoded data points
  ├── Portfolio table: mock tokens with fake balances
  ├── Cost basis editor: form UI with no backend
  ├── Projections page: model selector tabs with placeholder charts
  ├── Alerts page: rule builder form UI
  ├── Settings: wallet manager form
  ├── ✅ CHECK: `pnpm build` succeeds with zero errors
  ├── ✅ CHECK: `pnpm dev` → all pages render, navigation works
  └── ✅ CHECK: Run component tests (see Section 12)

PHASE 2: Chain Integrations (one at a time)
  ├── Create /lib/chains/ directory with per-chain fetcher modules:
  │   ├── ethereum.ts  (also covers Base, Arbitrum — parameterized by RPC URL)
  │   ├── solana.ts
  │   ├── bitcoin.ts
  │   ├── bittensor.ts
  │   └── alephium.ts
  ├── Each module exports: fetchBalances(address) → TokenBalance[]
  ├── Create /lib/prices/coingecko.ts — batch price fetcher
  ├── ✅ CHECK: Write integration tests with mock RPC responses
  ├── ✅ CHECK: Create /api/test/fetch-balances route that runs one fetch
  │            and returns JSON (for manual verification)
  └── ✅ CHECK: Each chain module has error handling + retry logic

PHASE 3: Cron Pipeline + Real Data
  ├── Build /api/cron/snapshot/route.ts per Section 5
  ├── Wire real data into dashboard + portfolio pages
  ├── Replace mock charts with live Supabase queries
  ├── ✅ CHECK: Hit /api/cron/snapshot manually → data appears in Supabase
  ├── ✅ CHECK: Dashboard chart renders real historical data
  └── ✅ CHECK: Portfolio table shows live balances with USD values

PHASE 4: Cost Basis + PnL
  ├── CRUD API routes for cost basis lots
  ├── PnL calculation engine (FIFO/LIFO/Average)
  ├── Wire cost basis editor to Supabase
  ├── ✅ CHECK: Add a lot → PnL updates in portfolio table
  └── ✅ CHECK: Switch PnL method → values recalculate correctly

PHASE 5: Projections
  ├── CAGR model + chart
  ├── Scenario model + chart
  ├── Monte Carlo engine + fan chart
  ├── ✅ CHECK: Each model renders chart with adjustable parameters
  └── ✅ CHECK: Monte Carlo runs 1000 sims without timeout (<10s)

PHASE 6: DeFi + Alerts + Notifications
  ├── DefiLlama integration for EVM DeFi positions
  ├── Bittensor staking detection
  ├── Alert evaluation logic in cron
  ├── Telegram/Ntfy notification delivery
  ├── ✅ CHECK: Create test alert → trigger it → notification received
  └── ✅ CHECK: DeFi positions display in portfolio with APY

PHASE 7: Final Validation
  ├── Run full E2E test suite (Playwright)
  ├── Run `pnpm build` — zero errors, zero warnings
  ├── Lighthouse audit on dashboard page (target: >80 all categories)
  ├── Test on mobile viewport (375px width)
  └── ✅ CHECK: All pages functional, all charts interactive
```

### Claude Code Decision Rules (Autonomous Mode)

When executing without user oversight, follow these rules:

1. **If a dependency install fails** → Try alternative package. Log what you tried and what you switched to.
2. **If an API returns an unexpected format** → Add a `try/catch`, log the raw response, use a safe default. Don't block the pipeline.
3. **If build fails** → Fix the error before moving to the next phase. Never skip a broken build.
4. **If a chain integration doesn't work** (bad RPC, API down) → Stub it with a mock that returns empty balances and add a `TODO` comment. Move on.
5. **If tests fail** → Fix them. Don't delete tests to make the build pass.
6. **File organization** → Follow the component tree in Section 6 exactly. Don't flatten or reorganize.
7. **Error boundaries** → Wrap every page in a React error boundary. Failing chain data should never crash the UI.
8. **Type safety** → No `any` types. Define interfaces for all API responses and database rows.

---

## 12. Testing Strategy (UI & Functional Validation)

### Layer 1: Component Tests (Vitest + Testing Library)

Create `__tests__/` directory mirroring the component tree. Every UI component gets a test.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
```

**What to test per component:**

| Component | Test Cases |
|-----------|-----------|
| `<PortfolioValueChart>` | Renders with mock data; handles empty data; time range buttons switch correctly |
| `<AllocationPie>` | Renders correct segments; handles single-token portfolio; handles zero values |
| `<TokenTable>` | Renders rows; sorts by column; expands row to show per-wallet breakdown |
| `<LotEditor>` | Opens modal; validates numeric inputs; saves new lot; deletes lot |
| `<AlertEditor>` | Condition builder produces correct JSON; validates threshold > 0 |
| `<WalletManager>` | Adds wallet; validates address format per chain; removes wallet with confirm |
| `<ModelSelector>` | Tabs switch between 3 models; preserves params when switching |
| `<MonteCarloProjection>` | Renders fan chart; shows loading state during simulation |

**Run command:**
```bash
pnpm vitest run          # single run
pnpm vitest --watch      # dev mode
```

### Layer 2: API Route Tests (Vitest)

Test each API route handler in isolation with mocked Supabase client:

```typescript
// __tests__/api/cost-basis.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: mockLots, error: null }),
      insert: vi.fn().mockResolvedValue({ data: newLot, error: null }),
      update: vi.fn().mockResolvedValue({ data: updatedLot, error: null }),
      delete: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('Cost Basis API', () => {
  it('returns lots for a given token_id', async () => { /* ... */ });
  it('validates lot schema (qty > 0, price > 0)', async () => { /* ... */ });
  it('rejects invalid token_id', async () => { /* ... */ });
});
```

### Layer 3: Chain Integration Tests (Vitest, mocked RPCs)

Each chain module in `/lib/chains/` gets a test with mocked API responses:

```typescript
// __tests__/lib/chains/ethereum.test.ts
describe('Ethereum balance fetcher', () => {
  it('parses Alchemy getTokenBalances response', async () => { /* mock RPC */ });
  it('handles unknown ERC-20 (no CoinGecko match)', async () => { /* ... */ });
  it('retries on 429 rate limit', async () => { /* ... */ });
  it('returns empty array for address with no tokens', async () => { /* ... */ });
});
```

### Layer 4: E2E Tests (Playwright)

Full browser tests against `pnpm dev` running locally:

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads and displays portfolio value chart', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="portfolio-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-value"]')).not.toHaveText('$0');
  });

  test('time range buttons update chart', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="range-7d"]');
    // chart should re-render (check canvas or SVG element updates)
    await expect(page.locator('[data-testid="portfolio-chart"] canvas')).toBeVisible();
  });

  test('navigation works across all pages', async ({ page }) => {
    const pages = ['/dashboard', '/portfolio', '/cost-basis', '/projections', '/alerts', '/settings'];
    for (const p of pages) {
      await page.goto(p);
      await expect(page).toHaveURL(p);
      // No error boundary shown
      await expect(page.locator('[data-testid="error-boundary"]')).not.toBeVisible();
    }
  });
});

// e2e/cost-basis.spec.ts
test('add and edit a cost basis lot', async ({ page }) => {
  await page.goto('/cost-basis');
  await page.click('[data-testid="add-lot-btn"]');
  await page.fill('[data-testid="lot-qty"]', '0.5');
  await page.fill('[data-testid="lot-price"]', '42000');
  await page.click('[data-testid="lot-save"]');
  await expect(page.locator('[data-testid="lot-row"]')).toHaveCount(1);
});

// e2e/projections.spec.ts
test('Monte Carlo renders fan chart', async ({ page }) => {
  await page.goto('/projections');
  await page.click('[data-testid="tab-montecarlo"]');
  await expect(page.locator('[data-testid="fan-chart"]')).toBeVisible({ timeout: 15000 });
});
```

**Run commands:**
```bash
npx playwright test                    # headless
npx playwright test --headed           # watch it run
npx playwright test --ui              # interactive debug mode
```

### Layer 5: Visual Smoke Test Route (Dev Only)

Create a hidden dev route that renders ALL components on one page with mock data — useful for quick visual verification without clicking through the whole app:

```typescript
// src/app/dev/smoke/page.tsx (only in development)
// Renders: chart, pie, table, lot editor, all 3 projection models,
// alert builder, wallet manager — all with hardcoded mock data.
// Claude Code can screenshot this page to verify UI rendering.
```

### Test Data Fixtures

Create `/src/test/fixtures/` with realistic mock data:

```
fixtures/
├── mock-balances.json       # 15 tokens across 7 chains
├── mock-snapshots.json      # 90 days of hourly snapshots
├── mock-prices.json         # 90 days of prices for 10 tokens
├── mock-cost-basis.json     # 5 tokens with multiple lots each
├── mock-defi-positions.json # 3 protocols with various position types
├── mock-rpc-responses/      # Raw API responses per chain for integration tests
│   ├── alchemy-eth.json
│   ├── helius-sol.json
│   ├── blockstream-btc.json
│   ├── taostats-tao.json
│   └── alephium-explorer.json
└── mock-alerts.json         # 5 alert rules (mix of types)
```

### CI Check Script (Claude Code runs this after each phase)

```bash
#!/bin/bash
# scripts/check.sh — run after every phase
set -e

echo "=== TypeScript Check ==="
pnpm tsc --noEmit

echo "=== Lint ==="
pnpm eslint src/ --max-warnings 0

echo "=== Unit + Component Tests ==="
pnpm vitest run

echo "=== Build ==="
pnpm build

echo "=== E2E Tests (if dev server running) ==="
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  npx playwright test
else
  echo "⚠️  Dev server not running — skipping E2E"
fi

echo "✅ All checks passed"
```

**Claude Code: Run `bash scripts/check.sh` after completing each phase. Do not proceed to the next phase if any check fails.**

---

## 13. User Tasks (Manual Steps Required)

> **These tasks cannot be automated by Claude Code.** Complete them in order.
> Items marked 🔑 are required before the app can function.
> Items marked 📱 require your phone or browser.

### Before Claude Code Starts

| # | Task | Where | Time |
|---|------|-------|------|
| 🔑 1 | **Create Supabase project** | [supabase.com](https://supabase.com) → New Project → copy URL + anon key + service role key | 3 min |
| 🔑 2 | **Create Alchemy account** | [alchemy.com](https://alchemy.com) → Create App → enable Ethereum, Base, Arbitrum → copy API key | 3 min |
| 🔑 3 | **Create Helius account** | [helius.dev](https://helius.dev) → Get API key (free: 1K req/day) | 2 min |
| 🔑 4 | **Paste keys into `.env.local`** | Claude Code will have created the file with placeholders — fill in real values | 2 min |

### After Phase 1 (DB Setup)

| # | Task | Where | Time |
|---|------|-------|------|
| 🔑 5 | **Run Supabase migration** | Supabase Dashboard → SQL Editor → paste the migration SQL that Claude Code generated → Run | 2 min |
| 6 | **Verify tables exist** | Supabase Dashboard → Table Editor → confirm all 7 tables created | 1 min |

### After Phase 2 (Chain Integrations)

| # | Task | Where | Time |
|---|------|-------|------|
| 🔑 7 | **Add your wallet addresses** | Open app → Settings → Wallet Manager → add addresses per chain | 5 min |
| 8 | **Test balance fetch** | Hit the `/api/test/fetch-balances` route in browser → verify JSON response shows your tokens | 2 min |

### After Phase 3 (Cron Pipeline)

| # | Task | Where | Time |
|---|------|-------|------|
| 🔑 9 | **Set up external cron** | Go to [cron-job.org](https://cron-job.org) → Create job → URL: `https://your-app.vercel.app/api/cron/snapshot?key=YOUR_CRON_SECRET` → Schedule: every 1 hour | 3 min |
| 10 | **Trigger first snapshot** | Click "Run Now" on cron-job.org or hit the URL manually | 1 min |
| 11 | **Verify data in Supabase** | Check `snapshots` and `balances` tables have rows | 1 min |

### After Phase 4 (Cost Basis)

| # | Task | Where | Time |
|---|------|-------|------|
| 12 | **Enter your cost basis data** | Open app → Cost Basis → add lots for each token you hold | 15-30 min |
| 13 | **Optional: Import CSV** | If you have exchange export CSVs, use the CSV import feature | 5 min |

### After Phase 6 (Alerts)

| # | Task | Where | Time |
|---|------|-------|------|
| 📱 14 | **Create Telegram bot** | Open Telegram → message @BotFather → `/newbot` → copy token | 3 min |
| 📱 15 | **Get your chat ID** | Message your new bot → visit `https://api.telegram.org/bot{TOKEN}/getUpdates` → find `chat.id` | 2 min |
| 🔑 16 | **Add Telegram credentials to `.env.local`** | Paste `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` | 1 min |
| 17 | **Redeploy on Vercel** | Push to GitHub → Vercel auto-deploys; or `vercel --prod` from CLI | 2 min |

### Deployment (Final)

| # | Task | Where | Time |
|---|------|-------|------|
| 🔑 18 | **Create Vercel project** | [vercel.com](https://vercel.com) → Import Git repo → Framework: Next.js | 3 min |
| 🔑 19 | **Add env vars to Vercel** | Vercel Dashboard → Settings → Environment Variables → paste all `.env.local` values | 3 min |
| 20 | **Deploy** | Push to `main` branch → Vercel builds and deploys automatically | 2 min |
| 21 | **Update cron-job.org URL** | Change cron URL from localhost to your Vercel production URL | 1 min |
| 22 | **Verify production** | Visit your Vercel URL → dashboard loads → trigger cron → data appears | 2 min |

### Ongoing Maintenance

| Task | Frequency |
|------|-----------|
| Check cron-job.org is firing successfully | Weekly |
| Update cost basis when you make trades | As needed |
| Review unpriced tokens in Settings → Token Overrides | After adding new tokens |
| Check Supabase storage usage (free tier: 500MB) | Monthly |
| Update dependencies (`pnpm update`) | Monthly |
