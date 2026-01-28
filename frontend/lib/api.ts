import { API_BASE_URL } from "./constants";
import type { Position, Transaction } from "@/types";
import type {
  ShieldPrepareResponse,
  UnshieldPrepareResponse,
  ProofJobResponse,
  ProofStatusResponse,
  PoolStatusResponse,
  PoolsListResponse,
  HealthResponse,
  APIError,
  RelayerInfoResponse,
  RelayUnshieldResponse,
  SwapQuoteResponse,
  SwapExecuteResponse,
  SwapTokenInfo,
} from "@/types/api";

/**
 * Custom error class for API failures with structured error data
 */
export class APIClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "APIClientError";
  }
}

/**
 * Generic fetch wrapper that handles errors and returns typed responses
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data.error as APIError | undefined;
    throw new APIClientError(
      error?.code || "UNKNOWN_ERROR",
      error?.message || `HTTP ${response.status}`,
      error?.details
    );
  }

  return data;
}

// ---------------------------------------------------------------------------
// Shield Operations
// ---------------------------------------------------------------------------

/**
 * Prepare a shield transaction - generates commitment and returns instruction
 *
 * @param amount - Amount in lamports
 * @param depositor - Depositor's public key
 * @param commitment - Optional pre-computed commitment (new flow with wallet-derived secrets)
 *                     If provided, backend uses this commitment directly.
 *                     If not provided, backend generates random secret and commitment (legacy).
 */
export async function prepareShield(
  amount: number,
  depositor: string,
  commitment?: string,
  denomination?: number | null
): Promise<ShieldPrepareResponse> {
  return fetchApi<ShieldPrepareResponse>("/shield/prepare", {
    method: "POST",
    body: JSON.stringify({ amount, depositor, commitment, denomination }),
  });
}

// ---------------------------------------------------------------------------
// Unshield Operations
// ---------------------------------------------------------------------------

/**
 * Request a ZK proof for unshielding - starts async proof generation
 */
export async function requestUnshieldProof(
  commitment: string,
  secret: string,
  amount: number,
  recipient: string,
  denomination?: number | null
): Promise<ProofJobResponse> {
  return fetchApi<ProofJobResponse>("/unshield/proof", {
    method: "POST",
    body: JSON.stringify({ commitment, secret, amount, recipient, denomination }),
  });
}

/**
 * Prepare an unshield transaction after proof generation is complete
 * Returns the instruction for signing and submitting
 */
export async function prepareUnshield(
  jobId: string,
  relayer: string,
  recipient?: string
): Promise<UnshieldPrepareResponse> {
  return fetchApi<UnshieldPrepareResponse>("/unshield/prepare", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      relayer,
      recipient,
    }),
  });
}

// ---------------------------------------------------------------------------
// Proof Status
// ---------------------------------------------------------------------------

/**
 * Poll for proof generation status
 */
export async function getProofStatus(jobId: string): Promise<ProofStatusResponse> {
  return fetchApi<ProofStatusResponse>(`/proof/status/${jobId}`);
}

// ---------------------------------------------------------------------------
// Pool Status
// ---------------------------------------------------------------------------

/**
 * Get current pool statistics
 */
export async function getPoolStatus(): Promise<PoolStatusResponse> {
  return fetchApi<PoolStatusResponse>("/pool/status");
}

/**
 * Get all denomination pools with their anonymity set sizes
 */
export async function fetchPools(): Promise<PoolsListResponse> {
  return fetchApi<PoolsListResponse>("/pool/pools");
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Check API health and Solana connection status
 */
export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>("/health");
}

// ---------------------------------------------------------------------------
// Relayer Operations
// ---------------------------------------------------------------------------

/**
 * Get information about the relayer service
 * Returns relayer's public key, fee structure, and balance
 */
export async function getRelayerInfo(): Promise<RelayerInfoResponse> {
  return fetchApi<RelayerInfoResponse>("/relay/info");
}

/**
 * Relay an unshield transaction through the relayer service
 *
 * The relayer signs and submits the transaction on behalf of the user.
 * This provides TRUE PRIVACY because the user's wallet never signs the
 * withdrawal transaction - only the ZK proof authorizes it.
 *
 * @param jobId - The proof job ID from /unshield/proof
 * @param recipient - Solana address to receive the funds
 * @returns Transaction signature and fee information
 */
export async function relayUnshield(
  jobId: string,
  recipient: string
): Promise<RelayUnshieldResponse> {
  return fetchApi<RelayUnshieldResponse>("/relay/unshield", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      recipient,
    }),
  });
}

// ---------------------------------------------------------------------------
// Swap Operations
// ---------------------------------------------------------------------------

/**
 * Get a swap quote for converting shielded SOL to another token via Jupiter
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps = 100
): Promise<SwapQuoteResponse> {
  return fetchApi<SwapQuoteResponse>(
    `/swap/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
  );
}

/**
 * Execute a private swap: unshield + swap in one atomic operation
 */
export async function executeSwap(
  jobId: string,
  recipient: string,
  outputMint: string
): Promise<SwapExecuteResponse> {
  return fetchApi<SwapExecuteResponse>("/swap/execute", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, recipient, output_mint: outputMint }),
  });
}

/**
 * Get list of supported swap tokens
 */
export async function getSwapTokens(): Promise<SwapTokenInfo[]> {
  return fetchApi<SwapTokenInfo[]>("/swap/tokens");
}

// ---------------------------------------------------------------------------
// Legacy Endpoints (preserved for backwards compatibility)
// ---------------------------------------------------------------------------

interface LegacyApiResponse<T> {
  data: T;
  error?: string;
}

async function fetchApiLegacy<T>(
  endpoint: string,
  options?: RequestInit
): Promise<LegacyApiResponse<T>> {
  try {
    const data = await fetchApi<T>(endpoint, options);
    return { data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { data: null as T, error: message };
  }
}

export async function getPositions(
  publicKey: string
): Promise<LegacyApiResponse<Position[]>> {
  return fetchApiLegacy<Position[]>(`/positions?wallet=${publicKey}`);
}

export async function getTransactions(
  publicKey: string
): Promise<LegacyApiResponse<Transaction[]>> {
  return fetchApiLegacy<Transaction[]>(`/transactions?wallet=${publicKey}`);
}

export async function createShieldTransaction(params: {
  wallet: string;
  token: string;
  amount: number;
}): Promise<LegacyApiResponse<{ txHash: string }>> {
  return fetchApiLegacy<{ txHash: string }>("/shield", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createUnshieldTransaction(params: {
  wallet: string;
  positionId: string;
  amount: number;
}): Promise<LegacyApiResponse<{ txHash: string }>> {
  return fetchApiLegacy<{ txHash: string }>("/unshield", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
