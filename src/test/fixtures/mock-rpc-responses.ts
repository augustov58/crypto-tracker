/**
 * Mock RPC Responses for Chain Integration Tests
 */

// Alchemy - Ethereum/Base/Arbitrum
export const mockAlchemyTokenBalances = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f9e4B4',
    tokenBalances: [
      {
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        tokenBalance: '0x5f5e100', // 100 USDC (6 decimals)
      },
      {
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        tokenBalance: '0x2540be400', // 10000 USDT (6 decimals)
      },
      {
        contractAddress: '0x0000000000000000000000000000000000000000',
        tokenBalance: '0x0', // Zero balance - should be filtered
      },
    ],
  },
};

export const mockAlchemyTokenMetadataUSDC = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  },
};

export const mockAlchemyTokenMetadataUSDT = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  },
};

export const mockAlchemyEthBalance = '0x16345785d8a0000'; // 0.1 ETH

// Helius - Solana
export const mockHeliusSolBalance = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    context: { slot: 200000000 },
    value: 5000000000, // 5 SOL
  },
};

export const mockHeliusAssetsByOwner = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    total: 2,
    limit: 1000,
    page: 1,
    items: [
      {
        id: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        interface: 'FungibleToken',
        content: {
          metadata: {
            name: 'USD Coin',
            symbol: 'USDC',
          },
        },
        ownership: {
          frozen: false,
          delegated: false,
          ownership_model: 'token',
          owner: 'test-owner',
        },
        token_info: {
          symbol: 'USDC',
          balance: 1000000000, // 1000 USDC (6 decimals)
          supply: 1000000000000,
          decimals: 6,
          token_program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          associated_token_address: 'test-ata',
        },
      },
      {
        id: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        interface: 'FungibleToken',
        content: {
          metadata: {
            name: 'Jupiter',
            symbol: 'JUP',
          },
        },
        ownership: {
          frozen: false,
          delegated: false,
          ownership_model: 'token',
          owner: 'test-owner',
        },
        token_info: {
          symbol: 'JUP',
          balance: 50000000000, // 50 JUP (9 decimals)
          supply: 1000000000000000,
          decimals: 9,
          token_program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          associated_token_address: 'test-ata-2',
        },
      },
    ],
  },
};

// Blockstream - Bitcoin
export const mockBlockstreamAddress = {
  address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  chain_stats: {
    funded_txo_count: 5,
    funded_txo_sum: 150000000, // 1.5 BTC in satoshis
    spent_txo_count: 2,
    spent_txo_sum: 50000000, // 0.5 BTC spent
    tx_count: 7,
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0,
  },
};

// Taostats - Bittensor
export const mockTaostatsAccount = {
  address: '5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM',
  balance: '10000000000', // 10 TAO in RAO
  stake: '5000000000', // 5 TAO staked
  rank: 1234,
};

export const mockTaostatsStake = [
  {
    hotkey: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
    coldkey: '5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM',
    stake: '5000000000', // 5 TAO
    netuid: 1,
  },
];

// Alephium Explorer
export const mockAlephiumAddressInfo = {
  balance: '1000000000000000000000', // 1000 ALPH in attoALPH (18 decimals)
  lockedBalance: '0',
  txNumber: 42,
};

export const mockAlephiumTokenBalances: never[] = []; // No tokens for simplicity

// CoinGecko
export const mockCoinGeckoPrices = {
  bitcoin: {
    usd: 97500,
    usd_24h_change: 2.5,
    usd_24h_vol: 35000000000,
    usd_market_cap: 1900000000000,
    last_updated_at: 1707900000,
  },
  ethereum: {
    usd: 3250,
    usd_24h_change: 1.8,
    usd_24h_vol: 15000000000,
    usd_market_cap: 390000000000,
    last_updated_at: 1707900000,
  },
  solana: {
    usd: 185,
    usd_24h_change: 5.2,
    usd_24h_vol: 3000000000,
    usd_market_cap: 80000000000,
    last_updated_at: 1707900000,
  },
  bittensor: {
    usd: 420,
    usd_24h_change: -3.1,
    usd_24h_vol: 150000000,
    usd_market_cap: 3000000000,
    last_updated_at: 1707900000,
  },
  alephium: {
    usd: 1.25,
    usd_24h_change: 8.5,
    usd_24h_vol: 5000000,
    usd_market_cap: 150000000,
    last_updated_at: 1707900000,
  },
  'usd-coin': {
    usd: 1.0,
    usd_24h_change: 0.01,
    last_updated_at: 1707900000,
  },
};

export const mockCoinGeckoHistoricalPrices = {
  prices: [
    [1707800000000, 95000],
    [1707810000000, 95500],
    [1707820000000, 96000],
    [1707830000000, 96500],
    [1707840000000, 97000],
    [1707850000000, 97250],
    [1707860000000, 97500],
  ],
};
