/**
 * Deposit Receipt Export/Import for WhaleVault V3.
 *
 * Enables users to export shielded positions as an encrypted JSON file
 * and import them on another device using the same wallet.
 */

import { encrypt, decrypt } from "./encryption";
import type { Position } from "@/types";

interface ReceiptFile {
  version: 1;
  encrypted_data: string;
  nonce: string;
  exported_at: string;
}

// ---------------------------------------------------------------------------
// Required fields for position validation on import
// ---------------------------------------------------------------------------

const REQUIRED_POSITION_FIELDS: (keyof Position)[] = [
  "id",
  "token",
  "amount",
  "shieldedAmount",
  "timestamp",
  "status",
  "commitment",
];

function isValidPosition(p: unknown): p is Position {
  if (typeof p !== "object" || p === null) return false;
  const obj = p as Record<string, unknown>;
  return REQUIRED_POSITION_FIELDS.every(
    (field) => obj[field] !== undefined && obj[field] !== null
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export positions as an encrypted receipt file.
 * Returns a Blob suitable for browser download.
 */
export async function exportReceipt(
  positions: Position[],
  encryptionKey: CryptoKey
): Promise<Blob> {
  const plaintext = JSON.stringify(positions);
  const { ciphertext, nonce } = await encrypt(plaintext, encryptionKey);

  const receipt: ReceiptFile = {
    version: 1,
    encrypted_data: ciphertext,
    nonce,
    exported_at: new Date().toISOString(),
  };

  return new Blob([JSON.stringify(receipt, null, 2)], {
    type: "application/json",
  });
}

/**
 * Trigger browser download of a receipt blob.
 */
export function downloadReceipt(blob: Blob): void {
  const date = new Date().toISOString().split("T")[0];
  const filename = `whalevault-backup-${date}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import positions from an encrypted receipt file.
 * Throws if decryption fails (wrong wallet) or file is invalid.
 */
export async function importReceipt(
  file: File,
  encryptionKey: CryptoKey
): Promise<Position[]> {
  const text = await file.text();

  let receipt: ReceiptFile;
  try {
    receipt = JSON.parse(text);
  } catch {
    throw new Error("Invalid receipt file format");
  }

  if (receipt.version !== 1) {
    throw new Error(`Unsupported receipt version: ${receipt.version}`);
  }

  if (!receipt.encrypted_data || !receipt.nonce) {
    throw new Error("Receipt file is missing required fields");
  }

  const plaintext = await decrypt(
    receipt.encrypted_data,
    receipt.nonce,
    encryptionKey
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("Decrypted data is not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Decrypted data is not an array of positions");
  }

  for (const item of parsed) {
    if (!isValidPosition(item)) {
      throw new Error("Invalid position data in receipt");
    }
  }

  return parsed as Position[];
}
