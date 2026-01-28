import { SOLANA_RPC_URL } from "@/lib/constants";
import type { SwapQuoteResponse } from "@/types/api";

const RAYDIUM_DEVNET_SWAP_HOST = "https://transaction-v1-devnet.raydium.io";

interface RaydiumRoutePlan {
  poolId: string;
  inputMint: string;
  outputMint: string;
  feeMint: string;
  feeRate: number;
  feeAmount: string;
  remainingAccounts: string[];
  lastPoolPriceX64: string;
}

// Full response type - Raydium API expects this entire object for transaction building
export interface RaydiumComputeResponse {
  id: string;
  success: boolean;
  version: string;
  msg?: string;
  data?: {
    swapType: string;
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct: number;
    referrerAmount: string;
    routePlan: RaydiumRoutePlan[];
  };
}

interface RaydiumTransactionResponse {
  id: string;
  success: boolean;
  version: string;
  msg?: string;
  data?: Array<{ transaction: string }>;
}

/**
 * Fetch a swap quote from the Raydium devnet Trade API.
 * Returns data compatible with our SwapQuoteResponse type.
 */
export async function getRaydiumQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps = 100
): Promise<{ quote: SwapQuoteResponse; rawResponse: RaydiumComputeResponse }> {
  const url = new URL(`${RAYDIUM_DEVNET_SWAP_HOST}/compute/swap-base-in`);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amountLamports.toString());
  url.searchParams.set("slippageBps", slippageBps.toString());
  url.searchParams.set("txVersion", "V0");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Raydium API error: ${res.status} ${res.statusText}`);
  }
  const data: RaydiumComputeResponse = await res.json();

  if (!data.success || !data.data) {
    throw new Error(data.msg || "Raydium quote failed — no route found for this token pair");
  }

  const quote: SwapQuoteResponse = {
    inputMint: data.data.inputMint,
    outputMint: data.data.outputMint,
    inAmount: data.data.inputAmount,
    outAmount: data.data.outputAmount,
    priceImpactPct: data.data.priceImpactPct.toString(),
    slippageBps,
    minimumReceived: data.data.otherAmountThreshold,
    route: "raydium-devnet",
  };

  // Return full response - Raydium's transaction API expects the entire object
  return { quote, rawResponse: data };
}

/**
 * Build a Raydium swap transaction via the devnet Trade API.
 * Returns a base64-encoded versioned transaction for the user to sign.
 *
 * IMPORTANT: swapResponse must be the FULL quote response object (with id, success, version, data),
 * not just the .data portion. Raydium's API validates the entire response structure.
 */
export async function buildRaydiumSwapTransaction(
  swapResponse: RaydiumComputeResponse,
  walletPublicKey: string
): Promise<string> {
  const res = await fetch(`${RAYDIUM_DEVNET_SWAP_HOST}/transaction/swap-base-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      computeUnitPriceMicroLamports: "1000",
      swapResponse,
      wallet: walletPublicKey,
      txVersion: "V0",
      wrapSol: true,    // Auto-wrap native SOL to wSOL for swap
      unwrapSol: true,  // Auto-unwrap wSOL back to native SOL after swap
    }),
  });

  if (!res.ok) {
    throw new Error(`Raydium transaction API error: ${res.status} ${res.statusText}`);
  }
  const data: RaydiumTransactionResponse = await res.json();

  if (!data.success || !data.data || data.data.length === 0) {
    console.error("[Raydium] Transaction build failed:", data);
    throw new Error(data.msg || "Failed to build Raydium swap transaction");
  }

  return data.data[0].transaction;
}
