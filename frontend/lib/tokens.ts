import { NetworkType } from "@/types";

export interface FeaturedToken {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUri?: string;
}

export const MAINNET_FEATURED_TOKENS: FeaturedToken[] = [
  { symbol: "USDC", name: "USD Coin", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", name: "Tether USD", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6 },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6 },
];

export const DEVNET_FEATURED_TOKENS: FeaturedToken[] = [
  { symbol: "dwSOL", name: "Devnet Wrapped SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  { symbol: "dUSDC", name: "Devnet USDC", mint: "USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT", decimals: 6 },
  { symbol: "dUSDT", name: "Devnet USDT", mint: "9jWfcfEZToquBQmkoEViNSCt72veXwcvRGFQERXRjEk1", decimals: 6 },
];

export function getFeaturedTokens(network: NetworkType): FeaturedToken[] {
  if (network === "devnet") return DEVNET_FEATURED_TOKENS;
  return MAINNET_FEATURED_TOKENS;
}

/** @deprecated Use MAINNET_FEATURED_TOKENS or getFeaturedTokens() instead */
export const FEATURED_TOKENS = MAINNET_FEATURED_TOKENS;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
