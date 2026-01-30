"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { TerminalTyping } from "@/components/effects/TerminalTyping";

const features = [
  {
    number: "01",
    title: "shield()",
    description:
      "Deposit tokens into the privacy pool. Zero-knowledge proofs sever all connections to your identity.",
    command: "$ whalevault shield --amount 10 SOL",
  },
  {
    number: "02",
    title: "stealth_withdraw()",
    description:
      "Generate fresh stealth addresses for each withdrawal. Funds arrive without origin, without history.",
    command: "$ whalevault withdraw --stealth --to [addr]",
  },
  {
    number: "03",
    title: "private_swap()",
    description:
      "Exchange tokens within the shielded pool. No MEV, no surveillance, no trace.",
    command: "$ whalevault swap --from SOL --to USDC --private",
  },
];

const stats = [
  { value: "$847M", label: "TOTAL SHIELDED" },
  { value: "42,589", label: "USERS" },
  { value: "156,204", label: "TRANSACTIONS" },
  { value: "2.3s", label: "FINALITY" },
];

export default function LandingPage() {
  const { connected } = useWallet();
  const statsRef = useScrollReveal({ threshold: 0.15, once: false });
  const feature1Ref = useScrollReveal<HTMLDivElement>({ threshold: 0.15, once: false });
  const feature2Ref = useScrollReveal<HTMLDivElement>({ threshold: 0.15, once: false });
  const feature3Ref = useScrollReveal<HTMLDivElement>({ threshold: 0.15, once: false });
  const featureRefs = [feature1Ref, feature2Ref, feature3Ref];
  const ctaRef = useScrollReveal({ threshold: 0.15, once: false });

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center py-20 overflow-hidden">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Hero Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col justify-center"
          >
            {/* Brand */}
            <h1 className="font-heading text-4xl md:text-5xl lg:text-[52px] font-bold tracking-[10px] mb-6">
              <span className="text-white">WHALE</span>
              <span className="text-terminal-green" style={{ textShadow: "0 0 30px rgba(0, 160, 136, 0.5)" }}>
                VAULT
              </span>
            </h1>

            {/* Label */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4 mb-8"
            >
              <span className="w-12 h-px bg-terminal-dark" />
              <span className="font-heading text-xs tracking-[4px] text-text-dim">
                PRIVACY_PROTOCOL
              </span>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="font-heading text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight mb-6"
            >
              Where money
              <br />
              becomes{" "}
              <span className="text-terminal-green" style={{ textShadow: "0 0 30px rgba(0, 160, 136, 0.4)" }}>
                invisible
              </span>
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-text-dim text-base md:text-lg leading-loose max-w-md mb-10"
            >
              Zero-knowledge proofs on Solana. Shield your assets in complete
              darkness. Transact without trace. Exist without evidence.
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-start gap-4"
            >
              <Link href="/dashboard">
                <Button size="lg" className="min-w-[180px] font-mono tracking-wider">
                  ./launch-app
                </Button>
              </Link>
              <Link href="https://docs.whalevault.io" target="_blank">
                <Button variant="outline" size="lg" className="min-w-[180px] font-mono tracking-wider">
                  ./read-docs
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right: Terminal Window */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center"
          >
            <div className="w-full max-w-xl bg-bg-card border border-border rounded-xl overflow-hidden shadow-[0_0_80px_rgba(0,160,136,0.08)]">
              {/* Terminal Header */}
              <div className="px-5 py-4 bg-bg-elevated border-b border-border flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full bg-terminal-green"
                  style={{ boxShadow: "0 0 8px #00a088" }}
                />
                <span className="ml-auto text-text-dim text-xs tracking-wide">
                  whalevault@solana:~
                </span>
              </div>

              {/* Terminal Body */}
              <div className="p-6">
                <TerminalTyping connected={connected} />

                {/* Terminal Actions - only show when not connected */}
                {!connected && (
                  <div className="flex items-center gap-3 mt-6 pt-5 border-t border-dashed border-border">
                    <span className="text-terminal-green">$</span>
                    <Link href="/shield">
                      <button className="font-mono bg-transparent border border-terminal-green text-terminal-green px-5 py-2.5 text-xs cursor-pointer transition-all hover:bg-terminal-green hover:text-bg tracking-wide" style={{ textShadow: "0 0 5px #00a088" }}>
                        ./connect-wallet
                      </button>
                    </Link>
                    <Link href="https://docs.whalevault.io" target="_blank">
                      <button className="font-mono bg-transparent border border-border text-text-dim px-5 py-2.5 text-xs cursor-pointer transition-all hover:border-text-muted hover:text-text tracking-wide">
                        ./read-docs
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20 mb-16 items-end">
          <div className="font-heading text-[13px] text-white uppercase tracking-[3px]">
            CORE SYSTEMS
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-normal text-text">
            The Protocol
          </h2>
        </div>

        {/* Features List */}
        <div className="border-t border-border">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              ref={featureRefs[index]}
              className={`reveal stagger-${index + 1} grid grid-cols-1 md:grid-cols-[80px_200px_1fr] gap-4 md:gap-12 py-10 border-b border-border transition-all hover:pl-4 hover:bg-terminal-green/[0.02]`}
            >
              {/* Number */}
              <span className="font-heading text-lg text-text-dim">
                {feature.number}
              </span>

              {/* Title */}
              <span className="font-heading text-xl md:text-2xl text-terminal-green flex items-center gap-2">
                <span className="text-terminal-dark font-mono">$</span> {feature.title}
              </span>

              {/* Content */}
              <div className="flex flex-col gap-4">
                <p className="text-text-dim text-sm leading-relaxed max-w-lg">
                  {feature.description}
                </p>
                <code className="text-xs text-terminal-dark bg-black/40 px-3 py-2 w-fit">
                  {feature.command}
                </code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaRef} className="py-20 reveal">
        <div className="bg-bg-card border border-border rounded-xl p-10 md:p-16 text-center relative overflow-hidden">
          {/* Subtle glow overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-terminal-green/[0.03] to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="font-heading text-[13px] text-white uppercase tracking-[3px] mb-6">
              GET STARTED
            </div>
            <h2 className="font-heading text-2xl md:text-3xl font-semibold text-white mb-4">
              Ready to Go Private?
            </h2>
            <p className="text-text-dim text-base md:text-lg mb-10 max-w-lg mx-auto">
              Connect your wallet and start shielding your assets in seconds.
              Zero-knowledge privacy awaits.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/shield">
                <Button size="lg" className="min-w-[200px] font-mono tracking-wider">
                  ./start-shielding
                </Button>
              </Link>
              <Link href="https://docs.whalevault.io" target="_blank">
                <Button variant="outline" size="lg" className="min-w-[200px] font-mono tracking-wider">
                  ./documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-border">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div
            className="text-lg text-terminal-green"
            style={{ textShadow: "0 0 15px rgba(0, 160, 136, 0.3)" }}
          >
            {">"} whalevault
          </div>
          <div className="flex gap-12">
            {[
              { label: "DOCS", href: "https://docs.whalevault.io" },
              { label: "GITHUB", href: "https://github.com" },
              { label: "DISCORD", href: "https://discord.com" },
              { label: "TWITTER", href: "https://twitter.com" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-heading text-xs tracking-[2px] uppercase text-white hover:text-terminal-green transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
