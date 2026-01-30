"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SOLANA_NETWORK } from "@/lib/constants";
import { getFeaturedTokens, SOL_MINT } from "@/lib/tokens";
import { getSwapTokens, getSwapTokensDevnet } from "@/lib/api";
import type { FeaturedToken } from "@/lib/tokens";

const DEBOUNCE_MS = 300;

// Module-level cache to persist tokens across component mounts
let cachedTokens: FeaturedToken[] | null = null;
let fetchPromise: Promise<FeaturedToken[]> | null = null;

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
  const [allTokens, setAllTokens] = useState<FeaturedToken[]>(cachedTokens ?? featured);
  const [loading, setLoading] = useState(!cachedTokens);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load full token list on mount (with caching)
  useEffect(() => {
    // If we already have cached tokens, use them immediately
    if (cachedTokens) {
      setAllTokens(cachedTokens);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTokens() {
      setLoading(true);
      try {
        // Reuse existing fetch promise if one is in progress
        if (!fetchPromise) {
          fetchPromise = (async () => {
            const apiTokens = SOLANA_NETWORK === "devnet"
              ? await getSwapTokensDevnet()
              : await getSwapTokens();

            return apiTokens
              .filter((t) => t.address !== SOL_MINT)
              .map((t) => ({
                symbol: t.symbol,
                name: t.name,
                mint: t.address,
                decimals: t.decimals,
                logoUri: t.logoUri ?? undefined,
              }));
          })();
        }

        const tokens = await fetchPromise;

        // Cache the result
        if (tokens.length > 0) {
          cachedTokens = tokens;
        }

        if (!cancelled) setAllTokens(tokens.length > 0 ? tokens : featured);
      } catch (err) {
        console.error("[useTokenList] Failed to fetch tokens:", err);
        if (!cancelled) setAllTokens(featured);
      } finally {
        fetchPromise = null;
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
