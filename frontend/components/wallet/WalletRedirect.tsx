"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";

/**
 * Handles wallet connection/disconnection redirects:
 * - On connect: redirects to /dashboard (if on landing page)
 * - On disconnect: redirects to /landing
 */
export function WalletRedirect() {
  const { connected } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const wasConnected = useRef(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Skip first render to avoid redirect on page load
    if (!isInitialized.current) {
      isInitialized.current = true;
      wasConnected.current = connected;
      return;
    }

    // Wallet just connected - redirect to dashboard if on landing
    if (connected && !wasConnected.current) {
      if (pathname === "/" || pathname === "/landing") {
        router.push("/dashboard");
      }
    }

    // Wallet just disconnected - redirect to landing
    if (!connected && wasConnected.current) {
      router.push("/landing");
    }

    wasConnected.current = connected;
  }, [connected, router, pathname]);

  return null;
}
