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
   */
  async getDefiPositions(address: string): Promise<ZerionPosition[]> {
    return this.getWalletPositions(address, {
      filterPositionTypes: ['staked', 'deposit', 'locked', 'reward', 'borrowed', 'claimable'],
    });
  }
}

/**
 * Transform Zerion positions into our unified DeFi format
 */
export function transformZerionPositions(positions: ZerionPosition[]): DefiPosition[] {
  // Group by protocol + chain + group_id (for LP pools)
  const grouped = new Map<string, ZerionPosition[]>();
  
  for (const pos of positions) {
    const attr = pos.attributes;
    // Skip simple wallet positions and trash
    if (attr.position_type === 'wallet' || attr.flags.is_trash || !attr.flags.displayable) {
      continue;
    }
    
    const protocol = attr.application_metadata?.name || attr.protocol || 'Unknown';
    const chain = pos.relationships.chain.data.id;
    const groupId = attr.group_id || pos.id;
    const key = `${protocol}-${chain}-${groupId}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(pos);
  }
  
  // Transform grouped positions
  const result: DefiPosition[] = [];
  
  for (const [key, groupPositions] of grouped.entries()) {
    const first = groupPositions[0].attributes;
    const protocol = first.application_metadata?.name || first.protocol || 'Unknown';
    const chain = groupPositions[0].relationships.chain.data.id;
    
    const tokens: DefiPosition['tokens'] = [];
    const rewards: DefiPosition['rewards'] = [];
    const debt: DefiPosition['debt'] = [];
    
    let assetValue = 0;
    let debtValue = 0;
    
    for (const pos of groupPositions) {
      const attr = pos.attributes;
      const token = {
        symbol: attr.fungible_info.symbol,
        name: attr.fungible_info.name,
        amount: attr.quantity.float,
        usdValue: attr.value || 0,
        logo: attr.fungible_info.icon?.url || null,
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
    
    // Determine position type
    const types = [...new Set(groupPositions.map(p => p.attributes.position_type))];
    const type = types.length === 1 ? types[0] : types.join(' + ');
    
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
    });
  }
  
  return result.filter(p => p.netUsdValue > 0.01).sort((a, b) => b.netUsdValue - a.netUsdValue);
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
