/**
 * Zerion API Integration
 * 
 * Fetches wallet positions including DeFi positions across protocols
 * API docs: https://developers.zerion.io/reference/listwalletpositions
 */

const ZERION_API_BASE = 'https://api.zerion.io/v1';

export interface ZerionFungibleInfo {
  name: string;
  symbol: string;
  icon: { url: string } | null;
  decimals: number;
}

export interface ZerionPosition {
  type: string;
  id: string;
  attributes: {
    parent: string | null;
    protocol: string | null;
    name: string;
    position_type: 'wallet' | 'staked' | 'deposit' | 'locked' | 'reward' | 'borrowed' | 'claimable' | 'airdrop';
    quantity: {
      int: string;
      decimals: number;
      float: number;
      numeric: string;
    };
    value: number | null;
    price: number;
    changes: {
      absolute_1d: number | null;
      percent_1d: number | null;
    } | null;
    fungible_info: ZerionFungibleInfo;
    flags: {
      displayable: boolean;
      is_trash: boolean;
    };
    updated_at: string;
    updated_at_block: number;
    application_metadata: {
      name: string;
      icon: { url: string } | null;
      url: string | null;
    } | null;
    group_id?: string;
  };
  relationships: {
    chain: { data: { id: string } };
    fungible: { data: { id: string } };
  };
}

export interface ZerionResponse {
  links: { self: string; next?: string };
  data: ZerionPosition[];
}

export interface DefiPosition {
  id: string;
  protocol: string;
  protocolLogo: string | null;
  protocolUrl: string | null;
  chain: string;
  type: string;
  tokens: Array<{
    symbol: string;
    name: string;
    amount: number;
    usdValue: number;
    logo: string | null;
    isEstimated?: boolean; // True if value was estimated (e.g., stablecoin vaults)
  }>;
  rewards?: Array<{
    symbol: string;
    amount: number;
    usdValue: number;
  }>;
  debt?: Array<{
    symbol: string;
    amount: number;
    usdValue: number;
  }>;
  netUsdValue: number;
  assetUsdValue: number;
  debtUsdValue: number;
  hasUnpricedTokens?: boolean; // True if any tokens couldn't be priced
}

export class ZerionClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${ZERION_API_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zerion API error (${response.status}): ${text}`);
    }
    
    return response.json();
  }
  
  /**
   * Get all positions for a wallet (includes DeFi)
   */
  async getWalletPositions(address: string, options: {
    filterPositionTypes?: string[];
    filterTrash?: boolean;
    currency?: string;
  } = {}): Promise<ZerionPosition[]> {
    const params: Record<string, string> = {
      'currency': options.currency || 'usd',
      'filter[trash]': options.filterTrash === false ? 'only_non_trash' : 'only_non_trash',
      'sort': 'value',
    };
    
    if (options.filterPositionTypes?.length) {
      params['filter[position_types]'] = options.filterPositionTypes.join(',');
    }
    
    const allPositions: ZerionPosition[] = [];
    let nextUrl: string | undefined = `/wallets/${address}/positions/`;
    
    // Paginate through all results
    while (nextUrl) {
      const response: ZerionResponse = await this.fetch(nextUrl, nextUrl.includes('?') ? {} : params);
      allPositions.push(...response.data);
      
      // Check for next page
      nextUrl = response.links.next ? new URL(response.links.next).pathname + new URL(response.links.next).search : undefined;
      
      // Safety limit
      if (allPositions.length > 1000) break;
    }
    
    return allPositions;
  }
  
  /**
   * Get only DeFi positions (excludes simple wallet holdings)
   * Now fetches all positions and relies on transformZerionPositions to detect vault tokens
   */
  async getDefiPositions(address: string): Promise<ZerionPosition[]> {
    // Fetch all positions - the transform function will detect vault tokens
    // that Zerion classifies as "wallet" but are actually DeFi positions
    return this.getWalletPositions(address);
  }
}

/**
 * Known vault/DeFi protocols that Zerion may classify as "wallet" positions
 * Maps token name patterns to protocol info
 * Patterns should be specific to avoid false positives
 */
const VAULT_TOKEN_PATTERNS: Array<{
  pattern: RegExp;
  protocol: string;
  type: 'deposit' | 'staked' | 'lending' | 'yield';
}> = [
  // Midas - yield aggregator
  { pattern: /^Midas\s/i, protocol: 'Midas', type: 'yield' },
  { pattern: /^mEDGE$/i, protocol: 'Midas', type: 'yield' },
  { pattern: /^mBASIS$/i, protocol: 'Midas', type: 'yield' },
  // Instadapp - vault aggregator
  { pattern: /^Instadapp/i, protocol: 'Instadapp', type: 'deposit' },
  { pattern: /^iETH/i, protocol: 'Instadapp', type: 'deposit' },
  // Fluid - lending protocol (specific token names)
  { pattern: /^Fluid\s/i, protocol: 'Fluid', type: 'lending' },
  { pattern: /^fUSDC$/i, protocol: 'Fluid', type: 'lending' },
  { pattern: /^fUSDT$/i, protocol: 'Fluid', type: 'lending' },
  { pattern: /^fETH$/i, protocol: 'Fluid', type: 'lending' },
  // Morpho - lending aggregator
  { pattern: /^Morpho/i, protocol: 'Morpho', type: 'lending' },
  // Gauntlet - risk-managed vaults
  { pattern: /^Gauntlet/i, protocol: 'Gauntlet', type: 'yield' },
  // Aave - lending (explicit token names only)
  { pattern: /^Aave\s/i, protocol: 'Aave', type: 'lending' },
  { pattern: /^aEth/i, protocol: 'Aave', type: 'lending' },
  { pattern: /^aUSDC$/i, protocol: 'Aave', type: 'lending' },
  { pattern: /^aUSDT$/i, protocol: 'Aave', type: 'lending' },
  { pattern: /^aDAI$/i, protocol: 'Aave', type: 'lending' },
  { pattern: /^aWETH$/i, protocol: 'Aave', type: 'lending' },
  { pattern: /^aWBTC$/i, protocol: 'Aave', type: 'lending' },
  // Compound - lending (explicit token names only)
  { pattern: /^Compound\s/i, protocol: 'Compound', type: 'lending' },
  { pattern: /^cUSDC$/i, protocol: 'Compound', type: 'lending' },
  { pattern: /^cUSDT$/i, protocol: 'Compound', type: 'lending' },
  { pattern: /^cDAI$/i, protocol: 'Compound', type: 'lending' },
  { pattern: /^cETH$/i, protocol: 'Compound', type: 'lending' },
  { pattern: /^cWBTC$/i, protocol: 'Compound', type: 'lending' },
  // Lido - liquid staking
  { pattern: /^Lido\s/i, protocol: 'Lido', type: 'staked' },
  { pattern: /^stETH$/i, protocol: 'Lido', type: 'staked' },
  { pattern: /^wstETH$/i, protocol: 'Lido', type: 'staked' },
  { pattern: /^Staked\sETH$/i, protocol: 'Lido', type: 'staked' },
  // Rocket Pool
  { pattern: /^rETH$/i, protocol: 'Rocket Pool', type: 'staked' },
  { pattern: /^Rocket Pool/i, protocol: 'Rocket Pool', type: 'staked' },
  // Yearn
  { pattern: /^Yearn\s/i, protocol: 'Yearn', type: 'yield' },
  { pattern: /^yvUSDC$/i, protocol: 'Yearn', type: 'yield' },
  { pattern: /^yvDAI$/i, protocol: 'Yearn', type: 'yield' },
  { pattern: /^yvWETH$/i, protocol: 'Yearn', type: 'yield' },
  // Curve LP tokens
  { pattern: /^Curve\.fi/i, protocol: 'Curve', type: 'deposit' },
  { pattern: /Curve.*LP$/i, protocol: 'Curve', type: 'deposit' },
  // Convex
  { pattern: /^Convex/i, protocol: 'Convex', type: 'staked' },
  { pattern: /^cvx/i, protocol: 'Convex', type: 'staked' },
  // Pendle - yield trading
  { pattern: /^Pendle/i, protocol: 'Pendle', type: 'yield' },
  { pattern: /^PT-/i, protocol: 'Pendle', type: 'yield' },
  { pattern: /^YT-/i, protocol: 'Pendle', type: 'yield' },
  // EtherFi / EigenLayer restaking
  { pattern: /^eETH$/i, protocol: 'EtherFi', type: 'staked' },
  { pattern: /^weETH$/i, protocol: 'EtherFi', type: 'staked' },
  { pattern: /^EtherFi/i, protocol: 'EtherFi', type: 'staked' },
  { pattern: /^Ether\.Fi/i, protocol: 'EtherFi', type: 'staked' },
  { pattern: /^liquidETH$/i, protocol: 'EtherFi', type: 'staked' },
  // Spark (MakerDAO lending)
  { pattern: /^Spark\s/i, protocol: 'Spark', type: 'lending' },
  { pattern: /^spDAI$/i, protocol: 'Spark', type: 'lending' },
  // Maker/Sky savings
  { pattern: /^sDAI$/i, protocol: 'Maker', type: 'yield' },
  { pattern: /^Savings\sDAI$/i, protocol: 'Maker', type: 'yield' },
  // Coinbase wrapped staked ETH
  { pattern: /^cbETH$/i, protocol: 'Coinbase', type: 'staked' },
  // Generic vault patterns (more restrictive)
  { pattern: /\sVault$/i, protocol: 'Vault', type: 'deposit' },
  { pattern: /\sLP\sToken$/i, protocol: 'LP', type: 'deposit' },
];

/**
 * Check if a token is a known vault/DeFi token
 */
function detectVaultToken(name: string, symbol: string): { protocol: string; type: string } | null {
  for (const { pattern, protocol, type } of VAULT_TOKEN_PATTERNS) {
    if (pattern.test(name) || pattern.test(symbol)) {
      return { protocol, type };
    }
  }
  return null;
}

/**
 * Stablecoin patterns for estimating vault values
 * If a vault has these in the name/symbol and has no price, assume ~1:1 USD value
 */
const STABLECOIN_PATTERNS = [
  /USDC/i,
  /USDT/i,
  /DAI/i,
  /FRAX/i,
  /LUSD/i,
  /crvUSD/i,
  /GHO/i,
  /USD\+/i,
  /sUSD/i,
];

/**
 * Check if token name/symbol suggests it's a stablecoin vault
 */
function isStablecoinVault(name: string, symbol: string): boolean {
  return STABLECOIN_PATTERNS.some(p => p.test(name) || p.test(symbol));
}

/**
 * Transform Zerion positions into our unified DeFi format
 * Now includes vault token detection for positions classified as "wallet"
 */
export function transformZerionPositions(positions: ZerionPosition[]): DefiPosition[] {
  // Group by protocol + chain + group_id (for LP pools)
  // Store detected protocol info with each group
  const grouped = new Map<string, { positions: ZerionPosition[]; detectedProtocol: string; detectedType: string }>();
  
  for (const pos of positions) {
    const attr = pos.attributes;
    
    // Skip trash
    if (attr.flags.is_trash) {
      continue;
    }
    
    // Check if it's a known DeFi position type
    const isDefiType = attr.position_type !== 'wallet';
    
    // Check if it's a vault token that Zerion classified as "wallet"
    // Check vault tokens BEFORE displayable filter - some vaults are marked non-displayable
    const vaultInfo = !isDefiType 
      ? detectVaultToken(attr.fungible_info.name, attr.fungible_info.symbol)
      : null;
    
    // Skip non-displayable UNLESS it's a detected vault token
    if (!attr.flags.displayable && !vaultInfo && !isDefiType) {
      continue;
    }
    
    // Skip if neither DeFi type nor vault token
    if (!isDefiType && !vaultInfo) {
      continue;
    }
    
    const detectedProtocol = attr.application_metadata?.name || attr.protocol || vaultInfo?.protocol || 'Unknown';
    const detectedType = vaultInfo?.type || attr.position_type;
    const chain = pos.relationships.chain.data.id;
    const groupId = attr.group_id || pos.id;
    const key = `${detectedProtocol}-${chain}-${groupId}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, { positions: [], detectedProtocol, detectedType });
    }
    grouped.get(key)!.positions.push(pos);
  }
  
  // Transform grouped positions
  const result: DefiPosition[] = [];
  
  for (const [key, group] of grouped.entries()) {
    const { positions: groupPositions, detectedProtocol, detectedType } = group;
    const first = groupPositions[0].attributes;
    const protocol = detectedProtocol;
    const chain = groupPositions[0].relationships.chain.data.id;
    
    const tokens: DefiPosition['tokens'] = [];
    const rewards: DefiPosition['rewards'] = [];
    const debt: DefiPosition['debt'] = [];
    
    let assetValue = 0;
    let debtValue = 0;
    
    let hasUnpriced = false;
    
    for (const pos of groupPositions) {
      const attr = pos.attributes;
      
      // Determine USD value - estimate for stablecoin vaults if Zerion returns null
      let usdValue = attr.value;
      let isEstimated = false;
      
      if (usdValue === null || usdValue === 0) {
        // Check if this looks like a stablecoin vault
        if (isStablecoinVault(attr.fungible_info.name, attr.fungible_info.symbol)) {
          // Assume ~1:1 USD value for stablecoin vaults
          usdValue = attr.quantity.float;
          isEstimated = true;
        } else {
          usdValue = 0;
          hasUnpriced = true;
        }
      }
      
      const token = {
        symbol: attr.fungible_info.symbol,
        name: attr.fungible_info.name,
        amount: attr.quantity.float,
        usdValue: usdValue,
        logo: attr.fungible_info.icon?.url || null,
        isEstimated,
      };
      
      if (attr.position_type === 'borrowed') {
        debt.push({
          symbol: token.symbol,
          amount: token.amount,
          usdValue: token.usdValue,
        });
        debtValue += token.usdValue;
      } else if (attr.position_type === 'reward' || attr.position_type === 'claimable') {
        rewards.push({
          symbol: token.symbol,
          amount: token.amount,
          usdValue: token.usdValue,
        });
        assetValue += token.usdValue;
      } else {
        tokens.push(token);
        assetValue += token.usdValue;
      }
    }
    
    // Determine position type - use detected type for vault tokens
    const type = detectedType !== 'wallet' ? detectedType : 
      (() => {
        const types = [...new Set(groupPositions.map(p => p.attributes.position_type))];
        return types.length === 1 ? types[0] : types.join(' + ');
      })();
    
    result.push({
      id: key,
      protocol,
      protocolLogo: first.application_metadata?.icon?.url || null,
      protocolUrl: first.application_metadata?.url || null,
      chain,
      type,
      tokens,
      rewards: rewards.length > 0 ? rewards : undefined,
      debt: debt.length > 0 ? debt : undefined,
      netUsdValue: assetValue - debtValue,
      assetUsdValue: assetValue,
      debtUsdValue: debtValue,
      hasUnpricedTokens: hasUnpriced,
    });
  }
  
  // Keep positions that either have value > $0.01 OR have meaningful token amounts
  return result
    .filter(p => p.netUsdValue > 0.01 || p.tokens.some(t => t.amount > 0.01))
    .sort((a, b) => b.netUsdValue - a.netUsdValue);
}

/**
 * Chain ID mapping for Zerion
 */
export const ZERION_CHAIN_IDS: Record<string, string> = {
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum-one',
  optimism: 'optimism',
  polygon: 'polygon',
  avalanche: 'avalanche',
  bsc: 'binance-smart-chain',
  fantom: 'fantom',
  gnosis: 'xdai',
};
