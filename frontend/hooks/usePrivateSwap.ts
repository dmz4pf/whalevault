"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import {
  requestUnshieldProof,
  getProofStatus,
  getSwapQuote,
  executeSwap,
  relayUnshield,
} from "@/lib/api";
import { getRaydiumQuote, buildRaydiumSwapTransaction } from "@/services/raydium-swap";
import type { RaydiumComputeData } from "@/services/raydium-swap";
import { waitForTransactionConfirmation } from "@/lib/verification";
import { usePositionsStore } from "@/stores/positions";
import { useTransactionsStore } from "@/stores/transactions";
import { getPositionSecret } from "@/lib/secret-derivation";
import { pollWithBackoff } from "@/lib/polling";
import { SOL_MINT } from "@/lib/tokens";
import { SOLANA_NETWORK } from "@/lib/constants";
import type { Position, Transaction } from "@/types";
import type { SwapQuoteResponse, ProofResult, ProofStatusResponse } from "@/types/api";
import { PROOF_POLLING_CONFIG } from "@/lib/constants";

export type SwapStatus =
  | "idle"
  | "quoting"
  | "deriving"
  | "requesting"
  | "generating"
  | "unshielding"
  | "building_route"
  | "swapping"
  | "executing"
  | "confirming"
  | "success"
  | "error";

export interface SwapState {
  status: SwapStatus;
  error: string | null;
  quote: SwapQuoteResponse | null;
  unshieldSignature: string | null;
  swapSignature: string | null;
  proofProgress: number;
  proofStage: string | null;
}

export interface UsePrivateSwapReturn extends SwapState {
  fetchQuote: (position: Position, outputMint: string) => Promise<void>;
  swap: (position: Position, outputMint: string, recipient: string) => Promise<void>;
  reset: () => void;
  isDevnet: boolean;
}

const INITIAL_STATE: SwapState = {
  status: "idle",
  error: null,
  quote: null,
  unshieldSignature: null,
  swapSignature: null,
  proofProgress: 0,
  proofStage: null,
};

const isDevnet = SOLANA_NETWORK === "devnet";

export function usePrivateSwap(): UsePrivateSwapReturn {
  const wallet = useWallet();
  const { publicKey, signTransaction } = wallet;
  const { connection } = useConnection();
  const { updatePosition } = usePositionsStore();
  const { addTransaction } = useTransactionsStore();

  const [state, setState] = useState<SwapState>(INITIAL_STATE);
  const abortRef = useRef(false);
  const raydiumResponseRef = useRef<RaydiumComputeData | null>(null);

  const reset = useCallback(() => {
    abortRef.current = true;
    raydiumResponseRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const pollForProof = useCallback(
    async (jobId: string): Promise<ProofResult> => {
      const result = await pollWithBackoff<ProofStatusResponse>(
        async () => {
          if (abortRef.current) {
            throw new Error("Swap cancelled");
          }
          const response = await getProofStatus(jobId);
          setState((prev) => ({
            ...prev,
            proofProgress: response.progress,
            proofStage: response.stage,
          }));
          return response;
        },
        (response) =>
          response.status === "completed" || response.status === "failed",
        PROOF_POLLING_CONFIG
      );

      if (result.status === "failed") {
        throw new Error(result.error || "Proof generation failed");
      }
      if (!result.result) {
        throw new Error("Proof completed but no result returned");
      }
      return result.result;
    },
    []
  );

  const fetchQuote = useCallback(
    async (position: Position, outputMint: string) => {
      try {
        setState((prev) => ({ ...prev, status: "quoting", error: null }));

        if (isDevnet) {
          const { quote, rawResponse } = await getRaydiumQuote(
            SOL_MINT,
            outputMint,
            position.amount
          );
          raydiumResponseRef.current = rawResponse;
          setState((prev) => ({ ...prev, status: "idle", quote }));
        } else {
          const quote = await getSwapQuote(SOL_MINT, outputMint, position.amount);
          setState((prev) => ({ ...prev, status: "idle", quote }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch quote";
        setState((prev) => ({ ...prev, status: "error", error: message }));
      }
    },
    []
  );

  const swapDevnet = useCallback(
    async (position: Position, outputMint: string, recipient: string) => {
      if (!publicKey || !signTransaction) {
        throw new Error("Wallet not connected or does not support signing");
      }

      // Step 1: Derive secret
      setState({
        ...INITIAL_STATE,
        status: "deriving",
        proofStage: "Deriving secret...",
      });
      const secret = await getPositionSecret(position, wallet);

      // Step 2: Request proof generation
      setState((prev) => ({
        ...prev,
        status: "requesting",
        proofStage: "Requesting proof generation...",
      }));
      const { jobId } = await requestUnshieldProof(
        position.commitment!,
        secret,
        position.amount,
        recipient,
        position.denomination
      );

      // Step 3: Poll for proof
      setState((prev) => ({ ...prev, status: "generating" }));
      await pollForProof(jobId);

      // Step 4: Unshield SOL to user's wallet via relayer
      setState((prev) => ({
        ...prev,
        status: "unshielding",
        proofStage: "Unshielding SOL to wallet...",
      }));
      const relayResult = await relayUnshield(jobId, publicKey.toBase58());
      const unshieldSignature = relayResult.signature;

      // Wait for unshield confirmation
      const unshieldConfirmed = await waitForTransactionConfirmation(
        unshieldSignature,
        30,
        1000
      );
      if (!unshieldConfirmed) {
        throw new Error("Unshield transaction was not confirmed on-chain.");
      }

      // Step 5: Build Raydium swap transaction
      setState((prev) => ({
        ...prev,
        status: "building_route",
        proofStage: "Building swap route...",
        unshieldSignature,
      }));

      // Use cached quote data, or re-fetch if missing
      let swapData = raydiumResponseRef.current;
      if (!swapData) {
        const { rawResponse } = await getRaydiumQuote(SOL_MINT, outputMint, position.amount);
        swapData = rawResponse;
      }

      const serializedTx = await buildRaydiumSwapTransaction(
        swapData,
        publicKey.toBase58()
      );

      // Step 6: User signs and sends the swap transaction
      setState((prev) => ({
        ...prev,
        status: "swapping",
        proofStage: "Sign the swap transaction in your wallet...",
      }));

      const txBuffer = Buffer.from(serializedTx, "base64");
      const versionedTx = VersionedTransaction.deserialize(txBuffer);
      const signedTx = await signTransaction(versionedTx);
      const swapSignature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      // Step 7: Confirm swap on-chain
      setState((prev) => ({
        ...prev,
        status: "confirming",
        proofStage: "Confirming swap on chain...",
        swapSignature,
      }));

      const swapConfirmed = await waitForTransactionConfirmation(
        swapSignature,
        30,
        1000
      );
      if (!swapConfirmed) {
        throw new Error("Swap transaction was not confirmed on-chain.");
      }

      return { unshieldSignature, swapSignature };
    },
    [publicKey, signTransaction, wallet, connection, pollForProof]
  );

  const swapMainnet = useCallback(
    async (position: Position, outputMint: string, recipient: string) => {
      // Step 1: Derive secret
      setState({
        ...INITIAL_STATE,
        status: "deriving",
        proofStage: "Requesting signature to derive secret...",
      });
      const secret = await getPositionSecret(position, wallet);

      // Step 2: Request proof generation
      setState((prev) => ({
        ...prev,
        status: "requesting",
        proofStage: "Requesting proof generation...",
      }));
      const { jobId } = await requestUnshieldProof(
        position.commitment!,
        secret,
        position.amount,
        recipient,
        position.denomination
      );

      // Step 3: Poll for proof
      setState((prev) => ({ ...prev, status: "generating" }));
      await pollForProof(jobId);

      // Step 4: Execute atomic swap via backend
      setState((prev) => ({
        ...prev,
        status: "executing",
        proofStage: "Executing unshield + swap...",
      }));
      const swapResult = await executeSwap(jobId, recipient, outputMint);

      // Step 5: Confirm on-chain
      setState((prev) => ({
        ...prev,
        status: "confirming",
        proofStage: "Confirming transaction...",
        unshieldSignature: swapResult.unshieldSignature,
        swapSignature: swapResult.swapSignature,
      }));
      const confirmed = await waitForTransactionConfirmation(
        swapResult.swapSignature,
        30,
        1000
      );
      if (!confirmed) {
        throw new Error("Transaction was not confirmed on-chain.");
      }

      return {
        unshieldSignature: swapResult.unshieldSignature,
        swapSignature: swapResult.swapSignature,
        outputAmount: swapResult.outputAmount,
      };
    },
    [wallet, pollForProof]
  );

  const swap = useCallback(
    async (position: Position, outputMint: string, recipient: string) => {
      if (!publicKey) {
        setState((prev) => ({ ...prev, status: "error", error: "Wallet not connected" }));
        return;
      }
      if (!position.commitment) {
        setState((prev) => ({ ...prev, status: "error", error: "Position missing commitment" }));
        return;
      }

      abortRef.current = false;

      try {
        let result: { unshieldSignature: string; swapSignature: string; outputAmount?: string };

        if (isDevnet) {
          result = await swapDevnet(position, outputMint, recipient);
        } else {
          result = await swapMainnet(position, outputMint, recipient);
        }

        // Update position & storage
        updatePosition(position.id, {
          status: "unshielded",
          swapOutputToken: outputMint,
          swapOutputAmount: result.outputAmount ? parseFloat(result.outputAmount) : undefined,
        });

        const txRecord: Transaction = {
          id: result.swapSignature,
          type: "unshield",
          token: position.token,
          amount: result.outputAmount ? parseFloat(result.outputAmount) : position.amount,
          timestamp: Date.now(),
          txHash: result.swapSignature,
          status: "confirmed",
        };
        addTransaction(txRecord);

        setState((prev) => ({
          ...prev,
          status: "success",
          error: null,
          unshieldSignature: result.unshieldSignature,
          swapSignature: result.swapSignature,
          proofProgress: 100,
          proofStage: "complete",
        }));
      } catch (error) {
        if (abortRef.current) return;
        const message = error instanceof Error ? error.message : "Private swap failed";
        setState((prev) => ({ ...prev, status: "error", error: message }));
      }
    },
    [publicKey, swapDevnet, swapMainnet, updatePosition, addTransaction]
  );

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return { ...state, fetchQuote, swap, reset, isDevnet };
}
