"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTokenList } from "@/hooks/useTokenList";
import type { FeaturedToken } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface TokenSelectorProps {
  selectedToken: FeaturedToken | null;
  onSelect: (token: FeaturedToken) => void;
  disabled?: boolean;
}

export function TokenSelector({ selectedToken, onSelect, disabled }: TokenSelectorProps) {
  const { tokens, featuredTokens, loading, searchQuery, setSearchQuery } = useTokenList();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function handleSelect(token: FeaturedToken) {
    onSelect(token);
    setIsOpen(false);
    setSearchQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected token display / trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
          selectedToken
            ? "border-terminal-green bg-terminal-green/10"
            : "border-border bg-bg-card hover:border-terminal-dark",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer"
        )}
      >
        {selectedToken ? (
          <div className="flex items-center gap-3">
            <TokenIcon token={selectedToken} />
            <div className="text-left">
              <div className="font-medium text-white">{selectedToken.symbol}</div>
              <div className="text-sm text-text-dim">{selectedToken.name}</div>
            </div>
          </div>
        ) : (
          <span className="text-text-dim">Select output token</span>
        )}
        <ChevronIcon open={isOpen} />
      </button>

      {/* Featured chips (always visible) */}
      {!isOpen && featuredTokens.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {featuredTokens.map((token) => (
            <button
              key={token.mint}
              onClick={() => !disabled && handleSelect(token)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all",
                selectedToken?.mint === token.mint
                  ? "border-terminal-green bg-terminal-green/20 text-white"
                  : "border-border bg-bg-card text-text hover:border-terminal-dark hover:text-white",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <TokenIcon token={token} size="sm" />
              {token.symbol}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl border border-border bg-bg shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="p-3 border-b border-border">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, symbol, or address..."
                className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-white text-sm placeholder-text-muted focus:outline-none focus:border-terminal-green"
              />
            </div>

            {/* Token list */}
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-text-dim">Loading tokens...</span>
                </div>
              ) : tokens.length === 0 ? (
                <div className="text-center py-8 text-sm text-text-muted">
                  No tokens found
                </div>
              ) : (
                tokens.map((token) => (
                  <button
                    key={token.mint}
                    onClick={() => handleSelect(token)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      selectedToken?.mint === token.mint
                        ? "bg-terminal-green/10"
                        : "hover:bg-terminal-green/5"
                    )}
                  >
                    <TokenIcon token={token} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white">{token.symbol}</div>
                      <div className="text-xs text-text-muted truncate">{token.name}</div>
                    </div>
                    <div className="text-xs text-text-muted font-mono truncate max-w-[100px]">
                      {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TokenIcon({ token, size = "md" }: { token: FeaturedToken; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-5 h-5" : "w-8 h-8";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (token.logoUri) {
    return (
      <TokenLogoWithFallback token={token} dim={dim} textSize={textSize} />
    );
  }

  return (
    <div className={`${dim} rounded-full bg-bg-card flex items-center justify-center`}>
      <span className={`${textSize} font-bold text-white`}>
        {token.symbol.charAt(0)}
      </span>
    </div>
  );
}

function TokenLogoWithFallback({ token, dim, textSize }: { token: FeaturedToken; dim: string; textSize: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${dim} rounded-full bg-bg-card flex items-center justify-center`}>
        <span className={`${textSize} font-bold text-white`}>{token.symbol.charAt(0)}</span>
      </div>
    );
  }

  return (
    <img
      src={token.logoUri!}
      alt={token.symbol}
      className={`${dim} rounded-full`}
      onError={() => setFailed(true)}
    />
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-text-dim transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
