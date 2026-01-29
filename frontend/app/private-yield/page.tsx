"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import Link from "next/link";
import { cn } from "@/lib/utils";

const YIELD_PROTOCOLS = [
  {
    id: "jito",
    name: "Jito Staking",
    description: "Liquid staking with MEV rewards",
    apy: "~7-8%",
    risk: "Low",
    status: "Active",
    statusType: "active" as const,
  },
  {
    id: "kamino",
    name: "Kamino Lending",
    description: "Earn yield by lending SOL",
    apy: "~10-15%",
    risk: "Medium",
    status: "Coming Soon",
    statusType: "coming-soon" as const,
  },
  {
    id: "marinade",
    name: "Marinade Finance",
    description: "Decentralized liquid staking",
    apy: "~6-7%",
    risk: "Low",
    status: "Planned",
    statusType: "planned" as const,
  },
];

const FEATURES = [
  {
    title: "Hidden Positions",
    description: "Your deposit size, wallet address, and strategy remain completely private on-chain.",
    icon: "👁️‍🗨️",
  },
  {
    title: "Aggregated Deposits",
    description: "Your funds join other users' deposits, creating a large anonymity set that hides individual positions.",
    icon: "👥",
  },
  {
    title: "Private Withdrawals",
    description: "Withdraw your principal + yield to any address without linking it to your original deposit.",
    icon: "🔐",
  },
  {
    title: "Battle-Tested Protocols",
    description: "We only integrate with audited, high-TVL protocols like Jito ($2B+) and Kamino ($1B+).",
    icon: "🛡️",
  },
];

const STEPS = [
  {
    number: "[1]",
    title: "Shield Your Assets",
    description: "Deposit SOL into WhaleVault's shielded pools using zero-knowledge proofs.",
  },
  {
    number: "[2]",
    title: "Earn Private Yield",
    description: "Your funds join an aggregate pool that earns yield from protocols like Jito.",
  },
  {
    number: "[3]",
    title: "Withdraw Anonymously",
    description: "Withdraw principal + yield to any wallet without revealing your identity.",
  },
];

export default function PrivateYieldPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-16 pb-20">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-8"
      >
        {/* Coming Soon Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-terminal-green/10 border border-terminal-green/30 rounded-full mb-6">
          <span className="w-2 h-2 bg-terminal-green rounded-full animate-pulse" />
          <span className="text-terminal-green text-sm font-mono">Coming Soon</span>
        </div>

        <h1 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
          <span className="text-text-dim">&gt; </span>
          Private{" "}
          <span className="text-terminal-green" style={{ textShadow: "0 0 30px rgba(0, 160, 136, 0.4)" }}>
            Yield
          </span>
        </h1>
        <p className="text-text-dim text-lg md:text-xl max-w-2xl leading-relaxed">
          Earn yield on your shielded assets without revealing your position size, wallet address, or strategy.
        </p>
      </motion.div>

      {/* Value Proposition Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-bg-card border border-border rounded-xl overflow-hidden relative"
      >
        {/* Subtle glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-terminal-green/[0.03] to-transparent pointer-events-none" />

        <div className="p-8 md:p-10 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="flex-1">
              <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-4">
                THE PROBLEM
              </div>
              <h2 className="font-heading text-2xl md:text-3xl font-semibold text-white mb-4">
                The Problem with DeFi Yield
              </h2>
              <p className="text-text-dim mb-4 leading-relaxed">
                Today, earning yield on Solana means exposing everything. Your deposit amount, wallet address, and strategy are all visible on-chain. Competitors can copy your moves. MEV bots can front-run you. Adversaries know exactly how much you hold.
              </p>
              <p className="text-text font-medium">
                Private Yield changes that. Your funds earn yield while staying completely private.
              </p>
            </div>
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-xl bg-terminal-green/10 border border-terminal-green/20 flex items-center justify-center shrink-0">
              <div className="text-6xl md:text-7xl text-terminal-green" style={{ textShadow: "0 0 40px rgba(0, 160, 136, 0.5)" }}>
                💰
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* How It Works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-8"
      >
        <SectionHeader>How It Works</SectionHeader>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1 }}
              className="bg-bg-card border border-border rounded-xl p-6 hover:border-terminal-dark transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-terminal-green/20 flex items-center justify-center text-terminal-green font-heading font-bold shrink-0">
                  {step.number}
                </div>
                <div>
                  <div className="text-white font-heading text-lg mb-2">{step.title}</div>
                  <div className="text-text-dim text-sm leading-relaxed">{step.description}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-8"
      >
        <SectionHeader>Privacy Features</SectionHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.1 }}
              className="bg-bg-card border border-border rounded-xl p-6 hover:border-terminal-dark transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-terminal-green/20 flex items-center justify-center text-2xl mb-4">
                {feature.icon}
              </div>
              <div className="text-white font-heading text-lg mb-2">{feature.title}</div>
              <div className="text-text-dim text-sm leading-relaxed">{feature.description}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Yield Protocols */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-8"
      >
        <SectionHeader>Yield Protocols</SectionHeader>

        <div className="grid md:grid-cols-3 gap-6">
          {YIELD_PROTOCOLS.map((protocol, i) => {
            const isActive = protocol.statusType === "active";
            const isComingSoon = protocol.statusType === "coming-soon";
            const isPlanned = protocol.statusType === "planned";

            return (
              <motion.div
                key={protocol.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 + i * 0.1 }}
                className={cn(
                  "bg-bg-card border rounded-xl p-6 transition-all",
                  isActive ? "border-terminal-green" : "border-border hover:border-terminal-dark"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-lg">
                      {protocol.id === "jito" && "🟣"}
                      {protocol.id === "kamino" && "🔵"}
                      {protocol.id === "marinade" && "🟢"}
                    </div>
                    <span className="text-white font-heading">{protocol.name}</span>
                  </div>
                </div>

                <p className="text-text-dim text-sm mb-4">{protocol.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-dim">APY</span>
                    <span className="text-terminal-green font-medium">{protocol.apy}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-dim">Risk</span>
                    <span className={cn(
                      "font-medium",
                      protocol.risk === "Low" && "text-green-400",
                      protocol.risk === "Medium" && "text-yellow-400"
                    )}>{protocol.risk}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded",
                    isActive && "bg-terminal-green/20 text-terminal-green",
                    isComingSoon && "bg-yellow-500/20 text-yellow-500",
                    isPlanned && "bg-text-muted/20 text-text-muted"
                  )}>
                    {protocol.status}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-bg-card border border-border rounded-xl p-8 md:p-12 text-center relative overflow-hidden"
      >
        {/* Subtle glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-terminal-green/[0.03] to-transparent pointer-events-none" />

        <div className="relative z-10">
          <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-4">
            GET STARTED
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-semibold text-white mb-3">
            Ready to Earn Private Yield?
          </h2>
          <p className="text-text-dim mb-8 max-w-lg mx-auto">
            Private Yield is currently in development. Start by shielding your assets today — you&apos;ll be ready to earn private yield as soon as it launches.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shield">
              <Button size="lg" className="min-w-[180px] font-mono tracking-wider">
                ./shield-now
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="min-w-[180px] font-mono tracking-wider">
                ./view-dashboard
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Technical Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center text-sm text-text-dim space-y-1"
      >
        <p>Private Yield uses a share-based accounting system with encrypted position tracking.</p>
        <p>All user data is encrypted client-side before storage.</p>
        <Link
          href="https://github.com/whalevault/whalevault"
          target="_blank"
          rel="noopener noreferrer"
          className="text-terminal-green hover:text-terminal-dim transition-colors inline-block mt-2"
        >
          ./view-technical-docs
        </Link>
      </motion.div>
    </div>
  );
}
