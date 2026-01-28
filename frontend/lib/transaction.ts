import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import type { SerializedInstruction } from "@/types/api";

/**
 * Error thrown when transaction operations fail
 */
export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "TransactionError";
  }
}

/**
 * Deserialize a base64-encoded instruction from the backend
 */
export function deserializeInstruction(
  serialized: SerializedInstruction
): TransactionInstruction {
  const dataBuffer = Buffer.from(serialized.data, "base64");

  return new TransactionInstruction({
    programId: new PublicKey(serialized.programId),
    keys: serialized.keys.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: dataBuffer,
  });
}

/**
 * Build a transaction from instructions with blockhash and fee payer
 */
export function buildTransaction(
  instructions: TransactionInstruction[],
  blockhash: string,
  payer: PublicKey
): Transaction {
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;

  for (const ix of instructions) {
    tx.add(ix);
  }

  return tx;
}

export interface SignAndSendOptions {
  maxRetries?: number;
  commitment?: Commitment;
}

/**
 * Sign and send a transaction with exponential backoff retry logic
 */
export async function signAndSend(
  transaction: Transaction,
  wallet: WalletContextState,
  connection: Connection,
  options?: SignAndSendOptions
): Promise<string> {
  const { maxRetries = 3, commitment = "confirmed" } = options ?? {};

  if (!wallet.signTransaction) {
    throw new TransactionError("Wallet does not support signing");
  }

  console.log("[Transaction] Requesting wallet signature...");
  const signedTx = await wallet.signTransaction(transaction);
  console.log("[Transaction] Transaction signed, serializing...");
  const rawTx = signedTx.serialize();
  console.log("[Transaction] Serialized transaction size:", rawTx.length, "bytes");

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Transaction] Attempt ${attempt}/${maxRetries}: Sending transaction...`);
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: commitment,
      });
      console.log("[Transaction] Transaction sent, signature:", signature);

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash(commitment);
      console.log("[Transaction] Confirming with blockhash:", blockhash);

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        commitment
      );
      console.log("[Transaction] Transaction confirmed!");

      return signature;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Transaction] Attempt ${attempt} failed:`, lastError.message);

      // Log full error details for debugging
      if (error && typeof error === "object" && "logs" in error) {
        console.error("[Transaction] Program logs:", (error as { logs: string[] }).logs);
      }

      // Don't retry user rejections
      if (lastError.message.includes("User rejected")) {
        throw new TransactionError("User rejected the transaction", lastError);
      }

      // "Already processed" means transaction succeeded - extract signature and verify
      if (lastError.message.includes("already been processed")) {
        console.log("[Transaction] Transaction may have already succeeded, checking on-chain...");
        // The transaction was processed - try to get the signature from the signed tx
        try {
          const signature = bs58.encode(signedTx.signature!);
          const status = await connection.getSignatureStatus(signature);
          if (status.value?.confirmationStatus) {
            console.log("[Transaction] Transaction confirmed on-chain:", signature);
            return signature;
          }
        } catch {
          // If we can't verify, continue with error
        }
      }

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Transaction] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error("[Transaction] All attempts exhausted. Last error:", lastError);
  throw new TransactionError(
    `Transaction failed after ${maxRetries} attempts`,
    lastError ?? undefined
  );
}

/**
 * Create a connection for the given RPC endpoint
 */
export function getConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, "confirmed");
}
