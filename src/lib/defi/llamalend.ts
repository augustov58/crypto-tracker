/**
 * LlamaLend (crvUSD) position reader.
 *
 * Zerion does not report LlamaLend vault-held collateral, so this module reads
 * the market controller directly on-chain. Discovered from the 2026-11-01
 * borrow_more tx of wallet 0xb4877bd4… (tx 0x2e5f72b9…): the working view is
 * user_state(address) => [collateral, ?, debt, x] (raw retries with a bad
 * selector revert, so errors here degrade to position-skip, never crash).
 *
 * Usage: getLlamaLendPosition(controller, address, collateralPriceUsd, borrowedPriceUsd)
 */

import { ethers } from 'ethers';

export interface LlamaLendPosition {
  controller: string;
  collateralSymbol: string;
  borrowedSymbol: string;
  collateralAmount: number;   // token units (18 dec)
  debtAmount: number;         // token units (18 dec)
  collateralUsd: number;
  debtUsd: number;
  netUsd: number;             // collateral - debt
  ltv: number;                // debt/collateral, 0..1
  healthy: boolean;           // health() > 0
}

const CTRL_ABI = [
  'function user_state(address) view returns (uint256[4])',
  'function health(address) view returns (int256)',
  'function collateral_token() view returns (address)',
  'function borrowed_token() view returns (address)',
  'function liquidation_discount() view returns (uint256)',
];

const ERC20_ABI = ['function symbol() view returns (string)'];

/** Markets to track: controller address + Coingecko ids for pricing. */
export const LLAMA_MARKETS: Array<{ controller: string; collateralGeckoId: string; borrowedGeckoId: string }> = [
  {
    // wstETH market (verified live 2026-11-01: coll 4.261836 wstETH, debt 4400.05 crvUSD)
    controller: '0x5756a035f276a8095a922931f224f4ed06149608',
    collateralGeckoId: 'wsteth',   // CoinGecko id
    borrowedGeckoId: 'crvusd',
  },
];

export async function getLlamaLendPosition(
  provider: ethers.JsonRpcProvider,
  market: { controller: string; collateralGeckoId: string; borrowedGeckoId: string },
  address: string,
  prices: { collateralUsd: number; borrowedUsd: number },
  collateralSymbol?: string,
  borrowedSymbol?: string
): Promise<LlamaLendPosition | null> {
  const ctrl = new ethers.Contract(market.controller, CTRL_ABI, provider);
  try {
    const state = await ctrl.user_state(address);
    const collRaw = state[0];
    const debtRaw = state[2];
    if (collRaw === BigInt(0) && debtRaw === BigInt(0)) return null;  // no position

    let collSymbol = collateralSymbol || market.collateralGeckoId.toUpperCase();
    let borrSymbol = borrowedSymbol || market.borrowedGeckoId.toUpperCase();
    try {
      const collToken = new ethers.Contract(await ctrl.collateral_token(), ERC20_ABI, provider);
      collSymbol = await collToken.symbol();
      const borrToken = new ethers.Contract(await ctrl.borrowed_token(), ERC20_ABI, provider);
      borrSymbol = await borrToken.symbol();
    } catch { /* keep fallbacks */ }

    const collateralAmount = Number(ethers.formatUnits(collRaw, 18));
    const debtAmount = Number(ethers.formatUnits(debtRaw, 18));
    const collateralUsd = collateralAmount * prices.collateralUsd;
    const debtUsd = debtAmount * prices.borrowedUsd;

    let healthy = true;
    try {
      healthy = (await ctrl.health(address)) > BigInt(0);
    } catch { /* assume healthy */ }

    return {
      controller: market.controller,
      collateralSymbol: collSymbol,
      borrowedSymbol: borrSymbol,
      collateralAmount,
      debtAmount,
      collateralUsd,
      debtUsd,
      netUsd: collateralUsd - debtUsd,
      ltv: collateralUsd > 0 ? debtUsd / collateralUsd : 0,
      healthy,
    };
  } catch {
    return null; // revert (e.g. wrong selector for this market version) => skip
  }
}

/** wstETH price = stETH-per-wstETH (from wrap rate) x ETH price. */
export async function getWstethPrice(
  provider: ethers.JsonRpcProvider,
  ethUsd: number,
  wstethToken = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0'
): Promise<number | null> {
  try {
    const wsteth = new ethers.Contract(wstethToken, [
      'function stEthPerToken() view returns (uint256)',
      'function totalSupply() view returns (uint256)',
    ], provider);
    try {
      return Number(ethers.formatUnits(await wsteth.stEthPerToken(), 18)) * ethUsd;
    } catch {
      // fallback: wrap rate = stETH balance / totalSupply
      const steth = new ethers.Contract('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', ['function balanceOf(address) view returns (uint256)'], provider);
      const rate = Number(ethers.formatUnits(await steth.balanceOf(wstethToken), 18)) /
        Number(ethers.formatUnits(await wsteth.totalSupply(), 18));
      return rate * ethUsd;
    }
  } catch {
    return null;
  }
}
