"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProofAnimation } from "@/components/proof/ProofAnimation";
import { useWallet } from "@/hooks/useWallet";
import { useShield } from "@/hooks/useShield";
import { usePools } from "@/hooks/usePools";
import { cn, formatAmount } from "@/lib/utils";
import { SUPPORTED_TOKENS, LAMPORTS_PER_SOL, FIXED_DENOMINATIONS, CUSTOM_AMOUNT_WARNING, type SupportedToken } from "@/lib/constants";
import type { PoolInfo } from "@/types/api";

function getPrivacyLevel(depositCount: number): { label: string; level: "strong" | "good" | "moderate" | "low" } {
  if (depositCount >= 100) return { label: "STRONG", level: "strong" };
  if (depositCount >= 50) return { label: "GOOD", level: "good" };
  if (depositCount >= 10) return { label: "MODERATE", level: "moderate" };
  return { label: "LOW", level: "low" };
}

export default function ShieldPage() {
  const router = useRouter();
  const { connected, balance } = useWallet();
  const { status, error, txSignature, shield, reset } = useShield();
  const { pools } = usePools();

  const [selectedToken, setSelectedToken] = useState<SupportedToken>(SUPPORTED_TOKENS[0]);
  const [mode, setMode] = useState<"fixed" | "custom">("fixed");
  const [denomination, setDenomination] = useState<number | null>(1_000_000_000);
  const [customAmount, setCustomAmount] = useState("");

  const isLoading = status === "preparing" || status === "signing" || status === "confirming" || status === "deriving";

  // Map shield status to progress for animation
  const getShieldProgress = (): { progress: number; stage: string | null } => {
    switch (status) {
      case "deriving": return { progress: 20, stage: "Deriving secret" };
      case "preparing": return { progress: 45, stage: "Preparing transaction" };
      case "signing": return { progress: 70, stage: "Waiting for signature" };
      case "confirming": return { progress: 90, stage: "Confirming on chain" };
      default: return { progress: 0, stage: null };
    }
  };
  const { progress: shieldProgress, stage: shieldStage } = getShieldProgress();

  const effectiveAmount =
    mode === "fixed" && denomination
      ? denomination / LAMPORTS_PER_SOL
      : parseFloat(customAmount) || 0;

  useEffect(() => {
    if (status === "success") {
      toast.success("Assets shielded successfully!", {
        description: `Transaction: ${txSignature?.slice(0, 8)}...`,
      });
      setCustomAmount("");
      reset();
      setTimeout(() => router.push("/dashboard"), 1500);
    } else if (status === "error" && error) {
      toast.error("Failed to shield assets", {
        description: error,
      });
    }
  }, [status, error, txSignature, reset, router]);

  const handleShield = async () => {
    if (!connected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (effectiveAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (effectiveAmount > balance) {
      toast.error("Insufficient balance");
      return;
    }

    const lamports = mode === "fixed" && denomination
      ? denomination
      : Math.floor(effectiveAmount * LAMPORTS_PER_SOL);

    await shield(lamports, mode === "fixed" ? denomination : null);
  };

  const getButtonText = () => {
    switch (status) {
      case "deriving":
        return "Deriving secret...";
      case "preparing":
        return "Preparing transaction...";
      case "signing":
        return "Waiting for signature...";
      case "confirming":
        return "Confirming on chain...";
      default:
        if (effectiveAmount > 0) {
          const formatted = effectiveAmount >= 1000
            ? `${effectiveAmount / 1000}K`
            : effectiveAmount.toString();
          return `./shield ${formatted} ${selectedToken.symbol}`;
        }
        return "./shield --execute";
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-bg-card border border-border flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-text-dim"
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
          <h1 className="font-heading text-2xl font-semibold text-white mb-2">
            Connect Your Wallet
          </h1>
          <p className="text-text-dim mb-6">
            Connect your wallet to shield your assets
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Shield Assets"
        subtitle="Convert your public assets into shielded, privacy-protected positions."
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card gradient>
          <CardContent className="p-[35px] space-y-6">
            {/* Token Selection */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <SectionHeader>Select Token</SectionHeader>
              </motion.div>
              <div className="grid grid-cols-2 gap-[15px] mb-[30px]">
              {SUPPORTED_TOKENS.map((token, index) => (
                <motion.button
                  key={token.mint}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.25 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelectedToken(token)}
                  className={cn(
                    "p-5 rounded-lg border transition-all",
                    "bg-[rgba(0,0,0,0.3)] hover:border-terminal-dark",
                    selectedToken.mint === token.mint
                      ? "border-terminal-green bg-[rgba(0,160,136,0.08)]"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center gap-[15px]">
                    <div className="w-10 h-10 rounded-full bg-terminal-dark flex items-center justify-center">
                      <span className="text-base font-semibold text-terminal-green">
                        {token.symbol === "SOL" ? "\u25CE" : token.symbol.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className="font-heading font-semibold text-white text-base">{token.symbol}</div>
                      <div className="text-xs text-text-dim">{token.name}</div>
                    </div>
                  </div>
                </motion.button>
              ))}

              {/* USDC Coming Soon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 0.5, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative p-5 rounded-lg border border-border bg-[rgba(0,0,0,0.3)] cursor-not-allowed"
              >
                <span className="absolute top-[10px] right-[10px] px-2 py-1 text-[9px] font-medium uppercase tracking-[1px] rounded bg-white/5 text-text-muted">
                  Coming Soon
                </span>
                <div className="flex items-center gap-[15px]">
                  <div className="w-10 h-10 rounded-full bg-terminal-dark flex items-center justify-center">
                    <span className="text-base font-semibold text-terminal-green">$</span>
                  </div>
                  <div className="text-left">
                    <div className="font-heading font-semibold text-white text-base">USDC</div>
                    <div className="text-xs text-text-dim">USD Coin</div>
                  </div>
                </div>
              </motion.div>
              </div>
            </div>

            {/* Pool Selection */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <SectionHeader>Select Amount</SectionHeader>
              </motion.div>

            {/* Tab Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-2 p-1.5 bg-[rgba(0,0,0,0.3)] rounded-lg border border-border"
            >
              <button
                onClick={() => {
                  setMode("fixed");
                  if (!denomination) setDenomination(1_000_000_000);
                }}
                className={cn(
                  "flex-1 py-3 px-4 rounded-md text-sm font-mono transition-all flex items-center justify-center gap-2",
                  mode === "fixed"
                    ? "bg-terminal-green text-bg"
                    : "text-text-dim hover:text-text"
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                </svg>
                Fixed Pools
                {mode === "fixed" && (
                  <span className="group relative text-[10px] bg-bg/40 border border-bg/60 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-help">
                    Best Privacy
                    <svg className="w-3 h-3 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-bg border border-terminal-green/30 rounded-lg text-[10px] text-text-dim leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
                      Fixed amounts mix your deposit with others who deposited the same amount, making it impossible to trace.
                    </span>
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setMode("custom");
                  setDenomination(null);
                }}
                className={cn(
                  "flex-1 py-3 px-4 rounded-md text-sm font-mono transition-all flex items-center justify-center gap-2",
                  mode === "custom"
                    ? "bg-terminal-green text-bg"
                    : "text-text-dim hover:text-text"
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Custom Amount
              </button>
            </motion.div>

            {/* Fixed Pool Grid */}
            {mode === "fixed" && (
              <div className="grid grid-cols-3 gap-[15px] mb-[25px]">
                {FIXED_DENOMINATIONS.map((denom, index) => {
                  const pool = pools.find((p: PoolInfo) => p.denomination === denom.value);
                  const depositCount = pool?.depositCount ?? 0;
                  const privacy = getPrivacyLevel(depositCount);
                  const isSelected = denomination === denom.value;

                  return (
                    <motion.button
                      key={denom.value}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => setDenomination(denom.value)}
                      className={cn(
                        "relative p-5 rounded-lg border cursor-pointer transition-all text-left",
                        "bg-[rgba(0,0,0,0.3)]",
                        isSelected
                          ? "border-terminal-green bg-[rgba(0,160,136,0.08)]"
                          : "border-border hover:border-terminal-dark"
                      )}
                    >
                      {denom.recommended && (
                        <span className="absolute top-2 right-2 text-[9px] font-medium text-bg bg-terminal-green px-2 py-1 rounded">
                          Best
                        </span>
                      )}
                      <div className="font-heading text-xl font-semibold text-white mb-2">
                        {denom.label}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-dim text-xs">
                          {depositCount} deposits
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          privacy.level === "strong" && "bg-terminal-green/20 text-terminal-green",
                          privacy.level === "good" && "bg-terminal-green/15 text-terminal-dim",
                          privacy.level === "moderate" && "bg-yellow-500/15 text-yellow-500",
                          privacy.level === "low" && "bg-red-500/15 text-red-400"
                        )}>
                          {privacy.label}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Custom Amount Input */}
            {mode === "custom" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                {/* Privacy Warning */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-yellow-500 mt-0.5">!</span>
                    <div>
                      <h4 className="font-medium text-yellow-500 text-sm">
                        Reduced Privacy
                      </h4>
                      <p className="text-sm text-text-dim mt-1">{CUSTOM_AMOUNT_WARNING}</p>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="relative">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[rgba(0,0,0,0.4)] border border-border rounded-xl px-4 py-3.5 text-white font-mono text-base focus:outline-none focus:border-terminal-green transition-colors"
                  />
                  <button
                    onClick={() => balance > 0 && setCustomAmount(balance.toString())}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-terminal-green hover:text-terminal-dim transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </motion.div>
            )}
            </div>

            {/* Balance Row */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-between text-[13px] mb-5"
            >
              <span className="text-text-dim">Balance:</span>
              <span className="text-white">{formatAmount(balance, 4)} {selectedToken.symbol}</span>
            </motion.div>

            {/* Info Box */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[rgba(0,160,136,0.08)] border border-[rgba(0,160,136,0.2)] rounded-lg p-[18px] mb-[25px]"
            >
              <div className="flex items-start gap-[10px]">
                <span className="text-terminal-green">ℹ</span>
                <p className="text-xs text-text-dim leading-[1.7]">
                  {mode === "fixed"
                    ? "Fixed denominations mix your deposit with others who deposited the same amount, maximizing privacy."
                    : "Shielding converts your tokens into a privacy-protected position. You can unshield at any time."}
                </p>
              </div>
            </motion.div>

            {/* Insufficient Balance Warning */}
            {mode === "fixed" && denomination && denomination / LAMPORTS_PER_SOL > balance && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-red-400 text-center"
              >
                Insufficient balance for this pool
              </motion.div>
            )}

            {/* Transaction Animation */}
            {isLoading && (
              <ProofAnimation progress={shieldProgress} stage={shieldStage} />
            )}

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
            >
              <Button
                onClick={handleShield}
                loading={isLoading}
                fullWidth
                size="lg"
                disabled={effectiveAmount <= 0 || effectiveAmount > balance}
              >
                {getButtonText()}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
