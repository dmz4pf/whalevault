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

function getDenominationLabel(denomination?: number | null): string {
  if (!denomination) return "Custom";
  const denom = FIXED_DENOMINATIONS.find((d) => d.value === denomination);
  return denom ? `${denom.label} Pool` : "Custom";
}

const STORAGE_KEY = "whalevault_positions";

export default function UnshieldPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { positions: storePositions, setPositions } = usePositionsStore();
  const { status, error, proofProgress, proofStage, fee, unshield, reset } =
    useUnshield();
  const { fire: fireConfetti } = useConfetti();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null
  );
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [useCustomRecipient, setUseCustomRecipient] = useState(false);

  // Load positions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const positions: Position[] = JSON.parse(stored);
      setPositions(positions);
    }
  }, [setPositions]);

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
      toast.success("Assets unshielded successfully!");
      setSelectedPosition(null);
      reset();
      setTimeout(() => router.push("/dashboard"), 1500);
    } else if (status === "error" && error) {
      toast.error("Failed to unshield assets", { description: error });
    }
  }, [status, error, reset, router, fireConfetti]);

  const handleUnshield = async () => {
    if (!selectedPosition || !publicKey) return;

    // Use custom recipient if enabled and valid, otherwise use connected wallet
    const recipient = useCustomRecipient && recipientAddress.trim()
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
        return "Unshield Assets";
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
        <h1 className="text-3xl font-bold text-white mb-2">Unshield Assets</h1>
        <p className="text-gray-400">
          Convert your shielded positions back to regular, public tokens.
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
        <Card gradient>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Unshield</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Position Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Select Position
              </label>
              <div className="space-y-3">
                {shieldedPositions.map((position) => (
                  <button
                    key={position.id}
                    onClick={() => setSelectedPosition(position)}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                      selectedPosition?.id === position.id
                        ? "border-whale-500 bg-whale-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-white">
                          {position.token.charAt(0)}
                        </span>
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
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white">
                        {formatSOL(position.shieldedAmount)} {position.token}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Position Summary */}
            {selectedPosition && (
              <div className="p-4 rounded-xl bg-whale-500/5 border border-whale-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    Amount to unshield
                  </span>
                  <span className="text-lg font-semibold text-white">
                    {formatSOL(selectedPosition.shieldedAmount)}{" "}
                    {selectedPosition.token}
                  </span>
                </div>
              </div>
            )}

            {/* Recipient Address Option - Privacy Feature */}
            {selectedPosition && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">
                    Withdraw to different address
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomRecipient(!useCustomRecipient)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      useCustomRecipient ? "bg-whale-500" : "bg-white/20"
                    }`}
                    disabled={isLoading}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useCustomRecipient ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {useCustomRecipient && (
                  <div>
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
                  </div>
                )}
              </div>
            )}

            {/* ZK Proof Animation during generation */}
            {status === "generating" && (
              <ProofAnimation progress={proofProgress} stage={proofStage} />
            )}

            {/* Privacy Info Box */}
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

            {/* Relayer Fee Info */}
            {selectedPosition && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Relayer fee (0.3%)</span>
                  <span className="text-white">
                    ~{formatSOL(Math.floor(selectedPosition.shieldedAmount * 0.003))} SOL
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
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
              disabled={!selectedPosition || isLoading}
            >
              {getButtonText()}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
