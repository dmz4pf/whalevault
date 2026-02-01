/**
 * Utilities for parsing and validating private transfer import data.
 */

import { FIXED_DENOMINATIONS } from "./constants";

export interface ParsedTransfer {
  secret: string;
  commitment: string;
  amount: number;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedTransfer;
  error?: string;
}

/**
 * Validates that a string is exactly 64 hexadecimal characters.
 */
export function validateHex64(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value.trim());
}

/**
 * Detects the denomination pool based on amount in lamports.
 * Returns the denomination value if it matches a fixed pool, or null for custom amounts.
 */
export function detectDenomination(amountLamports: number): number | null {
  const match = FIXED_DENOMINATIONS.find((d) => d.value === amountLamports);
  return match ? match.value : null;
}

/**
 * Gets a human-readable label for a denomination.
 */
export function getDenominationLabel(amountLamports: number): string {
  const match = FIXED_DENOMINATIONS.find((d) => d.value === amountLamports);
  return match ? match.label : "Custom";
}

/**
 * Parses the "Copy All Details" text format from private transfers.
 *
 * Expected format:
 * ```
 * WhaleVault Private Transfer
 *
 * Secret: {64 hex chars}
 * Commitment: {64 hex chars}
 * Amount: {number} lamports ({X.XXXX} SOL)
 *
 * To claim: ...
 * ```
 */
export function parseTransferDetails(text: string): ParseResult {
  if (!text || typeof text !== "string") {
    return { success: false, error: "No text provided" };
  }

  const trimmedText = text.trim();

  // Extract secret (64 hex chars after "Secret:")
  const secretMatch = trimmedText.match(/Secret:\s*([a-fA-F0-9]{64})/i);
  if (!secretMatch) {
    return {
      success: false,
      error: "Could not find valid secret (64 hex characters)",
    };
  }

  // Extract commitment (64 hex chars after "Commitment:")
  const commitmentMatch = trimmedText.match(/Commitment:\s*([a-fA-F0-9]{64})/i);
  if (!commitmentMatch) {
    return {
      success: false,
      error: "Could not find valid commitment (64 hex characters)",
    };
  }

  // Extract amount (number before "lamports")
  const amountMatch = trimmedText.match(/Amount:\s*(\d+)\s*lamports/i);
  if (!amountMatch) {
    return {
      success: false,
      error: "Could not find valid amount in lamports",
    };
  }

  const amount = parseInt(amountMatch[1], 10);
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      error: "Amount must be a positive number",
    };
  }

  return {
    success: true,
    data: {
      secret: secretMatch[1].toLowerCase(),
      commitment: commitmentMatch[1].toLowerCase(),
      amount,
    },
  };
}

/**
 * Validates individual fields for manual entry.
 */
export function validateManualEntry(
  secret: string,
  commitment: string,
  amount: string
): ParseResult {
  const trimmedSecret = secret.trim();
  const trimmedCommitment = commitment.trim();
  const trimmedAmount = amount.trim();

  if (!validateHex64(trimmedSecret)) {
    return {
      success: false,
      error: "Secret must be exactly 64 hexadecimal characters",
    };
  }

  if (!validateHex64(trimmedCommitment)) {
    return {
      success: false,
      error: "Commitment must be exactly 64 hexadecimal characters",
    };
  }

  const amountNum = parseInt(trimmedAmount, 10);
  if (isNaN(amountNum) || amountNum <= 0) {
    return {
      success: false,
      error: "Amount must be a positive number",
    };
  }

  return {
    success: true,
    data: {
      secret: trimmedSecret.toLowerCase(),
      commitment: trimmedCommitment.toLowerCase(),
      amount: amountNum,
    },
  };
}
