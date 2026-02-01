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
import { usePrivateTransfer } from "@/hooks/usePrivateTransfer";
import { usePositionsStore } from "@/stores/positions";
import { cn } from "@/lib/utils";
import { LAMPORTS_PER_SOL, FIXED_DENOMINATIONS } from "@/lib/constants";
import {
  parseTransferDetails,
  validateManualEntry,
  validateHex64,
  detectDenomination,
  getDenominationLabel as getPoolLabel,
} from "@/lib/import-parser";
import Link from "next/link";
import type { Position } from "@/types";

type PageMode = "send" | "receive";
type ImportInputMode = "paste" | "manual";

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

function truncateHex(hex: string, chars = 8): string {
  if (hex.length <= chars * 2) return hex;
  return `${hex.slice(0, chars)}...${hex.slice(-chars)}`;
}

export default function SendPrivatelyPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { positions: storePositions, addPosition } = usePositionsStore();
  const {
    status,
    error,
    proofProgress,
    proofStage,
    recipientSecret,
    newCommitment,
    txSignature,
    transfer,
    reset,
  } = usePrivateTransfer();

  // Page mode: send or receive
  const [pageMode, setPageMode] = useState<PageMode>("send");

  // Send mode state
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [tick, setTick] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Receive/Import mode state
  const [importInputMode, setImportInputMode] = useState<ImportInputMode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [manualCommitment, setManualCommitment] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [importedPosition, setImportedPosition] = useState<Position | null>(null);

  // Tick every minute to update delay countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-parse pasted text
  useEffect(() => {
    if (importInputMode === "paste" && pasteText.trim()) {
      const result = parseTransferDetails(pasteText);
      if (result.success && result.data) {
        setManualSecret(result.data.secret);
        setManualCommitment(result.data.commitment);
        setManualAmount(result.data.amount.toString());
        setImportError(null);
      }
    }
  }, [pasteText, importInputMode]);

  // Clear import error when switching modes
  useEffect(() => {
    setImportError(null);
  }, [importInputMode]);

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
    if (status === "success" && recipientSecret && newCommitment) {
      toast.success("Transfer complete!");
      setShowSuccess(true);
    } else if (status === "error" && error) {
      toast.error("Transfer failed", { description: error });
    }
  }, [status, error, recipientSecret, newCommitment]);

  const handleTransfer = async () => {
    if (!selectedPosition || !publicKey || !recipientAddress.trim()) return;
    await transfer(selectedPosition, recipientAddress.trim());
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDone = () => {
    setShowSuccess(false);
    setSelectedPosition(null);
    setRecipientAddress("");
    setCopied(null);
    reset();
    router.push("/dashboard");
  };

  const handleImport = () => {
    setImportError(null);

    let secret: string;
    let commitment: string;
    let amount: number;

    if (importInputMode === "paste") {
      const result = parseTransferDetails(pasteText);
      if (!result.success || !result.data) {
        setImportError(result.error || "Could not parse transfer details");
        return;
      }
      secret = result.data.secret;
      commitment = result.data.commitment;
      amount = result.data.amount;
    } else {
      const result = validateManualEntry(manualSecret, manualCommitment, manualAmount);
      if (!result.success || !result.data) {
        setImportError(result.error || "Invalid input");
        return;
      }
      secret = result.data.secret;
      commitment = result.data.commitment;
      amount = result.data.amount;
    }

    // Check for duplicate commitment
    const existing = storePositions.find((p) => p.commitment === commitment);
    if (existing) {
      setImportError("This transfer has already been imported");
      return;
    }

    // Create position
    const position: Position = {
      id: commitment,
      token: "SOL",
      amount: amount,
      shieldedAmount: amount,
      timestamp: Date.now(),
      status: "shielded",
      commitment: commitment,
      secret: secret,
      denomination: detectDenomination(amount),
    };

    addPosition(position);
    setImportedPosition(position);
    setShowImportSuccess(true);
    toast.success("Position imported successfully!");
  };

  const handleImportDone = () => {
    router.push("/dashboard");
  };

  const handleUnshieldNow = () => {
    router.push("/unshield");
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
        return "./send-privately";
    }
  };

  const formatSOL = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);

  // Validation indicators for manual import mode
  const secretValid = manualSecret.trim() === "" || validateHex64(manualSecret);
  const commitmentValid = manualCommitment.trim() === "" || validateHex64(manualCommitment);
  const amountValid = manualAmount.trim() === "" || (parseInt(manualAmount, 10) > 0);

  const canImport = importInputMode === "paste"
    ? pasteText.trim().length > 0
    : manualSecret.trim().length > 0 &&
      manualCommitment.trim().length > 0 &&
      manualAmount.trim().length > 0;

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
            Connect your wallet to send or receive privately
          </p>
        </motion.div>
      </div>
    );
  }

  // Send success state - show shareable data
  if (showSuccess && recipientSecret && newCommitment) {
    return (
      <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
        <PageHeader
          title="Transfer Complete"
          subtitle="Share these details with the recipient so they can claim the funds."
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card gradient>
            <CardContent className="p-[35px] space-y-6">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-terminal-green/20 border border-terminal-green/50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">
                  {formatSOL(selectedPosition?.amount || 0)} SOL Sent Privately
                </h2>
                <p className="text-text-dim text-sm">
                  The funds are now in a shielded position owned by the recipient.
                </p>
              </div>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-400 mt-0.5 text-lg">!</span>
                  <div>
                    <p className="text-sm font-medium text-yellow-400 mb-1">
                      Important: Share These Details
                    </p>
                    <p className="text-sm text-text-dim">
                      The recipient needs the secret and commitment below to withdraw the funds.
                      If they lose this information, the funds cannot be recovered.
                    </p>
                  </div>
                </div>
              </div>

              {/* Shareable Data */}
              <div className="space-y-4">
                <SectionHeader>Recipient Data (Share Securely)</SectionHeader>

                {/* Recipient Secret */}
                <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-dim">Secret</span>
                    <button
                      onClick={() => handleCopy(recipientSecret, "Secret")}
                      className={cn(
                        "text-xs px-3 py-1 rounded transition-all",
                        copied === "Secret"
                          ? "bg-terminal-green/20 text-terminal-green"
                          : "bg-bg-card text-text-dim hover:text-white"
                      )}
                    >
                      {copied === "Secret" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-white break-all">
                    {recipientSecret}
                  </p>
                </div>

                {/* New Commitment */}
                <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-dim">Commitment</span>
                    <button
                      onClick={() => handleCopy(newCommitment, "Commitment")}
                      className={cn(
                        "text-xs px-3 py-1 rounded transition-all",
                        copied === "Commitment"
                          ? "bg-terminal-green/20 text-terminal-green"
                          : "bg-bg-card text-text-dim hover:text-white"
                      )}
                    >
                      {copied === "Commitment" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-white break-all">
                    {newCommitment}
                  </p>
                </div>

                {/* Amount */}
                <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-dim">Amount</span>
                    <button
                      onClick={() => handleCopy((selectedPosition?.amount || 0).toString(), "Amount")}
                      className={cn(
                        "text-xs px-3 py-1 rounded transition-all",
                        copied === "Amount"
                          ? "bg-terminal-green/20 text-terminal-green"
                          : "bg-bg-card text-text-dim hover:text-white"
                      )}
                    >
                      {copied === "Amount" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-sm text-terminal-green">
                    {formatSOL(selectedPosition?.amount || 0)} SOL ({selectedPosition?.amount || 0} lamports)
                  </p>
                </div>

                {/* Transaction */}
                {txSignature && (
                  <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-text-dim">Transaction</span>
                      <a
                        href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-terminal-green hover:underline"
                      >
                        View on Explorer
                      </a>
                    </div>
                    <p className="font-mono text-xs text-white">
                      {truncateHex(txSignature, 16)}
                    </p>
                  </div>
                )}
              </div>

              {/* Copy All Button */}
              <Button
                onClick={() => {
                  const data = `WhaleVault Private Transfer

Secret: ${recipientSecret}
Commitment: ${newCommitment}
Amount: ${selectedPosition?.amount || 0} lamports (${formatSOL(selectedPosition?.amount || 0)} SOL)

To claim: Import this position in WhaleVault using the secret and commitment above.`;
                  handleCopy(data, "All");
                }}
                fullWidth
                variant="ghost"
              >
                {copied === "All" ? "Copied All!" : "Copy All Details"}
              </Button>

              {/* Done Button */}
              <Button onClick={handleDone} fullWidth size="lg">
                Done
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Import success state
  if (showImportSuccess && importedPosition) {
    return (
      <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
        <PageHeader
          title="Import Successful"
          subtitle="The position has been added to your wallet."
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card gradient>
            <CardContent className="p-[35px] space-y-6">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-terminal-green/20 border border-terminal-green/50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">
                  Position Imported
                </h2>
                <p className="text-text-dim text-sm">
                  You can now unshield these funds to any wallet address.
                </p>
              </div>

              {/* Position Details */}
              <div className="space-y-4">
                <SectionHeader>Position Details</SectionHeader>

                <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-dim">Amount</span>
                  </div>
                  <p className="font-mono text-lg text-terminal-green">
                    {formatSOL(importedPosition.amount)} SOL
                  </p>
                </div>

                <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-dim">Pool</span>
                  </div>
                  <p className="font-mono text-sm text-white">
                    {getPoolLabel(importedPosition.amount)} Pool
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button onClick={handleUnshieldNow} fullWidth size="lg">
                  Unshield Now
                </Button>
                <Button onClick={handleImportDone} fullWidth variant="ghost">
                  View Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
      {/* Page Header */}
      <PageHeader
        title="Private Transfer"
        subtitle={pageMode === "send"
          ? "Transfer shielded funds to another address without revealing sender, recipient, or amount on-chain."
          : "Import a transfer you received from another user."
        }
      />

      {/* Mode Toggle - Shield page style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex gap-4"
      >
        <button
          onClick={() => setPageMode("send")}
          className={cn(
            "flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border transition-all duration-300",
            pageMode === "send"
              ? "bg-terminal-green border-terminal-green/50"
              : "bg-transparent border-border hover:border-text-dim"
          )}
        >
          <svg
            className={cn(
              "w-5 h-5",
              pageMode === "send" ? "text-bg-dark" : "text-text-dim"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span className={cn(
            "font-semibold",
            pageMode === "send" ? "text-bg-dark" : "text-text-dim"
          )}>
            Send
          </span>
          {pageMode === "send" && (
            <span className="px-2.5 py-0.5 rounded-full bg-[rgba(0,0,0,0.2)] text-xs text-bg-dark font-medium flex items-center gap-1">
              Private
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          )}
        </button>

        <button
          onClick={() => setPageMode("receive")}
          className={cn(
            "flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border transition-all duration-300",
            pageMode === "receive"
              ? "bg-terminal-green border-terminal-green/50"
              : "bg-transparent border-border hover:border-text-dim"
          )}
        >
          <svg
            className={cn(
              "w-5 h-5",
              pageMode === "receive" ? "text-bg-dark" : "text-text-dim"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className={cn(
            "font-semibold",
            pageMode === "receive" ? "text-bg-dark" : "text-text-dim"
          )}>
            Receive
          </span>
        </button>
      </motion.div>

      {/* SEND MODE */}
      {pageMode === "send" && (
        <>
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
                      You don&apos;t have any shielded positions to transfer. Shield some
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
                    <SectionHeader>Select Position</SectionHeader>
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

                  {/* Recipient Section */}
                  {selectedPosition && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <SectionHeader>Recipient Address</SectionHeader>
                      <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4 space-y-3">
                        <input
                          type="text"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          placeholder="Enter Solana address (e.g., 7xKX...)"
                          disabled={isLoading}
                          className="w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border border-terminal-green text-white font-mono text-sm placeholder-text-dim focus:outline-none disabled:opacity-50"
                        />
                        <p className="text-xs text-text-dim">
                          The recipient will receive a new shielded position. They&apos;ll need
                          the secret and commitment (shown after transfer) to unshield.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Privacy Info */}
                  {selectedPosition && (
                    <div className="bg-[rgba(0,160,136,0.08)] border border-[rgba(0,160,136,0.2)] rounded-lg p-5 mb-[25px]">
                      <div className="text-terminal-green text-[13px] font-semibold mb-[10px] flex items-center gap-2">
                        <span>+</span> Maximum Privacy
                      </div>
                      <p className="text-xs text-text-dim leading-[1.8]">
                        Private transfers keep funds in the shielded pool. No SOL moves
                        on-chain between addresses - only the commitment changes. Observers
                        can&apos;t see who sent to whom or how much was transferred.
                      </p>
                    </div>
                  )}

                  {/* Transaction Modal */}
                  <TransactionModal
                    isOpen={isLoading}
                    progress={proofProgress}
                    stage={proofStage}
                    title="Private Transfer"
                    subtitle={selectedPosition ? `${formatSOL(selectedPosition.shieldedAmount)} SOL` : undefined}
                  />

                  {/* Submit Button */}
                  <Button
                    onClick={handleTransfer}
                    loading={isLoading}
                    fullWidth
                    size="lg"
                    disabled={
                      !selectedPosition ||
                      isLoading ||
                      !recipientAddress.trim()
                    }
                  >
                    {getButtonText()}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {/* RECEIVE/IMPORT MODE */}
      {pageMode === "receive" && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card gradient>
            <CardContent className="p-[35px] space-y-6">
              {/* Input Mode Toggle */}
              <div className="flex gap-2 p-1 bg-[rgba(0,0,0,0.3)] rounded-lg">
                <button
                  onClick={() => setImportInputMode("paste")}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all",
                    importInputMode === "paste"
                      ? "bg-terminal-green/20 text-terminal-green"
                      : "text-text-dim hover:text-white"
                  )}
                >
                  Paste Details
                </button>
                <button
                  onClick={() => setImportInputMode("manual")}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all",
                    importInputMode === "manual"
                      ? "bg-terminal-green/20 text-terminal-green"
                      : "text-text-dim hover:text-white"
                  )}
                >
                  Enter Manually
                </button>
              </div>

              {/* Paste Mode */}
              {importInputMode === "paste" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <SectionHeader>Paste Transfer Details</SectionHeader>
                  <div className="space-y-2">
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={`Paste the text shared by the sender, e.g.:

WhaleVault Private Transfer

Secret: abc123...
Commitment: def456...
Amount: 1000000000 lamports`}
                      rows={8}
                      className="w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border border-border text-white font-mono text-sm placeholder-text-dim/50 focus:outline-none focus:border-terminal-green resize-none"
                    />
                    {pasteText.trim() && manualSecret && (
                      <p className="text-xs text-terminal-green flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Parsed: {formatSOL(parseInt(manualAmount || "0", 10))} SOL
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Manual Mode */}
              {importInputMode === "manual" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <SectionHeader>Enter Details Manually</SectionHeader>

                  {/* Secret Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-text-dim">Secret</label>
                    <input
                      type="text"
                      value={manualSecret}
                      onChange={(e) => setManualSecret(e.target.value)}
                      placeholder="64 hexadecimal characters"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border text-white font-mono text-sm placeholder-text-dim focus:outline-none",
                        !secretValid
                          ? "border-red-500"
                          : manualSecret.trim() && secretValid
                          ? "border-terminal-green"
                          : "border-border"
                      )}
                    />
                    {!secretValid && (
                      <p className="text-xs text-red-400">Must be 64 hex characters</p>
                    )}
                  </div>

                  {/* Commitment Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-text-dim">Commitment</label>
                    <input
                      type="text"
                      value={manualCommitment}
                      onChange={(e) => setManualCommitment(e.target.value)}
                      placeholder="64 hexadecimal characters"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border text-white font-mono text-sm placeholder-text-dim focus:outline-none",
                        !commitmentValid
                          ? "border-red-500"
                          : manualCommitment.trim() && commitmentValid
                          ? "border-terminal-green"
                          : "border-border"
                      )}
                    />
                    {!commitmentValid && (
                      <p className="text-xs text-red-400">Must be 64 hex characters</p>
                    )}
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-text-dim">Amount (lamports)</label>
                    <input
                      type="text"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g., 1000000000"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border text-white font-mono text-sm placeholder-text-dim focus:outline-none",
                        !amountValid
                          ? "border-red-500"
                          : manualAmount.trim() && amountValid
                          ? "border-terminal-green"
                          : "border-border"
                      )}
                    />
                    {manualAmount && amountValid && (
                      <p className="text-xs text-text-dim">
                        = {formatSOL(parseInt(manualAmount, 10))} SOL ({getPoolLabel(parseInt(manualAmount, 10))} Pool)
                      </p>
                    )}
                    {!amountValid && (
                      <p className="text-xs text-red-400">Must be a positive number</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Error Display */}
              {importError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
                >
                  <p className="text-sm text-red-400">{importError}</p>
                </motion.div>
              )}

              {/* Info Box */}
              <div className="bg-[rgba(0,160,136,0.08)] border border-[rgba(0,160,136,0.2)] rounded-lg p-5">
                <div className="text-terminal-green text-[13px] font-semibold mb-[10px] flex items-center gap-2">
                  <span>+</span> How It Works
                </div>
                <p className="text-xs text-text-dim leading-[1.8]">
                  When someone sends you a private transfer, they share a secret, commitment, and amount.
                  Import these details to add the position to your wallet. You can then unshield the funds
                  to any address you control.
                </p>
              </div>

              {/* Import Button */}
              <Button
                onClick={handleImport}
                fullWidth
                size="lg"
                disabled={!canImport}
              >
                Import Position
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
