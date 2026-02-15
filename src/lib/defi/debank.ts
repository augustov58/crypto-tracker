/**
 * DeBank API Integration
 * 
 * Fetches DeFi positions across all protocols for wallet addresses
 * API docs: https://docs.cloud.debank.com/en/readme/api-pro-reference/user
 */

const DEBANK_API_BASE = 'https://pro-openapi.debank.com';

export interface DebankToken {
  id: string;
  chain: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_url: string | null;
  price: number;
  amount: number;
}

export interface DebankPortfolioItem {
  name: string;
  detail_types: string[];
  detail: {
    supply_token_list?: DebankToken[];
    reward_token_list?: DebankToken[];
    borrow_token_list?: DebankToken[];
    token_list?: DebankToken[];
    description?: string;
  };
  stats: {
    asset_usd_value: number;
    debt_usd_value: number;
    net_usd_value: number;
  };
}

export interface DebankProtocol {
  id: string;
  chain: string;
  name: string;
  logo_url: string | null;
  site_url: string | null;
  has_supported_portfolio: boolean;
  portfolio_item_list: DebankPortfolioItem[];
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
    isEstimated?: boolean;
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
  hasUnpricedTokens?: boolean;
}

export class DebankClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${DEBANK_API_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    
    const response = await fetch(url.toString(), {
      headers: {
        'AccessKey': this.apiKey,
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeBank API error (${response.status}): ${text}`);
    }
    
    return response.json();
  }
  
  /**
   * Get all DeFi positions for an address across all chains
   */
  async getAllProtocolPositions(address: string, chainIds?: string[]): Promise<DebankProtocol[]> {
    const params: Record<string, string> = { id: address };
    if (chainIds?.length) {
      params.chain_ids = chainIds.join(',');
    }
    
    return this.fetch<DebankProtocol[]>('/v1/user/all_complex_protocol_list', params);
  }
  
  /**
   * Get DeFi positions for a specific chain
   */
  async getChainProtocolPositions(address: string, chainId: string): Promise<DebankProtocol[]> {
    return this.fetch<DebankProtocol[]>('/v1/user/complex_protocol_list', {
      id: address,
      chain_id: chainId,
    });
  }
  
  /**
   * Get simple protocol balances (less detail, faster)
   */
  async getSimpleProtocolList(address: string, chainIds?: string[]): Promise<Array<{
    id: string;
    chain: string;
    name: string;
    logo_url: string | null;
    site_url: string | null;
    net_usd_value: number;
    asset_usd_value: number;
    debt_usd_value: number;
  }>> {
    const params: Record<string, string> = { id: address };
    if (chainIds?.length) {
      params.chain_ids = chainIds.join(',');
    }
    
    return this.fetch('/v1/user/all_simple_protocol_list', params);
  }
}

/**
 * Transform DeBank protocol data into our unified format
 */
export function transformDebankPositions(protocols: DebankProtocol[]): DefiPosition[] {
  const positions: DefiPosition[] = [];
  
  for (const protocol of protocols) {
    if (!protocol.portfolio_item_list?.length) continue;
    
    for (const item of protocol.portfolio_item_list) {
      const tokens: DefiPosition['tokens'] = [];
      const rewards: DefiPosition['rewards'] = [];
      const debt: DefiPosition['debt'] = [];
      
      // Supply/deposit tokens
      const supplyTokens = item.detail.supply_token_list || item.detail.token_list || [];
      for (const token of supplyTokens) {
        if (token.amount > 0) {
          tokens.push({
            symbol: token.symbol,
            name: token.name,
            amount: token.amount,
            usdValue: token.amount * token.price,
            logo: token.logo_url,
          });
        }
      }
      
      // Reward tokens
      for (const token of item.detail.reward_token_list || []) {
        if (token.amount > 0) {
          rewards.push({
            symbol: token.symbol,
            amount: token.amount,
            usdValue: token.amount * token.price,
          });
        }
      }
      
      // Debt/borrow tokens
      for (const token of item.detail.borrow_token_list || []) {
        if (token.amount > 0) {
          debt.push({
            symbol: token.symbol,
            amount: token.amount,
            usdValue: token.amount * token.price,
          });
        }
      }
      
      // Determine position type from detail_types
      const type = item.detail_types?.join(', ') || item.name || 'Position';
      
      positions.push({
        id: `${protocol.id}-${protocol.chain}-${item.name}`,
        protocol: protocol.name,
        protocolLogo: protocol.logo_url,
        protocolUrl: protocol.site_url,
        chain: protocol.chain,
        type,
        tokens,
        rewards: rewards.length > 0 ? rewards : undefined,
        debt: debt.length > 0 ? debt : undefined,
        netUsdValue: item.stats.net_usd_value,
        assetUsdValue: item.stats.asset_usd_value,
        debtUsdValue: item.stats.debt_usd_value,
      });
    }
  }
  
  return positions.filter(p => p.netUsdValue > 0.01).sort((a, b) => b.netUsdValue - a.netUsdValue);
}

/**
 * Chain ID mapping (DeBank uses short IDs)
 */
export const DEBANK_CHAIN_IDS: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arb',
  optimism: 'op',
  polygon: 'matic',
  avalanche: 'avax',
  bsc: 'bsc',
  fantom: 'ftm',
  gnosis: 'xdai',
};
