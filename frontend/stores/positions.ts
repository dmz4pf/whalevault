import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Position, PositionsState } from "@/types";
import {
  signEncryptionMessage,
  deriveEncryptionKey,
  walletHash as computeWalletHash,
  encrypt,
  decrypt,
  clearCachedSignature,
} from "@/lib/encryption";
import { supabase } from "@/lib/supabase";

interface PositionsStore extends PositionsState {
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  removePosition: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  encryptionKey: CryptoKey | null;
  walletHash: string | null;

  _hydrated: boolean;

  initCloudSync: (
    signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
    publicKey: string
  ) => Promise<void>;
  syncToCloud: () => Promise<void>;
  clearCloudState: () => void;
}

const initialState: PositionsState = {
  positions: [],
  loading: false,
  error: null,
  syncing: false,
  lastSynced: null,
};

function mergePositions(
  local: Position[],
  cloud: Position[]
): Position[] {
  const map = new Map<string, Position>();

  for (const p of cloud) {
    map.set(p.commitment, p);
  }

  for (const p of local) {
    const existing = map.get(p.commitment);
    if (!existing || p.timestamp > existing.timestamp) {
      map.set(p.commitment, p);
    }
  }

  return Array.from(map.values());
}

export const usePositionsStore = create<PositionsStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      encryptionKey: null,
      walletHash: null,
      _hydrated: false,

      setPositions: (positions) => set({ positions, error: null }),

      addPosition: (position) => {
        set((state) => ({
          positions: [...state.positions, position],
        }));
        get().syncToCloud();
      },

      updatePosition: (id, updates) => {
        set((state) => ({
          positions: state.positions.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
        get().syncToCloud();
      },

      removePosition: (id) =>
        set((state) => ({
          positions: state.positions.filter((p) => p.id !== id),
        })),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),

      initCloudSync: async (signMessage, publicKey) => {
        set({ syncing: true });
        try {
          const signature = await signEncryptionMessage(signMessage, publicKey);
          const key = await deriveEncryptionKey(signature);
          const hash = await computeWalletHash(publicKey);

          set({ encryptionKey: key, walletHash: hash });

          let cloudPositions: Position[] = [];
          const { data, error: fetchError } = supabase
            ? await supabase
                .from("vault_data")
                .select("encrypted_data, nonce")
                .eq("wallet_hash", hash)
                .single()
            : { data: null, error: null };

          // PGRST116 = no rows found (first-time user, not an error)
          if (fetchError && fetchError.code !== "PGRST116") {
            console.warn("[WhaleVault] Supabase fetch error:", fetchError);
          }

          if (data?.encrypted_data && data?.nonce) {
            const plaintext = await decrypt(
              data.encrypted_data,
              data.nonce,
              key
            );
            cloudPositions = JSON.parse(plaintext) as Position[];
          }

          const localPositions = get().positions;
          const merged = mergePositions(localPositions, cloudPositions);
          const hasNewLocal = merged.length !== cloudPositions.length ||
            localPositions.some(
              (lp) => !cloudPositions.find((cp) => cp.commitment === lp.commitment)
            );

          set({
            positions: merged,
            syncing: false,
            lastSynced: new Date().toISOString(),
          });

          if (hasNewLocal) {
            get().syncToCloud();
          }
        } catch (error) {
          console.warn("[WhaleVault] Cloud sync init failed, using local:", error);
          set({ syncing: false });
        }
      },

      syncToCloud: async () => {
        const { encryptionKey, walletHash: hash, positions } = get();
        if (!encryptionKey || !hash) return;

        set({ syncing: true });
        try {
          const plaintext = JSON.stringify(positions);
          const { ciphertext, nonce } = await encrypt(plaintext, encryptionKey);

          if (!supabase) return;

          await supabase.from("vault_data").upsert(
            {
              wallet_hash: hash,
              encrypted_data: ciphertext,
              nonce,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "wallet_hash" }
          );

          set({ syncing: false, lastSynced: new Date().toISOString() });
        } catch (error) {
          console.warn("[WhaleVault] Cloud sync failed:", error);
          set({ syncing: false });
        }
      },

      clearCloudState: () => {
        set({ encryptionKey: null, walletHash: null });
        clearCachedSignature();
      },
    }),
    {
      name: "whalevault-positions",
      partialize: (state) => ({
        positions: state.positions,
        lastSynced: state.lastSynced,
      }),
      onRehydrateStorage: () => () => {
        usePositionsStore.setState({ _hydrated: true });
      },
    }
  )
);
