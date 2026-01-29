"use client";

import { forwardRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-terminal-green text-bg border-none hover:shadow-[0_0_30px_rgba(0,160,136,0.4)] hover:-translate-y-0.5",
  secondary:
    "bg-transparent text-text-dim border border-border hover:border-terminal-dark hover:text-terminal-green",
  outline:
    "bg-transparent text-terminal-green border border-terminal-green hover:bg-terminal-green hover:text-bg",
  ghost:
    "bg-transparent text-text-dim hover:text-terminal-green hover:bg-terminal-green/5",
  danger:
    "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      onClick,
      type = "button",
    },
    ref
  ) {
    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={onClick}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        className={cn(
          "inline-flex items-center justify-center font-mono text-sm transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-terminal-green/50 focus:ring-offset-2 focus:ring-offset-bg",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
      >
        {loading && (
          <svg
            className="absolute left-1/2 -translate-x-1/2 h-4 w-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className={cn(loading && "invisible")}>{children}</span>
      </motion.button>
    );
  }
);
