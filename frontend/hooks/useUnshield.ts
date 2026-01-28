"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { requestUnshieldProof, getProofStatus, relayUnshield } from "@/lib/api";
import { waitForTransactionConfirmation } from "@/lib/verification";
import { usePositionsStore } from "@/stores/positions";
import { useTransactionsStore } from "@/stores/transactions";
import { getPositionSecret } from "@/lib/secret-derivation";
import { pollWithBackoff } from "@/lib/polling";
import type { Position, Transaction } from "@/types";
import type { ProofResult, ProofStatusResponse } from "@/types/api";
import { PROOF_POLLING_CONFIG } from "@/lib/constants";

export type UnshieldStatus =
  | "idle"
  | "deriving"
  | "requesting"
  | "generating"
  | "relaying"    // Relayer is signing and submitting
  | "confirming"  // Waiting for on-chain confirmation
  | "success"
  | "error";

export interface UnshieldState {
  status: UnshieldStatus;
  error: string | null;
  txSignature: string | null;
  proofProgress: number;
  proofStage: string | null;
  fee: number | null;  // Relayer fee in lamports
}

export interface UseUnshieldReturn extends UnshieldState {
  unshield: (position: Position, recipientAddress?: string) => Promise<void>;
  reset: () => void;
}

export function useUnshield(): UseUnshieldReturn {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { publicKey } = wallet;
  const { updatePosition } = usePositionsStore();
  const { addTransaction } = useTransactionsStore();

  const [state, setState] = useState<UnshieldState>({
    status: "idle",
    error: null,
    txSignature: null,
    proofProgress: 0,
    proofStage: null,
    fee: null,
  });

  const abortRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState({
      status: "idle",
      error: null,
      txSignature: null,
      proofProgress: 0,
      proofStage: null,
      fee: null,
    });
  }, []);

  const pollForProof = useCallback(
    async (jobId: string): Promise<ProofResult> => {
      const result = await pollWithBackoff<ProofStatusResponse>(
        async () => {
          if (abortRef.current) {
            throw new Error("Proof generation cancelled");
          }

          const response = await getProofStatus(jobId);

          // Update UI with progress
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

  const unshield = useCallback(
    async (position: Position, recipientAddress?: string) => {
      if (!publicKey) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Wallet not connected",
        }));
        return;
      }

      if (!position.commitment) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Position missing commitment",
        }));
        return;
      }

      if (position.delayUntil && new Date(position.delayUntil) > new Date()) {
        const remaining = new Date(position.delayUntil).getTime() - Date.now();
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.ceil((remaining % (60 * 60 * 1000)) / (60 * 1000));
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        setState((prev) => ({
          ...prev,
          status: "error",
          error: `This position has a privacy delay. Available in ${timeStr}.`,
        }));
        return;
      }

      abortRef.current = false;

      // Use provided recipient or fall back to connected wallet
      // For maximum privacy, users should withdraw to a DIFFERENT wallet
      const recipient = recipientAddress || publicKey.toBase58();

      try {
        // Step 1: Derive secret from wallet signature
        // This requires user to sign a message to prove ownership
        setState({
          status: "deriving",
          error: null,
          txSignature: null,
          proofProgress: 0,
          proofStage: "Requesting signature to derive secret...",
          fee: null,
        });

        const secret = await getPositionSecret(position, wallet);
        console.log("[Unshield] Secret derived successfully");

        // Step 2: Request proof generation
        setState((prev) => ({
          ...prev,
          status: "requesting",
          proofStage: "Requesting proof generation...",
        }));

        const { jobId } = await requestUnshieldProof(
          position.commitment,
          secret,
          position.amount,
          recipient,
          position.denomination,
        );

        setState((prev) => ({ ...prev, status: "generating" }));
        console.log("[Unshield] Proof generation started, job ID:", jobId);

        const proofResult = await pollForProof(jobId);
        console.log("[Unshield] Proof generated successfully");

        // Step 3: Relay transaction through relayer
        // The relayer signs and submits - user's wallet NEVER signs the tx
        // This is what provides TRUE PRIVACY
        setState((prev) => ({
          ...prev,
          status: "relaying",
          proofStage: "Relayer is submitting transaction...",
        }));
        console.log("[Unshield] Sending to relayer for submission...");

        const relayResult = await relayUnshield(jobId, recipient);
        console.log("[Unshield] Relayer submitted transaction:", relayResult.signature);

        // Step 4: Wait for on-chain confirmation
        setState((prev) => ({
          ...prev,
          status: "confirming",
          proofStage: "Confirming transaction...",
          fee: relayResult.fee,
        }));
        console.log("[Unshield] Waiting for transaction confirmation...");

        const confirmed = await waitForTransactionConfirmation(
          relayResult.signature,
          30,
          1000
        );
        if (!confirmed) {
          throw new Error(
            "Transaction was not confirmed on-chain. Please check the explorer and try again."
          );
        }
        console.log("[Unshield] Transaction confirmed on-chain!");

        // Step 5: Update position and storage
        updatePosition(position.id, { status: "unshielded" });

        // Add transaction record
        const txRecord: Transaction = {
          id: relayResult.signature,
          type: "unshield",
          token: position.token,
          amount: relayResult.amountSent,  // Amount after fee
          timestamp: Date.now(),
          txHash: relayResult.signature,
          status: "confirmed",
        };
        addTransaction(txRecord);

        setState({
          status: "success",
          error: null,
          txSignature: relayResult.signature,
          proofProgress: 100,
          proofStage: "complete",
          fee: relayResult.fee,
        });
      } catch (error) {
        if (abortRef.current) return;

        const message = error instanceof Error ? error.message : "Stealth withdrawal failed";
        console.error("[Unshield] Error:", error);

        // Provide user-friendly error messages
        const userMessage = message.includes("Signature required")
          ? "Please sign the message to withdraw your position. The signature is used to securely derive your secret."
          : message.includes("User rejected")
          ? "Signature request was rejected. Please try again."
          : message.includes("Relayer")
          ? "Relayer service error. Please try again later."
          : message;

        setState((prev) => ({
          ...prev,
          status: "error",
          error: userMessage,
        }));
      }
    },
    [publicKey, connection, wallet, updatePosition, addTransaction, pollForProof]
  );

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  return {
    ...state,
    unshield,
    reset,
  };
}
