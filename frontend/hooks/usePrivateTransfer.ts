"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { requestPrivateTransferProof, getProofStatus, relayPrivateTransfer } from "@/lib/api";
import { waitForTransactionConfirmation } from "@/lib/verification";
import { usePositionsStore } from "@/stores/positions";
import { useTransactionsStore } from "@/stores/transactions";
import { getPositionSecret } from "@/lib/secret-derivation";
import { pollWithBackoff } from "@/lib/polling";
import type { Position, Transaction } from "@/types";
import type { ProofStatusResponse, RelayTransferResponse } from "@/types/api";
import { PROOF_POLLING_CONFIG } from "@/lib/constants";

export type PrivateTransferStatus =
  | "idle"
  | "deriving"
  | "requesting"
  | "generating"
  | "relaying"
  | "confirming"
  | "success"
  | "error";

export interface PrivateTransferState {
  status: PrivateTransferStatus;
  error: string | null;
  txSignature: string | null;
  proofProgress: number;
  proofStage: string | null;
  // Transfer-specific: data the sender must share with recipient
  recipientSecret: string | null;
  newCommitment: string | null;
}

export interface UsePrivateTransferReturn extends PrivateTransferState {
  transfer: (position: Position, recipientAddress: string) => Promise<void>;
  reset: () => void;
}

export function usePrivateTransfer(): UsePrivateTransferReturn {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { publicKey } = wallet;
  const { updatePosition } = usePositionsStore();
  const { addTransaction } = useTransactionsStore();

  const [state, setState] = useState<PrivateTransferState>({
    status: "idle",
    error: null,
    txSignature: null,
    proofProgress: 0,
    proofStage: null,
    recipientSecret: null,
    newCommitment: null,
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
      recipientSecret: null,
      newCommitment: null,
    });
  }, []);

  const pollForProof = useCallback(
    async (jobId: string): Promise<ProofStatusResponse> => {
      const result = await pollWithBackoff<ProofStatusResponse>(
        async () => {
          if (abortRef.current) {
            throw new Error("Transfer cancelled");
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
        throw new Error(result.error || "Transfer proof generation failed");
      }

      if (!result.result) {
        throw new Error("Proof completed but no result returned");
      }

      return result;
    },
    []
  );

  const transfer = useCallback(
    async (position: Position, recipientAddress: string) => {
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

      if (!recipientAddress || recipientAddress.length < 32) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Invalid recipient address",
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

      // Track if relayer submitted tx
      let relayerSubmitted = false;
      let transferResult: RelayTransferResponse | null = null;

      try {
        // Step 1: Derive secret from wallet signature
        setState({
          status: "deriving",
          error: null,
          txSignature: null,
          proofProgress: 0,
          proofStage: "Requesting signature to derive secret...",
          recipientSecret: null,
          newCommitment: null,
        });

        const secret = await getPositionSecret(position, wallet);
        console.log("[PrivateTransfer] Secret derived successfully");

        // Step 2: Request proof generation
        setState((prev) => ({
          ...prev,
          status: "requesting",
          proofStage: "Requesting transfer proof generation...",
        }));

        const { jobId } = await requestPrivateTransferProof(
          position.commitment,
          secret,
          position.amount,
          recipientAddress,
          position.denomination
        );

        setState((prev) => ({ ...prev, status: "generating" }));
        console.log("[PrivateTransfer] Proof generation started, job ID:", jobId);

        await pollForProof(jobId);
        console.log("[PrivateTransfer] Proof generated successfully");

        // Step 3: Relay transaction through relayer
        setState((prev) => ({
          ...prev,
          status: "relaying",
          proofStage: "Relayer is submitting transfer...",
        }));
        console.log("[PrivateTransfer] Sending to relayer for submission...");

        transferResult = await relayPrivateTransfer(jobId, recipientAddress);
        relayerSubmitted = true;
        console.log("[PrivateTransfer] Relayer submitted transaction:", transferResult.signature);

        // Step 4: Wait for on-chain confirmation
        setState((prev) => ({
          ...prev,
          status: "confirming",
          proofStage: "Confirming transaction...",
        }));
        console.log("[PrivateTransfer] Waiting for transaction confirmation...");

        const confirmed = await waitForTransactionConfirmation(
          transferResult.signature,
          30,
          1000
        );
        if (!confirmed) {
          throw new Error(
            "Transaction was not confirmed on-chain. Please check the explorer and try again."
          );
        }
        console.log("[PrivateTransfer] Transaction confirmed on-chain!");

        // Step 5: Update position status (sender's position is now spent)
        updatePosition(position.id, { status: "transferred" });

        // Add transaction record
        const txRecord: Transaction = {
          id: transferResult.signature,
          type: "transfer",
          token: position.token,
          amount: transferResult.amount,
          timestamp: Date.now(),
          txHash: transferResult.signature,
          status: "confirmed",
        };
        addTransaction(txRecord);

        setState({
          status: "success",
          error: null,
          txSignature: transferResult.signature,
          proofProgress: 100,
          proofStage: "complete",
          recipientSecret: transferResult.recipientSecret,
          newCommitment: transferResult.newCommitment,
        });
      } catch (error) {
        if (abortRef.current) return;

        const message = error instanceof Error ? error.message : "Private transfer failed";
        console.error("[PrivateTransfer] Error:", error);

        // If relayer already submitted tx, mark position as transferred
        if (relayerSubmitted) {
          updatePosition(position.id, { status: "transferred" });
        }

        // Provide user-friendly error messages
        const userMessage = message.includes("Signature required")
          ? "Please sign the message to transfer your position. The signature is used to securely derive your secret."
          : message.includes("User rejected")
          ? "Signature request was rejected. Please try again."
          : message.includes("Relayer")
          ? "Relayer service error. Please try again later."
          : message;

        setState((prev) => ({
          ...prev,
          status: "error",
          error: userMessage,
          // Still preserve the recipient data if transfer was submitted
          recipientSecret: transferResult?.recipientSecret || null,
          newCommitment: transferResult?.newCommitment || null,
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
    transfer,
    reset,
  };
}
