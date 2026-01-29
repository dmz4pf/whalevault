"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { usePositionsStore } from "@/stores/positions";
import { usePools } from "@/hooks/usePools";
import { getPoolStatus } from "@/lib/api";
import { formatAmount } from "@/lib/utils";
import { LAMPORTS_PER_SOL, FIXED_DENOMINATIONS } from "@/lib/constants";
import Link from "next/link";
import type { PoolStatusResponse } from "@/types/api";
import { getPrivacyLevel } from "@/components/shield/AnonymityBadge";
import { PageHeader } from "@/components/ui/PageHeader";

function formatRelativeTime(timestamp: number | string): string {
  const time = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  const seconds = Math.floor((Date.now() - time) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(time).toLocaleDateString();
}

function getDenominationLabel(denomination?: number | null): string {
  if (!denomination) return "Custom";
  const denom = FIXED_DENOMINATIONS.find((d) => d.value === denomination);
  return denom ? denom.label : "Custom";
}

interface PrivacyRingProps {
  score: number;
}

function PrivacyRing({ score }: PrivacyRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepValue = score / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setAnimatedScore(score);
        clearInterval(interval);
      } else {
        setAnimatedScore(Math.floor(currentStep * stepValue));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [score]);

  const degrees = (animatedScore / 100) * 360;

  return (
    <div className="relative w-[140px] h-[140px]">
      <div
        className="w-[140px] h-[140px] rounded-full flex items-center justify-center transition-shadow duration-300"
        style={{
          background: `conic-gradient(
            var(--terminal-green) 0deg,
            var(--terminal-green) ${degrees}deg,
            var(--border) ${degrees}deg,
            var(--border) 360deg
          )`,
          boxShadow: "0 0 50px rgba(0, 160, 136, 0.25), 0 0 100px rgba(0, 160, 136, 0.1)",
        }}
      >
        <div className="w-[110px] h-[110px] rounded-full bg-bg-card flex flex-col items-center justify-center">
          <div
            className="font-heading text-[32px] font-medium text-terminal-green"
            style={{ textShadow: "0 0 20px rgba(0, 160, 136, 0.5)" }}
          >
            {animatedScore}%
          </div>
          <div className="text-[12px] text-text-muted tracking-wider font-mono">
            PRIVACY
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { connected, balance } = useWallet();
  const { positions, syncing, lastSynced, walletHash } = usePositionsStore();
  const { pools, loading: poolsLoading } = usePools();
  const [poolStatus, setPoolStatus] = useState<PoolStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockNumber, setBlockNumber] = useState(234891026);

  // Increment block number every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNumber((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const shieldedPositions = positions.filter((p) => p.status === "shielded");
  const shieldedBalance = shieldedPositions.reduce(
    (sum, p) => sum + p.shieldedAmount,
    0
  );

  const formatSOL = (lamports: number) =>
    (lamports / LAMPORTS_PER_SOL).toFixed(4);

  // Calculate privacy score (shielded ratio)
  const totalBalance = balance;
  const privacyScore = totalBalance > 0
    ? Math.round((shieldedBalance / (totalBalance * LAMPORTS_PER_SOL)) * 100)
    : 0;

  // ASCII Progress Bar
  const progressBarLength = 24;
  const filledBlocks = Math.min(progressBarLength, Math.max(0, Math.round((privacyScore / 100) * progressBarLength)));
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(progressBarLength - filledBlocks);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-xl bg-terminal-dark/30 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-terminal-green">{">"}_</span>
          </div>
          <h1 className="font-heading text-2xl text-white mb-2">
            {">"} connect_wallet
          </h1>
          <p className="text-text-dim mb-6 font-mono">
            Connect your wallet to view your shielded positions
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-[35px]">
      {/* Header Row */}
      <PageHeader
        title="Dashboard"
        subtitle="Your private portfolio overview"
        rightContent={
          <div className="flex items-center gap-4 text-sm font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
              <span className="text-text-dim">Devnet</span>
            </div>
            <span className="text-terminal-green animate-cursor-blink text-lg font-bold">|</span>
            <span className="text-text-dim">
              Block {blockNumber.toLocaleString()}
            </span>
          </div>
        }
      />

      {/* Two Column Layout */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 380px" }}>
        {/* Left Column */}
        <div className="space-y-6">
          {/* Account Status */}
          <div>
            <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-5">
              // ACCOUNT_STATUS
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[rgba(0,160,136,0.06)] border border-[rgba(0,160,136,0.15)] rounded-2xl p-10"
            >
              <div className="flex items-start gap-12">
                <div className="pl-2">
                  <PrivacyRing score={privacyScore} />
                </div>
                <div className="flex-1 pr-4">
                  <div className="space-y-0">
                    <div className="flex justify-between py-3 border-b border-dotted border-border text-sm font-mono">
                      <span className="text-text-dim">
                        <span className="text-terminal-green">{">"}</span> wallet_balance
                      </span>
                      <span className="text-white">{formatAmount(balance, 4)} SOL</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-dotted border-border text-sm font-mono">
                      <span className="text-text-dim">
                        <span className="text-terminal-green">{">"}</span> shielded_balance
                      </span>
                      <span className="text-terminal-green" style={{ textShadow: "0 0 10px rgba(0, 160, 136, 0.5)" }}>
                        {formatSOL(shieldedBalance)} SOL
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-dotted border-border text-sm font-mono">
                      <span className="text-text-dim">
                        <span className="text-terminal-green">{">"}</span> active_positions
                      </span>
                      <span className="text-white">{shieldedPositions.length}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-dotted border-border text-sm font-mono">
                      <span className="text-text-dim">
                        <span className="text-terminal-green">{">"}</span> shielded_ratio
                      </span>
                      <span className="text-white">{privacyScore}%</span>
                    </div>
                    <div className="py-2 text-sm font-mono text-text-dim">
                      [<span className="text-terminal-green">{progressBar.slice(0, filledBlocks)}</span><span className="opacity-30">{progressBar.slice(filledBlocks)}</span>] {privacyScore}%
                    </div>
                    <div className="flex justify-between py-3 text-sm font-mono">
                      <span className="text-text-dim">
                        <span className="text-terminal-green">{">"}</span> anonymity_set
                      </span>
                      <span className="text-terminal-green" style={{ textShadow: "0 0 10px rgba(0, 160, 136, 0.5)" }}>
                        {poolStatus?.anonymitySetSize || 0} deposits
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Privacy Pools */}
          <div>
            <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-5">
              // PRIVACY_POOLS
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[rgba(0,160,136,0.06)] border border-[rgba(0,160,136,0.15)] rounded-2xl overflow-hidden"
            >
              {poolsLoading ? (
                <div className="p-6 space-y-4">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : pools.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-text-muted font-normal uppercase tracking-wider px-5 py-3.5">POOL</th>
                      <th className="text-left text-xs text-text-muted font-normal uppercase tracking-wider px-5 py-3.5">DEPOSITS</th>
                      <th className="text-left text-xs text-text-muted font-normal uppercase tracking-wider px-5 py-3.5">TVL</th>
                      <th className="text-left text-xs text-text-muted font-normal uppercase tracking-wider px-5 py-3.5">PRIVACY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pools.map((pool) => {
                      const privacy = getPrivacyLevel(pool.depositCount);
                      return (
                        <tr
                          key={pool.denomination}
                          className="border-b border-border/20 hover:bg-terminal-green/[0.02] transition-colors"
                        >
                          <td className="px-5 py-5">
                            <span className="font-heading text-base font-medium text-white">
                              {pool.label}
                            </span>
                          </td>
                          <td className="px-5 py-5 text-sm font-mono text-white">
                            {pool.depositCount}
                          </td>
                          <td className="px-5 py-5 text-sm font-mono text-text-dim">
                            {formatSOL(pool.totalValueLocked)} SOL
                          </td>
                          <td className="px-5 py-5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded ${
                                privacy.label === "Strong" || privacy.label === "Good"
                                  ? "bg-terminal-green/10 text-terminal-green"
                                  : privacy.label === "Moderate"
                                  ? "bg-yellow-500/10 text-yellow-500"
                                  : "bg-red-400/10 text-red-400"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
                              {privacy.label.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-text-dim font-mono">
                  No pools available
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Commands */}
          <div>
            <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-5">
              // QUICK_COMMANDS
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="relative rounded-2xl border border-border overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(0,160,136,0.03) 0%, rgba(0,0,0,0.4) 100%)",
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(0,160,136,0.3) 50%, transparent 100%)",
                }}
              />
              <div className="p-6 space-y-4">
                <Link href="/shield">
                  <div className="bg-[rgba(255,255,255,0.03)] border border-border/50 rounded-xl px-5 py-4 hover:border-terminal-green/50 hover:bg-[rgba(0,160,136,0.05)] transition-all cursor-pointer">
                    <span className="text-terminal-green font-mono text-sm">$</span>
                    <span className="text-text-dim font-mono text-sm ml-2">shield --amount</span>
                  </div>
                </Link>
                <Link href="/unshield">
                  <div className="bg-[rgba(255,255,255,0.03)] border border-border/50 rounded-xl px-5 py-4 hover:border-terminal-green/50 hover:bg-[rgba(0,160,136,0.05)] transition-all cursor-pointer">
                    <span className="text-terminal-green font-mono text-sm">$</span>
                    <span className="text-text-dim font-mono text-sm ml-2">withdraw --stealth</span>
                  </div>
                </Link>
                <Link href="/private-swap">
                  <div className="bg-[rgba(255,255,255,0.03)] border border-border/50 rounded-xl px-5 py-4 hover:border-terminal-green/50 hover:bg-[rgba(0,160,136,0.05)] transition-all cursor-pointer">
                    <span className="text-terminal-green font-mono text-sm">$</span>
                    <span className="text-text-dim font-mono text-sm ml-2">swap --private</span>
                  </div>
                </Link>
                <Link href="/history">
                  <div className="bg-[rgba(255,255,255,0.03)] border border-border/50 rounded-xl px-5 py-4 hover:border-terminal-green/50 hover:bg-[rgba(0,160,136,0.05)] transition-all cursor-pointer">
                    <span className="text-terminal-green font-mono text-sm">$</span>
                    <span className="text-text-dim font-mono text-sm ml-2">history --all</span>
                  </div>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Your Positions */}
          <div>
            <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-5">
              // YOUR_POSITIONS
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-[rgba(0,160,136,0.06)] border border-[rgba(0,160,136,0.15)] rounded-2xl p-8"
            >
              {shieldedPositions.length > 0 ? (
                <div className="space-y-2">
                  {shieldedPositions.slice(0, 3).map((position) => (
                    <div
                      key={position.id}
                      className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl hover:bg-terminal-green/[0.03] transition-all"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-lg bg-terminal-green/10 flex items-center justify-center text-terminal-green text-sm">
                          ◎
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">SOL</div>
                          <div className="text-text-dim text-xs font-mono">
                            {getDenominationLabel(position.denomination)} Pool
                          </div>
                        </div>
                      </div>
                      <div className="font-heading text-base text-terminal-green">
                        {formatSOL(position.shieldedAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-text-dim font-mono py-8 text-sm">
                  No positions yet
                </div>
              )}
            </motion.div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-5">
              // RECENT_ACTIVITY
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[rgba(0,160,136,0.08)] border border-[rgba(0,160,136,0.2)] rounded-2xl p-8"
            >
              <div className="space-y-0">
                {shieldedPositions.slice(0, 4).map((position, index) => (
                  <div
                    key={position.id}
                    className="flex items-center gap-3.5 py-3.5 border-b border-border last:border-0 text-[13px]"
                  >
                    <div className="w-2 h-2 rounded-full bg-terminal-green flex-shrink-0" />
                    <div className="flex-1 text-text-dim">Shielded</div>
                    <div className="text-terminal-green font-heading">
                      {formatSOL(position.shieldedAmount)} SOL
                    </div>
                    <div className="text-text-muted text-[13px]">
                      {formatRelativeTime(position.timestamp)}
                    </div>
                  </div>
                ))}
                {shieldedPositions.length === 0 && (
                  <div className="text-center text-text-dim font-mono py-6 text-sm">
                    No activity yet
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton Components
function SkeletonCard() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-6 animate-pulse">
      <div className="h-3 w-24 bg-border rounded mb-4" />
      <div className="h-8 w-32 bg-border rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between animate-pulse">
      <div className="h-4 w-20 bg-border rounded" />
      <div className="h-4 w-16 bg-border rounded" />
      <div className="h-4 w-24 bg-border rounded" />
      <div className="h-5 w-16 bg-border rounded" />
    </div>
  );
}

function SkeletonPosition() {
  return (
    <div className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-border" />
        <div className="space-y-2">
          <div className="h-4 w-20 bg-border rounded" />
          <div className="h-3 w-24 bg-border rounded" />
        </div>
      </div>
      <div className="h-5 w-16 bg-border rounded" />
    </div>
  );
}
