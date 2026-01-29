"use client";

import { motion } from "framer-motion";

interface ProofAnimationProps {
  progress: number;
  stage: string | null;
}

export function ProofAnimation({ progress, stage }: ProofAnimationProps) {
  const particleCount = Math.floor(progress / 10);
  const circumference = 2 * Math.PI * 56;

  return (
    <div className="relative w-full h-48 rounded-xl bg-gradient-to-br from-terminal-green/10 to-terminal-dark/10 border border-border overflow-hidden">
      {/* Central orb glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-terminal-green to-terminal-dark blur-xl" />
      </motion.div>

      {/* Inner rotating ring */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-16 h-16 rounded-full border-2 border-terminal-green/50 border-t-terminal-green" />
      </motion.div>

      {/* Orbiting particles */}
      {Array.from({ length: particleCount }).map((_, i) => {
        const angle = i * 36 * (Math.PI / 180);
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-terminal-green"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: Math.cos(angle) * 60,
              y: Math.sin(angle) * 60,
              opacity: [0, 1, 0.5],
              scale: [0, 1, 0.5],
            }}
            transition={{
              duration: 2,
              delay: i * 0.1,
              repeat: Infinity,
            }}
          />
        );
      })}

      {/* Progress ring */}
      <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32">
        <circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
        />
        <motion.circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          stroke="url(#proof-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (circumference * progress) / 100 }}
          transition={{ duration: 0.5 }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
        <defs>
          <linearGradient id="proof-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00a088" />
            <stop offset="100%" stopColor="#006858" />
          </linearGradient>
        </defs>
      </svg>

      {/* Text overlay */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <div className="text-2xl font-bold text-white">{progress}%</div>
        {stage && (
          <div className="text-sm text-text-dim capitalize">
            {stage.replace(/_/g, " ")}
          </div>
        )}
      </div>
    </div>
  );
}
