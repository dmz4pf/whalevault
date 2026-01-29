"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProofAnimation } from "@/components/proof/ProofAnimation";
import { useWallet } from "@/hooks/useWallet";
import { useUnshield } from "@/hooks/useUnshield";
import { useConfetti } from "@/hooks/useConfetti";
import { usePositionsStore } from "@/stores/positions";
import { LAMPORTS_PER_SOL, FIXED_DENOMINATIONS } from "@/lib/constants";
import Link from "next/link";
import type { Position } from "@/types";

type UnshieldAction = "send" | "swap" | "wallet";

function getDenominationLabel(denomination?: number | null): string {
  if (!denomination) return "Custom";
  const denom = FIXED_DENOMINATIONS.find((d) => d.value === denomination);
  return denom ? `${denom.label} Pool` : "Custom";
}

function formatTimeRemaining(delayUntil: string): string | null {
  const remaining = new Date(delayUntil).getTime() - Date.now();
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.ceil((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const ACTION_OPTIONS = [
  {
    id: "send" as const,
    icon: "🔒",
    title: "Send Privately",
    description: "Transfer to another wallet with full privacy",
    recommended: true,
  },
  {
    id: "swap" as const,
    icon: "🔄",
    title: "Swap Privately",
    description: "Convert to another token and send",
    recommended: false,
  },
  {
    id: "wallet" as const,
    icon: "⚠️",
    title: "Back to My Wallet",
    description: "Exit privacy — creates traceable link",
    warning: true,
    recommended: false,
  },
];

export default function UnshieldPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { positions: storePositions } = usePositionsStore();
  const { status, error, proofProgress, proofStage, fee, unshield, reset } =
    useUnshield();
  const { fire: fireConfetti } = useConfetti();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null
  );
  const [selectedAction, setSelectedAction] = useState<UnshieldAction>("send");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [tick, setTick] = useState(0);

  // Tick every minute to update delay countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Filter to only shielded positions
  const shieldedPositions = storePositions.filter(
    (p) => p.status === "shielded"
  );

  const isLoading =
    status === "deriving" ||
    status === "requesting" ||
    status === "generating" ||
    status === "relaying" ||
    status === "confirming";

  // Handle success/error
  useEffect(() => {
    if (status === "success") {
      fireConfetti();
      toast.success("Stealth withdrawal complete!");
      setSelectedPosition(null);
      reset();
      setTimeout(() => router.push("/dashboard"), 1500);
    } else if (status === "error" && error) {
      toast.error("Stealth withdrawal failed", { description: error });
    }
  }, [status, error, reset, router, fireConfetti]);

  const handleUnshield = async () => {
    if (!selectedPosition || !publicKey) return;

    if (selectedAction === "swap") {
      // Redirect to private swap with position pre-selected
      router.push(`/private-swap?position=${selectedPosition.id}`);
      return;
    }

    // Use custom recipient for "send", use connected wallet for "wallet"
    const recipient = selectedAction === "send" && recipientAddress.trim()
      ? recipientAddress.trim()
      : undefined;  // undefined means hook will use connected wallet

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
        if (selectedAction === "swap") return "Continue to Swap";
        if (selectedAction === "wallet") return "Unshield to My Wallet";
        return "Send Privately";
    }
  };

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
            Connect your wallet to unshield your assets
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Unshield from Vault</h1>
        <p className="text-gray-400">
          Choose how to use your shielded assets while preserving privacy.
        </p>
      </motion.div>

      {shieldedPositions.length === 0 ? (
        <Card gradient>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
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
                You don&apos;t have any shielded positions to unshield. Shield
                some assets first to use this feature.
              </p>
              <Link href="/shield">
                <Button>Go to Shield</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Position Selection */}
          <Card gradient>
            <CardHeader>
              <h2 className="text-xl font-semibold text-white">Select Position</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shieldedPositions.map((position) => {
                  const timeLeft = position.delayUntil
                    ? formatTimeRemaining(position.delayUntil)
                    : null;
                  const isLocked = !!timeLeft;

                  return (
                    <button
                      key={position.id}
                      onClick={() => !isLocked && setSelectedPosition(position)}
                      disabled={isLoading || isLocked}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                        selectedPosition?.id === position.id
                          ? "border-whale-500 bg-whale-500/10"
                          : isLocked
                          ? "border-yellow-500/30 bg-yellow-500/5 cursor-not-allowed"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isLocked ? "bg-yellow-500/10" : "bg-white/10"
                        }`}>
                          {isLocked ? (
                            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <span className="text-lg font-bold text-white">
                              {position.token.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {position.token}
                            </span>
                            <span className="text-[10px] font-medium text-whale-400 bg-whale-500/20 px-1.5 py-0.5 rounded">
                              {getDenominationLabel(position.denomination)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            Shielded{" "}
                            {new Date(position.timestamp).toLocaleDateString()}
                          </div>
                          {isLocked && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-yellow-400">Available in {timeLeft}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-white">
                          {formatSOL(position.shieldedAmount)} {position.token}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action Selection */}
          {selectedPosition && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold text-white">Choose Action</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ACTION_OPTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => setSelectedAction(action.id)}
                      disabled={isLoading}
                      className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                        selectedAction === action.id
                          ? action.warning
                            ? "border-yellow-500/50 bg-yellow-500/10"
                            : "border-whale-500 bg-whale-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className="text-2xl">{action.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{action.title}</span>
                          {action.recommended && (
                            <span className="text-[10px] font-medium text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mt-0.5 ${action.warning ? "text-yellow-400/80" : "text-gray-400"}`}>
                          {action.description}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedAction === action.id
                          ? action.warning
                            ? "border-yellow-500 bg-yellow-500"
                            : "border-whale-500 bg-whale-500"
                          : "border-white/30"
                      }`}>
                        {selectedAction === action.id && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Recipient Address (only for "send" action) */}
          {selectedPosition && selectedAction === "send" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold text-white">Recipient Address</h2>
                </CardHeader>
                <CardContent>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Enter Solana address (e.g., 7xKX...)"
                    disabled={isLoading}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whale-500 disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    For maximum privacy, use a fresh wallet address that has
                    never been linked to your main wallet.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Privacy Warning for "wallet" action */}
          {selectedPosition && selectedAction === "wallet" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-400 mb-1">
                      Privacy Trade-off
                    </p>
                    <p className="text-sm text-yellow-400/80">
                      Withdrawing to your own wallet creates a link between your deposit and withdrawal.
                      For maximum privacy, consider sending to a fresh wallet instead.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Privacy Info (for send action) */}
          {selectedPosition && selectedAction === "send" && (
            <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0"
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
                <div>
                  <p className="text-sm font-medium text-green-400 mb-1">
                    True Privacy Mode
                  </p>
                  <p className="text-sm text-gray-300">
                    Your wallet never signs the withdrawal transaction. A relayer
                    submits it on your behalf using your ZK proof, making it
                    impossible to link your deposit to this withdrawal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ZK Proof Animation during generation */}
          {status === "generating" && (
            <ProofAnimation progress={proofProgress} stage={proofStage} />
          )}

          {/* Relayer Fee Info */}
          {selectedPosition && selectedAction !== "swap" && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-medium">
                  {formatSOL(selectedPosition.shieldedAmount)} {selectedPosition.token}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-400">Relayer fee (0.3%)</span>
                <span className="text-white">
                  ~{formatSOL(Math.floor(selectedPosition.shieldedAmount * 0.003))} SOL
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-white/10">
                <span className="text-gray-400">You receive</span>
                <span className="text-white font-medium">
                  ~{formatSOL(Math.floor(selectedPosition.shieldedAmount * 0.997))} {selectedPosition.token}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleUnshield}
            loading={isLoading}
            fullWidth
            size="lg"
            disabled={
              !selectedPosition ||
              isLoading ||
              (selectedAction === "send" && !recipientAddress.trim())
            }
            variant={selectedAction === "wallet" ? "ghost" : "primary"}
          >
            {getButtonText()}
          </Button>
        </div>
      )}
    </div>
  );
}
