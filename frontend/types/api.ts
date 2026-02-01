/**
 * API response types matching backend models
 */

// Serialized Solana instruction
export interface SerializedInstruction {
  programId: string;
  keys: InstructionKey[];
  data: string; // base64 encoded
}

export interface InstructionKey {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

// Shield prepare response
export interface ShieldPrepareResponse {
  commitment: string;
  secret: string | null;  // null when frontend provides pre-computed commitment
  amount: number;
  instruction: SerializedInstruction;
  blockhash: string;
}

// Commitment computation response
export interface ComputeCommitmentResponse {
  commitment: string;
}

// Unshield prepare response
export interface UnshieldPrepareResponse {
  instruction: SerializedInstruction;
  blockhash: string;
  amount: number;
  recipient: string;
}

// Proof job responses
export type ProofStatus = "pending" | "processing" | "completed" | "failed";

export interface ProofJobResponse {
  jobId: string;
  status: ProofStatus;
  estimatedTime: number;
}

export interface ProofResult {
  proof: string;
  nullifier: string;
  publicInputs: {
    commitment: string;
    nullifier: string;
    recipient: string;
    amount: number;
  };
  verified: boolean;
}

export interface ProofStatusResponse {
  jobId: string;
  status: ProofStatus;
  progress: number;
  stage: string | null;
  result: ProofResult | null;
  error: string | null;
}

// Pool status
export interface PoolStatusResponse {
  totalValueLocked: number;
  totalDeposits: number;
  anonymitySetSize: number;
}

// Pool info (for denomination pools)
export interface PoolInfo {
  denomination: number;  // 0 = custom
  label: string;
  name: string;
  depositCount: number;
  totalValueLocked: number;
}

// Pools list response
export interface PoolsListResponse {
  pools: PoolInfo[];
  customEnabled: boolean;
}

// Health check
export interface HealthResponse {
  status: string;
  version: string;
  solanaConnection: boolean;
  rpcLatency: number | null;
  programId: string;
}

// Swap Operations
export interface SwapQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  minimumReceived: string;
  route?: string;
}

export interface SwapExecuteResponse {
  unshieldSignature: string;
  swapSignature: string;
  transferSignature?: string; // SOL fallback transfer when swap fails
  outputAmount: string;
  outputMint: string;
  recipient: string;
  fee: number;
}

export interface SwapTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri: string | null;
}

// API Error
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Relayer types
export interface RelayerInfoResponse {
  enabled: boolean;
  publicKey: string;
  feeBps: number;  // Fee in basis points (100 = 1%)
  balance: number; // Relayer balance in lamports
}

export interface RelayUnshieldResponse {
  signature: string;  // Transaction signature
  fee: number;        // Fee charged in lamports
  amountSent: number; // Amount sent after fee
  recipient: string;  // Recipient address
}

// Private Transfer types
export interface RelayTransferResponse {
  signature: string;       // Transaction signature
  fee: number;             // Fee charged (0 for transfers)
  recipientSecret: string; // Secret the recipient needs to unshield (64 hex chars)
  newCommitment: string;   // Recipient's commitment in the pool (64 hex chars)
  amount: number;          // Amount transferred in lamports
  recipient: string;       // Recipient address (for reference)
}

export interface TransferProofResult {
  proof: string;
  nullifier: string;
  newCommitment: string;
  recipientSecret: string;
  publicInputs: {
    nullifier: string;
    newCommitment: string;
    amount: number;
    recipient: string;
  };
  verified: boolean;
}
