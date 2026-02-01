"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface TransactionModalProps {
  isOpen: boolean;
  progress: number;
  stage: string | null;
  title?: string;
  subtitle?: string;
}

const STAGE_INFO: Record<string, { icon: string; description: string; tip: string }> = {
  deriving: {
    icon: "🔐",
    description: "Deriving cryptographic secret",
    tip: "Sign the message in your wallet",
  },
  requesting: {
    icon: "📡",
    description: "Requesting proof generation",
    tip: "Connecting to prover network",
  },
  generating: {
    icon: "⚡",
    description: "Generating zero-knowledge proof",
    tip: "This ensures your privacy",
  },
  relaying: {
    icon: "🚀",
    description: "Relayer submitting transaction",
    tip: "Your wallet stays anonymous",
  },
  confirming: {
    icon: "⛓️",
    description: "Confirming on Solana",
    tip: "Waiting for block finality",
  },
  executing: {
    icon: "⚙️",
    description: "Executing transaction",
    tip: "Processing on-chain",
  },
  swapping: {
    icon: "🔄",
    description: "Performing token swap",
    tip: "Converting your tokens",
  },
  unshielding: {
    icon: "🛡️",
    description: "Unshielding position",
    tip: "Exiting the privacy pool",
  },
  building_route: {
    icon: "🗺️",
    description: "Building optimal route",
    tip: "Finding best swap path",
  },
};

function getStageInfo(stage: string | null) {
  if (!stage) return STAGE_INFO.deriving;
  const key = Object.keys(STAGE_INFO).find((k) => stage.toLowerCase().includes(k));
  return key ? STAGE_INFO[key] : { icon: "⏳", description: stage, tip: "Processing..." };
}

export function TransactionModal({
  isOpen,
  progress,
  stage,
  title = "Processing Transaction",
  subtitle,
}: TransactionModalProps) {
  const [dots, setDots] = useState("");
  const stageInfo = getStageInfo(stage);

  // Animated dots
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Blurred backdrop */}
          <motion.div
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(16px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-black/80"
          />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-terminal-green/40"
                initial={{
                  x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                  y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 20,
                }}
                animate={{
                  y: -20,
                  x: `+=${Math.sin(i) * 100}`,
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 4 + i * 0.5,
                  repeat: Infinity,
                  delay: i * 0.8,
                  ease: "linear",
                }}
              />
            ))}
          </div>

          {/* Modal content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md mx-4"
          >
            {/* Card */}
            <div
              className="bg-bg/95 border border-terminal-green/30 rounded-2xl p-8 shadow-2xl backdrop-blur-sm"
              style={{ boxShadow: "0 0 100px rgba(0, 160, 136, 0.2), 0 0 40px rgba(0, 160, 136, 0.1)" }}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <motion.h2
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-heading text-terminal-green tracking-wide"
                  style={{ textShadow: "0 0 30px rgba(0, 160, 136, 0.5)" }}
                >
                  {title}
                </motion.h2>
                {subtitle && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-white font-mono text-lg mt-2"
                  >
                    {subtitle}
                  </motion.p>
                )}
              </div>

              {/* Central animated orb */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  {/* Outer pulse ring */}
                  <motion.div
                    className="absolute rounded-full border-2 border-terminal-green/30"
                    style={{ width: 140, height: 140, left: -30, top: -30 }}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 0, 0.3],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />

                  {/* Second pulse ring */}
                  <motion.div
                    className="absolute rounded-full border border-terminal-green/20"
                    style={{ width: 120, height: 120, left: -20, top: -20 }}
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.2, 0, 0.2],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  />

                  {/* Gradient glow */}
                  <motion.div
                    className="absolute rounded-full"
                    style={{
                      width: 100,
                      height: 100,
                      left: -10,
                      top: -10,
                      background: "radial-gradient(circle, rgba(0, 160, 136, 0.4) 0%, transparent 70%)",
                    }}
                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />

                  {/* Main orb */}
                  <motion.div
                    className="relative w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, rgba(0, 160, 136, 0.15) 0%, rgba(0, 80, 68, 0.3) 100%)",
                      border: "2px solid rgba(0, 160, 136, 0.6)",
                    }}
                    animate={{
                      boxShadow: [
                        "0 0 30px rgba(0, 160, 136, 0.3), inset 0 0 20px rgba(0, 160, 136, 0.1)",
                        "0 0 50px rgba(0, 160, 136, 0.5), inset 0 0 30px rgba(0, 160, 136, 0.2)",
                        "0 0 30px rgba(0, 160, 136, 0.3), inset 0 0 20px rgba(0, 160, 136, 0.1)",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {/* Spinning outer ring */}
                    <motion.div
                      className="absolute inset-1 rounded-full border-2 border-transparent"
                      style={{
                        borderTopColor: "#00a088",
                        borderRightColor: "rgba(0, 160, 136, 0.2)",
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Counter-spinning inner ring */}
                    <motion.div
                      className="absolute inset-3 rounded-full border border-transparent"
                      style={{
                        borderBottomColor: "rgba(0, 160, 136, 0.5)",
                        borderLeftColor: "rgba(0, 160, 136, 0.2)",
                      }}
                      animate={{ rotate: -360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Stage icon */}
                    <motion.span
                      key={stageInfo.icon}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-2xl z-10"
                    >
                      {stageInfo.icon}
                    </motion.span>
                  </motion.div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs font-mono text-text-dim mb-2">
                  <span>Progress</span>
                  <span className="text-terminal-green">{progress}%</span>
                </div>
                <div className="h-2 bg-bg-card rounded-full overflow-hidden border border-border">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, #00a088 0%, #00d4aa 50%, #00a088 100%)",
                      backgroundSize: "200% 100%",
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${progress}%`,
                      backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
                    }}
                    transition={{
                      width: { duration: 0.5, ease: "easeOut" },
                      backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" },
                    }}
                  />
                </div>
              </div>

              {/* Stage info */}
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-bg-card/50 border border-border rounded-xl p-4 mb-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg">{stageInfo.icon}</span>
                  <span className="text-white font-medium text-sm">
                    {stageInfo.description}{dots}
                  </span>
                </div>
                <p className="text-text-dim text-xs pl-8">{stageInfo.tip}</p>
              </motion.div>

              {/* Terminal-style status */}
              <div className="font-mono text-xs text-text-dim bg-black/30 rounded-lg p-3 border border-border/50">
                <div className="flex items-center gap-2">
                  <motion.span
                    className="text-terminal-green"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    {">"}
                  </motion.span>
                  <span className="text-terminal-green/80">
                    {stage ? stage.replace(/_/g, " ").toLowerCase() : "initializing"}
                  </span>
                  <motion.span
                    className="text-terminal-green"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    _
                  </motion.span>
                </div>
              </div>

              {/* Warning text */}
              <p className="text-center text-text-muted text-xs mt-4">
                Do not close this window or navigate away
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
