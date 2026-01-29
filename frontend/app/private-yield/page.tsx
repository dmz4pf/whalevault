"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

const YIELD_PROTOCOLS = [
  {
    id: "jito",
    name: "Jito Staking",
    description: "Liquid staking with MEV rewards",
    apy: "~7-8%",
    risk: "Low",
    riskColor: "text-green-400",
    status: "First Integration",
    statusColor: "bg-whale-500/20 text-whale-400",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" className="text-purple-400" />
        <path d="M16 8v8l6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-purple-400" />
      </svg>
    ),
  },
  {
    id: "kamino",
    name: "Kamino Lending",
    description: "Earn yield by lending SOL",
    apy: "~10-15%",
    risk: "Medium",
    riskColor: "text-yellow-400",
    status: "Coming Next",
    statusColor: "bg-gray-500/20 text-gray-400",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <rect x="6" y="10" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" className="text-blue-400" />
        <path d="M10 10V8a6 6 0 1112 0v2" stroke="currentColor" strokeWidth="2" className="text-blue-400" />
      </svg>
    ),
  },
  {
    id: "marinade",
    name: "Marinade Finance",
    description: "Decentralized liquid staking",
    apy: "~6-7%",
    risk: "Low",
    riskColor: "text-green-400",
    status: "Planned",
    statusColor: "bg-gray-500/20 text-gray-400",
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
        <path d="M16 4l12 8v8l-12 8-12-8v-8l12-8z" stroke="currentColor" strokeWidth="2" className="text-teal-400" />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: "Hidden Positions",
    description: "Your deposit size, wallet address, and strategy remain completely private on-chain.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    ),
  },
  {
    title: "Aggregated Deposits",
    description: "Your funds join other users' deposits, creating a large anonymity set that hides individual positions.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: "Private Withdrawals",
    description: "Withdraw your principal + yield to any address without linking it to your original deposit.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: "Battle-Tested Protocols",
    description: "We only integrate with audited, high-TVL protocols like Jito ($2B+) and Kamino ($1B+).",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function PrivateYieldPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-whale-500/20 border border-whale-500/30 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-whale-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-whale-500"></span>
          </span>
          <span className="text-sm font-medium text-whale-400">Coming Soon</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Private Yield
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Earn yield on your shielded assets without revealing your position size, wallet address, or strategy.
        </p>
      </motion.div>

      {/* Value Proposition */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card gradient className="overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">
                  The Problem with DeFi Yield
                </h2>
                <p className="text-gray-400 mb-4">
                  Today, earning yield on Solana means exposing everything. Your deposit amount, wallet address, and strategy are all visible on-chain. Competitors can copy your moves. MEV bots can front-run you. Adversaries know exactly how much you hold.
                </p>
                <p className="text-gray-300 font-medium">
                  Private Yield changes that. Your funds earn yield while staying completely private.
                </p>
              </div>
              <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-whale-500/20 to-purple-500/20 flex items-center justify-center">
                <svg className="w-24 h-24 text-whale-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* How It Works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold text-white text-center">How It Works</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Shield Your Assets",
              description: "Deposit SOL into WhaleVault's shielded pools using zero-knowledge proofs.",
            },
            {
              step: "2",
              title: "Earn Private Yield",
              description: "Your funds join an aggregate pool that earns yield from protocols like Jito.",
            },
            {
              step: "3",
              title: "Withdraw Anonymously",
              description: "Withdraw principal + yield to any wallet without revealing your identity.",
            },
          ].map((item, i) => (
            <Card key={i}>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-whale-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-whale-400">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold text-white text-center">Privacy Features</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map((feature, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-whale-400 shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Supported Protocols */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-6"
      >
        <h2 className="text-2xl font-bold text-white text-center">Yield Protocols</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {YIELD_PROTOCOLS.map((protocol) => (
            <Card key={protocol.id} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                    {protocol.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{protocol.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${protocol.statusColor}`}>
                      {protocol.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-4">{protocol.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-500">APY</span>
                    <p className="text-white font-semibold">{protocol.apy}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500">Risk</span>
                    <p className={`font-semibold ${protocol.riskColor}`}>{protocol.risk}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card gradient>
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Get Early Access
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Private Yield is currently in development. Start by shielding your assets today — you&apos;ll be ready to earn private yield as soon as it launches.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/shield">
                <Button size="lg">
                  Shield Assets Now
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg">
                  View Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Technical Details */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center text-sm text-gray-500"
      >
        <p>
          Private Yield uses a share-based accounting system with encrypted position tracking.
          <br />
          All user data is encrypted client-side before storage.
          <br />
          <Link href="https://github.com/whalevault/whalevault" target="_blank" rel="noopener noreferrer" className="text-whale-400 hover:text-whale-300">
            View Technical Documentation
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
