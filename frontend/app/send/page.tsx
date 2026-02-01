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

type SendMode = "unshield" | "shielded";
type ShieldedSubMode = "send" | "receive";
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

export default function SendPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { positions: storePositions, addPosition } = usePositionsStore();

  // Unshield hook
  const {
    status: unshieldStatus,
    error: unshieldError,
    proofProgress: unshieldProgress,
    proofStage: unshieldStage,
    unshield,
    reset: resetUnshield,
  } = useUnshield();

  // Transfer hook
  const {
    status: transferStatus,
    error: transferError,
    proofProgress: transferProgress,
    proofStage: transferStage,
    recipientSecret,
    newCommitment,
    txSignature,
    transfer,
    reset: resetTransfer,
  } = usePrivateTransfer();

  // Main mode toggle
  const [sendMode, setSendMode] = useState<SendMode>("unshield");

  // Shared state
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [tick, setTick] = useState(0);

  // Unshield-specific state
  const [showUnshieldSuccess, setShowUnshieldSuccess] = useState(false);

  // Shielded transfer state
  const [shieldedSubMode, setShieldedSubMode] = useState<ShieldedSubMode>("send");
  const [showTransferSuccess, setShowTransferSuccess] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Import/Receive state
  const [importInputMode, setImportInputMode] = useState<ImportInputMode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [manualCommitment, setManualCommitment] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [importedPosition, setImportedPosition] = useState<Position | null>(null);

  // Tick every minute
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

  // Filter shielded positions
  const shieldedPositions = storePositions
    .filter((p) => p.status === "shielded")
    .sort((a, b) => b.timestamp - a.timestamp);

  // Loading states
  const isUnshieldLoading = ["deriving", "requesting", "generating", "relaying", "confirming"].includes(unshieldStatus);
  const isTransferLoading = ["deriving", "requesting", "generating", "relaying", "confirming"].includes(transferStatus);
  const isLoading = isUnshieldLoading || isTransferLoading;

  // Handle unshield success
  useEffect(() => {
    if (unshieldStatus === "success") {
      toast.success("Sent to wallet!");
      setSelectedPosition(null);
      resetUnshield();
      setTimeout(() => router.push("/dashboard"), 1500);
    } else if (unshieldStatus === "error" && unshieldError) {
      toast.error("Failed", { description: unshieldError });
    }
  }, [unshieldStatus, unshieldError, resetUnshield, router]);

  // Handle transfer success
  useEffect(() => {
    if (transferStatus === "success" && recipientSecret && newCommitment) {
      toast.success("Transfer complete!");
      setShowTransferSuccess(true);
    } else if (transferStatus === "error" && transferError) {
      toast.error("Transfer failed", { description: transferError });
    }
  }, [transferStatus, transferError, recipientSecret, newCommitment]);

  const handleUnshield = async () => {
    if (!selectedPosition || !publicKey) return;
    const recipient = recipientAddress.trim() || undefined;
    await unshield(selectedPosition, recipient);
  };

  const handleTransfer = async () => {
    if (!selectedPosition || !publicKey || !recipientAddress.trim()) return;
    await transfer(selectedPosition, recipientAddress.trim());
  };

  const handleImport = () => {
    setImportError(null);
    let secret: string, commitment: string, amount: number;

    if (importInputMode === "paste") {
      const result = parseTransferDetails(pasteText);
      if (!result.success || !result.data) {
        setImportError(result.error || "Could not parse transfer details");
        return;
      }
      ({ secret, commitment, amount } = result.data);
    } else {
      const result = validateManualEntry(manualSecret, manualCommitment, manualAmount);
      if (!result.success || !result.data) {
        setImportError(result.error || "Invalid input");
        return;
      }
      ({ secret, commitment, amount } = result.data);
    }

    if (storePositions.find((p) => p.commitment === commitment)) {
      setImportError("This transfer has already been imported");
      return;
    }

    const position: Position = {
      id: commitment,
      token: "SOL",
      amount,
      shieldedAmount: amount,
      timestamp: Date.now(),
      status: "shielded",
      commitment,
      secret,
      denomination: detectDenomination(amount),
    };

    addPosition(position);
    setImportedPosition(position);
    setShowImportSuccess(true);
    toast.success("Position imported!");
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTransferDone = () => {
    setShowTransferSuccess(false);
    setSelectedPosition(null);
    setRecipientAddress("");
    setCopied(null);
    resetTransfer();
    router.push("/dashboard");
  };

  const formatSOL = (lamports: number) => (lamports / LAMPORTS_PER_SOL).toFixed(4);

  const relayerFee = selectedPosition ? Math.floor(selectedPosition.shieldedAmount * 0.003) : 0;
  const receiveAmount = selectedPosition ? selectedPosition.shieldedAmount - relayerFee : 0;

  // Validation for import
  const secretValid = manualSecret.trim() === "" || validateHex64(manualSecret);
  const commitmentValid = manualCommitment.trim() === "" || validateHex64(manualCommitment);
  const amountValid = manualAmount.trim() === "" || parseInt(manualAmount, 10) > 0;
  const canImport = importInputMode === "paste"
    ? pasteText.trim().length > 0
    : manualSecret.trim() && manualCommitment.trim() && manualAmount.trim();

  // Not connected
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-24 h-24 rounded-full bg-bg-card border border-border flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-white mb-2">Connect Your Wallet</h1>
          <p className="text-text-dim mb-6">Connect your wallet to send funds</p>
        </motion.div>
      </div>
    );
  }

  // Transfer success state
  if (showTransferSuccess && recipientSecret && newCommitment) {
    return (
      <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
        <PageHeader title="Transfer Complete" subtitle="Share these details with the recipient so they can claim the funds." />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <Card gradient>
            <CardContent className="p-[35px] space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-terminal-green/20 border border-terminal-green/50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">{formatSOL(selectedPosition?.amount || 0)} SOL Sent</h2>
                <p className="text-text-dim text-sm">The funds are now in a shielded position owned by the recipient.</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-400 mt-0.5 text-lg">!</span>
                  <div>
                    <p className="text-sm font-medium text-yellow-400 mb-1">Important: Share These Details</p>
                    <p className="text-sm text-text-dim">The recipient needs the info below to withdraw. If lost, funds cannot be recovered.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <SectionHeader>Recipient Data</SectionHeader>
                {[
                  { label: "Secret", value: recipientSecret },
                  { label: "Commitment", value: newCommitment },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-text-dim">{label}</span>
                      <button onClick={() => handleCopy(value, label)} className={cn("text-xs px-3 py-1 rounded transition-all", copied === label ? "bg-terminal-green/20 text-terminal-green" : "bg-bg-card text-text-dim hover:text-white")}>
                        {copied === label ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-white break-all">{value}</p>
                  </div>
                ))}
                <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-text-dim">Amount</span>
                    <button onClick={() => handleCopy((selectedPosition?.amount || 0).toString(), "Amount")} className={cn("text-xs px-3 py-1 rounded transition-all", copied === "Amount" ? "bg-terminal-green/20 text-terminal-green" : "bg-bg-card text-text-dim hover:text-white")}>
                      {copied === "Amount" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-sm text-terminal-green">{formatSOL(selectedPosition?.amount || 0)} SOL ({selectedPosition?.amount || 0} lamports)</p>
                </div>
              </div>
              <Button onClick={() => { const data = `WhaleVault Private Transfer\n\nSecret: ${recipientSecret}\nCommitment: ${newCommitment}\nAmount: ${selectedPosition?.amount || 0} lamports (${formatSOL(selectedPosition?.amount || 0)} SOL)\n\nTo claim: Import this in WhaleVault > Send > Receive tab.`; handleCopy(data, "All"); }} fullWidth variant="ghost">
                {copied === "All" ? "Copied All!" : "Copy All Details"}
              </Button>
              <Button onClick={handleTransferDone} fullWidth size="lg">Done</Button>
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
        <PageHeader title="Import Successful" subtitle="The position has been added to your wallet." />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <Card gradient>
            <CardContent className="p-[35px] space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-terminal-green/20 border border-terminal-green/50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-semibold text-white mb-2">Position Imported</h2>
                <p className="text-text-dim text-sm">You can now send these funds to any wallet.</p>
              </div>
              <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4">
                <span className="text-sm text-text-dim">Amount</span>
                <p className="font-mono text-lg text-terminal-green mt-1">{formatSOL(importedPosition.amount)} SOL</p>
              </div>
              <div className="space-y-3">
                <Button onClick={() => { setShowImportSuccess(false); setSendMode("unshield"); }} fullWidth size="lg">Send to Wallet</Button>
                <Button onClick={() => router.push("/dashboard")} fullWidth variant="ghost">View Dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-10 lg:px-[50px] space-y-8">
      <PageHeader
        title="Send"
        subtitle={sendMode === "unshield"
          ? "Send funds from your shielded position to any wallet address."
          : shieldedSubMode === "send"
          ? "Transfer a shielded position to another person. They receive the position privately."
          : "Import a shielded position someone sent you."
        }
      />

      {/* Main Mode Toggle */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex gap-4">
        <button
          onClick={() => setSendMode("unshield")}
          className={cn("flex-1 py-4 px-6 rounded-2xl border transition-all duration-300", sendMode === "unshield" ? "bg-terminal-green border-terminal-green/50" : "bg-transparent border-border hover:border-text-dim")}
        >
          <div className={cn("font-semibold mb-1", sendMode === "unshield" ? "text-bg-dark" : "text-text-dim")}>Unshield to Wallet</div>
          <div className={cn("text-xs", sendMode === "unshield" ? "text-bg-dark/70" : "text-text-dim/70")}>Private withdrawal → SOL sent to any wallet</div>
        </button>
        <button
          onClick={() => setSendMode("shielded")}
          className={cn("flex-1 py-4 px-6 rounded-2xl border transition-all duration-300", sendMode === "shielded" ? "bg-terminal-green border-terminal-green/50" : "bg-transparent border-border hover:border-text-dim")}
        >
          <div className={cn("font-semibold mb-1", sendMode === "shielded" ? "text-bg-dark" : "text-text-dim")}>Send Shielded Position</div>
          <div className={cn("text-xs", sendMode === "shielded" ? "text-bg-dark/70" : "text-text-dim/70")}>Stays private → recipient imports position</div>
        </button>
      </motion.div>

      {/* UNSHIELD MODE */}
      {sendMode === "unshield" && (
        <>
          {shieldedPositions.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
              <Card gradient>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-bg-card border border-border flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No Shielded Positions</h3>
                    <p className="text-text-dim mb-6 max-w-sm">Shield some assets first to use this feature.</p>
                    <Link href="/shield"><Button>Go to Shield</Button></Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
              <Card gradient>
                <CardContent className="p-[35px] space-y-6">
                  <div className="space-y-4">
                    <SectionHeader>{selectedPosition ? "Position Selected" : "Select Position"}</SectionHeader>

                    {selectedPosition ? (
                      /* Compact view when position is selected */
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-terminal-green/15 border border-terminal-green/40 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-terminal-green/20 flex items-center justify-center">
                              <span className="text-terminal-green">✓</span>
                            </div>
                            <div>
                              <div className="font-mono text-terminal-green text-lg">
                                {formatSOL(selectedPosition.shieldedAmount)} SOL
                              </div>
                              <div className="text-xs text-text-dim font-mono">
                                {getDenominationLabel(selectedPosition.denomination)} Pool
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedPosition(null)}
                            className="text-xs text-text-dim hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                          >
                            Change
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      /* Full list when no position selected */
                      <div className="border border-border rounded-lg overflow-hidden max-h-[250px] overflow-y-auto">
                        {shieldedPositions.map((position, index) => {
                          const timeLeft = position.delayUntil ? formatTimeRemaining(position.delayUntil) : null;
                          const isLocked = !!timeLeft;
                          return (
                            <motion.button key={position.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                              onClick={() => !isLocked && setSelectedPosition(position)} disabled={isLoading || isLocked}
                              className={cn("w-full flex items-center justify-between py-3.5 px-4 transition-all text-left", index !== 0 && "border-t border-border/50", "border-l-2 border-l-transparent", isLocked ? "bg-yellow-500/5 cursor-not-allowed" : "hover:bg-white/[0.02]", isLoading && "opacity-50 cursor-not-allowed")}
                            >
                              <div className="flex items-center gap-3">
                                <span className={cn("font-mono text-sm w-24 text-left", isLocked ? "text-yellow-400" : "text-terminal-green")}>{formatSOL(position.shieldedAmount)} SOL</span>
                                <span className="text-xs text-text-dim font-mono">{getDenominationLabel(position.denomination)}</span>
                                {isLocked && <span className="text-xs text-yellow-400">({timeLeft})</span>}
                              </div>
                              <span className="text-xs text-text-dim">{formatRelativeTime(position.timestamp)}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedPosition && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <SectionHeader>Recipient Address</SectionHeader>
                      <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-xl p-4 space-y-3">
                        <input type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="Enter Solana address (leave empty for your wallet)" disabled={isLoading} className="w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border border-terminal-green text-white font-mono text-sm placeholder-text-dim focus:outline-none disabled:opacity-50" />
                        <p className="text-xs text-text-dim">Leave empty to send to your connected wallet, or enter any Solana address.</p>
                      </div>
                    </motion.div>
                  )}

                  {selectedPosition && (
                    <div className="bg-[rgba(0,0,0,0.3)] border border-border rounded-lg p-5">
                      <div className="flex justify-between mb-3 text-[13px]">
                        <span className="text-text-dim">Relayer fee (0.3%)</span>
                        <span className="text-white">~{formatSOL(relayerFee)} SOL</span>
                      </div>
                      <div className="flex justify-between pt-3 border-t border-border text-[13px]">
                        <span className="text-text-dim">Recipient receives</span>
                        <span className="text-terminal-green font-semibold">~{formatSOL(receiveAmount)} SOL</span>
                      </div>
                    </div>
                  )}

                  <TransactionModal isOpen={isUnshieldLoading} progress={unshieldProgress} stage={unshieldStage} title="Sending" subtitle={selectedPosition ? `${formatSOL(selectedPosition.shieldedAmount)} SOL` : undefined} />

                  <Button onClick={handleUnshield} loading={isUnshieldLoading} fullWidth size="lg" disabled={!selectedPosition || isLoading}>
                    {isUnshieldLoading ? unshieldStage || "Processing..." : "Send to Wallet"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {/* SHIELDED MODE */}
      {sendMode === "shielded" && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <Card gradient>
            <CardContent className="p-[35px] space-y-6">
              {/* Sub-mode toggle */}
              <div className="flex gap-2 p-1 bg-[rgba(0,0,0,0.3)] rounded-lg">
                <button onClick={() => setShieldedSubMode("send")} className={cn("flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all", shieldedSubMode === "send" ? "bg-terminal-green/20 text-terminal-green" : "text-text-dim hover:text-white")}>Send</button>
                <button onClick={() => setShieldedSubMode("receive")} className={cn("flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all", shieldedSubMode === "receive" ? "bg-terminal-green/20 text-terminal-green" : "text-text-dim hover:text-white")}>Receive</button>
              </div>

              {/* SEND SUB-MODE */}
              {shieldedSubMode === "send" && (
                <>
                  {shieldedPositions.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-text-dim mb-4">No shielded positions to send.</p>
                      <Link href="/shield"><Button>Go to Shield</Button></Link>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <SectionHeader>{selectedPosition ? "Position Selected" : "Select Position"}</SectionHeader>

                        {selectedPosition ? (
                          /* Compact view when position is selected */
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-terminal-green/15 border border-terminal-green/40 rounded-xl p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-terminal-green/20 flex items-center justify-center">
                                  <span className="text-terminal-green">✓</span>
                                </div>
                                <div>
                                  <div className="font-mono text-terminal-green text-lg">
                                    {formatSOL(selectedPosition.shieldedAmount)} SOL
                                  </div>
                                  <div className="text-xs text-text-dim font-mono">
                                    {getDenominationLabel(selectedPosition.denomination)} Pool
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedPosition(null)}
                                className="text-xs text-text-dim hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                              >
                                Change
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          /* Full list when no position selected */
                          <div className="border border-border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                            {shieldedPositions.map((position, index) => {
                              const timeLeft = position.delayUntil ? formatTimeRemaining(position.delayUntil) : null;
                              const isLocked = !!timeLeft;
                              return (
                                <button key={position.id} onClick={() => !isLocked && setSelectedPosition(position)} disabled={isLoading || isLocked}
                                  className={cn("w-full flex items-center justify-between py-3 px-4 transition-all text-left", index !== 0 && "border-t border-border/50", "border-l-2 border-l-transparent", isLocked ? "bg-yellow-500/5 cursor-not-allowed" : "hover:bg-white/[0.02]")}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={cn("font-mono text-sm", isLocked ? "text-yellow-400" : "text-terminal-green")}>{formatSOL(position.shieldedAmount)} SOL</span>
                                    <span className="text-xs text-text-dim">{getDenominationLabel(position.denomination)}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {selectedPosition && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                          <SectionHeader>Recipient Address</SectionHeader>
                          <input type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="Enter recipient's Solana address" disabled={isLoading} className="w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border border-border text-white font-mono text-sm placeholder-text-dim focus:outline-none focus:border-terminal-green disabled:opacity-50" />
                        </motion.div>
                      )}

                      <div className="bg-[rgba(0,160,136,0.08)] border border-[rgba(0,160,136,0.2)] rounded-lg p-4">
                        <p className="text-xs text-text-dim">The recipient will receive a shielded position. You'll need to share the secret details with them so they can import and use it.</p>
                      </div>

                      <TransactionModal isOpen={isTransferLoading} progress={transferProgress} stage={transferStage} title="Transferring" subtitle={selectedPosition ? `${formatSOL(selectedPosition.shieldedAmount)} SOL` : undefined} />

                      <Button onClick={handleTransfer} loading={isTransferLoading} fullWidth size="lg" disabled={!selectedPosition || !recipientAddress.trim() || isLoading}>
                        {isTransferLoading ? transferStage || "Processing..." : "Send Shielded Position"}
                      </Button>
                    </>
                  )}
                </>
              )}

              {/* RECEIVE SUB-MODE */}
              {shieldedSubMode === "receive" && (
                <>
                  <div className="flex gap-2 p-1 bg-[rgba(0,0,0,0.2)] rounded-lg">
                    <button onClick={() => setImportInputMode("paste")} className={cn("flex-1 py-2 px-3 rounded text-xs font-medium transition-all", importInputMode === "paste" ? "bg-terminal-green/15 text-terminal-green" : "text-text-dim hover:text-white")}>Paste Details</button>
                    <button onClick={() => setImportInputMode("manual")} className={cn("flex-1 py-2 px-3 rounded text-xs font-medium transition-all", importInputMode === "manual" ? "bg-terminal-green/15 text-terminal-green" : "text-text-dim hover:text-white")}>Enter Manually</button>
                  </div>

                  {importInputMode === "paste" ? (
                    <div className="space-y-2">
                      <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste the details shared by the sender..." rows={6} className="w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border border-border text-white font-mono text-sm placeholder-text-dim/50 focus:outline-none focus:border-terminal-green resize-none" />
                      {pasteText.trim() && manualSecret && (
                        <p className="text-xs text-terminal-green flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Parsed: {formatSOL(parseInt(manualAmount || "0", 10))} SOL
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm text-text-dim">Secret</label>
                        <input type="text" value={manualSecret} onChange={(e) => setManualSecret(e.target.value)} placeholder="64 hex characters" className={cn("w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border text-white font-mono text-sm placeholder-text-dim focus:outline-none", !secretValid ? "border-red-500" : manualSecret.trim() ? "border-terminal-green" : "border-border")} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-text-dim">Commitment</label>
                        <input type="text" value={manualCommitment} onChange={(e) => setManualCommitment(e.target.value)} placeholder="64 hex characters" className={cn("w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border text-white font-mono text-sm placeholder-text-dim focus:outline-none", !commitmentValid ? "border-red-500" : manualCommitment.trim() ? "border-terminal-green" : "border-border")} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-text-dim">Amount (lamports)</label>
                        <input type="text" value={manualAmount} onChange={(e) => setManualAmount(e.target.value.replace(/\D/g, ""))} placeholder="e.g., 1000000000" className={cn("w-full px-4 py-3 rounded-xl bg-[rgba(0,0,0,0.4)] border text-white font-mono text-sm placeholder-text-dim focus:outline-none", !amountValid ? "border-red-500" : manualAmount.trim() ? "border-terminal-green" : "border-border")} />
                        {manualAmount && amountValid && <p className="text-xs text-text-dim">= {formatSOL(parseInt(manualAmount, 10))} SOL</p>}
                      </div>
                    </div>
                  )}

                  {importError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                      <p className="text-sm text-red-400">{importError}</p>
                    </div>
                  )}

                  <Button onClick={handleImport} fullWidth size="lg" disabled={!canImport}>Import Position</Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
