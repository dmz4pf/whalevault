"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPools } from "@/lib/api";
import type { PoolInfo } from "@/types/api";

const USE_MOCK_POOLS = process.env.NEXT_PUBLIC_MOCK_POOLS === "true";

const MOCK_POOLS: PoolInfo[] = [
  { denomination: 1_000_000_000, label: "1 SOL", name: "small", depositCount: 47, totalValueLocked: 47_000_000_000 },
  { denomination: 10_000_000_000, label: "10 SOL", name: "medium", depositCount: 32, totalValueLocked: 320_000_000_000 },
  { denomination: 100_000_000_000, label: "100 SOL", name: "large", depositCount: 12, totalValueLocked: 1_200_000_000_000 },
  { denomination: 1_000_000_000_000, label: "1K SOL", name: "whale", depositCount: 5, totalValueLocked: 5_000_000_000_000 },
  { denomination: 10_000_000_000_000, label: "10K SOL", name: "mega", depositCount: 2, totalValueLocked: 20_000_000_000_000 },
  { denomination: 0, label: "Custom", name: "custom", depositCount: 8, totalValueLocked: 15_000_000_000 },
];

export function usePools() {
  const [pools, setPools] = useState<PoolInfo[]>(MOCK_POOLS);
  const [loading, setLoading] = useState(!USE_MOCK_POOLS);

  const refresh = useCallback(async () => {
    if (USE_MOCK_POOLS) return;
    try {
      const data = await fetchPools();
      // Use API data if available, otherwise keep mock data
      if (data.pools && data.pools.length > 0) {
        setPools(data.pools);
      }
    } catch {
      console.warn("[Pools] Failed to fetch pool data, using mock data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getPoolByDenomination = useCallback(
    (denomination: number) => pools.find((p) => p.denomination === denomination),
    [pools]
  );

  return { pools, loading, refresh, getPoolByDenomination };
}
