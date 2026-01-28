"use client";

import { useCallback, useEffect } from "react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletStore } from "@/stores/wallet";
import { usePositionsStore } from "@/stores/positions";
import { LAMPORTS_PER_SOL } from "@/lib/constants";

export function useWallet() {
  const { connection } = useConnection();
  const {
    publicKey,
    connected,
    connecting,
    disconnect: walletDisconnect,
    signMessage,
    select,
    wallets,
  } = useSolanaWallet();

  const {
    balance,
    setConnected,
    setPublicKey,
    setBalance,
    setConnecting,
    disconnect: storeDisconnect,
  } = useWalletStore();

  useEffect(() => {
    setConnected(connected);
    setPublicKey(publicKey?.toBase58() ?? null);
    setConnecting(connecting);
  }, [connected, publicKey, connecting, setConnected, setPublicKey, setConnecting]);

  useEffect(() => {
    if (!publicKey || !connection) {
      setBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance(0);
      }
    };

    fetchBalance();

    const subscriptionId = connection.onAccountChange(publicKey, (account) => {
      setBalance(account.lamports / LAMPORTS_PER_SOL);
    });

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [publicKey, connection, setBalance]);

  // Cloud sync — deferred to avoid interfering with wallet adapter init.
  // Fires once per session after wallet is fully connected and settled.
  useEffect(() => {
    if (!connected || !publicKey || !signMessage) return;

    // Check if already synced this session
    const store = usePositionsStore.getState();
    if (store.encryptionKey) return;

    // Wait for adapter to fully settle before touching signMessage
    const timeout = setTimeout(() => {
      console.log("[WhaleVault] Starting cloud sync...");
      usePositionsStore
        .getState()
        .initCloudSync(signMessage, publicKey.toBase58())
        .then(() => console.log("[WhaleVault] Cloud sync complete"))
        .catch((err) => console.warn("[WhaleVault] Cloud sync failed:", err));
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  const disconnect = useCallback(async () => {
    try {
      await walletDisconnect();
      storeDisconnect();
      usePositionsStore.getState().clearCloudState();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }, [walletDisconnect, storeDisconnect]);

  return {
    connected,
    connecting,
    publicKey: publicKey?.toBase58() ?? null,
    balance,
    wallets,
    select,
    disconnect,
  };
}
