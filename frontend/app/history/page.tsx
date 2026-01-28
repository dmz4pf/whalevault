"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { useTransactionsStore } from "@/stores/transactions";
import { formatAddress } from "@/lib/utils";
import { LAMPORTS_PER_SOL } from "@/lib/constants";
import Link from "next/link";
import type { Transaction } from "@/types";

const STORAGE_KEY = "whalevault_transactions";

type FilterTab = "all" | "shield" | "unshield";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shield", label: "Shield" },
  { key: "unshield", label: "Withdraw" },
];

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getStatusColor(status: Transaction["status"]): string {
  switch (status) {
    case "confirmed":
      return "text-green-400 bg-green-400/10";
    case "pending":
      return "text-yellow-400 bg-yellow-400/10";
    case "failed":
      return "text-red-400 bg-red-400/10";
    default:
      return "text-gray-400 bg-gray-400/10";
  }
}

function TypeIcon({ type }: { type: Transaction["type"] }) {
  if (type === "shield") {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
      />
    </svg>
  );
}

export default function HistoryPage() {
  const { connected } = useWallet();
  const { transactions, setTransactions } = useTransactionsStore();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setTransactions(JSON.parse(stored));
    }
  }, [setTransactions]);

  const formatSOL = (lamports: number) =>
    (lamports / LAMPORTS_PER_SOL).toFixed(4);

  const filteredTransactions =
    activeFilter === "all"
      ? transactions
      : transactions.filter((tx) => tx.type === activeFilter);

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
            Connect your wallet to view your transaction history
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          Transaction History
        </h1>
        <p className="text-gray-400">
          View all your shield and withdraw transactions.
        </p>
      </motion.div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Transactions</h2>
            {transactions.length > 0 && (
              <span className="text-sm text-gray-400">
                {filteredTransactions.length} transaction
                {filteredTransactions.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {transactions.length > 0 && (
            <div className="flex overflow-x-auto gap-2 mt-4 pb-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeFilter === tab.key
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <svg
                  className="w-10 h-10 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No transactions yet
              </h3>
              <p className="text-gray-400 mb-8 max-w-sm">
                Start by shielding some assets to see your transaction history
                here.
              </p>
              <Link href="/shield">
                <Button>Shield Your First Asset</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.type === "shield"
                          ? "bg-whale-500/20 text-whale-400"
                          : "bg-vault-500/20 text-vault-400"
                      }`}
                    >
                      <TypeIcon type={tx.type} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            tx.type === "shield"
                              ? "bg-whale-500/20 text-whale-400"
                              : "bg-vault-500/20 text-vault-400"
                          }`}
                        >
                          {tx.type === "shield" ? "Shield" : "Withdraw"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            tx.status
                          )}`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {formatRelativeTime(tx.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-white">
                      {formatSOL(tx.amount)} {tx.token}
                    </div>
                    <a
                      href={`https://solscan.io/tx/${tx.txHash}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-vault-400 hover:text-vault-300 transition-colors"
                    >
                      {formatAddress(tx.txHash, 6)}
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
