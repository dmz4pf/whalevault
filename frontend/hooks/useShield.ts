"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { prepareShield } from "@/lib/api";
import {
  deserializeInstruction,
  buildTransaction,
  signAndSend,
} from "@/lib/transaction";
import { waitForTransactionConfirmation } from "@/lib/verification";
import { usePositionsStore } from "@/stores/positions";
import { useTransactionsStore } from "@/stores/transactions";
import { generateNonce, deriveShieldSecret } from "@/lib/secret-derivation";
import { computeCommitment } from "@/lib/commitment";
import type { Position, Transaction } from "@/types";

export type ShieldStatus =
  | "idle"
  | "deriving"    // Deriving secret from wallet signature
  | "preparing"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export interface ShieldState {
  status: ShieldStatus;
  error: string | null;
  txSignature: string | null;
}

export interface UseShieldReturn extends ShieldState {
  shield: (amount: number, denomination?: number | null, delayMs?: number | null) => Promise<void>;
  reset: () => void;
}

export function useShield(): UseShieldReturn {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { addPosition } = usePositionsStore();
  const { addTransaction } = useTransactionsStore();
  const { publicKey, signTransaction } = wallet;

  const [state, setState] = useState<ShieldState>({
    status: "idle",
    error: null,
    txSignature: null,
  });

  const reset = useCallback(() => {
    setState({ status: "idle", error: null, txSignature: null });
  }, []);

  const shield = useCallback(
    async (amount: number, denomination?: number | null, delayMs?: number | null) => {
      if (!publicKey) {
        setState({
          status: "error",
          error: "Wallet not connected",
          txSignature: null,
        });
        return;
      }

      if (!signTransaction) {
        setState({
          status: "error",
          error: "Wallet does not support signing",
          txSignature: null,
        });
        return;
      }

      try {
        // Step 1: Generate nonce and derive secret from wallet signature
        setState({ status: "deriving", error: null, txSignature: null });
        console.log("[Shield] Starting shield flow for amount:", amount);

        const nonce = generateNonce();
        console.log("[Shield] Generated nonce:", nonce);

        // This prompts user to sign a message
        const secret = await deriveShieldSecret(wallet, nonce);
        console.log("[Shield] Secret derived from wallet signature");

        // Step 2: Compute commitment using the derived secret
        setState((prev) => ({ ...prev, status: "preparing" }));
        console.log("[Shield] Computing commitment...");

        const commitment = await computeCommitment(amount, secret);
        console.log("[Shield] Commitment computed:", commitment);

        // Step 3: Call backend with pre-computed commitment
        const depositor = publicKey.toBase58();
        console.log("[Shield] Depositor:", depositor);

        const response = await prepareShield(amount, depositor, commitment, denomination);
        console.log("[Shield] API response:", {
          commitment: response.commitment,
          blockhash: response.blockhash,
          instructionKeys: response.instruction.keys.length,
          dataLength: response.instruction.data.length,
        });

        // Step 4: Build transaction from serialized instruction
        const instruction = deserializeInstruction(response.instruction);
        console.log("[Shield] Deserialized instruction:", {
          programId: instruction.programId.toBase58(),
          keysCount: instruction.keys.length,
          dataLength: instruction.data.length,
        });

        const transaction = buildTransaction(
          [instruction],
          response.blockhash,
          publicKey
        );
        console.log("[Shield] Transaction built with blockhash:", response.blockhash);

        // Step 5: Save position BEFORE sending transaction (critical for recovery)
        // If transaction succeeds but app crashes, we still have the nonce
        const position: Position = {
          id: response.commitment,
          token: "SOL",
          amount: amount,
          shieldedAmount: amount,
          timestamp: Date.now(),
          status: "pending",  // Will update to "shielded" after confirmation
          commitment: response.commitment,
          nonce: nonce,  // Critical: needed to re-derive secret during unshield
          denomination: denomination ?? null,
          delayUntil: delayMs ? new Date(Date.now() + delayMs).toISOString() : null,
        };
        addPosition(position);
        console.log("[Shield] Position saved with status 'pending' (recovery-safe)");

        // Step 6: Sign and send transaction
        setState((prev) => ({ ...prev, status: "signing" }));
        console.log("[Shield] Requesting wallet signature for transaction...");

        let signature: string;
        try {
          signature = await signAndSend(transaction, wallet, connection);
          console.log("[Shield] Transaction sent, signature:", signature);
        } catch (sendError) {
          // Transaction failed to send - remove pending position
          usePositionsStore.getState().removePosition(response.commitment);
          throw sendError;
        }

        // Step 7: Wait for on-chain confirmation
        setState((prev) => ({ ...prev, status: "confirming" }));
        console.log("[Shield] Waiting for transaction confirmation...");

        const confirmed = await waitForTransactionConfirmation(signature, 30, 1000);
        if (!confirmed) {
          // Transaction may have failed - mark position as failed (don't delete, user can retry)
          usePositionsStore.getState().updatePosition(response.commitment, { status: "failed" });
          throw new Error(
            "Transaction was not confirmed on-chain. Please check your wallet and try again."
          );
        }
        console.log("[Shield] Transaction confirmed on-chain");

        // Step 8: Update position status to shielded
        usePositionsStore.getState().updatePosition(response.commitment, { status: "shielded" });

        // Create transaction record
        const txRecord: Transaction = {
          id: signature,
          type: "shield",
          token: "SOL",
          amount: amount,
          timestamp: Date.now(),
          txHash: signature,
          status: "confirmed",
        };
        addTransaction(txRecord);

        setState({ status: "success", error: null, txSignature: signature });
      } catch (error) {
        console.error("[Shield] Error:", error);
        const message =
          error instanceof Error ? error.message : "Shield failed";
        setState({ status: "error", error: message, txSignature: null });
      }
    },
    [publicKey, signTransaction, connection, wallet, addPosition, addTransaction]
  );

  return {
    ...state,
    shield,
    reset,
  };
}
