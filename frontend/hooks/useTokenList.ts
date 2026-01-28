"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SOLANA_NETWORK } from "@/lib/constants";
import { getFeaturedTokens, SOL_MINT } from "@/lib/tokens";
import { getSwapTokens } from "@/lib/api";
import type { FeaturedToken } from "@/lib/tokens";

const RAYDIUM_DEVNET_API = "https://api-v3-devnet.raydium.io";
const DEBOUNCE_MS = 300;

interface RaydiumPoolToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

interface UseTokenListReturn {
  tokens: FeaturedToken[];
  featuredTokens: FeaturedToken[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

/**
 * Fetches and filters available swap output tokens.
 * - Devnet: Searches Raydium pools paired with SOL
 * - Mainnet: Uses backend /swap/tokens endpoint
 *
 * Excludes SOL from output since we're always swapping FROM SOL.
 */
export function useTokenList(): UseTokenListReturn {
  const featured = useMemo(() => getFeaturedTokens(SOLANA_NETWORK), []);
  const [allTokens, setAllTokens] = useState<FeaturedToken[]>(featured);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load full token list on mount
  useEffect(() => {
    let cancelled = false;

    async function loadTokens() {
      setLoading(true);
      try {
        if (SOLANA_NETWORK === "devnet") {
          // Fetch tokens that have SOL pools on devnet
          const res = await fetch(
            `${RAYDIUM_DEVNET_API}/pools/info/mint?mint1=${SOL_MINT}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=50&page=1`
          );
          const data = await res.json();
          const pools = data?.data?.data ?? [];

          const seen = new Set<string>();
          const tokens: FeaturedToken[] = [];

          for (const pool of pools) {
            const other: RaydiumPoolToken =
              pool.mintA.address === SOL_MINT ? pool.mintB : pool.mintA;

            if (seen.has(other.address) || other.address === SOL_MINT) continue;
            if (!other.symbol) continue;
            seen.add(other.address);

            tokens.push({
              symbol: other.symbol,
              name: other.name,
              mint: other.address,
              decimals: other.decimals,
              logoUri: other.logoURI || undefined,
            });
          }

          if (!cancelled) setAllTokens(tokens.length > 0 ? tokens : featured);
        } else {
          // Mainnet: use backend token list
          const tokens = await getSwapTokens();
          if (!cancelled) {
            setAllTokens(
              tokens
                .filter((t) => t.address !== SOL_MINT)
                .map((t) => ({
                  symbol: t.symbol,
                  name: t.name,
                  mint: t.address,
                  decimals: t.decimals,
                  logoUri: t.logoUri ?? undefined,
                }))
            );
          }
        }
      } catch {
        // Fall back to featured tokens on error
        if (!cancelled) setAllTokens(featured);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTokens();
    return () => { cancelled = true; };
  }, [featured]);

  // Debounced search filter
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return allTokens;
    const q = debouncedQuery.toLowerCase();
    return allTokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.mint.toLowerCase().includes(q)
    );
  }, [allTokens, debouncedQuery]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
      }
    };
  }, []);

  return {
    tokens: filtered,
    featuredTokens: featured.filter((t) => t.mint !== SOL_MINT),
    loading,
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
  };
}
