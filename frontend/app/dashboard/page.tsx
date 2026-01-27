"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { usePositionsStore } from "@/stores/positions";
import { usePools } from "@/hooks/usePools";
import { getPoolStatus } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { LAMPORTS_PER_SOL, FIXED_DENOMINATIONS } from "@/lib/constants";
import Link from "next/link";
import type { PoolStatusResponse } from "@/types/api";
import { SkeletonCard, SkeletonPosition } from "@/components/ui/Skeleton";

const STORAGE_KEY = "whalevault_positions";

function getPrivacyLevel(depositCount: number) {
  if (depositCount >= 20) return { color: "text-green-400", bg: "bg-green-400", label: "Good privacy" };
  if (depositCount >= 5) return { color: "text-yellow-400", bg: "bg-yellow-400", label: "Moderate" };
  return { color: "text-red-400", bg: "bg-red-400", label: "Low privacy" };
}

function getDenominationLabel(denomination?: number | null): string {
  if (!denomination) return "Custom";
  const denom = FIXED_DENOMINATIONS.find((d) => d.value === denomination);
  return denom ? `${denom.label} Pool` : "Custom";
}

export default function DashboardPage() {
  const { connected, balance } = useWallet();
  const { positions, setPositions } = usePositionsStore();
  const { pools, loading: poolsLoading } = usePools();
  const [poolStatus, setPoolStatus] = useState<PoolStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load positions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPositions(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [setPositions]);

  // Fetch pool status
  const fetchPoolStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await getPoolStatus();
      setPoolStatus(status);
    } catch (error) {
      console.error("Failed to fetch pool status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      fetchPoolStatus();
    }
  }, [connected, fetchPoolStatus]);

  // Calculate shielded balance from positions
  const shieldedPositions = positions.filter((p) => p.status === "shielded");
  const shieldedBalance = shieldedPositions.reduce(
    (sum, p) => sum + p.shieldedAmount,
    0
  );

  const formatSOL = (lamports: number) =>
    (lamports / LAMPORTS_PER_SOL).toFixed(4);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Connect Your Wallet
          </h1>
          <p className="text-gray-400 mb-6">
            Connect your wallet to view your shielded positions
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">
          Manage your shielded positions and view your privacy-protected assets.
        </p>
      </motion.div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <Card gradient>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400">Wallet Balance</span>
                  <div className="w-10 h-10 rounded-xl bg-vault-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-vault-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatAmount(balance, 4)} SOL
                </div>
              </CardContent>
            </Card>

            <Card gradient>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400">Shielded Balance</span>
                  <div className="w-10 h-10 rounded-xl bg-whale-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-whale-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatSOL(shieldedBalance)} SOL
                </div>
              </CardContent>
            </Card>

            <Card gradient>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400">Active Positions</span>
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {shieldedPositions.length}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Pool Statistics */}
      {poolStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Total Value Locked</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchPoolStatus}
                  disabled={loading}
                >
                  {loading ? "..." : "\u21BB"}
                </Button>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatSOL(poolStatus.totalValueLocked)} SOL
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <span className="text-gray-400">Anonymity Set</span>
              <div className="text-2xl font-bold text-white mt-4">
                {poolStatus.anonymitySetSize} deposits
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Privacy Pools */}
      {pools.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Privacy Pools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pools.map((pool) => {
              const privacy = getPrivacyLevel(pool.depositCount);
              return (
                <Card key={pool.denomination}>
                  <CardContent className="p-5">
                    <div className="text-lg font-bold text-white mb-3">
                      {pool.label}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Deposits</span>
                        <span className="text-white">{pool.depositCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">TVL</span>
                        <span className="text-white">
                          {formatSOL(pool.totalValueLocked)} SOL
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Privacy</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${privacy.bg}`} />
                          <span className={`text-xs ${privacy.color}`}>
                            {privacy.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Link href="/shield">
            <Button variant="primary">Shield Assets</Button>
          </Link>
          <Link href="/unshield">
            <Button variant="secondary">Unshield Assets</Button>
          </Link>
          <Link href="/history">
            <Button variant="outline">View History</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-white">Shielded Positions</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <SkeletonPosition />
              <SkeletonPosition />
              <SkeletonPosition />
            </div>
          ) : shieldedPositions.length > 0 ? (
            <div className="space-y-3">
              {shieldedPositions.map((position) => (
                <div
                  key={position.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-whale-500/20 flex items-center justify-center">
                      <span className="text-lg font-bold text-whale-400">S</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{position.token}</span>
                        <span className="text-[10px] font-medium text-whale-400 bg-whale-500/20 px-1.5 py-0.5 rounded">
                          {getDenominationLabel(position.denomination)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(position.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">
                      {formatSOL(position.shieldedAmount)} SOL
                    </div>
                    <div className="text-sm text-green-400">Shielded</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No Shielded Positions
              </h3>
              <p className="text-gray-400 mb-6 max-w-sm">
                You haven&apos;t shielded any assets yet. Shield your first
                position to start using privacy features.
              </p>
              <Link href="/shield">
                <Button>Shield Your First Asset</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
