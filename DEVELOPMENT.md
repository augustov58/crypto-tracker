# Crypto Tracker - Development Guide

## Quick Reference

### Project Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts (not TradingView/lightweight-charts)
- **Deployment**: Vercel

### Key Files
```
src/
├── app/
│   ├── api/
│   │   ├── portfolio/route.ts    # Token balances aggregation
│   │   ├── defi/route.ts         # DeFi positions via Zerion
│   │   ├── snapshots/route.ts    # Historical data for charts
│   │   ├── cron/snapshot/route.ts # Hourly snapshot cron job
│   │   └── wallets/route.ts      # Wallet management
│   └── dashboard/page.tsx
├── components/
│   ├── dashboard/
│   │   ├── quick-stats.tsx       # Top cards (uses snapshots)
│   │   └── portfolio-value-chart.tsx # Main chart (Recharts)
│   └── portfolio/
│       ├── token-table.tsx       # Token list with spam filter
│       └── defi-positions.tsx    # DeFi positions display
├── lib/
│   ├── chains/
│   │   ├── index.ts              # Chain router
│   │   ├── ethereum.ts           # ETH + ERC20 via Alchemy
│   │   ├── solana.ts             # SOL via Helius
│   │   ├── bitcoin.ts            # BTC via Blockstream
│   │   └── bittensor.ts          # TAO via Subtensor RPC
│   ├── defi/
│   │   └── zerion.ts             # Zerion API + vault detection
│   └── prices/
│       └── coingecko.ts          # Price fetching
```

### Environment Variables
```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Chain APIs
ALCHEMY_API_KEY=        # Ethereum, Base, Arbitrum
HELIUS_API_KEY=         # Solana

# DeFi
ZERION_API_KEY=         # DeFi positions (rate limited on free tier!)

# Cron
CRON_SECRET=            # Auth for /api/cron/* endpoints
```

---

## Known Issues & Solutions

### 1. Zerion Rate Limiting (HTTP 429)
**Problem**: Zerion free tier has strict rate limits. DeFi positions return empty.

**Solution**: 
- Cron has 5s delays between wallet queries
- Retry logic with 10s wait on 429
- Dashboard pulls from cached snapshots, not live API

**If still failing**: Wait 30-60 mins for rate limit reset, or upgrade Zerion plan.

### 2. Portfolio Chart Not Showing
**Problem**: Chart appears empty or shows TradingView logo.

**Solution**: We switched from `lightweight-charts` (TradingView) to `Recharts`.
- Check `portfolio-value-chart.tsx` uses Recharts `<AreaChart>`
- Ensure `/api/snapshots` returns at least 2 data points

### 3. Spam Tokens Cluttering Portfolio
**Problem**: Airdrops and scam tokens pollute the token list.

**Solution**: `token-table.tsx` filters by price availability.
- Tokens without CoinGecko price → hidden by default
- Collapsible "Show X unpriced tokens" section at bottom

### 4. DeFi Positions Not Detected
**Problem**: Vault tokens (Midas, Gauntlet, EtherFi, etc.) not showing.

**Solution**: `zerion.ts` has `VAULT_TOKEN_PATTERNS` array.
```typescript
// Add new patterns here:
{ pattern: /^YourToken/i, protocol: 'ProtocolName', type: 'yield' },
```

**Current patterns include**: Midas, Instadapp, Fluid, Morpho, Gauntlet, Aave, Compound, Lido, Rocket Pool, Yearn, Curve, Convex, Pendle, EtherFi, Spark, Maker

### 5. Bittensor (TAO) Balance Issues
**Problem**: Public TAO APIs (taostats, tensorplex) are dead.

**Solution**: Use `@polkadot/api` with Subtensor RPC directly.
```typescript
// bittensor.ts connects to:
wss://entrypoint-finney.opentensor.ai:443
```

### 6. Dashboard Stats Don't Match Chart
**Problem**: Quick stats show different value than chart.

**Solution**: Both should pull from `/api/snapshots`.
- Quick stats: Uses latest snapshot for total value
- Chart: Uses snapshot history for graph
- Portfolio API (`/api/portfolio`) only has token balances, not DeFi

---

## Common Tasks

### Add a New Chain
1. Create `src/lib/chains/newchain.ts` with `fetchBalances(address)` function
2. Add to `CHAIN_CONFIGS` in `src/lib/chains/types.ts`
3. Add to switch in `src/lib/chains/index.ts`
4. Add wallet entries to Supabase `wallets` table

### Add a New DeFi Protocol Pattern
Edit `src/lib/defi/zerion.ts`:
```typescript
const VAULT_TOKEN_PATTERNS = [
  // Add your pattern:
  { pattern: /^NewProtocol/i, protocol: 'NewProtocol', type: 'yield' },
  ...
];
```

### Trigger Manual Snapshot
```bash
curl "https://crypto-tracker-gilt-tau.vercel.app/api/cron/snapshot?key=YOUR_CRON_SECRET"
```

### Check Snapshot Data
```bash
curl "https://crypto-tracker-gilt-tau.vercel.app/api/snapshots?from=2026-02-01"
```

### Debug DeFi Fetching
```bash
# Check if Zerion is rate limiting
curl "https://crypto-tracker-gilt-tau.vercel.app/api/defi"
# Should return { positions: [...], totalUsd: X, source: "zerion" }
# If positions empty and totalUsd: 0, likely rate limited
```

---

## Architecture Notes

### Data Flow
```
Hourly Cron (/api/cron/snapshot)
    │
    ├── Fetch token balances from all chains
    ├── Fetch prices from CoinGecko
    ├── Fetch DeFi positions from Zerion (with delays)
    │
    └── Store in Supabase:
        ├── balances table (per-token snapshots)
        ├── prices table (token prices)
        └── snapshots table (aggregated totals)

Dashboard
    │
    ├── Quick Stats → /api/snapshots (latest snapshot)
    ├── Chart → /api/snapshots (historical)
    ├── Token Table → /api/portfolio (live from balances table)
    └── DeFi Positions → /api/defi (live, may be rate limited)
```

### Why Dashboard Uses Snapshots
- Avoids rate limiting on every page load
- DeFi data cached from hourly cron
- Consistent values across components
- Faster page loads

---

## Deployment

### Vercel Cron Schedule
File: `vercel.json`
```json
{
  "crons": [{
    "path": "/api/cron/snapshot",
    "schedule": "0 * * * *"  // Every hour
  }]
}
```

### After Code Changes
1. `npm run build` — verify no TypeScript errors
2. `git push` — Vercel auto-deploys from main
3. Wait ~1 min for deployment
4. Test the affected API endpoints

---

## Wallets Configured

| Chain | Address | Notes |
|-------|---------|-------|
| ethereum | 0x977a79e3...8260 | Main wallet |
| ethereum | 0xda26960b...0b83 | |
| ethereum | 0x8ac746c4...2b39 | |
| ethereum | 0xb89bafc3...b527 | Has EtherFi position |
| base | (same 4 addresses) | |
| arbitrum | (same 4 addresses) | |
| bitcoin | bc1qyemc26... | |
| bittensor | 5C78j4N77A... | ~30 TAO |
| solana | A7voQv78ur... | |

---

## Current Known Gaps

1. **EtherFi position (~$19k)** — Zerion rate limiting prevents consistent fetching
2. **Stablecoin vault pricing** — Estimated at 1:1, may not reflect actual exchange rate
3. **No Optimism/Polygon chains** — Not configured yet
4. **Cost basis tracking** — Partial implementation, needs CSV import
