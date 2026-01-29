"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/hooks/useWallet";
import { useTransactionsStore } from "@/stores/transactions";
import { usePositionsStore } from "@/stores/positions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { cn } from "@/lib/utils";
import { LAMPORTS_PER_SOL } from "@/lib/constants";
import Link from "next/link";
import type { Transaction } from "@/types";

const STORAGE_KEY = "whalevault_transactions";

type FilterTab = "all" | "shield" | "unshield" | "swap";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "shield", label: "SHIELD" },
  { key: "unshield", label: "WITHDRAW" },
  { key: "swap", label: "SWAP" },
];

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatLogTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getTypeIcon(type: Transaction["type"]): string {
  if (type === "shield") return "◇";
  if (type === "unshield") return "↗";
  return "⇄";
}

function shortenHash(hash: string): string {
  if (!hash) return "";
  return `${hash.slice(0, 5)}...${hash.slice(-4)}`;
}

export default function HistoryPage() {
  const { connected } = useWallet();
  const { transactions, setTransactions } = useTransactionsStore();
  const { positions } = usePositionsStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [blockNumber, setBlockNumber] = useState(234891026);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setTransactions(JSON.parse(stored));
    }
  }, [setTransactions]);

  // Increment block number every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNumber((prev) => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatSOL = (lamports: number) =>
    (lamports / LAMPORTS_PER_SOL).toFixed(2);

  const filteredTransactions = useMemo(() => {
    let result = activeFilter === "all"
      ? transactions
      : transactions.filter((tx) => tx.type === activeFilter);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.txHash?.toLowerCase().includes(query) ||
          tx.type.toLowerCase().includes(query) ||
          formatSOL(tx.amount).includes(query)
      );
    }

    return result;
  }, [transactions, activeFilter, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const shieldTxs = transactions.filter((tx) => tx.type === "shield");
    const unshieldTxs = transactions.filter((tx) => tx.type === "unshield");
    // Note: swap type may not exist yet in Transaction type
    const swapTxs = transactions.filter((tx) => (tx.type as string) === "swap");

    const totalShielded = shieldTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawn = unshieldTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const feesPaid = transactions.length * 0.003 * (totalShielded / LAMPORTS_PER_SOL);

    return {
      total: transactions.length,
      totalShielded,
      totalWithdrawn,
      totalSwapped: swapTxs.length,
      feesPaid,
    };
  }, [transactions]);

  // Recent activity log (last 5 transactions)
  const activityLog = useMemo(() => {
    return [...transactions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [transactions]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-xl bg-bg-card border border-border flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-text-dim">◈</span>
          </div>
          <h1 className="font-heading text-2xl font-semibold text-white mb-2">
            Connect Your Wallet
          </h1>
          <p className="text-text-dim font-mono">
            Connect your wallet to view transaction history
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto px-6 md:px-10 space-y-6 pb-20">
      {/* Page Header */}
      <PageHeader
        title="Transaction History"
        subtitle="View all your shielded transactions"
      />

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        {/* Left Column - Transactions */}
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <SectionHeader>Transaction History</SectionHeader>
          </motion.div>

          {/* Search Box */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 bg-bg border border-border p-4 transition-all focus-within:border-terminal-green focus-within:shadow-[0_0_20px_rgba(0,160,136,0.1)]"
          >
            <span className="text-terminal-green font-mono">{">"}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search by hash, amount, or type..."
              className="flex-1 bg-transparent border-none text-white font-mono text-sm outline-none placeholder:text-text-muted"
            />
          </motion.div>

          {/* Filter Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-2"
          >
            {FILTER_TABS.map((tab, index) => (
              <motion.button
                key={tab.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.35 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  "px-4 py-2 font-mono text-sm border transition-all",
                  activeFilter === tab.key
                    ? "border-terminal-green text-terminal-green bg-terminal-green/5"
                    : "border-border text-text-dim hover:border-terminal-dark hover:text-white bg-bg"
                )}
              >
                {tab.label}
              </motion.button>
            ))}
          </motion.div>

          {/* Transaction Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-bg-card border border-border overflow-hidden"
          >
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-3xl mb-4">📭</div>
                <div className="text-text-dim mb-2 font-mono text-sm">No transactions found</div>
                <Link
                  href="/shield"
                  className="text-terminal-green hover:underline font-mono text-sm"
                >
                  $ shield --first-transaction →
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-text-muted font-normal text-xs tracking-wider">TYPE</th>
                    <th className="text-left p-4 text-text-muted font-normal text-xs tracking-wider">AMOUNT</th>
                    <th className="text-left p-4 text-text-muted font-normal text-xs tracking-wider">TX_HASH</th>
                    <th className="text-left p-4 text-text-muted font-normal text-xs tracking-wider">STATUS</th>
                    <th className="text-left p-4 text-text-muted font-normal text-xs tracking-wider">TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, index) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.45 + index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      className="border-b border-dotted border-border last:border-b-0 hover:bg-terminal-green/[0.02] transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-7 h-7 rounded flex items-center justify-center text-sm",
                              tx.type === "shield" && "bg-terminal-green/10 text-terminal-green",
                              tx.type === "unshield" && "bg-blue-500/10 text-blue-400",
                              (tx.type as string) === "swap" && "bg-purple-500/10 text-purple-400"
                            )}
                          >
                            {getTypeIcon(tx.type)}
                          </div>
                          <span className="text-white font-mono text-sm">{tx.type}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "font-mono text-sm",
                            tx.type === "shield" && "text-terminal-green",
                            tx.type === "unshield" && "text-red-400"
                          )}
                        >
                          {tx.type === "shield" ? "+" : tx.type === "unshield" ? "-" : ""}
                          {formatSOL(tx.amount)} {tx.token}
                        </span>
                      </td>
                      <td className="p-4">
                        <a
                          href={`https://solscan.io/tx/${tx.txHash}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-dim font-mono text-sm hover:text-terminal-green hover:underline transition-colors cursor-pointer"
                        >
                          {shortenHash(tx.txHash)}
                        </a>
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono",
                            tx.status === "confirmed" && "text-terminal-green bg-terminal-green/10",
                            tx.status === "pending" && "text-yellow-500 bg-yellow-500/10",
                            tx.status === "failed" && "text-red-500 bg-red-500/10"
                          )}
                        >
                          <span className="text-[8px]">●</span>
                          {tx.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-text-muted font-mono text-sm">
                          {formatRelativeTime(tx.timestamp)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </motion.div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Quick Commands */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <SectionHeader>Quick Commands</SectionHeader>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-xl border border-border overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(0,160,136,0.03) 0%, rgba(0,0,0,0.4) 100%)",
              }}
            >
              {/* Gradient top edge */}
              <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(0,160,136,0.3) 50%, transparent 100%)",
                }}
              />
              <div className="p-5 space-y-3">
                {[
                  { href: "/shield", cmd: "shield --amount" },
                  { href: "/unshield", cmd: "withdraw --stealth" },
                  { href: "/private-swap", cmd: "swap --private" },
                  { href: "/history", cmd: "history --all", active: true },
                ].map((item) => (
                  <Link
                    key={item.cmd}
                    href={item.href}
                    className={cn(
                      "block px-4 py-3 rounded-lg border font-mono text-sm transition-all",
                      item.active
                        ? "border-border text-terminal-green bg-[rgba(0,160,136,0.08)]"
                        : "border-border text-text-dim hover:border-terminal-dark hover:text-terminal-green bg-[rgba(0,0,0,0.3)]"
                    )}
                  >
                    <span className="text-terminal-green">$ </span>
                    {item.cmd}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Statistics */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <SectionHeader>Statistics</SectionHeader>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-xl border border-border overflow-hidden"
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
              <div className="p-5">
                {[
                  { label: "total_transactions", value: stats.total.toString() },
                  { label: "total_shielded", value: `${formatSOL(stats.totalShielded)} SOL`, highlight: true },
                  { label: "total_withdrawn", value: `${formatSOL(stats.totalWithdrawn)} SOL` },
                  { label: "total_swapped", value: stats.totalSwapped.toString() },
                  { label: "fees_paid", value: `${stats.feesPaid.toFixed(4)} SOL` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex justify-between py-2.5 border-b border-dotted border-border/50 last:border-b-0"
                  >
                    <span className="text-text-dim font-mono text-sm">
                      <span className="text-terminal-green">{"> "}</span>
                      {stat.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm",
                        stat.highlight ? "text-terminal-green" : "text-white"
                      )}
                      style={stat.highlight ? { textShadow: "0 0 10px rgba(0, 160, 136, 0.5)" } : undefined}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Export Button */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-xl border border-border overflow-hidden"
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
            <button
              onClick={() => {
                const csv = transactions.map(tx =>
                  `${tx.type},${formatSOL(tx.amount)},${tx.token},${tx.txHash},${tx.status},${new Date(tx.timestamp).toISOString()}`
                ).join("\n");
                const blob = new Blob([`type,amount,token,hash,status,timestamp\n${csv}`], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "whalevault-history.csv";
                a.click();
              }}
              className="w-full p-5 font-mono text-sm text-text-dim text-left hover:text-terminal-green transition-all"
            >
              <span className="text-terminal-green">$ </span>
              export --format csv --range all
            </button>
          </motion.div>
        </div>
      </div>

      {/* Recent Activity - Full Width */}
      <div>
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <SectionHeader>Recent Activity</SectionHeader>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-xl border border-border overflow-hidden"
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
          <div className="p-5">
            {activityLog.length === 0 ? (
              <div className="text-text-muted font-mono text-sm text-center py-4">
                No activity yet
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {activityLog.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex gap-3 font-mono text-sm"
                  >
                    <span className="text-text-muted">[{formatLogTime(tx.timestamp)}]</span>
                    <span className="text-terminal-green">
                      {tx.type.toUpperCase()}
                    </span>
                    <span className="text-white">
                      {formatSOL(tx.amount)} {tx.token}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Network Status Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-6 px-5 py-4 rounded-xl bg-[rgba(0,0,0,0.4)] border border-border"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
          <span className="text-text-dim font-mono text-sm">Devnet</span>
        </div>
        <span className="text-terminal-green animate-cursor-blink">|</span>
        <span className="text-text-dim font-mono text-sm">
          Block {blockNumber.toLocaleString()}
        </span>
      </motion.div>
    </div>
  );
}
