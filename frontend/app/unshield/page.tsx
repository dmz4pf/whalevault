"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransactionModal } from "@/components/transaction";
import { useWallet } from "@/hooks/useWallet";
import { useUnshield } from "@/hooks/useUnshield";
import { usePositionsStore } from "@/stores/positions";
import { cn } from "@/lib/utils";
import { LAMPORTS_PER_SOL, FIXED_DENOMINATIONS } from "@/lib/constants";
import Link from "next/link";
import type { Position } from "@/types";

type UnshieldAction = "send" | "swap" | "wallet";

function getDenominationLabel(denomination?: number | null): string {
  if (!denomination) return "Custom";
  const denom = FIXED_DENOMINATIONS.find((d) => d.value === denomination);
  return denom ? `${denom.label}` : "Custom";
}

function formatTimeRemaining(delayUntil: string): string | null {
  const remaining = new Date(delayUntil).getTime() - Date.now();
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.ceil((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "Just now";
}

const ACTION_OPTIONS = [
  {
    id: "send" as const,
    icon: "\u2192",
    title: "Send Privately",
    description: "To another wallet",
    recommended: true,
    warning: false,
  },
  {
    id: "swap" as const,
    icon: "\u21C4",
    title: "Swap to Token",
    description: "Convert and send privately",
    recommended: false,
    warning: false,
  },
  {
    id: "wallet" as const,
    icon: "\u21A9",
    title: "Back to Wallet",
    description: "Exit privacy - creates link",
    warning: true,
    recommended: false,
  },
];

const DELAY_PRESETS = [
  { label: "Instant", ms: 0 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "6h", ms: 6 * 60 * 60 * 1000 },
  { label: "12h", ms: 12 * 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
];

export default function UnshieldPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { positions: storePositions } = usePositionsStore();
  const { status, error, proofProgress, proofStage, unshield, reset } = useUnshield();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [selectedAction, setSelectedAction] = useState<UnshieldAction>("send");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [useDifferentAddress, setUseDifferentAddress] = useState(false);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [tick, setTick] = useState(0);

  // Tick every minute to update delay countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Filter to only shielded positions, sorted by most recent first
  const shieldedPositions = storePositions
    .filter((p) => p.status === "shielded")
    .sort((a, b) => b.timestamp - a.timestamp);

  const isLoading =
    status === "deriving" ||
    status === "requesting" ||
    status === "generating" ||
    status === "relaying" ||
    status === "confirming";

  // Handle success/error
  useEffect(() => {
    if (status === "success") {
      toast.success("Withdrawal complete!");
      setSelectedPosition(null);
      reset();
      setTimeout(() => router.push("/dashboard"), 1500);
    } else if (status === "error" && error) {
      toast.error("Withdrawal failed", { description: error });
    }
  }, [status, error, reset, router]);

  const handleUnshield = async () => {
    if (!selectedPosition || !publicKey) return;

    if (selectedAction === "swap") {
      router.push(`/private-swap?position=${selectedPosition.id}`);
      return;
    }

    const recipient =
      selectedAction === "send" && useDifferentAddress && recipientAddress.trim()
        ? recipientAddress.trim()
        : undefined;

    await unshield(selectedPosition, recipient);
  };

  const getButtonText = () => {
    switch (status) {
      case "deriving":
        return "Deriving secret...";
      case "requesting":
        return "Requesting proof...";
      case "generating":
        return `Generating proof... ${proofProgress}%`;
      case "relaying":
        return "Relayer submitting...";
      case "confirming":
        return "Confirming on chain...";
      default:
        return "./unshield";
    }
  };

  const formatSOL = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);

  const relayerFee = selectedPosition
    ? Math.floor(selectedPosition.shieldedAmount * 0.003)
    : 0;
  const receiveAmount = selectedPosition
    ? selectedPosition.shieldedAmount - relayerFee
    : 0;

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
            Connect your wallet to unshield your assets
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Unshield"
        subtitle="Convert your shielded positions back to regular, public tokens."
      />

      {shieldedPositions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card gradient>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-bg-card border border-border flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-text-dim"
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
              <p className="text-text-dim mb-6 max-w-sm">
                You don&apos;t have any shielded positions to unshield. Shield some
                assets first to use this feature.
              </p>
              <Link href="/shield">
                <Button>Go to Shield</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
        <Card gradient>
          <CardContent className="p-[35px] space-y-6">
            {/* Position Selection */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <SectionHeader>Select Position</SectionHeader>
              </motion.div>
              <div className="border border-border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto mb-[25px]">
                {shieldedPositions.map((position, index) => {
                  const timeLeft = position.delayUntil
                    ? formatTimeRemaining(position.delayUntil)
                    : null;
                  const isLocked = !!timeLeft;
                  const isSelected = selectedPosition?.id === position.id;

                  return (
                    <motion.button
                      key={position.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                      onClick={() => !isLocked && setSelectedPosition(position)}
                      disabled={isLoading || isLocked}
                      className={cn(
                        "w-full flex items-center justify-between py-3.5 px-4 transition-all text-left",
                        index !== 0 && "border-t border-border/50",
                        isSelected
                          ? "bg-terminal-green/15 border-l-2 border-l-terminal-green"
                          : "border-l-2 border-l-transparent",
                        isLocked
                          ? "bg-yellow-500/5 cursor-not-allowed"
                          : !isSelected && "hover:bg-white/[0.02]",
                        isLoading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "font-mono text-sm w-24 text-left",
                          isLocked ? "text-yellow-400" : "text-terminal-green"
                        )}>
                          {formatSOL(position.shieldedAmount)} SOL
                        </span>
                        <span className="text-xs text-text-dim font-mono">
                          {getDenominationLabel(position.denomination)}
                        </span>
                        {isLocked && (
                          <span className="text-xs text-yellow-400">
                            ({timeLeft})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-dim">
                        {formatRelativeTime(position.timestamp)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Action Selection */}
            {selectedPosition && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  <SectionHeader>Select Action</SectionHeader>
                </motion.div>
                <div className="space-y-3">
                  {ACTION_OPTIONS.map((action, index) => {
                    const isSelected = selectedAction === action.id;
                    return (
                      <motion.button
                        key={action.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => setSelectedAction(action.id)}
                        disabled={isLoading}
                        className={cn(
                          "w-full p-4 rounded-xl border cursor-pointer transition-all text-left",
                          "bg-[rgba(0,0,0,0.3)]",
                          isSelected
                            ? action.warning
                              ? "border-yellow-500/50 bg-yellow-500/10"
                              : "border-terminal-green bg-[rgba(0,160,136,0.08)]"
                            : "border-border hover:border-terminal-dark",
                          isLoading && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "text-2xl",
                                action.warning ? "text-yellow-400" : "text-terminal-green"
                              )}
                            >
                              {action.icon}
                            </span>
                            <div>
                              <div className="text-white font-medium text-sm">
                                {action.title}
                              </div>
                              <div
                                className={cn(
                                  "text-xs",
                                  action.warning ? "text-yellow-400/80" : "text-text-dim"
                                )}
                              >
                                {action.description}
                              </div>
                            </div>
                          </div>
                          {action.recommended && (
                            <span className="text-xs px-2 py-1 bg-terminal-green/20 text-terminal-green rounded">
                              RECOMMENDED
                            </span>
                          )}
                          {action.warning && (
                            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                              CAUTION
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Recipient Section (only for "send" action) */}
            {selectedPosition && selectedAction === "send" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <SectionHeader>Recipient</SectionHeader>
                <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4 space-y-4">
                  {/* Toggle - entire row clickable */}
                  <button
                    type="button"
                    onClick={() => !isLoading && setUseDifferentAddress(!useDifferentAddress)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-text-dim text-xs">
                      Different Address
                    </span>
                    <div
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        useDifferentAddress
                          ? "bg-terminal-green"
                          : "bg-border"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-5 h-5 rounded-full transition-transform",
                          useDifferentAddress
                            ? "translate-x-6 bg-bg"
                            : "translate-x-0.5 bg-text"
                        )}
                      />
                    </div>
                  </button>

                  {/* Address Input */}
                  {useDifferentAddress && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="Enter Solana address (e.g., 7xKX...)"
                        disabled={isLoading}
                        className="w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border border-terminal-green text-white font-mono text-sm placeholder-text-dim focus:outline-none disabled:opacity-50"
                      />
                      <p className="text-xs text-text-dim">
                        For maximum privacy, use a fresh wallet address that has
                        never been linked to your main wallet.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Privacy Delay Section (for send action) */}
            {selectedPosition && selectedAction === "send" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <SectionHeader>Privacy Delay</SectionHeader>
                <div className="flex gap-2">
                  {DELAY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDelayMs(preset.ms)}
                      disabled={isLoading}
                      className={cn(
                        "flex-1 py-3 rounded-lg font-mono text-sm transition-all",
                        delayMs === preset.ms
                          ? "bg-terminal-green text-bg"
                          : "bg-bg-card border border-border text-text-dim hover:border-terminal-dark"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Privacy Warning for "wallet" action */}
            {selectedPosition && selectedAction === "wallet" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-yellow-400 mt-0.5">!</span>
                    <div>
                      <p className="text-sm font-medium text-yellow-400 mb-1">
                        Privacy Trade-off
                      </p>
                      <p className="text-sm text-text-dim">
                        Withdrawing to your own wallet creates a link between your
                        deposit and withdrawal. For maximum privacy, consider
                        sending to a fresh wallet instead.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Privacy Info (for send action) */}
            {selectedPosition && selectedAction === "send" && (
              <div className="bg-[rgba(0,160,136,0.08)] border border-[rgba(0,160,136,0.2)] rounded-lg p-5 mb-[25px]">
                <div className="text-terminal-green text-[13px] font-semibold mb-[10px] flex items-center gap-2">
                  <span>✓</span> True Privacy Mode
                </div>
                <p className="text-xs text-text-dim leading-[1.8]">
                  Your wallet never signs the withdrawal transaction. A relayer
                  submits it on your behalf using your ZK proof, making it
                  impossible to link your deposit to this withdrawal.
                </p>
              </div>
            )}

            {/* Fee Summary */}
            {selectedPosition && selectedAction !== "swap" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[rgba(0,0,0,0.3)] border border-border rounded-lg p-5 mb-[25px]"
              >
                <div className="flex justify-between mb-3 text-[13px]">
                  <span className="text-text-dim">Relayer fee (0.3%)</span>
                  <span className="text-white">
                    ~{formatSOL(relayerFee)} {selectedPosition.token}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-border text-[13px]">
                  <span className="text-text-dim">You receive</span>
                  <span className="text-terminal-green font-semibold">
                    ~{formatSOL(receiveAmount)} {selectedPosition.token}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Transaction Modal - Fullscreen with blur */}
            <TransactionModal
              isOpen={isLoading}
              progress={proofProgress}
              stage={proofStage}
              title="Unshielding"
              subtitle={selectedPosition ? `${formatSOL(selectedPosition.shieldedAmount)} SOL` : undefined}
            />

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <Button
                onClick={handleUnshield}
                loading={isLoading}
                fullWidth
                size="lg"
                disabled={
                  !selectedPosition ||
                  isLoading ||
                  (selectedAction === "send" &&
                    useDifferentAddress &&
                    !recipientAddress.trim())
                }
                variant={selectedAction === "wallet" ? "ghost" : "primary"}
              >
                {getButtonText()}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
        </motion.div>
      )}
    </div>
  );
}
