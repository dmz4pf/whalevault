"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPools } from "@/lib/api";
import type { PoolInfo } from "@/types/api";

export function usePools() {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPools();
      setPools(data.pools);
    } catch {
      console.warn("[Pools] Failed to fetch pool data");
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
