import type { NetworkType } from "@/types";
import type { HealthResponse } from "@/types/api";

/**
 * Default program ID - used as fallback if health endpoint is unavailable.
 * In production, this should match the deployed program.
 */
const DEFAULT_PROGRAM_ID = "3qhVPvz8T1WiozCLEfhUuv8WZHDPpEfnAzq2iSatULc7";

/**
 * Program ID - fetched from backend on initialization.
 * This ensures frontend always uses the same program as backend.
 */
let _programId: string = DEFAULT_PROGRAM_ID;
let _initialized = false;

export function getProgramId(): string {
  return _programId;
}

/**
 * Initialize configuration from backend.
 * Should be called once during app startup.
 */
export async function initializeConfig(): Promise<void> {
  if (_initialized) return;

  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (response.ok) {
      const health: HealthResponse = await response.json();
      _programId = health.programId;
      console.log("[Config] Loaded program ID from backend:", _programId);
    }
  } catch (error) {
    console.warn("[Config] Failed to fetch config from backend, using defaults");
  }

  _initialized = true;
}

/**
 * @deprecated Use getProgramId() instead for dynamic loading.
 * Kept for backwards compatibility during migration.
 */
export const PROGRAM_ID = DEFAULT_PROGRAM_ID;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const SOLANA_NETWORK: NetworkType = "devnet";

export const SOLANA_RPC_URL = "https://api.devnet.solana.com";

export interface SupportedToken {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUri: string;
}

export const SUPPORTED_TOKENS: SupportedToken[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logoUri: "/tokens/sol.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    decimals: 6,
    logoUri: "/tokens/usdc.png",
  },
];

export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Fixed denomination pools for amount privacy.
 * Each denomination has its own on-chain pool with separate anonymity set.
 */
export const FIXED_DENOMINATIONS = [
  { value: 1_000_000_000, label: "1 SOL", recommended: true },
  { value: 10_000_000_000, label: "10 SOL", recommended: false },
  { value: 100_000_000_000, label: "100 SOL", recommended: false },
  { value: 1_000_000_000_000, label: "1K SOL", recommended: false },
  { value: 10_000_000_000_000, label: "10K SOL", recommended: false },
] as const;

export const CUSTOM_AMOUNT_WARNING =
  "Custom amounts reduce privacy. Fixed denominations provide better anonymity by mixing your deposit with others who deposited the same amount.";

export const APP_NAME = "WhaleVault";

export const APP_DESCRIPTION =
  "Privacy-preserving vault for Solana. Shield your assets with zero-knowledge proofs.";
