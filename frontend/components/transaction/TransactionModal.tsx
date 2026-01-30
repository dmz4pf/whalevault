"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TransactionProgress } from "./TransactionProgress";

interface TransactionModalProps {
  isOpen: boolean;
  progress: number;
  stage: string | null;
  title?: string;
  subtitle?: string;
}

export function TransactionModal({
  isOpen,
  progress,
  stage,
  title = "Processing Transaction",
  subtitle,
}: TransactionModalProps) {
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
            animate={{ backdropFilter: "blur(12px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 bg-black/70"
          />

          {/* Modal content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-lg mx-4"
          >
            {/* Card */}
            <div className="bg-bg/95 border border-terminal-green/30 rounded-2xl p-8 shadow-2xl"
              style={{ boxShadow: "0 0 80px rgba(0, 160, 136, 0.15)" }}
            >
              {/* Header */}
              <div className="text-center mb-2">
                <h2
                  className="text-2xl font-heading text-terminal-green tracking-wide"
                  style={{ textShadow: "0 0 30px rgba(0, 160, 136, 0.5)" }}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-white font-mono text-lg mt-2">{subtitle}</p>
                )}
              </div>

              {/* Step-based progress animation */}
              <TransactionProgress progress={progress} stage={stage} />

              {/* Status text */}
              <div className="text-center">
                <p className="text-text-muted text-xs">
                  Do not close this window
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
