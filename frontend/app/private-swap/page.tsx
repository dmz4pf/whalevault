"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProofAnimation } from "@/components/proof/ProofAnimation";
import { TokenSelector } from "@/components/swap/TokenSelector";
import { useWallet } from "@/hooks/useWallet";
import { usePrivateSwap } from "@/hooks/usePrivateSwap";
import { useConfetti } from "@/hooks/useConfetti";
import { usePositionsStore } from "@/stores/positions";
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

  // Prefill recipient with connected wallet
  useEffect(() => {
    if (publicKey && !recipientAddress) {
      setRecipientAddress(publicKey);
    }
  }, [publicKey, recipientAddress]);

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
        return "Unshielding SOL to wallet...";
      case "building_route":
        return "Building swap route...";
      case "swapping":
        return "Sign swap in wallet...";
      case "executing":
        return "Executing swap...";
      case "confirming":
        return "Confirming on chain...";
      case "success":
        return "Swap Complete!";
      default:
        return "Execute Private Swap";
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
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">Connect your wallet to privately swap shielded assets</p>
        </motion.div>
      </div>
    );
  }

  const explorerCluster = isDevnet ? "?cluster=devnet" : "";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-white mb-2">Private Swap</h1>
        <p className="text-gray-400">
          Swap shielded assets privately through {isDevnet ? "Raydium" : "Jupiter"}.
        </p>
      </motion.div>

      {/* Devnet Banner */}
      {isDevnet && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5"
        >
          <svg className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-300">Devnet Mode</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">
              Limited token pairs. Swaps use Raydium devnet pools. Two-step process: unshield to wallet, then swap.
            </p>
          </div>
        </motion.div>
      )}

      {/* Position Selector */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card gradient>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Select Position</h2>
          </CardHeader>
          <CardContent>
            {shieldedPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Shielded Positions</h3>
                <p className="text-gray-400 mb-6 max-w-sm">
                  You don&apos;t have any shielded positions. Shield some assets first.
                </p>
                <Link href="/shield">
                  <Button>Go to Shield</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {shieldedPositions.map((position) => (
                  <button
                    key={position.id}
                    onClick={() => handleSelectPosition(position)}
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
                          <span className="font-medium text-white">{position.token}</span>
                          <span className="text-[10px] font-medium text-whale-400 bg-whale-500/20 px-1.5 py-0.5 rounded">
                            {getDenominationLabel(position.denomination)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          Shielded {new Date(position.timestamp).toLocaleDateString()}
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
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Output Token Picker */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="relative z-20">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Output Token</h2>
          </CardHeader>
          <CardContent>
            <TokenSelector
              selectedToken={selectedToken}
              onSelect={handleSelectToken}
              disabled={isLoading}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Recipient Address */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Recipient</h2>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="Enter Solana address"
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-whale-500 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-2">
              {isDevnet
                ? "On devnet, SOL is unshielded to your wallet first, then swapped via Raydium."
                : "For maximum privacy, use a fresh wallet address that has never been linked to your main wallet."}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quote Display */}
      {quote && selectedToken && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="space-y-3 py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">You receive</span>
                <span className="text-white font-semibold text-lg">
                  {formatTokenAmount(quote.outAmount, selectedToken.decimals)} {selectedToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Exchange rate</span>
                <span className="text-white">
                  1 SOL = {computeExchangeRate(quote.inAmount, quote.outAmount, selectedToken.decimals)} {selectedToken.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Price impact</span>
                <span className={
                  parseFloat(quote.priceImpactPct) > 1 ? "text-yellow-400" : "text-green-400"
                }>
                  {parseFloat(quote.priceImpactPct).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Minimum received</span>
                <span className="text-white">
                  {formatTokenAmount(quote.minimumReceived, selectedToken.decimals)} {selectedToken.symbol}
                </span>
              </div>
              {quote.route && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Route</span>
                  <span className="text-xs text-gray-500 font-mono">{quote.route}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ZK Proof Animation */}
      {status === "generating" && (
        <ProofAnimation progress={proofProgress} stage={proofStage} />
      )}

      {/* Progress Status */}
      {isLoading && status !== "generating" && proofStage && (
        <div className="text-center text-sm text-gray-400">{proofStage}</div>
      )}

      {/* Execute Button */}
      <Button
        onClick={handleSwap}
        loading={isLoading}
        fullWidth
        size="lg"
        disabled={!selectedPosition || !selectedToken || !recipientAddress.trim() || isLoading || status === "success"}
      >
        {getButtonText()}
      </Button>

      {/* Success State */}
      {status === "success" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Swap Successful</h3>
                  <p className="text-sm text-gray-400">Your private swap has been confirmed on-chain.</p>
                </div>
              </div>
              {unshieldSignature && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Unshield TX</span>
                  <a
                    href={`https://solscan.io/tx/${unshieldSignature}${explorerCluster}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-whale-400 hover:text-whale-300 font-mono text-xs"
                  >
                    {unshieldSignature.slice(0, 8)}...{unshieldSignature.slice(-8)}
                  </a>
                </div>
              )}
              {swapSignature && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Swap TX</span>
                  <a
                    href={`https://solscan.io/tx/${swapSignature}${explorerCluster}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-whale-400 hover:text-whale-300 font-mono text-xs"
                  >
                    {swapSignature.slice(0, 8)}...{swapSignature.slice(-8)}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
