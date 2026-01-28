import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { encrypt, decrypt } from "@/lib/encryption";
import type { Position } from "@/types";

export function useVaultStorage() {
  const loadFromCloud = useCallback(
    async (hash: string, key: CryptoKey): Promise<Position[] | null> => {
      if (!supabase) return null;

      const { data, error } = await supabase
        .from("vault_data")
        .select("encrypted_data, nonce, updated_at")
        .eq("wallet_hash", hash)
        .single();

      if (error || !data) return null;

      try {
        const plaintext = await decrypt(data.encrypted_data, data.nonce, key);
        return JSON.parse(plaintext) as Position[];
      } catch {
        console.error("[VaultStorage] Decryption failed");
        return null;
      }
    },
    []
  );

  const saveToCloud = useCallback(
    async (
      hash: string,
      key: CryptoKey,
      positions: Position[]
    ): Promise<void> => {
      const plaintext = JSON.stringify(positions);
      const { ciphertext, nonce } = await encrypt(plaintext, key);

      if (!supabase) throw new Error("Cloud backup not configured");

      const { error } = await supabase.from("vault_data").upsert(
        {
          wallet_hash: hash,
          encrypted_data: ciphertext,
          nonce,
        },
        { onConflict: "wallet_hash" }
      );

      if (error) {
        console.error("[VaultStorage] Save failed:", error.message);
        throw new Error("Cloud save failed");
      }
    },
    []
  );

  const mergePositions = useCallback(
    (local: Position[], cloud: Position[]): Position[] => {
      const map = new Map<string, Position>();

      for (const p of cloud) {
        map.set(p.commitment, p);
      }

      for (const p of local) {
        const existing = map.get(p.commitment);
        if (!existing || p.timestamp >= existing.timestamp) {
          map.set(p.commitment, p);
        }
      }

      return Array.from(map.values());
    },
    []
  );

  return { loadFromCloud, saveToCloud, mergePositions };
}
