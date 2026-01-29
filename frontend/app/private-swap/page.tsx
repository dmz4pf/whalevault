"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProofAnimation } from "@/components/proof/ProofAnimation";
import { TokenSelector } from "@/components/swap/TokenSelector";
import { useWallet } from "@/hooks/useWallet";
import { usePrivateSwap } from "@/hooks/usePrivateSwap";
import { useConfetti } from "@/hooks/useConfetti";
import { usePositionsStore } from "@/stores/positions";
import { cn } from "@/lib/utils";
import { LAMPORTS_PER_SOL, FIXED_DENOMINATIONS } from "@/lib/constants";
import Link from "next/link";
import type { Position } from "@/types";
import type { FeaturedToken } from "@/lib/tokens";

function getDenominationLabel(denomination?: number | null): string {
  if (!denomination) return "Custom";
  const denom = FIXED_DENOMINATIONS.find((d) => d.value === denomination);
  return denom ? `${denom.label} Pool` : "Custom";
}

function formatSOL(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

function formatTokenAmount(rawAmount: string, decimals: number): string {
  const value = parseFloat(rawAmount) / Math.pow(10, decimals);
  return value < 0.01 ? value.toExponential(2) : value.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function computeExchangeRate(
  inAmount: string,
  outAmount: string,
  outputDecimals: number
): string {
  const solAmount = parseFloat(inAmount) / LAMPORTS_PER_SOL;
  const tokenAmount = parseFloat(outAmount) / Math.pow(10, outputDecimals);
  if (solAmount === 0) return "0";
  const rate = tokenAmount / solAmount;
  return rate < 0.01 ? rate.toExponential(2) : rate.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function PrivateSwapPage() {
  const { connected, publicKey } = useWallet();
  const { positions: storePositions } = usePositionsStore();
  const {
    status, error, quote, unshieldSignature, swapSignature,
    proofProgress, proofStage, fetchQuote, swap, reset, isDevnet,
  } = usePrivateSwap();
  const { fire: fireConfetti } = useConfetti();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [selectedToken, setSelectedToken] = useState<FeaturedToken | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string>("");

  // Auto-fill recipient only once when wallet connects
  const didAutoFill = useRef(false);
  useEffect(() => {
    if (publicKey && !didAutoFill.current) {
      setRecipientAddress(publicKey);
      didAutoFill.current = true;
    }
  }, [publicKey]);

  const shieldedPositions = storePositions.filter((p) => p.status === "shielded");

  const isLoading =
    status === "quoting" ||
    status === "deriving" ||
    status === "requesting" ||
    status === "generating" ||
    status === "unshielding" ||
    status === "building_route" ||
    status === "swapping" ||
    status === "executing" ||
    status === "confirming";

  // Auto-fetch quote when position + token selected
  useEffect(() => {
    if (selectedPosition && selectedToken && status === "idle" && !quote) {
      fetchQuote(selectedPosition, selectedToken.mint);
    }
  }, [selectedPosition, selectedToken, status, quote, fetchQuote]);

  // Reset quote when selection changes
  const handleSelectPosition = useCallback((position: Position) => {
    setSelectedPosition(position);
    reset();
  }, [reset]);

  const handleSelectToken = useCallback((token: FeaturedToken) => {
    setSelectedToken(token);
    reset();
  }, [reset]);

  // Handle success/error
  useEffect(() => {
    if (status === "success") {
      fireConfetti();
      toast.success("Private swap complete!");
    } else if (status === "error" && error) {
      toast.error("Private swap failed", { description: error });
    }
  }, [status, error, fireConfetti]);

  const handleSwap = async () => {
    if (!selectedPosition || !selectedToken || !recipientAddress.trim()) return;
    await swap(selectedPosition, selectedToken.mint, recipientAddress.trim());
  };

  const getButtonText = (): string => {
    switch (status) {
      case "quoting":
        return "Fetching quote...";
      case "deriving":
        return "Deriving secret...";
      case "requesting":
        return "Requesting proof...";
      case "generating":
        return `Generating proof... ${proofProgress}%`;
      case "unshielding":
        return "Unshielding SOL...";
      case "building_route":
        return "Building route...";
      case "swapping":
        return "Sign in wallet...";
      case "executing":
        return "Executing swap...";
      case "confirming":
        return "Confirming...";
      case "success":
        return "Swap Complete!";
      default:
        return "./swap --private";
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
            Connect your wallet to privately swap shielded assets
          </p>
        </motion.div>
      </div>
    );
  }

  const explorerCluster = isDevnet ? "?cluster=devnet" : "";

  // Success state
  if (status === "success") {
    return (
      <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="font-heading text-[26px] font-semibold text-terminal-green" style={{ textShadow: "0 0 20px rgba(0, 160, 136, 0.3)" }}>
            Private Swap
          </h1>
          <p className="text-text-dim">
            Swap shielded assets privately through {isDevnet ? "Raydium" : "Jupiter"}.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="bg-bg-card border border-terminal-green/30 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">&#x2713;</div>
            <div className="text-terminal-green text-xl font-heading mb-2">Swap Complete</div>
            <div className="text-text-dim mb-6">Your tokens have been swapped privately</div>
            <div className="space-y-2 text-sm">
              {unshieldSignature && (
                <a
                  href={`https://solscan.io/tx/${unshieldSignature}${explorerCluster}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terminal-green hover:underline block"
                >
                  View Unshield Transaction &rarr;
                </a>
              )}
              {swapSignature && (
                <a
                  href={`https://solscan.io/tx/${swapSignature}${explorerCluster}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terminal-green hover:underline block"
                >
                  View Swap Transaction &rarr;
                </a>
              )}
            </div>
            <Link href="/dashboard" className="block mt-6">
              <Button variant="ghost" fullWidth>
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Private Swap"
        subtitle={`Swap shielded assets privately through ${isDevnet ? "Raydium" : "Jupiter"}.`}
      />

      {/* Devnet Banner */}
      {isDevnet && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-500 mt-0.5">&#x26A0;</span>
              <div>
                <div className="text-yellow-500 font-medium">Devnet Notice</div>
                <div className="text-yellow-500/80 text-sm mt-1">
                  Private swaps use Raydium on devnet. Limited token pairs available.
                  Two-step process: unshield to wallet, then swap.
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
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

            {shieldedPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="font-heading text-lg font-medium text-white mb-2">No Shielded Positions</h3>
                <p className="text-text-dim mb-6 max-w-sm">
                  You don&apos;t have any shielded positions. Shield some assets first.
                </p>
                <Link href="/shield">
                  <Button>./shield --go</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-[10px] mb-[25px]">
                {shieldedPositions.map((position, index) => (
                  <motion.button
                    key={position.id}
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => handleSelectPosition(position)}
                    disabled={isLoading}
                    className={cn(
                      "w-full flex items-center justify-between p-[18px] px-5 rounded-lg border transition-all",
                      "bg-[rgba(0,0,0,0.3)] hover:border-terminal-dark",
                      selectedPosition?.id === position.id
                        ? "border-terminal-green bg-[rgba(0,160,136,0.08)]"
                        : "border-border",
                      isLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-[15px]">
                      <div className="w-10 h-10 rounded-full bg-terminal-dark flex items-center justify-center">
                        <span className="text-sm font-semibold text-terminal-green">
                          {position.token === "SOL" ? "\u25CE" : position.token.charAt(0)}
                        </span>
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-[10px]">
                          <span className="font-heading font-semibold text-white text-[15px]">{position.token}</span>
                          <span className="text-xs font-medium text-terminal-green bg-terminal-green/20 px-2 py-0.5 rounded">
                            {getDenominationLabel(position.denomination)}
                          </span>
                        </div>
                        <div className="text-xs text-text-dim mt-1">
                          Shielded {new Date(position.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-heading font-medium text-white text-base">
                        {formatSOL(position.shieldedAmount)} {position.token}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Output Token Selection */}
          <div className="space-y-4 relative z-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <SectionHeader>Output Token</SectionHeader>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <TokenSelector
                selectedToken={selectedToken}
                onSelect={handleSelectToken}
                disabled={isLoading}
              />
            </motion.div>
          </div>

          {/* Recipient Address */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <SectionHeader>Recipient</SectionHeader>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
                <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter Solana address"
                disabled={isLoading}
                className="w-full bg-[rgba(0,0,0,0.4)] border border-border rounded-xl px-4 py-3.5 text-white font-mono text-sm focus:outline-none focus:border-terminal-green transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-text-dim mt-3">
                {isDevnet
                  ? "On devnet, SOL is unshielded to your wallet first, then swapped via Raydium."
                  : "For maximum privacy, use a fresh wallet address that has never been linked to your main wallet."}
              </p>
            </motion.div>
          </div>

          {/* Quote Display */}
          {quote && selectedToken && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <SectionHeader>Swap Quote</SectionHeader>
              <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-lg p-5">
                <div className="space-y-3">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text-dim">You Pay</span>
                    <span className="text-white">
                      {selectedPosition ? formatSOL(selectedPosition.shieldedAmount) : "0"} SOL
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text-dim">You Receive</span>
                    <span className="text-terminal-green font-semibold">
                      {formatTokenAmount(quote.outAmount, selectedToken.decimals)} {selectedToken.symbol}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-text-dim">Rate</span>
                      <span className="text-terminal-green">
                        1 SOL = {computeExchangeRate(quote.inAmount, quote.outAmount, selectedToken.decimals)} {selectedToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between text-[13px] mt-3">
                      <span className="text-text-dim">Price Impact</span>
                      <span className={cn(
                        parseFloat(quote.priceImpactPct) < 1 ? "text-terminal-green" : "text-yellow-500"
                      )}>
                        {parseFloat(quote.priceImpactPct).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[13px] mt-3">
                      <span className="text-text-dim">Min Received</span>
                      <span className="text-white">
                        {formatTokenAmount(quote.minimumReceived, selectedToken.decimals)} {selectedToken.symbol}
                      </span>
                    </div>
                    {quote.route && (
                      <div className="flex justify-between text-[13px] mt-3">
                        <span className="text-text-dim">Route</span>
                        <span className="text-xs text-text-muted font-mono">{quote.route}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ZK Proof Animation */}
          {status === "generating" && (
            <ProofAnimation progress={proofProgress} stage={proofStage} />
          )}

          {/* Progress Status */}
          {isLoading && status !== "generating" && proofStage && (
            <div className="text-center text-sm text-text-dim font-mono">{proofStage}</div>
          )}

          {/* Info Box */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[rgba(0,160,136,0.08)] border border-[rgba(0,160,136,0.2)] rounded-lg p-[18px] mb-[25px]"
          >
            <div className="flex items-start gap-[10px]">
              <span className="text-terminal-green">ℹ</span>
              <p className="text-xs text-text-dim leading-[1.7]">
                Private swaps first unshield your SOL, then swap it for your desired token.
                The swap transaction is signed by your wallet for on-chain execution.
              </p>
            </div>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <Button
              onClick={handleSwap}
              loading={isLoading}
              fullWidth
              size="lg"
              disabled={!selectedPosition || !selectedToken || !recipientAddress.trim() || isLoading}
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
