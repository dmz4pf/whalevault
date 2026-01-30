"use client";

import { motion } from "framer-motion";

interface TransactionProgressProps {
  progress: number;
  stage: string | null;
}

const STAGES = [
  { key: "deriving", label: "Deriving", icon: "🔐" },
  { key: "preparing", label: "Preparing", icon: "📦" },
  { key: "signing", label: "Signing", icon: "✍️" },
  { key: "confirming", label: "Confirming", icon: "⛓️" },
];

export function TransactionProgress({ progress, stage }: TransactionProgressProps) {
  // Determine current stage index
  const getCurrentStageIndex = () => {
    if (!stage) return 0;
    const stageLower = stage.toLowerCase();
    if (stageLower.includes("deriv")) return 0;
    if (stageLower.includes("prepar") || stageLower.includes("request")) return 1;
    if (stageLower.includes("sign") || stageLower.includes("generat")) return 2;
    if (stageLower.includes("confirm") || stageLower.includes("relay")) return 3;
    return Math.floor(progress / 25);
  };

  const currentIndex = getCurrentStageIndex();

  return (
    <div className="w-full py-8">
      {/* Animated orb */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          {/* Outer glow rings */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(0, 160, 136, 0.3) 0%, transparent 70%)",
              width: 120,
              height: 120,
              left: -20,
              top: -20,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Main orb */}
          <motion.div
            className="relative w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(0, 160, 136, 0.2) 0%, rgba(0, 100, 80, 0.3) 100%)",
              border: "2px solid rgba(0, 160, 136, 0.5)",
              boxShadow: "0 0 40px rgba(0, 160, 136, 0.3), inset 0 0 20px rgba(0, 160, 136, 0.1)",
            }}
            animate={{
              boxShadow: [
                "0 0 40px rgba(0, 160, 136, 0.3), inset 0 0 20px rgba(0, 160, 136, 0.1)",
                "0 0 60px rgba(0, 160, 136, 0.5), inset 0 0 30px rgba(0, 160, 136, 0.2)",
                "0 0 40px rgba(0, 160, 136, 0.3), inset 0 0 20px rgba(0, 160, 136, 0.1)",
              ],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Spinning ring inside */}
            <motion.div
              className="absolute inset-2 rounded-full border-2 border-transparent"
              style={{
                borderTopColor: "#00a088",
                borderRightColor: "rgba(0, 160, 136, 0.3)",
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            {/* Percentage */}
            <span className="text-terminal-green font-mono text-lg font-bold z-10">
              {progress}%
            </span>
          </motion.div>
        </div>
      </div>

      {/* Stage steps */}
      <div className="flex items-center justify-between px-4 mb-6">
        {STAGES.map((s, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={s.key} className="flex flex-col items-center flex-1">
              {/* Connector line (except first) */}
              {index > 0 && (
                <div className="absolute" style={{ width: "calc(100% / 4 - 20px)", left: `calc(${(index - 0.5) * 25}% - 10px)`, top: 8 }}>
                  <div className={`h-0.5 transition-colors duration-500 ${isComplete ? "bg-terminal-green" : "bg-border"}`} />
                </div>
              )}

              {/* Step circle */}
              <motion.div
                className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                  isComplete
                    ? "bg-terminal-green/20 border-2 border-terminal-green text-terminal-green"
                    : isActive
                    ? "bg-terminal-green/10 border-2 border-terminal-green text-terminal-green"
                    : "bg-bg-card border-2 border-border text-text-muted"
                }`}
                animate={isActive ? {
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(0, 160, 136, 0)",
                    "0 0 0 8px rgba(0, 160, 136, 0.2)",
                    "0 0 0 0 rgba(0, 160, 136, 0)",
                  ],
                } : {}}
                transition={{
                  duration: 1.5,
                  repeat: isActive ? Infinity : 0,
                  ease: "easeInOut",
                }}
              >
                {isComplete ? (
                  <span className="text-terminal-green">✓</span>
                ) : (
                  <span className={isActive ? "" : "opacity-50"}>{s.icon}</span>
                )}
              </motion.div>

              {/* Label */}
              <span className={`mt-2 text-xs font-mono transition-colors duration-300 ${
                isComplete || isActive ? "text-terminal-green" : "text-text-muted"
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current stage text */}
      <div className="text-center">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-sm text-text-dim"
        >
          <span className="text-terminal-green animate-pulse mr-2">{">"}</span>
          {stage ? stage.replace(/_/g, " ").toLowerCase() : "initializing..."}
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            _
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}
