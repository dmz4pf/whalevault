export interface Position {
  id: string;
  token: string;
  amount: number;
  shieldedAmount: number;
  timestamp: number;
  status: "shielded" | "unshielded" | "pending" | "failed" | "transferred";
  commitment: string;
  /**
   * Nonce used for secret derivation from wallet signature.
   * Format: "{timestamp}-{uuid}"
   * Required for new positions created with deterministic secrets.
   */
  nonce?: string;
  /**
   * @deprecated Legacy field - secrets are now derived from wallet signatures.
   * Only present for positions created before the security update.
   * New positions should NOT have this field.
   */
  secret?: string;
  /** Denomination in lamports. null/0 = custom pool. */
  denomination?: number | null;
  poolAddress?: string;
  shieldTxSig?: string;
  unshieldTxSig?: string | null;
  swapOutputToken?: string | null;
  swapOutputAmount?: number | null;
  spentAt?: string | null;
  delayUntil?: string | null;
}

export interface Transaction {
  id: string;
  type: "shield" | "unshield" | "transfer";
  token: string;
  amount: number;
  timestamp: number;
  txHash: string;
  status: "confirmed" | "pending" | "failed";
  privacyDelay?: number; // Delay in ms (0 = instant, 3600000 = 1h, etc.)
}

export interface Token {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUri?: string;
}

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
  connecting: boolean;
}

export interface PositionsState {
  positions: Position[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  lastSynced: string | null;
}

export type NetworkType = "mainnet-beta" | "devnet" | "testnet";
